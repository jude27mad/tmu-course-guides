import { nativeIOSScroll } from '@src/utils/scrollRoot';
/* eslint-disable react/jsx-props-no-spreading */

import '@src/styles/global.scss';
import '@src/styles/global.css';

import * as THREE from 'three';

import { PerformanceMonitor, View } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import Background from '@src/components/canvas/background/Index';
import DemandDriver from '@src/components/canvas/DemandDriver';
import { Canvas } from '@react-three/fiber';
import { createTouchScrollFilter } from '@src/components/canvas/fluid/touch-scroll.mjs';
import { EffectComposer } from '@react-three/postprocessing';
import Fluid from '@src/components/canvas/fluid/Fluid';
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

// The stats.js FPS panel is a development aid: show it only with ?stats in the URL.
const SHOW_STATS = typeof window !== 'undefined' && /[?&]stats\b/.test(window.location.search);

// Shared View.Port canvas pixel ratio: capped (the original allowed 1.5 everywhere),
// and stepped down to 1 by PerformanceMonitor when frames drop.
const MAX_DPR_DESKTOP = 1.5;
const MAX_DPR_TOUCH = 1.25;

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

// Keyboard scrolling while nothing has focus yet (focus on <body>): `main` is the
// scroller, not the document, so the browser's own key scrolling would do
// nothing. Inside main (or after the skip link) the browser handles keys itself.
const SCROLL_KEYS = { ArrowDown: 1, ArrowUp: -1, PageDown: 2, PageUp: -2, ' ': 2, Home: -3, End: 3 };
function useBodyKeyScroll() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      let step = SCROLL_KEYS[event.key];
      if (!step) return;
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

function MyApp({ Component, pageProps, router }) {
  const [lenis, setLenis, fluidColor, isAbout, still] = useStore(useShallow((state) => [state.lenis, state.setLenis, state.fluidColor, state.isAbout, state.still]));
  const coarse = useCoarsePointer();
  const maxDpr = coarse ? MAX_DPR_TOUCH : MAX_DPR_DESKTOP;
  const [dpr, setDpr] = useState(null);

  const mainRef = useRef();
  const mainContainerRef = useRef();
  const layoutRef = useRef();

  useFoucFix();
  useBodyKeyScroll();
  useScroll(() => ScrollTrigger.update());

  useIsomorphicLayoutEffect(() => {
    // Giats's synchronized touch scrolling keeps pointer moves flowing to the
    // fluid during a swipe. Native panning otherwise cancels that input stream.
    // Keep pinch zoom native and `main` scrollable for keys and find-in-page.
    const ios = nativeIOSScroll();
    // eslint-disable-next-line no-shadow
    const lenis = new Lenis({
      smoothWheel: true,
      syncTouch: !ios && !useStore.getState().still,
      virtualScroll: createTouchScrollFilter(),
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
    if (lenis) lenis.options.syncTouch = !nativeIOSScroll() && !still;
  }, [lenis, still]);

  useIsomorphicLayoutEffect(() => {
    if (lenis) {
      ScrollTrigger.refresh();
    }
  }, [lenis]);

  useFrame((time) => {
    if (lenis) {
      lenis.raf(time);
    }
  }, 0);

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

  const canvasElements = useMemo(
    () => (
      <Canvas
        gl={{
          outputColorSpace: isAbout === false ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
        style={{ zIndex: 0 }}
        resize={{ debounce: { resize: 0, scroll: 0 }, polyfill: undefined }}
        className={styles.canvasContainer}
        dpr={dpr ?? [1, maxDpr]}
        // motion off: draw only when something moves (scroll, resize, panels, curtain)
        frameloop={still ? 'demand' : 'always'}
        aria-hidden="true"
      >
        {still && <DemandDriver />}
        <PerformanceMonitor flipflops={3} onDecline={() => setDpr(1)} onIncline={() => setDpr(null)} onFallback={() => setDpr(1)} />
        {/* A view that is loading (or never loads) must stay inside the canvas: without
            this boundary R3F suspends the <Canvas> DOM component itself, and its next
            re-render (dpr, colour space) would hold every update of the page. */}
        <Suspense fallback={null}>
          <View.Port />
        </Suspense>
      </Canvas>
    ),
    [isAbout, dpr, maxDpr, still],
  );

  return (
    <>
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
          {canvasElements}
          {!still && (
            <Canvas
              id="fluidCanvas"
              flat
              frameloop="always"
              gl={{
                antialias: false,
                stencil: false,
                depth: false,
              }}
              // R3F's wrapper takes pointer events unless told otherwise; the
              // fluid reads pointer moves from <main> itself. Its black base lives in
              // global.scss, keyed on the scroll mode: a value chosen here from the
              // client-only scroll mode never reaches the page, because hydration keeps
              // the exported server style (see docs/qa/safari-toolbar-transparency.md).
              style={{ mixBlendMode: 'difference', pointerEvents: 'none' }}
              linear
              className={styles.canvasContainer}
              dpr={[0.1, 0.5]}
              aria-hidden="true"
            >
              <EffectComposer multisampling={0}>
                <Fluid fluidColor={fluidColor} mainRef={mainRef} />
              </EffectComposer>
            </Canvas>
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
    </>
  );
}

export default MyApp;
