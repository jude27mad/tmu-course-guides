import { AssessmentBody, CenBody, TopicBody } from '@src/pages/course/components/cards/ItemCards';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import styles from './workspace.module.scss';

export default function AssignmentDetail({ item, kind, assignments, back, returnView }) {
  const { info, courseId } = useCourse();
  const entry = assignments?.entries.find((row) => row.id === item.id);
  const returnLabel = {
    work: 'Work',
    schedule: 'Schedule',
    study: 'Study',
    info: 'Course info',
  }[returnView];
  return (
    <article id={item.anchor} className={styles.detail} tabIndex={-1} data-assignment-detail>
      <button type="button" onClick={back} className={styles.back}>
        ← Back to {returnLabel}
      </button>
      <div className={styles.detailHeading}>
        <p className={styles.eyebrow}>{kind === 'topic' ? 'Study' : [item.who, item.weightLabel].filter(Boolean).join(' · ')}</p>
        <h2>{item.name || item.title}</h2>
        {kind === 'topic' ? <p>{item.sub}</p> : null}
        {entry?.pastDue && !entry.done ? <p className={styles.status}>Past due · not marked done</p> : null}
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
                  {row.label ? <span>{row.label}</span> : null}
                  {row.target?.note ? <span>{row.target.note}</span> : null}
                  {row.cta ? <span>{row.cta}</span> : null}
                  {row.markable ? <span className={styles.meta}>{row.done ? 'Marked done by you' : [row.overdue && 'Past due', 'not marked done'].filter(Boolean).join(' · ')}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>{item.timing || 'Date pending · check D2L'}</p>
          )}
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
