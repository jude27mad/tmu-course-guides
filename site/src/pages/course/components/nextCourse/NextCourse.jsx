import { COURSES, nextDeadline } from '@src/lib';

import AppearByWords from '@src/components/animationComponents/appearByWords/Index';
import Link from 'next/link';
import clsx from 'clsx';
import styles from '@src/pages/course/components/nextCourse/styles/nextCourse.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import { useMemo } from 'react';

// The original NextProject: one 100svh window card to the next course
// (CEN100 -> MTH140 -> MTH141 -> CEN100). His project images become solid
// panels in the next course's own palette, with the original typography.
function NextCourse() {
  const { courseId, live } = useCourse();
  const index = COURSES.findIndex((course) => course.id === courseId);
  const next = COURSES[(index + 1) % COURSES.length];
  const upcoming = useMemo(() => (live ? nextDeadline({ now: live.now, courseId: next.id }) : null), [live, next.id]);
  const { palette } = next;
  const vars = {
    '--cardMenu': palette.menuColor,
    '--cardMenuFont': palette.menuFontColor,
    '--cardFill': palette.fillColor,
    '--cardInk': palette.primary,
  };

  return (
    <>
      <section className={clsx(styles.titleContainer, 'layout-block-inner')}>
        <h2 className={clsx(styles.title, 'h1')}>
          <AppearByWords>Next course</AppearByWords>
        </h2>
      </section>
      <section className={clsx(styles.nextRoot, 'layout-block-inner')} style={vars}>
        <div className={styles.innerContainer}>
          <Link aria-label={next.ariaLabel} scroll={false} href={next.href} className={clsx(styles.card)}>
            <div className={styles.projectsWrap}>
              <div className={clsx(styles.container, 'layout-grid-inner')}>
                <div className={styles.projectsDetails}>
                  <p className={clsx(styles.text, 'h6')}>{upcoming ? [upcoming.dateLabel, upcoming.title].filter(Boolean).join(' · ') : next.term}</p>
                  <p className={clsx(styles.text, 'h3')}>{`${next.code} ${next.name}`}</p>
                </div>
                <div className={styles.imageContainer} aria-hidden="true">
                  <span className={clsx('h1', 'bold', styles.panelCode)}>{next.code}</span>
                  <span className={clsx('p-l', styles.panelName)}>{next.title}</span>
                </div>
              </div>
            </div>

            <div className={styles.canvas} aria-hidden="true">
              <span className={clsx('bold', styles.canvasCode)}>{next.code}</span>
            </div>
          </Link>
        </div>
      </section>
    </>
  );
}

export default NextCourse;
