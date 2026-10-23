import { useEffect, useRef } from 'react';

import SplitType from 'split-type';
import clsx from 'clsx';
import gsap from 'gsap';
import { scrollToHash } from '@src/utils/scrollToHash';
import styles from '@src/components/dom/styles/loader.module.scss';
import { useProgress } from '@react-three/drei';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { TOKENS } from '@src/lib/palette.mjs';
import { wantsSRGB } from '@src/utils/routes';

// The original counted 0 -> 100 % over a fixed 5 s. The counter now follows what the
// page is really waiting for (fonts, the window load event, and every three.js
// loader: HDRs, textures) and never runs shorter than MIN_SECONDS, so the
// intro still reads as the original's. MAX_SECONDS is a safety net for a stuck asset.
const MIN_SECONDS = 1.2;
const MAX_SECONDS = 10;
const THREE_GRACE_MS = 400; // time for the 3D views to start their loaders after hydration

function readiness(state) {
  const three = useProgress.getState();
  let threePart = 1;
  if (three.total > 0) threePart = three.active ? Math.min(0.99, three.loaded / three.total) : 1;
  else if (performance.now() - state.loadedAt < THREE_GRACE_MS) threePart = 0.9;
  return 0.2 * (state.fonts ? 1 : 0) + 0.2 * (state.loaded ? 1 : 0) + 0.6 * (state.loaded ? threePart : 0);
}

function Loader() {
  const [lenis, introOut, setIntroOut, setIsLoading, setIsAbout] = useStore(useShallow((state) => [state.lenis, state.introOut, state.setIntroOut, state.setIsLoading, state.setIsAbout]));

  const progressRef = useRef(null);
  const fullNameRef = useRef(null);
  const shortNameRef = useRef(null);
  const root = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (introOut || !lenis) return undefined;
    setIsAbout(wantsSRGB(router.pathname));

    const state = { fonts: false, loaded: document.readyState === 'complete', loadedAt: performance.now() };
    let cancelled = false;
    let frame = 0;
    let ctx;
    const start = performance.now();
    let shown = 0;

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        state.fonts = true;
      });
    } else state.fonts = true;
    const onLoad = () => {
      state.loaded = true;
      state.loadedAt = performance.now();
    };
    if (!state.loaded) window.addEventListener('load', onLoad, { once: true });

    const finish = () => {
      if (useStore.getState().introOut) return;
      const main = document.querySelector('main');
      const layout = document.getElementById('layout');
      const reveal = () => {
        setIntroOut(true);
        setIsLoading(false);
        lenis.start();
        gsap.set(main, { willChange: 'auto' });
        // a #hash deep link lands on its item
        scrollToHash({ immediate: true });
      };

      lenis.scrollTo(0, { force: true, immediate: true });

      if (useStore.getState().still) {
        // Motion off: no curtain, the page is simply there.
        gsap.set(root.current, { autoAlpha: 0 });
        gsap.set(layout, { height: '100%' });
        gsap.set(main, { x: 0, scale: 1, opacity: 1, height: 'auto', border: 'none', borderRadius: 0, pointerEvents: 'auto' });
        gsap.set('header', { autoAlpha: 1 });
        reveal();
        return;
      }

      ctx = gsap.context(() => {
        gsap.set('header', { autoAlpha: 0 });

        const splitted = new SplitType(fullNameRef.current, { types: 'lines', tagName: 'span' });
        splitted.lines.forEach((line) => {
          gsap.to(line, { ease: 'power4.inOut', top: '-12vw', duration: 1 });
        });
        gsap.to(shortNameRef.current, { opacity: 1 });
        const splittedShort = new SplitType(shortNameRef.current, { types: 'lines', tagName: 'span' });
        splittedShort.lines.forEach((line) => {
          gsap.to(line, { ease: 'power4.inOut', top: '0px', duration: 1 });
        });
        const splittedProgress = new SplitType(progressRef.current, { types: 'lines', tagName: 'span' });
        splittedProgress.lines.forEach((line) => {
          gsap.to(line, { ease: 'power4.inOut', top: '-12vw', duration: 1 });
        });

        gsap.set(layout, { height: '90%' });
        gsap.set(main, {
          x: '100%',
          scale: 0.9,
          opacity: 1,
          border: `2px solid ${TOKENS.page}`,
          borderRadius: '1.3888888889vw',
          willChange: 'transform',
        });

        // The original reveal, about 0.4 s tighter: card shrinks, slides out left while
        // main slides in from the right, then main settles full-screen.
        gsap.to(root.current, { scale: 0.9, ease: 'power2.inOut', delay: 0.6, duration: 0.5, borderRadius: '1.3888888889vw' });
        gsap.to(root.current, { ease: 'power2.inOut', delay: 1.35, duration: 0.5, x: '-100%' });
        gsap.to(main, { ease: 'power2.inOut', delay: 1.35, duration: 0.5, x: '0px' });
        gsap.to(main, { ease: 'power2.inOut', delay: 1.85, duration: 0.5, scale: 1, borderRadius: 0 });
        gsap.to(layout, { ease: 'power2.inOut', delay: 1.85, duration: 0.5, height: '100%' });
        gsap.to('header', { delay: 1.95, duration: 0.5, ease: 'power2.inOut', autoAlpha: 1 });
        gsap.to(main, {
          ease: 'power2.inOut',
          delay: 2.3,
          duration: 0.5,
          height: 'auto',
          border: 'none',
          pointerEvents: 'auto',
          onComplete: reveal,
        });
      });
    };

    let last = start;
    const tick = () => {
      if (cancelled) return;
      const time = performance.now();
      const dt = Math.min(0.5, (time - last) / 1000);
      last = time;
      const elapsed = (time - start) / 1000;
      const real = readiness(state);
      // motion off: no minimum show time, the page appears as soon as it is ready
      const timed = Math.min(1, elapsed / (useStore.getState().still ? 0.25 : MIN_SECONDS));
      const target = elapsed > MAX_SECONDS ? 1 : Math.min(real, timed);
      // eased per second, not per frame: a slow first frame must not slow the count
      shown += (target - shown) * (1 - Math.exp(-dt * 12));
      if (target >= 1 && 1 - shown < 0.01) shown = 1;
      if (progressRef.current) progressRef.current.textContent = `${Math.round(shown * 100)}%`;
      if (shown >= 1) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('load', onLoad);
      if (ctx) ctx.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenis, introOut]);

  return (
    <div id="loader" ref={root} className={clsx(styles.root, 'layout-block-inner')} aria-hidden="true">
      <div className={styles.innerContainer}>
        <div className={styles.fullNameContainer}>
          <p ref={fullNameRef} className={clsx(styles.fullName, 'h2')}>
            {introOut ? 'Loading' : 'TMU Course Guides'}
          </p>
        </div>

        {!introOut && (
          <div className={styles.shortNameContainer}>
            <p ref={shortNameRef} className={clsx(styles.shortName, 'h2')}>
              Fall 2026
            </p>
          </div>
        )}

        {!introOut && (
          <div className={styles.progressContainer}>
            <p ref={progressRef} className={clsx(styles.progress, 'h1')}>
              0%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Loader;
