/* eslint-disable react/jsx-props-no-spreading */

import '@src/styles/global.scss';
import '@src/styles/global.css';

import * as THREE from 'three';

import { PerformanceMonitor, View } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import BadgeBoundary from '@src/components/courseBadge/BadgeBoundary';
import { BadgeProvider } from '@src/components/courseBadge/BadgeProvider';
// eslint-disable-next-line import/extensions
import { createBadgeRegistry } from '@src/components/courseBadge/badgeRegistry.mjs';
// eslint-disable-next-line import/extensions
import { createTouchScrollFilter } from '@src/utils/touch-scroll.mjs';

import Background from '@src/components/canvas/background/Index';
import DemandDriver from '@src/components/canvas/DemandDriver';
import ClearViews from '@src/components/canvas/ClearViews';
import { Canvas } from '@react-three/fiber';
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
import { nativeIOSScroll } from '@src/utils/scrollRoot';

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

// The original contained scroller uses overflow:hidden during motion. Preserve
// keyboard scrolling there as well as from body, without intercepting keys
// belonging to form controls, native disclosures, or editable content.
const SCROLL_KEYS = { ArrowDown: 1, ArrowUp: -1, PageDown: 2, PageUp: -2, ' ': 2, Home: -3, End: 3 };
function useBodyKeyScroll() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const active = document.activeElement;
      const main = document.querySelector('main');
      const containedFocus = main?.contains(active) && getComputedStyle(main).overflowY === 'hidden';
      const control = active?.closest('input, textarea, select, button, summary, [contenteditable], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"]');
      if (active && active !== document.body && active !== document.documentElement && (!containedFocus || control)) return;
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
    if (lenis) lenis.options.syncTouch = !still;
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

  // Every canvas sits in a WebGLGate: a browser without WebGL (turned off, blocked, no GPU) gets the page
  // without its 3D layer instead of an application error. This one is `critical`: the course badges draw into it.
  const canvasElements = useMemo(
    () => (
      <WebGLGate critical>
        <Canvas
          id="viewCanvas"
          fallback={<span aria-hidden="true" />}
          gl={{
            outputColorSpace: THREE.LinearSRGBColorSpace,
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
          <PerformanceMonitor flipflops={3} onDecline={() => setDpr(1)} onIncline={() => setDpr(null)} onFallback={() => setDpr(1)} />
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
    [badgeRegistry, badgeRoute, dpr, maxDpr, still],
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
                aria-hidden="true"
              >
                <EffectComposer>
                  <Fluid fluidColor={fluidColor} mainRef={mainRef} />
                </EffectComposer>
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
