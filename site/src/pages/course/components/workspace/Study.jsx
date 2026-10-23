import Link from 'next/link';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import styles from './workspace.module.scss';

export default function Study() {
  const { courseId, info, progress } = useCourse();
  const total = info.topics.reduce((sum, item) => sum + item.skills.length, 0);
  const checked = info.topics.reduce((sum, item) => sum + progress.tickCount(courseId, item.id).checked, 0);
  return (
    <>
      <div className={styles.viewHeading}>
        <h2>Study</h2>
        <p>
          {checked}/{total} skills checked
        </p>
      </div>
      <p className={styles.intro}>Choose a topic for skills and recommended practice.</p>
      <ul className={styles.workList}>
        {info.topics.map((item) => (
          <li key={item.id}>
            <Link id={`open-${item.anchor}`} href={`/${courseId}/#${item.anchor}`} scroll={false} className={styles.studyRow}>
              <span>
                <span className={styles.rowTitle}>{item.title}</span>
                <span className={styles.meta}>{item.sub}</span>
              </span>
              <span>
                {progress.tickCount(courseId, item.id).checked}/{item.skills.length} checked
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
