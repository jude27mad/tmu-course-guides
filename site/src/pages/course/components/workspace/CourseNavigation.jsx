import { useCallback, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import useStill from '@src/hooks/useStill';
import styles from './workspace.module.scss';

// This is decoration only. Links/history remain owned by useCourseNavigation.
export default function CourseNavigation({ courseId, views, selectedView, acknowledge }) {
  const navRef = useRef(null);
  const selectionRef = useRef(null);
  const position = useRef(null);
  const still = useStill();

  const align = useCallback(
    (animate) => {
      const nav = navRef.current;
      const selection = selectionRef.current;
      const link = nav?.querySelector('[aria-current="page"]');
      if (!link || !selection) return;
      const next = { x: link.offsetLeft, y: link.offsetTop, width: link.offsetWidth, height: link.offsetHeight };
      const previous = position.current;
      gsap.killTweensOf(selection);
      if (!animate || still || !previous) {
        gsap.set(selection, { ...next, opacity: 1 });
      } else if (Math.abs(previous.y - next.y) > 1) {
        // Wrapped rows never send the highlight travelling across other labels.
        gsap.set(selection, { ...next, opacity: 0 });
        gsap.to(selection, { opacity: 1, duration: 0.12, ease: 'power2.out' });
      } else {
        gsap.to(selection, { ...next, opacity: 1, duration: 0.2, ease: 'power2.out' });
      }
      position.current = next;
      nav.dataset.selectionReady = 'true';
    },
    [still],
  );

  useIsomorphicLayoutEffect(() => {
    align(true);
  }, [align, selectedView]);

  useIsomorphicLayoutEffect(() => {
    let active = true;
    const selection = selectionRef.current;
    const resize = new ResizeObserver(() => align(false));
    resize.observe(navRef.current);
    navRef.current.querySelectorAll('a').forEach((link) => resize.observe(link));
    document.fonts?.ready.then(() => {
      if (active) align(false);
    });
    return () => {
      active = false;
      resize.disconnect();
      gsap.killTweensOf(selection);
    };
  }, [align]);

  return (
    <nav ref={navRef} className={styles.navigation} aria-label="Course views" data-glass="light">
      <span ref={selectionRef} className={styles.selection} aria-hidden="true" data-course-selection />
      {views.map(([view, label]) => (
        <Link
          key={view}
          href={`/${courseId}/#${view === 'info' ? 'course-info' : view}`}
          scroll={false}
          aria-current={selectedView === view ? 'page' : undefined}
          onClick={(event) => {
            if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
              acknowledge(view === 'info' ? 'course-info' : view);
            }
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
