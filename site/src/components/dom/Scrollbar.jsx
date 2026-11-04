import { useEffect, useRef } from 'react';

import gsap from 'gsap';
import styles from '@src/components/dom/styles/scrollbar.module.scss';
import useScroll from '@src/hooks/useScroll';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

// Every scroll frame used to start two new tweens, and the superseded ones kept running (about 18 per
// 0.3 s at 60 Hz), each writing the bar's `top`. Only the newest was ever visible. The bar now keeps one
// chase for its position (quickTo restarts from where the bar is, over the same 0.3 s) and replaces only
// its own fade, so the menu's prepared timeline, which also animates #scrollbar, is never touched.
function Scrollbar() {
  const progressBar = useRef();
  const scrollbarRef = useRef();
  const fadeTimeout = useRef();
  const fade = useRef(null);
  const top = useRef(null);
  const bound = useRef(null);
  const [isLoading, isMenuOpen, isSearchOpen, introOut] = useStore(useShallow((state) => [state.isLoading, state.isMenuOpen, state.isSearchOpen, state.introOut]));

  // One position chase per mounted bar (it remounts after each page change). The value is in svh and
  // written directly, so no unit conversion (and its measurement) happens per frame. It moves the bar with
  // a transform from its place at the top of the track (.inner sets no top), the same pixels as a top
  // offset, so a scroll frame no longer lays out the page or repaints the bar.
  useEffect(() => {
    const state = { value: 0 };
    const toTop = gsap.quickTo(state, 'value', {
      duration: 0.3,
      onUpdate: () => {
        if (progressBar.current) progressBar.current.style.transform = `translateY(${state.value}svh)`;
      },
    });
    top.current = toTop;
    return () => {
      toTop.tween.kill();
      top.current = null;
    };
  }, []);

  const opacity = (value, duration) => {
    fade.current?.kill();
    fade.current = gsap.to(scrollbarRef.current, { opacity: value, duration });
  };

  const updateScrollbar = (scroll, limit) => {
    const progress = limit > 0 ? scroll / limit : 0;
    const maxTopValueInVh = 80 - 6;
    const newTopValueInVh = Math.min(maxTopValueInVh, progress * maxTopValueInVh);

    // A new bar (after a page change) starts from 0, as a fresh element's first tween did.
    if (bound.current !== progressBar.current) {
      bound.current = progressBar.current;
      top.current?.(newTopValueInVh, 0);
    } else top.current?.(newTopValueInVh);
  };

  useScroll(({ scroll, limit }) => {
    if (!isLoading && !isMenuOpen && !isSearchOpen && scrollbarRef.current) {
      opacity(1, 0.3);
      updateScrollbar(scroll, limit);

      clearTimeout(fadeTimeout.current);
      fadeTimeout.current = setTimeout(() => {
        if (scrollbarRef?.current) opacity(0, 0.5);
      }, 1500);
    }
  });

  useEffect(
    () => () => {
      clearTimeout(fadeTimeout.current);
      fade.current?.kill();
    },
    [],
  );

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
