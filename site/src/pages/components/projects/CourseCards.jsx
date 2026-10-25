/* eslint-disable no-return-assign */
import { COURSES } from '@src/lib';
import Link from 'next/link';
import CourseBadge from '@src/components/courseBadge/CourseBadge';
import clsx from 'clsx';
import { entryFor } from '@src/pages/components/useDesk';
import { gsap } from 'gsap';
import { scrollRoot } from '@src/utils/scrollRoot';
import styles from '@src/pages/components/projects/styles/projects.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useStill from '@src/hooks/useStill';
import { useStore } from '@src/store';
import { useWindowSize } from '@darkroom.engineering/hamo';

// The original stacked project cards (home "Selected Projects" and the /projects
// index), one per course. The original photos are replaced by the shared Desk
// palette: the full-card layer is a solid menu-colour panel over
// the dark shader (.4 -> .85 on hover, as the photo was), and the small frame
// is a fill-colour panel with the course code in the bold display face.
const NO_DEADLINES = 'No upcoming deadlines';

function kickerFor(course, entry, ready) {
  if (!ready) return course.term;
  const next = entry?.next;
  // "Section 24 · Tue 4:00 PM lab · VIC305" -> "Section 24"
  const section = entry?.section ? String(entry.section).split(' · ')[0] : null;
  return [section, next ? `Next: ${next.dateLabel || next.when}` : NO_DEADLINES].filter(Boolean).join(' · ');
}

function CourseCards({ desk }) {
  const isMobile = useIsMobile();
  const still = useStill();
  const windowSize = useWindowSize();
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));

  const rootRef = useRef();
  const cardRefs = useRef([]);

  // Each card's panel stays put while its card scrolls past and the next card
  // slides over it (the original scrub). Motion off: the panels simply scroll.
  const setupCardAnimations = () => {
    const ctx = gsap.context(() => {
      if (!isLoading && !still) {
        cardRefs.current.slice(0, -1).forEach((cardRef, index) => {
          gsap.set(cardRef, { yPercent: 0 });
          gsap
            .timeline({
              scrollTrigger: {
                id: `courseCard-index-${index}`,
                trigger: rootRef.current,
                start: `top+=${windowSize.height * index}`,
                end: () => `+=${(cardRefs.current.length - 1) * windowSize.height}`,
                scrub: true,
                scroller: scrollRoot(),
                invalidateOnRefresh: true,
              },
            })
            .to(cardRef, {
              yPercent: 100,
              stagger: 1,
            });
        });
      }
    });

    return ctx;
  };

  useIsomorphicLayoutEffect(() => {
    const ctx = setupCardAnimations();
    return () => ctx.kill();
  }, [isLoading, windowSize.height, still]);

  const last = COURSES.length - 1;

  return (
    <section ref={rootRef} className={clsx(styles.root, styles.rootIndex, 'layout-block-inner')}>
      <div className={styles.innerContainer}>
        {COURSES.map((course, index) => {
          const { palette } = course;
          return (
            <Link
              data-badge-clip
              aria-label={course.ariaLabel}
              key={course.id}
              scroll={false}
              href={course.href}
              className={clsx(styles.card)}
              style={{ '--card-menu': palette.menuColor, '--card-fill': palette.fillColor, '--card-ink': palette.primary }}
            >
              <div
                style={
                  !isMobile
                    ? {
                        height: index === last ? '200svh' : `${200 + 100 * index}svh`,
                        top: index === 0 ? '0px' : '-100svh',
                      }
                    : {
                        height: index === last ? '100svh' : `${200 + 100 * index}svh`,
                        top: index === 0 ? '0px' : '-50svh',
                      }
                }
                className={styles.projectsWrap}
              >
                <div className={clsx(styles.container, 'layout-grid-inner')}>
                  <div className={styles.projectsDetails}>
                    <p className="h6">{kickerFor(course, entryFor(desk, course.id), desk?.ready)}</p>
                    <h2 className="h3">
                      {course.code} — {course.name}
                    </h2>
                    <p className={clsx('p-l', styles.summary)}>{course.summary}</p>
                  </div>
                  <div className={styles.imageContainer} aria-hidden="true">
                    <CourseBadge instanceId={`directory-${course.id}`} courseId={course.id} next={entryFor(desk, course.id)?.next} ready={desk?.ready} />
                  </div>
                </div>
              </div>
              <div ref={(el) => (cardRefs.current[index] = el)} className={clsx(styles.canvas, index === 0 && styles.firstCard, index === last && styles.lastCard)} data-surface="dark" data-badge-backing />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default CourseCards;
