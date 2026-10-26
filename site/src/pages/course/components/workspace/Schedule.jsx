import { Component, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { calendarEvents } from '@src/lib';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import useDelayedFeedback from '@src/hooks/useDelayedFeedback';
import styles from './workspace.module.scss';
import calendarStyles from './calendar.module.scss';

class CalendarBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    const { failed } = this.state;
    const { children } = this.props;
    return failed ? <p role="status">Calendar unavailable — every date is in the list below.</p> : children;
  }
}
function CalendarLoading({ error }) {
  const showLoading = useDelayedFeedback(error ? null : 'calendar');
  if (error) throw error;
  return showLoading ? <p role="status">Loading calendar… Dates are available below.</p> : null;
}

const Calendar = dynamic(() => import('./Calendar'), {
  ssr: false,
  loading: CalendarLoading,
});

export default function Schedule({ navigate, state, setState }) {
  const { courseId, live } = useCourse();
  const root = useRef(null);
  const [wide, setWide] = useState(false);
  const { choice, range, day, selectedDate } = state;
  const events = useMemo(() => calendarEvents(courseId, live?.items || []), [courseId, live]);
  useEffect(() => {
    if (!root.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= 700));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const mode = choice || (wide ? 'calendar' : 'agenda');
  const items =
    live?.items.filter((item) => {
      if (day) return item.date === day || (item.week && item.week <= day && item.target?.weekEnd >= day);
      return range === 'all' || !item.passed;
    }) || [];
  const selectDay = (value) => {
    setState((previous) => ({ ...previous, day: value, range: 'all' }));
    document.getElementById('schedule-agenda')?.focus({ preventScroll: true });
  };
  return (
    <div ref={root}>
      <div className={styles.viewHeading}>
        <h2>Schedule</h2>
        <div className={styles.filters}>
          {['agenda', 'calendar'].map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => setState((previous) => ({ ...previous, choice: value }))}>
              {value === 'agenda' ? 'Agenda' : 'Calendar'}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.intro}>Times are in Toronto. Quiz weeks and lab windows keep their published precision.</p>
      {mode === 'calendar' ? (
        <CalendarBoundary>
          <Calendar events={events} navigate={navigate} onDate={selectDay} selectedDate={selectedDate} onSelectedDate={(value) => setState((previous) => ({ ...previous, selectedDate: value }))} />
        </CalendarBoundary>
      ) : null}
      <div id="schedule-agenda" tabIndex={-1} className={calendarStyles.agenda}>
        <div className={styles.viewHeading}>
          <h3>{day ? `Dates for ${day}` : 'Deadline list'}</h3>
          <div className={styles.filters}>
            {[
              ['upcoming', 'Upcoming'],
              ['all', 'All dates'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={!day && range === value}
                onClick={() => {
                  setState((previous) => ({ ...previous, day: null, range: value }));
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {!live ? <p role="status">Loading deadlines…</p> : null}
        {live && !items.length ? <p>No deadlines in this view. Use All dates to review earlier work.</p> : null}
        <ul className={styles.workList}>
          {items.map((item) => {
            const event = events.find((candidate) => candidate.rowId === item.id);
            return (
              <li key={item.id}>
                <Link id={`schedule-${courseId}-${item.id}`} href={`/${courseId}/#${item.anchor}`} scroll={false} className={calendarStyles.agendaRow} data-schedule-link>
                  <span>
                    <span className={styles.rowTitle}>{event?.title || item.title}</span>
                    <span className={styles.meta}>{[event?.qualifier, item.target?.note, item.cta].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span>
                    {item.dateLabel || 'Date pending'}
                    <span className={styles.meta}>{item.timeLabel || (item.precision === 'pending' ? 'Check D2L' : item.label)}</span>
                    <span className={styles.meta}>{item.done ? 'Marked done by you' : [item.overdue && 'Past due · not marked done'].filter(Boolean).join('')}</span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
