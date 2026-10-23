import Link from 'next/link';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import styles from './workspace.module.scss';

const groups = [
  ['pastDue', 'Past due · not marked done'],
  ['thisWeek', 'This week'],
  ['nextWeek', 'Next week'],
  ['later', 'Later & undated'],
  ['done', 'Marked done by you'],
];
export default function Work({ assignments, filter, navigate }) {
  const { courseId, info, progress } = useCourse();
  const content = info.items || info.assessments;
  const count = assignments?.entries.length || content.length;
  const done = assignments?.done.length || 0;
  return (
    <>
      <div className={styles.viewHeading}>
        <h2>Work</h2>
        <div className={styles.filters} aria-label="Filter assignments">
          {[
            ['open', 'Open', count - done],
            ['all', 'All', count],
            ['done', 'Done', done],
          ].map(([value, label, number]) => (
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => navigate(value === 'open' ? 'work' : `work/${value}`)}>
              {label} ({number})
            </button>
          ))}
        </div>
      </div>
      {!assignments ? (
        <p role="status">Loading your work…</p>
      ) : (
        groups
          .filter(([key]) => filter === 'all' || (filter === 'done' ? key === 'done' : key !== 'done'))
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
      {assignments && (filter === 'done' ? !done : filter === 'open' && done === count) ? (
        <p className={styles.empty}>{filter === 'done' ? 'No assignments marked done yet.' : 'All assignments are marked done. Use All to review them.'}</p>
      ) : null}
    </>
  );
}
