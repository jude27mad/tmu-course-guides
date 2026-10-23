// Initialize Temporal before evaluating Schedule-X.
// eslint-disable-next-line import/extensions, import/order
import { Temporal } from './calendarTemporal.mjs';
import '@schedule-x/theme-default/dist/index.css';
import { useEffect, useRef, useState } from 'react';
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react';
import { createViewMonthAgenda, createViewMonthGrid } from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
import styles from './calendar.module.scss';
// eslint-disable-next-line import/extensions
import { toScheduleXEvent } from './calendarAdapter.mjs';

export default function Calendar({ events, navigate, onDate, selectedDate, onSelectedDate }) {
  const root = useRef(null);
  const callbacks = useRef({ navigate, onDate, onSelectedDate });
  callbacks.current = { navigate, onDate, onSelectedDate };
  const [eventsService] = useState(() => createEventsServicePlugin());
  const [controls] = useState(() => createCalendarControlsPlugin());
  const calendar = useCalendarApp({
    views: [createViewMonthGrid(), createViewMonthAgenda()],
    timezone: 'America/Toronto',
    locale: 'en-US',
    firstDayOfWeek: 1,
    selectedDate: selectedDate ? Temporal.PlainDate.from(selectedDate) : Temporal.Now.plainDateISO('America/Toronto'),
    events: events.map(toScheduleXEvent),
    plugins: [eventsService, controls],
    calendars: {
      due: { colorName: 'due', lightColors: { main: '#28282b', container: '#f2ffbd', onContainer: '#28282b' } },
      done: { colorName: 'done', lightColors: { main: '#28282b', container: '#f0f4f1', onContainer: '#28282b' } },
    },
    callbacks: {
      onEventClick: (event) => callbacks.current.navigate(event.anchor),
      onClickPlusEvents: (date) => callbacks.current.onDate(date.toString()),
      onClickDate: (date) => callbacks.current.onDate(date.toString()),
      onSelectedDateUpdate: (date) => callbacks.current.onSelectedDate(date.toString()),
    },
  });
  useEffect(() => {
    if (calendar) eventsService.set(events.map(toScheduleXEvent));
  }, [calendar, events, eventsService]);
  useEffect(() => {
    if (!calendar || !root.current) return undefined;
    let lastView;
    const observer = new ResizeObserver(([entry]) => {
      const view = entry.contentRect.width < 700 ? 'month-agenda' : 'month-grid';
      if (view !== lastView) {
        lastView = view;
        controls.setView(view);
      }
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [calendar, controls]);
  return (
    <div ref={root} className={styles.calendar} data-lenis-prevent data-course-calendar>
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
