import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { openPicker, useCourse } from '@src/pages/course/hooks/useCourseState';

import AppearByWords from '@src/components/animationComponents/appearByWords/Index';
import AppearTitle from '@src/components/animationComponents/appearTitle/Index';
import Arrow from '@src/components/imageComponents/Arrow';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import HoverText, { dimPage, hidePortal, showPortal } from '@src/pages/course/components/portal/HoverText';
import MagicBall from '@src/pages/course/components/magicball/MagicBall';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import clsx from 'clsx';
import { countdown } from '@src/lib';
import { gsap } from 'gsap';
import styles from '@src/pages/course/components/deadlines/styles/deadlines.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useShallow } from 'zustand/react/shallow';
import useStill from '@src/hooks/useStill';
import { useStore } from '@src/store';
import { useWindowSize } from '@darkroom.engineering/hamo';

// The original Services section (pinned MagicBall window + category list + hover
// Portal), carrying the deadlines: one category per time bucket, one option
// per deadline with its countdown. Desktop hover shows the Portal; a tap or
// Enter opens the details inline under the row (phones never get the page dim).
const BUCKETS = [
  { key: 'thisWeek', title: 'This week', ball: 'NOW' },
  { key: 'nextWeek', title: 'Next week', ball: 'NEXT' },
  { key: 'later', title: 'Later', ball: 'LATER' },
];

const finePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

function Details({ item, now }) {
  const { markDone, undo, pendingUndo } = useCourse();
  const time = countdown(item, now);
  return (
    <div className={styles.details}>
      <p className="p-l">{[item.when || item.dateLabel, item.label].filter(Boolean).join(' · ')}</p>
      {time.status && time.status !== time.label ? <p className="p-l">{time.status}</p> : null}
      <p className={clsx('p-x', styles.meta)}>{[item.who, item.weightLabel].filter(Boolean).join(' · ')}</p>
      {item.requirement ? <p className="p-l">{item.requirement}</p> : null}
      {item.detail && item.detail !== item.requirement ? <p className={clsx('p-x', styles.meta)}>{item.detail}</p> : null}
      <div className={styles.actions}>
        {item.cta ? <ButtonLink onClick={openPicker} label={item.cta.toUpperCase()} /> : null}
        <ButtonLink href={`#${item.anchor}`} label="VIEW REQUIREMENTS" ariaLabel={`View requirements for ${item.title}`} />
        {item.markable && !item.done && pendingUndo !== item.id ? <ButtonLink onClick={() => markDone(item.id)} label="MARK DONE" ariaLabel={`Mark ${item.title} done`} /> : null}
        {pendingUndo === item.id ? <ButtonLink onClick={undo} label="UNDO" /> : null}
      </div>
    </div>
  );
}

const Other = memo(({ setPortals, groups, now, palette, sectionRef }) => {
  const [isLoading] = useStore(useShallow((state) => [state.isLoading]));
  const isMobile = useIsMobile();
  const still = useStill();
  const [open, setOpen] = useState(null);

  const rightContainerRef = useRef();
  const leftContainerRef = useRef();
  const categoriesRef = useRef([]);
  const shapesRef = useRef([]);
  const titlesRef = useRef({});
  const windowSize = useWindowSize();
  const colors = [palette.menuColor, palette.fluidColor, palette.primary];

  useIsomorphicLayoutEffect(() => {
    const vw = (coef) => windowSize.width * (coef / 100);

    const ctx = gsap.context(() => {
      if (!isMobile && !isLoading) {
        ScrollTrigger.create({
          id: 'course-deadlines',
          trigger: rightContainerRef.current,
          start: 'top',
          end: `bottom-=${vw(30)}`,
          pin: leftContainerRef.current,
          scrub: true,
          scroller: document?.querySelector('main'),
          invalidateOnRefresh: true,
          pinSpacing: false,
        });

        const last = BUCKETS.length - 1;
        shapesRef.current.forEach((shapeRef, index) => {
          if (!shapeRef) return;
          gsap.set(shapeRef, { yPercent: -100 });
          const duration = still ? 0 : 1;
          gsap.timeline({
            scrollTrigger: {
              trigger: categoriesRef.current[index],
              start: index === 0 ? 'top-=500%' : 'top center',
              end: 'bottom center',
              id: `course-deadlines-${index}`,
              scroller: document?.querySelector('main'),
              onEnter: () => {
                if (index === 0) {
                  gsap.set(shapeRef, { yPercent: 0 });
                } else {
                  gsap.set(shapeRef, { yPercent: -100, overwrite: true });
                  gsap.to(shapeRef, { yPercent: 0, duration, ease: 'bounce.out' });
                }
              },
              onLeave: () => {
                if (index === last) {
                  gsap.set(shapeRef, { yPercent: 0 });
                } else {
                  gsap.to(shapeRef, { yPercent: 100, duration, ease: 'power1.out' });
                }
              },
              onEnterBack: () => {
                if (index !== last) {
                  gsap.set(shapeRef, { yPercent: -100, overwrite: true });
                  gsap.to(shapeRef, { yPercent: 0, duration, ease: 'bounce.out' });
                }
              },
              onLeaveBack: () => {
                gsap.to(shapeRef, { yPercent: 100, duration, ease: 'power1.out' });
              },
              invalidateOnRefresh: true,
            },
          });
        });
      }
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getById('course-deadlines')?.kill();
    };
  }, [isMobile, isLoading, windowSize.width, still]);

  // Never leave the page dimmed (route change, data change under the pointer).
  useEffect(() => () => dimPage(false, sectionRef.current), [sectionRef]);

  const handleEnter = useCallback(
    (event, item) => {
      if (event.pointerType !== 'mouse' || !finePointer()) return;
      const title = titlesRef.current[item.id];
      if (title) gsap.to(title, { color: '#28282b', duration: 0.35, ease: 'none' });
      dimPage(true, sectionRef.current);
      showPortal(setPortals, item.id, [item.title, [item.when || item.dateLabel, item.weightLabel].filter(Boolean).join(' · '), item.requirement].filter(Boolean));
    },
    [setPortals, sectionRef],
  );

  const handleLeave = useCallback(
    (event, item) => {
      const title = titlesRef.current[item.id];
      if (title) gsap.to(title, { color: 'unset', duration: 0.35, ease: 'none' });
      dimPage(false, sectionRef.current);
      hidePortal(setPortals, item.id);
    },
    [setPortals, sectionRef],
  );

  return (
    <>
      <div className={styles.topContainer}>
        <h2 className={clsx(styles.text, 'h1')}>
          <AppearByWords>Assignments</AppearByWords>
        </h2>
      </div>

      <div className={styles.servicesContainer}>
        <div ref={leftContainerRef} className={styles.leftContainer}>
          {!isMobile ? (
            <>
              {BUCKETS.map((bucket, index) => (
                <div key={`deadlines-shape-${bucket.key}`} className={styles.shapesContainer}>
                  <div
                    ref={(el) => {
                      shapesRef.current[index] = el;
                    }}
                    className={styles.shape}
                  >
                    <MagicBall isSphere color={colors[index]} label={bucket.ball} palette={palette} roughness={0.4} className={styles.ball} viewClassName={styles.view} />
                  </div>
                </div>
              ))}
            </>
          ) : null}
          <div className={styles.spacing} />
        </div>

        <div ref={rightContainerRef} className={styles.rightContainer}>
          {groups.map((group, index) => (
            <div
              ref={(el) => {
                categoriesRef.current[index] = el;
              }}
              key={group.key}
              className={styles.category}
            >
              {isMobile ? (
                <div className={styles.shape}>
                  <MagicBall isSphere color={colors[index]} label={group.ball} palette={palette} roughness={0.5} className={styles.ball} viewClassName={styles.view} />
                </div>
              ) : null}

              <div className={styles.innerContainer}>
                <AppearTitle>
                  <h3 className="h6">{group.title}</h3>
                </AppearTitle>
                {now && !group.items.length ? <p className="p-l">Nothing scheduled</p> : null}
                <ul className={styles.options}>
                  {group.items.map((item) => {
                    const isOpen = open === item.id;
                    const time = countdown(item, now);
                    return (
                      <li key={item.id} id={`deadline-${item.id}`} className={clsx(styles.option, item.overdue && styles.overdue)}>
                        <button
                          type="button"
                          className={styles.optionButton}
                          aria-expanded={isOpen}
                          aria-controls={`deadline-details-${item.id}`}
                          onClick={() => setOpen(isOpen ? null : item.id)}
                          onPointerEnter={(event) => handleEnter(event, item)}
                          onPointerLeave={(event) => handleLeave(event, item)}
                        >
                          <Arrow className={clsx(styles.arrow, isOpen && styles.arrowOpen)} />
                          <span
                            className={clsx('p-l', styles.optionTitle)}
                            ref={(el) => {
                              titlesRef.current[item.id] = el;
                            }}
                          >
                            {item.title}
                          </span>
                          <span className={clsx('p-x', styles.countdown)}>{time.label}</span>
                        </button>
                        <div id={`deadline-details-${item.id}`} hidden={!isOpen}>
                          {isOpen ? <Details item={item} now={now} /> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
});

function Deadlines() {
  const { live, course } = useCourse();
  const [portals, setPortals] = useState([]);
  const sectionRef = useRef(null);
  const groups = BUCKETS.map((bucket) => ({ ...bucket, items: live?.buckets?.[bucket.key] || [] }));

  return (
    <section ref={sectionRef} id="assignments" className={clsx(styles.root, 'layout-block-inner')}>
      <Other setPortals={setPortals} groups={groups} now={live?.now || null} palette={course.palette} sectionRef={sectionRef} />
      <HoverText portals={portals} className={styles.hoverTextContainer} textClassName={styles.hoverText} />
    </section>
  );
}

export default Deadlines;
