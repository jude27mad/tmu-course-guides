import Link from 'next/link';
import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import useStill from '@src/hooks/useStill';
import useSelectionMotion from './useSelectionMotion';
import styles from './workspace.module.scss';

const groups = [
  ['pastDue', 'Past due · not marked done'],
  ['thisWeek', 'This week'],
  ['nextWeek', 'Next week'],
  ['later', 'Later & undated'],
  ['done', 'Marked done by you'],
];
const matches = (filter, key) => filter === 'all' || (filter === 'done' ? key === 'done' : key !== 'done');
const resultKey = (assignments, filter) =>
  groups
    .filter(([key]) => matches(filter, key))
    .flatMap(([key]) => assignments?.[key].map((entry) => entry.id) || [])
    .join(',');

export default function Work({ assignments, filter, navigate }) {
  const { courseId, info, progress } = useCourse();
  const still = useStill();
  const filtersRef = useRef(null);
  const selectionRef = useRef(null);
  const resultsRef = useRef(null);
  const reveal = useRef(false);
  const [visibleFilter, setVisibleFilter] = useState(filter);
  const requestedRows = resultKey(assignments, filter);
  const visibleRows = resultKey(assignments, visibleFilter);
  useSelectionMotion(filtersRef, selectionRef, filter, '[aria-pressed="true"]');

  useIsomorphicLayoutEffect(() => {
    const results = resultsRef.current;
    gsap.killTweensOf(results);
    const reset = () => {
      results.inert = false;
      results.removeAttribute('aria-busy');
      gsap.set(results, { clearProps: 'opacity,willChange' });
    };
    // Identical sets (Open/All before any completion) stay readable. The moving
    // selection and live summary still acknowledge the change immediately.
    if (visibleFilter === filter) {
      results.inert = false;
      results.removeAttribute('aria-busy');
      if (reveal.current && !still) gsap.to(results, { opacity: 1, duration: 0.18, ease: 'power2.out', onComplete: reset });
      else reset();
      reveal.current = false;
    } else if (still || requestedRows === visibleRows) {
      reveal.current = false;
      reset();
      setVisibleFilter(filter);
    } else {
      reveal.current = false;
      results.inert = true;
      results.setAttribute('aria-busy', 'true');
      gsap.set(results, { willChange: 'opacity' });
      gsap.to(results, {
        opacity: 0,
        duration: 0.12,
        ease: 'power2.inOut',
        onComplete: () => {
          reveal.current = true;
          setVisibleFilter(filter);
        },
      });
    }
    return () => gsap.killTweensOf(results);
  }, [filter, visibleFilter, requestedRows, visibleRows, still]);

  const content = info.items || info.assessments;
  const count = assignments?.entries.length || content.length;
  const done = assignments?.done.length || 0;
  let summary = `${count - done} open ${count - done === 1 ? 'assignment' : 'assignments'}`;
  if (filter === 'all') summary = `All ${count} assignments · ${done} marked done`;
  if (filter === 'done') summary = `${done} ${done === 1 ? 'assignment' : 'assignments'} marked done`;
  return (
    <>
      <div className={styles.viewHeading}>
        <h2>Work</h2>
        <div ref={filtersRef} className={styles.workFilters} role="group" aria-label="Filter assignments" data-work-filters>
          <span ref={selectionRef} className={styles.selection} data-filter-selection aria-hidden="true" />
          {[
            ['open', 'Open', count - done],
            ['all', 'All', count],
            ['done', 'Done', done],
          ].map(([value, label, number]) => (
            <button
              id={`work-filter-${value}`}
              type="button"
              key={value}
              aria-controls="work-results"
              aria-pressed={filter === value}
              onClick={() => {
                if (filter !== value) navigate(value === 'open' ? 'work' : `work/${value}`);
              }}
            >
              {label} ({number})
            </button>
          ))}
        </div>
      </div>
      <p className={styles.workSummary} data-work-summary role="status" aria-live="polite" aria-atomic="true">
        {summary}
      </p>
      <div ref={resultsRef} id="work-results" className={styles.workResults} data-work-results>
        {!assignments ? (
          <p role="status">Loading your work…</p>
        ) : (
          groups
            .filter(([key]) => matches(visibleFilter, key))
            .map(([key, heading]) => {
              const rows = assignments[key];
              if (!rows.length) return null;
              return (
                <div key={key} className={styles.workGroup}>
                  <h3 className={styles.groupTitle}>
                    {heading} <span>{rows.length}</span>
                  </h3>
                  <ul className={styles.workList}>
                    {rows.map((entry) => {
                      const item = content.find((candidate) => candidate.id === entry.id);
                      const { lead } = entry;
                      let status = 'Open';
                      if (entry.recorded) status = `${entry.recorded}/${entry.records.length} recorded`;
                      if (entry.done) status = 'Marked done';
                      const ticks = progress.tickCount(courseId, entry.id);
                      return (
                        <li key={entry.id}>
                          <Link id={`open-${entry.anchor}`} href={`/${courseId}/#${entry.anchor}`} scroll={false} className={styles.workRow} data-assignment-link>
                            <span className={styles.rowMain}>
                              <span className={styles.rowTitle}>{entry.title}</span>
                              <span className={styles.meta}>{[item.who, item.weightLabel].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span className={styles.rowDate}>
                              {lead?.dateLabel || 'Date pending'}
                              <span className={styles.meta}>{lead?.timeLabel || lead?.cta || 'Check D2L'}</span>
                            </span>
                            <span className={styles.rowStatus}>
                              {status}
                              <span className={styles.meta}>{ticks.total ? `${ticks.checked}/${ticks.total} prepared` : 'View requirements'}</span>
                            </span>
                            <span className={styles.rowArrow} aria-hidden="true">
                              ↗
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
        )}
        {assignments && (visibleFilter === 'done' ? !done : visibleFilter === 'open' && done === count) ? (
          <div className={styles.workEmpty} data-work-empty>
            <h3>{visibleFilter === 'done' ? 'No assignments marked done yet' : 'All assignments are marked done'}</h3>
            <p>{visibleFilter === 'done' ? 'Open an assignment and mark its submission records done.' : 'You can still review your requirements, notes and records.'}</p>
            <button type="button" onClick={() => navigate(visibleFilter === 'done' ? 'work' : 'work/all')}>
              {visibleFilter === 'done' ? 'View open work' : 'View all work'} <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
