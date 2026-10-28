import { AssessmentBody, CenBody, TopicBody } from '@src/pages/course/components/cards/ItemCards';
import { useState } from 'react';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import { isSitting, passedWord } from './sittings';
import styles from './workspace.module.scss';

export default function AssignmentDetail({ item, kind, assignments, back, returnView }) {
  const { info, courseId, progress } = useCourse();
  // Records can also be marked beside their dates; the completion boxes further down stay in step.
  const [recorded, setRecorded] = useState({ id: null, text: '' });
  const record = (row) => {
    const result = progress.setDone(courseId, row.id, !row.done);
    setRecorded({ id: item.id, text: result.message || '' });
  };
  const entry = assignments?.entries.find((row) => row.id === item.id);
  const returnLabel = {
    work: 'Work',
    schedule: 'Schedule',
    study: 'Study',
    info: 'Course info',
  }[returnView];
  return (
    <article id={`course-view-${item.anchor}`} className={styles.detail} tabIndex={-1} data-assignment-detail>
      <button type="button" onClick={back} className={styles.back}>
        ← Back to {returnLabel}
      </button>
      <div className={styles.detailHeading}>
        <p className={styles.eyebrow}>{kind === 'topic' ? 'Study' : [item.who, item.weightLabel].filter(Boolean).join(' · ')}</p>
        <h2>{item.name || item.title}</h2>
        {kind === 'topic' ? <p>{item.sub}</p> : null}
        {entry?.group === 'pastDue' ? <p className={styles.status}>{passedWord(courseId, entry.lead)} · not marked done</p> : null}
        {entry?.missed && entry.group !== 'pastDue' && !entry.done ? (
          <p className={styles.status}>
            {entry.missed} earlier {entry.missed === 1 ? 'part' : 'parts'} past due · not marked done
          </p>
        ) : null}
        {entry?.done ? <p className={styles.status}>Marked done by you</p> : null}
      </div>
      {kind !== 'topic' ? (
        <div className={styles.dates}>
          <h3>Dates & submissions</h3>
          {entry?.rows.length ? (
            <ul>
              {entry.rows.map((row) => (
                <li key={row.id}>
                  <strong>{row.title}</strong>
                  <span>{[row.dateLabel || 'Date pending', row.timeLabel].filter(Boolean).join(' · ')}</span>
                  {row.label && !(row.overdue && isSitting(courseId, row)) ? <span>{row.label}</span> : null}
                  {row.target?.note ? <span>{row.target.note}</span> : null}
                  {row.cta ? <span>{row.cta}</span> : null}
                  {row.markable ? (
                    <span className={styles.meta}>{row.done ? 'Marked done by you' : [row.overdue && passedWord(courseId, row), 'not marked done'].filter(Boolean).join(' · ')}</span>
                  ) : null}
                  {row.markable ? (
                    <button
                      type="button"
                      className={styles.markRow}
                      disabled={!progress.ready}
                      onClick={() => record(row)}
                      aria-label={`${row.done ? 'Mark not done' : 'Mark done'}: ${row.title}`}
                      data-mark-row={row.id}
                    >
                      {row.done ? 'Mark not done' : 'Mark done'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>{item.timing || 'Date pending · check D2L'}</p>
          )}
          <p className={styles.meta} role="status">
            {recorded.id === item.id ? recorded.text : ''}
          </p>
        </div>
      ) : null}
      <div className={styles.detailBody} key={`${courseId}-${item.id}`}>
        {kind === 'cen' ? <CenBody item={item} /> : null}
        {kind === 'assessment' ? <AssessmentBody item={item} /> : null}
        {kind === 'topic' ? <TopicBody item={item} review={info.review} /> : null}
      </div>
      <button type="button" onClick={back} className={styles.back}>
        ← Back to {returnLabel}
      </button>
    </article>
  );
}
