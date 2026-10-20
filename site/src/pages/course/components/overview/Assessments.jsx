import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import Link from 'next/link';
import { assessments } from '@src/lib';
import clsx from 'clsx';
import styles from '@src/pages/course/components/overview/styles/overview.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import { useMemo } from 'react';

// The original /about Overview (h3 title lines, a small label, a column of lines),
// carrying the graded assessments with their weights and dates.
function Assessments() {
  const { courseId, info, section } = useCourse();
  const rows = useMemo(() => assessments(courseId, { section }), [courseId, section]);
  const cen = courseId === 'cen100';
  const grading = info.grading || info.page?.grading || {};

  let titleLines;
  if (cen) {
    const [head, tail] = String(grading.summary || '').split(/:\s*/);
    titleLines = tail ? [`${head}:`, tail] : [grading.summary];
  } else {
    titleLines = [grading.heading || grading.summary, grading.pass].filter(Boolean);
  }
  const table = cen ? grading.tables?.[1] : null;
  const categories = cen ? grading.tables?.[0] : null;

  return (
    <section id="course-grading" className={clsx(styles.root, 'layout-grid-inner')}>
      <div className={styles.title}>
        <AppearTitle key={`grading-${courseId}`}>
          {titleLines.map((line) => (
            <h2 key={line} className="h3">
              {line}
            </h2>
          ))}
        </AppearTitle>
      </div>
      <div className={clsx(styles.text, 'p-l', styles.myStory)}>
        <AppearTitle key={`grading-label-${courseId}`}>
          <span>Assessments</span>
        </AppearTitle>
      </div>
      <div className={styles.desc}>
        {table ? (
          <div className={clsx(styles.rowHead, 'p-x')} aria-hidden="true">
            <span>{table.columns[0]}</span>
            <span />
            <span>{table.columns[1]}</span>
          </div>
        ) : null}
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={`${row.title}-${row.ids.join('-')}`} className={styles.row}>
              <Link scroll={false} href={`#${row.anchor}`} className={clsx('h6', styles.rowTitle)}>
                {row.title}
              </Link>
              <span className={clsx('p-l', styles.rowDate)}>{row.dateLabel}</span>
              <span className={clsx('h6', styles.rowWeight)}>{row.weightLabel}</span>
            </li>
          ))}
          {table?.total?.length ? (
            <li className={clsx(styles.row, styles.rowTotal)}>
              <span className="h6">{table.total[0]}</span>
              <span />
              <span className={clsx('h6', styles.rowWeight)}>{table.total[1]}</span>
            </li>
          ) : null}
        </ul>

        {rows.categories ? (
          <ul className={clsx(styles.rows, styles.paddingTop)}>
            {rows.categories.map((category) => (
              <li key={category.title} className={styles.row}>
                <span className="h6">{category.title}</span>
                <span />
                <span className={clsx('h6', styles.rowWeight)}>{`${category.weight}%`}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {grading.quizPolicy ? <p className={clsx('p-l', styles.paddingTop)}>{grading.quizPolicy}</p> : null}

        {categories ? (
          <>
            <h3 className={clsx('h6', styles.paddingTop)}>{categories.label}</h3>
            <ul className={styles.rows}>
              {categories.rows.map((row) => (
                <li key={row.label} className={clsx(styles.row, styles.rowWide)}>
                  <span className="p-l">{row.label}</span>
                  <span className={clsx('h6', styles.rowWeight)}>{row.weight}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {cen
          ? (grading.notes || []).map((note) => (
              <p key={note} className={clsx('p-l', styles.paddingTop)}>
                {note}
              </p>
            ))
          : null}
      </div>
    </section>
  );
}

export default Assessments;
