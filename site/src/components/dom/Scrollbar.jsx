import { useEffect, useRef } from 'react';

import gsap from 'gsap';
import styles from '@src/components/dom/styles/scrollbar.module.scss';
import useScroll from '@src/hooks/useScroll';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

function Scrollbar() {
  const progressBar = useRef();
  const scrollbarRef = useRef();
  const fadeTimeout = useRef();
  const [isLoading, isMenuOpen, isSearchOpen, introOut] = useStore(useShallow((state) => [state.isLoading, state.isMenuOpen, state.isSearchOpen, state.introOut]));

  const updateScrollbar = (scroll, limit) => {
    const progress = limit > 0 ? scroll / limit : 0;
    const maxTopValueInVh = 80 - 6;
    const newTopValueInVh = Math.min(maxTopValueInVh, progress * maxTopValueInVh);

    // overwrite: each scroll frame starts a new tween and only the newest was ever visible; without it
    // the superseded ones (about 18 per 0.3 s at 60 Hz) kept running and writing `top` every tick.
    gsap.to(progressBar.current, { top: `${newTopValueInVh}svh`, duration: 0.3, overwrite: true });
  };

  useScroll(({ scroll, limit }) => {
    if (!isLoading && !isMenuOpen && !isSearchOpen && scrollbarRef.current) {
      gsap.to(scrollbarRef.current, { opacity: 1, duration: 0.3, overwrite: true });
      updateScrollbar(scroll, limit);

      clearTimeout(fadeTimeout.current);
      fadeTimeout.current = setTimeout(() => {
        if (scrollbarRef?.current) {
          gsap.to(scrollbarRef.current, { opacity: 0, duration: 0.5, overwrite: true });
        }
      }, 1500);
    }
  });

  useEffect(() => () => clearTimeout(fadeTimeout.current), []);

  if (isLoading && introOut) {
    return null;
  }

  return (
    <div id="scrollbar" ref={scrollbarRef} className={styles.scrollbar} aria-hidden="true">
      <div ref={progressBar} className={styles.inner} />
    </div>
  );
}

export default Scrollbar;
