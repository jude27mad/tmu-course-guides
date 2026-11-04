/* eslint-disable react/jsx-props-no-spreading */

import '@src/styles/global.scss';
import '@src/styles/global.css';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import BadgeBoundary from '@src/components/courseBadge/BadgeBoundary';
import { BadgeProvider } from '@src/components/courseBadge/BadgeProvider';
// eslint-disable-next-line import/extensions
import { createBadgeRegistry } from '@src/components/courseBadge/badgeRegistry.mjs';
// eslint-disable-next-line import/extensions
import { createTouchScrollFilter } from '@src/utils/touch-scroll.mjs';
// eslint-disable-next-line import/extensions
import { frameShare } from '@src/utils/frameStep.mjs';

import Head from 'next/head';
import Layout from '@src/components/dom/Layout';
import Lenis from 'lenis';
import Loader from '@src/components/dom/Loader';
import Navbar from '@src/components/dom/navbar/Index';
import NavigationFeedback from '@src/components/dom/NavigationFeedback';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import Scrollbar from '@src/components/dom/Scrollbar';
import Stats from '@src/components/stats/Index';
import Tempus from '@darkroom.engineering/tempus';
import WebGLGate from '@src/components/canvas/WebGLGate';
import { gsap } from 'gsap';
import styles from '@src/pages/app.module.scss';
import { useCoarsePointer } from '@src/hooks/useMediaQuery';
import useFoucFix from '@src/hooks/useFoucFix';
import { useFrame } from '@darkroom.engineering/hamo';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useMotionPaused } from '@src/lib/react';
import useScroll from '@src/hooks/useScroll';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { nativeIOSScroll, scrollTrial } from '@src/utils/scrollRoot';
// eslint-disable-next-line import/extensions
import { blockAutoscroll, blockWheel, lockKey } from '@src/utils/scrollTrialGuards.mjs';

if (typeof window !== 'undefined') {
  gsap.defaults({ ease: 'none' });
  gsap.registerPlugin(ScrollTrigger);

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.remove(gsap.updateRoot);
  Tempus?.add((time) => {
    gsap.updateRoot(time / 1000);
  }, 0);

  window.history.scrollRestoration = 'manual';
  ScrollTrigger.clearScrollMemory(window.history.scrollRestoration);
}

const BadgeWorld = dynamic(() => import('@src/components/courseBadge/BadgeScene').then((module) => module.BadgeWorld), { ssr: false });

// The 3D layer (three, R3F, drei, postprocessing) loads after the page is usable instead of in the first
// bundle every route downloads and runs. Each canvas already mounts after hydration (WebGLGate), and what
// it draws is unchanged; it arrives once these chunks are in. The composer and the fluid load as one.
const Canvas = dynamic(() => import('@react-three/fiber').then((module) => module.Canvas), { ssr: false });
const PerformanceMonitor = dynamic(() => import('@react-three/drei/core/PerformanceMonitor').then((module) => module.PerformanceMonitor), { ssr: false });
const View = { Port: dynamic(() => import('@react-three/drei/web/View').then((module) => module.View.Port), { ssr: false }) };
const Background = dynamic(() => import('@src/components/canvas/background/Index'), { ssr: false });
const DemandDriver = dynamic(() => import('@src/components/canvas/DemandDriver'), { ssr: false });
const ClearViews = dynamic(() => import('@src/components/canvas/ClearViews'), { ssr: false });
const FluidLayer = dynamic(() => import('@src/components/canvas/FluidLayer'), { ssr: false });

// The stats.js FPS panel is a development aid: show it only with ?stats in the URL.
const SHOW_STATS = typeof window !== 'undefined' && /[?&]stats\b/.test(window.location.search);

// Shared View.Port canvas pixel ratio: capped (the original allowed 1.5 everywhere),
// and stepped down to 1 by PerformanceMonitor when frames drop.
const MAX_DPR_DESKTOP = 1.5;
const MAX_DPR_TOUCH = 1.25;
// drei counts every incline as a flip-flop, even one that changes nothing, so a
// smooth device reached its fallback (DPR 1) about 10 s after load. Only real
// changes count here; after more than three the canvas stays at DPR 1. On a
// 120 Hz display frames "drop" below 90 fps rather than 60.
const DPR_FLIPFLOPS = 3;
const dprBounds = (refreshrate) => (refreshrate > 100 ? [90, 110] : [40, 60]);

// Lenis turns a touch release into inertia: its last per-frame velocity times
// this multiplier, if the last touchmove travelled more than 5 px. Both are per
// frame, so at 120 Hz flings went half as far and slow ones did not start.
// Each frame records its share of a 60 Hz frame to rescale both.
const TOUCH_INERTIA = 35;
const touchFrame = { share: 1 };

// Skip link copy from docs/copy/interface-copy.md.
const skipLabel = (pathname) => (pathname === '/' ? 'Skip to courses' : 'Skip to coursework');

// Keeps the store (and html[data-motion]) in step with the lib's motion hook:
// prefers-reduced-motion or the saved "Pause motion" ('guide-motion-paused').
function MotionSync() {
  const [still, setPaused, info] = useMotionPaused();
  const setMotionState = useStore((state) => state.setMotionState);
  const saved = !!info?.saved;
  // the device setting or ?motion=off: "Pause motion" cannot be switched off from the page
  const reduced = !!(info?.reduced || info?.forced);

  useEffect(() => {
    setMotionState({ still, saved, reduced, setPaused });
    document.documentElement.setAttribute('data-motion', still ? 'off' : 'on');
  }, [still, saved, reduced, setPaused, setMotionState]);

  return null;
}

// The original contained scroller uses overflow:hidden during motion. Preserve
// keyboard scrolling there as well as from body, without intercepting keys
// belonging to form controls, native disclosures, or editable content.
const SCROLL_KEYS = { ArrowDown: 1, ArrowUp: -1, PageDown: 2, PageUp: -2, ' ': 2, Home: -3, End: 3 };
// Controls that use these keys themselves (typing, choosing, moving between options).
const OWNS_KEYS =
  'input, textarea, select, [contenteditable], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="tablist"], [role="radiogroup"], [role="grid"], [role="menu"], dialog';
// Controls that Space activates; the other keys still scroll from them, as they do natively.
const ACTIVATED_BY_SPACE = 'button, summary, [role="button"], [role="checkbox"], [role="switch"], [role="tab"]';
function useBodyKeyScroll() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      let step = SCROLL_KEYS[event.key];
      if (!step) return;
      const active = document.activeElement;
      const focused = active && active !== document.body && active !== document.documentElement ? active : null;
      const main = document.querySelector('main');
      if (focused?.closest(OWNS_KEYS) || (event.key === ' ' && focused?.closest(ACTIVATED_BY_SPACE))) return;
      // A main that scrolls natively (Pause motion, reduced motion) is scrolled by the browser from focus inside
      // it. Focus anywhere else (a button in the overflow:hidden main, the header after a panel closes) has
      // nothing the browser can scroll, so those keys did nothing. The opt-in browser-scrolled page
      // (?scroll=fast) is a real scroller that Lenis still scrolls, so its keys stay Lenis's.
      if (focused && main?.contains(focused) && getComputedStyle(main).overflowY !== 'hidden' && !scrollTrial()) return;
      const { lenis, isLoading, isMenuOpen, isSearchOpen, still } = useStore.getState();
      if (!lenis || isLoading || isMenuOpen || isSearchOpen) return;
      if (event.key === ' ' && event.shiftKey) step = -2;
      event.preventDefault();
      const page = window.innerHeight * 0.85;
      let target;
      if (Math.abs(step) === 3) target = step > 0 ? lenis.limit : 0;
      else target = lenis.targetScroll + (Math.abs(step) === 2 ? Math.sign(step) * page : step * 80);
      lenis.scrollTo(target, { duration: 0.6, immediate: still });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

// With the opt-in browser-scrolled page (?scroll=fast), keep input that scrolls nothing today (main is
// not user-scrollable) from scrolling main natively past Lenis. A scroll key Lenis does not take and a
// two-finger gesture lock main while they last (data-keylock, data-multitouch), so the focused field or
// a pinch keeps its own behaviour; a wheel in the Schedule calendar that it cannot scroll and
// middle-click autoscroll are cancelled. While main is locked nothing can scroll it anyway.
function useScrollTrialGuards(mainRef) {
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    const open = () => scrollTrial() && getComputedStyle(main).overflowY !== 'hidden';
    // The key's default action (and the browser's choice of what to scroll) runs right after keydown, so
    // the lock lasts two frames: a held key locks again on each repeat, and a key whose keyup goes
    // elsewhere (Alt+Down opens a date picker) leaves nothing behind.
    let keyFrame = 0;
    const unlockKeys = () => {
      cancelAnimationFrame(keyFrame);
      main.removeAttribute('data-keylock');
    };
    const onKeyDown = (event) => {
      if (!open() || !lockKey(event, main, document.activeElement)) return;
      main.setAttribute('data-keylock', '');
      cancelAnimationFrame(keyFrame);
      keyFrame = requestAnimationFrame(() => {
        keyFrame = requestAnimationFrame(unlockKeys);
      });
    };
    const onWheel = (event) => {
      if (open() && blockWheel(event, main)) event.preventDefault();
    };
    const onMouseDown = (event) => {
      if (open() && blockAutoscroll(event, navigator.platform, main)) event.preventDefault();
    };
    // Every finger, wherever it landed (the header is outside main); a one-finger start means the others lifted.
    const onTouch = (event) => {
      if (event.touches.length > 1 && scrollTrial()) main.setAttribute('data-multitouch', '');
      else if (event.touches.length === 0 || (event.type === 'touchstart' && event.touches.length === 1)) main.removeAttribute('data-multitouch');
    };
    const touch = { capture: true, passive: true };
    document.addEventListener('keydown', onKeyDown);
    main.addEventListener('wheel', onWheel, { passive: false });
    main.addEventListener('mousedown', onMouseDown);
    ['touchstart', 'touchend', 'touchcancel'].forEach((type) => document.addEventListener(type, onTouch, touch));
    return () => {
      unlockKeys();
      document.removeEventListener('keydown', onKeyDown);
      main.removeEventListener('wheel', onWheel);
      main.removeEventListener('mousedown', onMouseDown);
      ['touchstart', 'touchend', 'touchcancel'].forEach((type) => document.removeEventListener(type, onTouch, touch));
    };
  }, [mainRef]);
}

function MyApp({ Component, pageProps, router }) {
  const [lenis, setLenis, fluidColor, still] = useStore(useShallow((state) => [state.lenis, state.setLenis, state.fluidColor, state.still]));
  const [badgeRegistry] = useState(createBadgeRegistry);
  const badgeRoute = router.asPath.split(/[?#]/)[0];
  const coarse = useCoarsePointer();
  const maxDpr = coarse ? MAX_DPR_TOUCH : MAX_DPR_DESKTOP;
  const [dpr, setDpr] = useState(null);

  const mainRef = useRef();
  const mainContainerRef = useRef();
  const layoutRef = useRef();

  useFoucFix();
  useBodyKeyScroll();
  useScrollTrialGuards(mainRef);
  useScroll(() => ScrollTrigger.update());

  useIsomorphicLayoutEffect(() => {
    // Safari needs the document layout for content to continue behind its bars.
    // Keep Giats's synchronized touch input in that layout: Lenis handles the
    // gesture and the unchanged fluid hook still listens to pointermove on main.
    // Document layout must not switch syncTouch off and hand the swipe to Safari.
    const ios = nativeIOSScroll();
    // eslint-disable-next-line no-shadow
    const lenis = new Lenis({
      smoothWheel: true,
      smoothTouch: true,
      syncTouch: true,
      touchInertiaMultiplier: TOUCH_INERTIA,
      virtualScroll: createTouchScrollFilter(() => touchFrame.share),
      wrapper: ios ? window : mainRef.current || undefined,
      content: ios ? document.documentElement : mainContainerRef.current || undefined,
    });

    setLenis(lenis);
    lenis.stop();
    lenis.scrollTo(0, { immediate: true, force: true });

    return () => {
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  useEffect(() => {
    // Pause Motion and reduced motion restore native touch scrolling without
    // recreating Lenis or resetting the reader's position.
    if (lenis) lenis.options.syncTouch = !still;
  }, [lenis, still]);

  useIsomorphicLayoutEffect(() => {
    if (lenis) {
      ScrollTrigger.refresh();
    }
  }, [lenis]);

  useFrame((time, deltaTime) => {
    if (lenis) {
      lenis.raf(time);
      touchFrame.share = frameShare(deltaTime / 1000);
      lenis.options.touchInertiaMultiplier = TOUCH_INERTIA / touchFrame.share;
    }
  }, 0);

  const dprRef = useRef(null);
  const dprChanges = useRef(0);
  const changeDpr = useCallback((next) => {
    if (dprRef.current === next) return;
    dprChanges.current += 1;
    dprRef.current = dprChanges.current > DPR_FLIPFLOPS ? 1 : next;
    setDpr(dprRef.current);
  }, []);

  const domElements = useMemo(
    () => (
      <>
        <Loader />
        <div className={styles.background} aria-hidden="true">
          <Background />
        </div>
        <Scrollbar />
        <Navbar />
      </>
    ),
    [],
  );

  // Every canvas sits in a WebGLGate: a browser without WebGL (turned off, blocked, no GPU) gets the page
  // without its 3D layer instead of an application error. This one is `critical`: the course badges draw into it.
  const canvasElements = useMemo(
    () => (
      <WebGLGate critical>
        <Canvas
          id="viewCanvas"
          fallback={<span aria-hidden="true" />}
          gl={{
            outputColorSpace: 'srgb-linear', // THREE.LinearSRGBColorSpace
            powerPreference: 'high-performance',
          }}
          style={{ zIndex: 0 }}
          resize={{ scroll: false, debounce: { resize: 0, scroll: 0 }, polyfill: undefined }}
          className={styles.canvasContainer}
          dpr={dpr ?? [1, maxDpr]}
          // motion off: draw only when something moves (scroll, resize, panels, curtain)
          frameloop={still ? 'demand' : 'always'}
          aria-hidden="true"
        >
          {still && <DemandDriver />}
          <ClearViews />
          <PerformanceMonitor bounds={dprBounds} onDecline={() => changeDpr(1)} onIncline={() => changeDpr(null)} />
          {/* A view that is loading (or never loads) must stay inside the canvas: without
              this boundary R3F suspends the <Canvas> DOM component itself, and its next
              re-render (dpr, colour space) would hold every update of the page. */}
          <BadgeBoundary registry={badgeRegistry} route={badgeRoute}>
            <Suspense fallback={null}>
              <BadgeWorld registry={badgeRegistry} />
              <View.Port />
            </Suspense>
          </BadgeBoundary>
        </Canvas>
      </WebGLGate>
    ),
    [badgeRegistry, badgeRoute, changeDpr, dpr, maxDpr, still],
  );

  return (
    <BadgeProvider value={badgeRegistry}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      {/* Transparent, non-interactive guards. No opaque browser-bar colour is
          supplied; page content, rather than a sampled solid strip, stays behind it. */}
      <div aria-hidden="true" data-safari-blend="top" className="safari-toolbar-blend" />
      <MotionSync />
      <NavigationFeedback />
      {SHOW_STATS && <Stats />}
      <a
        className="skip-link"
        href="#mainContainer"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus({ preventScroll: true });
        }}
      >
        {skipLabel(router.pathname)}
      </a>
      <div className={styles.root}>
        {domElements}
        <div ref={layoutRef} id="layout" className={styles.layout}>
          {/* The paper a page fades into during a page change (Layout). */}
          <div id="routePaper" className={styles.routePaper} aria-hidden="true" />
          {canvasElements}
          {!still && (
            <WebGLGate>
              <Canvas
                id="fluidCanvas"
                flat
                gl={{
                  antialias: false,
                  stencil: false,
                  depth: false,
                  pixelRatio: 0.1,
                }}
                // Keep the wrapper transparent on iOS before hydration as well.
                // global.scss supplies the original black base in contained mode;
                // an inline background would override Safari's document styling.
                style={{ mixBlendMode: 'difference', pointerEvents: 'none' }}
                linear
                className={styles.canvasContainer}
                eventSource={mainRef.current}
                dpr={[0.1, 0.5]}
                // Fluid keeps frames coming while its trail is moving or fading.
                frameloop="demand"
                aria-hidden="true"
              >
                <FluidLayer fluidColor={fluidColor} mainRef={mainRef} />
              </Canvas>
            </WebGLGate>
          )}
          <main ref={mainRef} id="main" className={styles.main} tabIndex={-1}>
            <div ref={mainContainerRef} id="mainContainer" className={styles.mainContainer}>
              <Layout layoutRef={layoutRef} mainRef={mainRef} router={router}>
                <Component {...pageProps} />
              </Layout>
            </div>
          </main>
        </div>
      </div>
      {/* Must follow the entire document, outside clipped/transformed scene roots. */}
      <div aria-hidden="true" data-safari-blend="bottom" className="safari-toolbar-blend" />
    </BadgeProvider>
  );
}

export default MyApp;
