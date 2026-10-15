import { Fragment, useRef } from 'react';

import AppearByWords from '@src/components/animationComponents/appearByWords/Index';
import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import CheckRow from '@src/pages/course/components/CheckRow';
import CourseArtwork from '@src/components/courseArtwork/CourseArtwork';
import RecordActions from '@src/pages/course/components/RecordActions';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import clsx from 'clsx';
import { gsap } from 'gsap';
import styles from '@src/pages/course/components/checklist/styles/checklist.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useShallow } from 'zustand/react/shallow';
import useStill from '@src/hooks/useStill';
import { useStore } from '@src/store';
import { useWindowSize } from '@darkroom.engineering/hamo';

// The original Process section (pinned artwork window on the left, sliding
// sideways as you scroll; category list on the right), carrying this week's
// checklist: one category per item due this week, one real checkbox per
// preparation step, and MARK DONE / UNDO kept apart from the ticks.
function Checklist() {
  const { courseId, live, progress, copy } = useCourse();
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));
  const isMobile = useIsMobile();
  const still = useStill();
  const windowSize = useWindowSize();

  const rightContainerRef = useRef();
  const leftContainerRef = useRef();
  const categoriesRef = useRef([]);
  const shapesRef = useRef([]);

  const list = live?.week || null;
  // One placeholder category keeps the window and its artwork when nothing is due.
  const entries = list && list.length ? list : [null];
  const count = entries.length;

  useIsomorphicLayoutEffect(() => {
    const vw = (coef) => windowSize.width * (coef / 100);

    const ctx = gsap.context(() => {
      if (!isMobile && !isLoading) {
        ScrollTrigger.create({
          id: 'course-checklist',
          trigger: rightContainerRef.current,
          start: 'top',
          end: `bottom-=${vw(30)}`,
          pin: leftContainerRef.current,
          scrub: true,
          scroller: document?.querySelector('main'),
          invalidateOnRefresh: true,
          pinSpacing: false,
        });

        const last = count - 1;
        const duration = still ? 0 : 1;
        shapesRef.current.slice(0, count).forEach((shapeRef, index) => {
          if (!shapeRef) return;
          gsap.set(shapeRef, { xPercent: -100 });
          gsap.timeline({
            scrollTrigger: {
              trigger: categoriesRef.current[index],
              start: index === 0 ? 'top-=500%' : 'top center',
              end: 'bottom center',
              id: `course-checklist-${index}`,
              scroller: document?.querySelector('main'),
              onEnter: () => {
                if (index === 0) {
                  gsap.set(shapeRef, { xPercent: 0 });
                } else {
                  gsap.set(shapeRef, { xPercent: -100, overwrite: true });
                  gsap.to(shapeRef, { xPercent: 0, duration, ease: 'bounce.out' });
                }
              },
              onLeave: () => {
                if (index === last) {
                  gsap.set(shapeRef, { xPercent: 0 });
                } else {
                  gsap.to(shapeRef, { xPercent: 100, duration, ease: 'power1.out' });
                }
              },
              onEnterBack: () => {
                if (index !== last) {
                  gsap.set(shapeRef, { xPercent: -100, overwrite: true });
                  gsap.to(shapeRef, { xPercent: 0, duration, ease: 'bounce.out' });
                }
              },
              onLeaveBack: () => {
                if (index !== 0 || count > 1) gsap.to(shapeRef, { xPercent: 100, duration, ease: 'power1.out' });
              },
              invalidateOnRefresh: true,
            },
          });
        });
      }
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getById('course-checklist')?.kill();
    };
  }, [isMobile, isLoading, windowSize.width, still, count]);

  const title = "This week's work";

  return (
    <section id={courseId === 'cen100' ? 'study' : undefined} className={clsx(styles.root, 'layout-block-inner')}>
      <div className={styles.topContainer}>
        <h2 className={clsx(styles.text, 'h1')}>
          <AppearByWords>{title}</AppearByWords>
        </h2>
      </div>

      <div className={styles.processContainer}>
        <div ref={leftContainerRef} className={styles.leftContainer}>
          {!isMobile ? (
            <>
              {entries.map((entry, index) => (
                <div key={`checklist-shape-${entry ? entry.itemId : 'empty'}`} className={styles.shapesContainer}>
                  <div
                    ref={(el) => {
                      shapesRef.current[index] = el;
                    }}
                    className={styles.shape}
                  >
                    <CourseArtwork courseId={courseId} className={styles.artwork} sizes="(max-width: 800px) 100vw, 40vw" />
                  </div>
                </div>
              ))}
            </>
          ) : null}
          <div className={styles.spacing} />
        </div>

        <div ref={rightContainerRef} className={styles.rightContainer}>
          {entries.map((entry, index) => {
            const counts = entry ? progress.tickCount(courseId, entry.item || entry.itemId) : null;
            let countLine = '';
            if (entry && counts?.total) countLine = courseId === 'cen100' ? `${counts.checked}/${counts.total}` : copy.counts.prepared(counts.checked, counts.total);
            return (
              <div
                ref={(el) => {
                  categoriesRef.current[index] = el;
                }}
                key={entry ? entry.itemId : 'empty'}
                className={styles.category}
              >
                {isMobile ? (
                  <div className={styles.shape}>
                    <CourseArtwork courseId={courseId} className={styles.artwork} sizes="(max-width: 800px) 100vw, 40vw" />
                  </div>
                ) : null}

                <div className={styles.innerContainer}>
                  {entry ? (
                    <>
                      <AppearTitle key={entry.itemId}>
                        <h3 className="h6">{entry.title}</h3>
                      </AppearTitle>
                      <div className={styles.desc}>
                        <p className="p-l">{[list.week?.label, [entry.dateLabel, entry.timeLabel].filter(Boolean).join(' · ')].filter(Boolean).join(' — ')}</p>
                        {countLine ? <p className={clsx('p-x', styles.meta)}>{countLine}</p> : null}
                      </div>
                      <ul className={styles.options} aria-label={`${entry.title}: checklist`}>
                        {entry.steps.map((step, stepIndex) => (
                          <Fragment key={step.id}>
                            {step.group && step.group !== entry.steps[stepIndex - 1]?.group ? (
                              <li className={clsx('p-x', styles.group)} aria-hidden="true">
                                {step.group}
                              </li>
                            ) : null}
                            <CheckRow checked={step.checked} disabled={!progress.ready} onChange={(value) => progress.toggleTick(courseId, entry.item || entry.itemId, step.id, value)}>
                              {step.group ? <span className="sr-only">{`${step.group}: `}</span> : null}
                              {step.text}
                            </CheckRow>
                          </Fragment>
                        ))}
                      </ul>
                      <div className={styles.records}>
                        {entry.records.map((record) => (
                          <div key={record.id} className={styles.record}>
                            {entry.records.length > 1 ? <p className={clsx('p-x', styles.meta)}>{[record.title, record.dateLabel].filter(Boolean).join(' · ')}</p> : null}
                            <RecordActions record={record} className={styles.actions} />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="h6">{list?.week?.label || ' '}</h3>
                      {live ? <p className="p-l">Nothing scheduled</p> : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Checklist;
