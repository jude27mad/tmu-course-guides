import { useMemo, useRef } from 'react';

import MagicBall from '@src/pages/course/components/magicball/MagicBall';
import clsx from 'clsx';
import { gsap } from 'gsap';
import styles from '@src/pages/course/components/hero/styles/hero.module.scss';
import { useCourse } from '@src/pages/course/hooks/useCourseState';
import useIsMobile from '@src/hooks/useIsMobile';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import useStill from '@src/hooks/useStill';
import { useWindowSize } from '@darkroom.engineering/hamo';

// The original /about Hero (white title at the bottom of a window, parallax), set in
// his home hero's paper frame so the header sits on paper. His photo is
// replaced by his own 3D vocabulary: a MagicBall marble in the course palette,
// labelled with the course code, over the dark shader.
function Hero() {
  const { course, info } = useCourse();
  const rootRef = useRef();
  const windowSize = useWindowSize();
  const isMobile = useIsMobile();
  const still = useStill();
  const heroBallRef = useRef();

  const mainScroller = useMemo(() => {
    if (typeof window !== 'undefined') {
      return document.querySelector('main');
    }
    return null;
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (still) return undefined;
    const ctx = gsap.context(() => {
      gsap.set(heroBallRef.current, { yPercent: !isMobile ? -10 : 0 });
      gsap.to(heroBallRef.current, {
        yPercent: 20,
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          scroller: mainScroller,
          invalidateOnRefresh: true,
        },
      });
    });
    return () => ctx.revert();
  }, [windowSize.height, isMobile, still]);

  const context = info.page?.context || `${course.code} · ${course.term}`;
  const { palette } = course;

  return (
    <section ref={rootRef} className={styles.root}>
      <div className={styles.window}>
        <div className={styles.wrapper}>
          <div ref={heroBallRef} className={styles.ballContainer}>
            <MagicBall className={styles.ball} viewClassName={styles.view} isSphere color={palette.menuColor} label={course.code} palette={palette} roughness={isMobile ? 0.5 : 0.4} />
          </div>
        </div>
        <header className={styles.titleContainer}>
          <p className={clsx(styles.context, 'h6')}>{context}</p>
          <h1 className={clsx(styles.title, 'h2')}>{info.title || course.title}</h1>
        </header>
      </div>
    </section>
  );
}

export default Hero;
