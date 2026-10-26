import { nativeIOSScroll, scrollTop } from '@src/utils/scrollRoot';
import React, { useEffect, useRef, useState } from 'react';
import { Transition as ReactTransition, SwitchTransition } from 'react-transition-group';
import { courseIdFromPath, pathKey, wantsSRGB } from '@src/utils/routes';

import Footer from '@src/components/dom/Footer';
import CompactFooter from '@src/pages/course/components/workspace/CompactFooter';
import CompanionStatement from '@src/components/dom/CompanionStatement';
import gsap from 'gsap';
import { isMobileNow } from '@src/hooks/useIsMobile';
import { scrollToHash } from '@src/utils/scrollToHash';
import styles from '@src/components/dom/styles/layout.module.scss';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { TOKENS } from '@src/lib/palette.mjs';
import { markPageShrunk } from '@src/components/dom/navbar/panelShell';

// Giats's card (desktop and Android, except between courses): shrink, slide, slide, grow.
// Two steps out and about two in keep a page change within 0.6 s.
const STEP = 0.14;
const PANEL_CLOSE = 0.45;
// The paper fade (iPhone and iPad, and between courses on every screen): the page
// dissolves into the paper behind it and the next page rises out of it. In ms: `paper`
// is how fast the paper comes up, `out` the old page's fade, `in` the new page's,
// `clear` when the paper starts to go; `rise` is in px.
const FADE = {
  page: { paper: 120, out: 180, in: 340, clear: 120, rise: 14 },
  course: { paper: 80, out: 120, in: 220, clear: 80, rise: 0 },
  // From an open phone menu or search: the swap happens unseen under the panel, which
  // then dissolves straight into the new page.
  panel: { hold: 240, in: 260, clear: 100, rise: 0 },
};
// GSAP's power2.in, power2.out, expo.out and power1.inOut as CSS curves.
const EASE = {
  in: 'cubic-bezier(0.32, 0, 0.67, 0)',
  out: 'cubic-bezier(0.33, 1, 0.68, 1)',
  rise: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
};
// react-transition-group's fallback when an animation never finishes (a hidden tab
// stops them); normally each phase ends with its animations.
const WATCHDOG_MS = 1500;
const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta'];

const siteHeader = () => document.querySelector('header');
const routePaper = () => document.getElementById('routePaper');
const viewCanvas = () => document.getElementById('viewCanvas');

// After a route change: focus the new page's heading (or main). Next's own
// route announcer reads the new document title.
function landOnPage() {
  const main = document.querySelector('main');
  const heading = main?.querySelector('h1');
  // the page's title when it opens the page; otherwise main (Tab starts from the top)
  const target = heading && heading.getBoundingClientRect().top < window.innerHeight ? heading : main;
  if (target) {
    if (target !== main && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}

// The paper fade runs as Web Animations, which the browser can play on its compositor:
// they keep moving while the arriving page's effects hold the main thread. `end` runs
// once, when every animation has finished or `run.end()` finishes the phase early.
function playPhase(run, anims, end) {
  const id = run.id + 1;
  run.id = id;
  run.anims = anims;
  const finish = () => {
    if (run.id !== id) return;
    run.id += 1;
    run.end = null;
    end();
  };
  run.end = finish;
  Promise.all(anims.map((anim) => anim.finished)).then(finish, () => {});
}

// Card timelines are built in the commit that mounts a page, so they would start "in
// the past" (GSAP's clock is the last frame's) and lose the mount's time. Start them on
// the next tick.
function startNextTick(run, tl) {
  run.start?.kill();
  run.start = gsap.delayedCall(0, () => tl.play());
}

function Layout({ children, layoutRef, mainRef, router }) {
  const [introOut, setIsLoading, setIsAbout, still] = useStore(useShallow((state) => [state.introOut, state.setIsLoading, state.setIsAbout, state.still]));
  // The footer belongs to the page on screen: it changes when the next page mounts,
  // not under the outgoing page as soon as the address changes.
  const [footerPath, setFooterPath] = useState(router.asPath);

  // One page change at a time: its phase ('idle' | 'exit' | 'enter'), plan, card
  // timeline or fade animations, and react-transition-group's done for the phase.
  const runRef = useRef({ phase: 'idle', plan: null, tl: null, start: null, anims: [], end: null, id: 0, done: null, ready: false, skip: false, steady: true, from: router.asPath, swipe: null });

  const animated = introOut && !still;

  // Ends the current react-transition-group phase (or the next one to ask, if it has
  // not asked yet).
  const release = () => {
    const run = runRef.current;
    const { done } = run;
    run.done = null;
    if (done) done();
    else run.ready = true;
  };
  const addEndListener = (node, done) => {
    const run = runRef.current;
    if (run.ready) {
      run.ready = false;
      done();
    } else run.done = done;
  };

  // Stops whatever is playing. A stopped fade keeps its current look, so the next
  // phase continues from where the page is.
  const stopMotion = (run) => {
    run.start?.kill();
    run.tl?.kill();
    run.anims.forEach((anim) => {
      try {
        anim.commitStyles();
      } catch {
        // an element that is no longer rendered has nothing to keep
      }
      anim.cancel();
    });
    run.start = null;
    run.tl = null;
    run.anims = [];
    run.end = null;
    run.id += 1;
  };

  // Finishes the current phase now: a tap, a key, Pause motion, or a page that
  // mounted before the exit had played out.
  const finishPhase = () => {
    const run = runRef.current;
    run.start?.kill();
    if (run.tl) run.tl.progress(1);
    run.anims.forEach((anim) => anim.finish());
    run.end?.();
  };

  const closePanels = () => {
    const state = useStore.getState();
    if (state.isMenuOpen) state.setIsMenuOpen(false);
    if (state.isSearchOpen) state.setIsSearchOpen(false);
  };

  // The old page is gone from view: park the scroll and let the next page mount.
  const covered = () => {
    const run = runRef.current;
    run.tl = null;
    if (!run.steady) gsap.set(siteHeader(), { autoAlpha: 0 });
    setIsLoading(true);
    useStore.getState().lenis.scrollTo(0, { force: true, immediate: true });
    release();
  };

  const finishEnter = () => {
    const run = runRef.current;
    const main = mainRef.current;
    const { lenis } = useStore.getState();
    setIsAbout(wantsSRGB(router.pathname));
    gsap.set(main, { willChange: 'auto' });
    gsap.set('#loader', { autoAlpha: 0, display: 'none' });
    gsap.set(routePaper(), { display: 'none' });
    gsap.set(siteHeader(), { autoAlpha: 1 });
    if (nativeIOSScroll() || run.plan !== 'card') gsap.set(main, { clearProps: 'transform,transformOrigin,left' });
    if (nativeIOSScroll()) {
      markPageShrunk(false);
      const fluid = document.getElementById('fluidCanvas');
      if (fluid) gsap.set(fluid, { opacity: 1 });
    }
    // The finished fade's end state is already the page's own.
    run.anims.forEach((anim) => anim.cancel());
    run.anims = [];
    run.tl = null;
    run.phase = 'idle';
    run.skip = false;

    // The old page's removal and the final transform cleanup can move Safari's
    // document scroll after the exit reset. Read the incoming page's actual
    // position first: Lenis skips scrollTo(0) if its cached target is already 0.
    lenis.start();
    lenis.resize();
    lenis.scrollTo(0, { force: true, immediate: true });
    useStore.getState().setIsTransitioning(false);
    setIsLoading(false);
    landOnPage();
    scrollToHash({ immediate: true });
    release();
  };

  const handleExit = () => {
    const state = useStore.getState();
    if (!state.introOut) return;
    const run = runRef.current;
    const main = mainRef.current;
    const header = siteHeader();
    const ios = nativeIOSScroll();
    const { from } = run;
    const to = router.asPath;
    // A change that replaces one still arriving (a second tap) leaves from where it is.
    const superseding = run.phase === 'enter';
    // Safari's own swipe-back animation already showed the change.
    const swiped = run.swipe === pathKey(to);
    const panelOpen = state.isMenuOpen || state.isSearchOpen;

    stopMotion(run);
    run.phase = 'exit';
    run.ready = false;
    run.skip = false;
    run.swipe = null;
    state.setIsTransitioning(true);
    state.lenis.stop();
    closePanels();

    if (state.still || swiped) {
      // Motion off: no fade and no card; the old page stays where it is until the
      // new one replaces it at its top.
      run.plan = 'instant';
      setIsLoading(true);
      release();
      return;
    }

    const betweenCourses = !!(courseIdFromPath(from) && courseIdFromPath(to));
    if (panelOpen && isMobileNow()) run.plan = 'panel';
    // Phone transitions stay full width with either scroll owner. Restoring
    // Giats's contained input must not bring back the desktop loading card.
    else if (isMobileNow() || ios || (!panelOpen && (betweenCourses || superseding))) run.plan = betweenCourses ? 'course' : 'page';
    else run.plan = 'card';
    // The header stays put while it is on screen. Once scrolled away, or moved by a
    // wide panel's shell (iPad), it fades with the page so it cannot pop back in.
    run.steady = run.plan !== 'card' && scrollTop() < 1 && (!panelOpen || run.plan === 'panel') && Number(getComputedStyle(header).opacity) === 1;

    if (run.plan === 'card') {
      const menuTime = panelOpen ? PANEL_CLOSE : 0;
      const scrollbar = document.getElementById('scrollbar');
      const tl = gsap.timeline({ paused: true, onComplete: covered, defaults: { ease: 'power2.inOut', duration: STEP } });
      tl.set(main, { willChange: 'transform', pointerEvents: 'none' }, 0);
      if (scrollbar) tl.to(scrollbar, { autoAlpha: 0 }, menuTime);
      tl.to(
        header,
        {
          autoAlpha: 0,
          onComplete: () => {
            gsap.set('#loader', {
              scale: 0.9,
              x: '100%',
              borderRadius: '1.3888888889vw',
              autoAlpha: 1,
              display: 'block', // restore only during route transition
            });
            gsap.set(header, { left: 0, top: 0, scale: 1 });
          },
          overwrite: true,
        },
        menuTime,
      )
        .to(layoutRef.current, { height: '90svh', opacity: 1 }, menuTime)
        .to(main, { scale: 0.9, opacity: 1, border: `2px solid ${TOKENS.page}`, borderRadius: '1.3888888889vw' }, menuTime)
        .to(main, { x: '-100%' }, STEP + menuTime)
        .to('#loader', { x: '0px' }, STEP + menuTime)
        .set(main, { x: '100%' });
      run.tl = tl;
      startNextTick(run, tl);
      return;
    }

    // The paper fade. It continues from the paper an interrupted arrival left, and
    // takes over from a loader card still in flight at once.
    const fade = FADE[run.plan];
    const paper = routePaper();
    const fading = [main, viewCanvas()].filter(Boolean);
    const cardInFlight = getComputedStyle(document.getElementById('loader')).display !== 'none';
    const paperShown = getComputedStyle(paper).display !== 'none';
    let paperFrom = paperShown ? Number(getComputedStyle(paper).opacity) : 0;
    if (cardInFlight) paperFrom = 1;
    gsap.set('#loader', { autoAlpha: 0, display: 'none' });
    gsap.set(main, { pointerEvents: 'none', willChange: 'opacity, transform' });
    let anims;
    if (run.plan === 'panel') {
      // The open panel covers the screen: the old page gives way to paper beneath it.
      gsap.set(paper, { display: 'block', autoAlpha: 1 });
      const hide = { duration: fade.hold, fill: 'both' };
      anims = fading.map((el) => el.animate({ opacity: [0, 0] }, hide));
      if (!run.steady) anims.push(header.animate({ opacity: [0, 0] }, hide));
    } else {
      gsap.set(paper, { display: 'block', autoAlpha: 1 });
      const out = { duration: fade.out, easing: EASE.in, fill: 'both' };
      anims = [paper.animate({ opacity: [paperFrom, 1] }, { duration: fade.paper, easing: EASE.out, fill: 'both' }), ...fading.map((el) => el.animate({ opacity: 0 }, out))];
      if (!run.steady) anims.push(header.animate({ opacity: 0 }, out));
      // A wide panel's shell (iPad) dims the page; bring it up to the paper.
      if (Number(gsap.getProperty(layoutRef.current, 'opacity')) < 1) anims.push(layoutRef.current.animate({ opacity: 1 }, { duration: fade.paper, easing: EASE.out, fill: 'both' }));
      const scrollbar = document.getElementById('scrollbar');
      if (scrollbar) anims.push(scrollbar.animate({ opacity: 0 }, out));
    }
    playPhase(run, anims, covered);
  };

  const handleEnter = () => {
    const run = runRef.current;
    run.from = router.asPath;
    setFooterPath(router.asPath);
    if (!useStore.getState().introOut) return;
    // A skip or the watchdog can mount the page before the exit has played out.
    if (run.phase === 'exit') finishPhase();
    const exitAnims = run.anims;
    run.start?.kill();
    run.tl = null;
    run.anims = [];
    run.phase = 'enter';
    run.ready = false;
    const main = mainRef.current;
    const header = siteHeader();
    const paper = routePaper();
    const { lenis } = useStore.getState();

    if (run.plan === 'instant' || run.skip || useStore.getState().still) {
      // The new page is simply there.
      gsap.set('#loader', { autoAlpha: 0, display: 'none' });
      gsap.set(layoutRef.current, { height: '100%', opacity: 1 });
      gsap.set(main, { x: 0, y: 0, scale: 1, borderRadius: 0, border: 'none', height: 'auto', pointerEvents: 'auto', opacity: 1 });
      gsap.set(header, { autoAlpha: 1, left: 0, top: 0, scale: 1 });
      run.anims = exitAnims;
      finishEnter();
      return;
    }

    if (run.plan === 'card') {
      const tl = gsap.timeline({ paused: true, onComplete: finishEnter, defaults: { ease: 'power2.inOut', duration: STEP } });
      tl.set(layoutRef.current, { height: '90%', opacity: 1, onComplete: () => setIsAbout(wantsSRGB(router.pathname)) }, 0)
        .to('#loader', { x: '-100%' }, 0)
        .to(main, { x: '0px' }, 0)
        .to(main, { borderRadius: 0, scale: 1 }, STEP)
        .to(layoutRef.current, { height: '100%', opacity: 1 }, STEP)
        .to(header, { autoAlpha: 1 }, STEP * 1.3)
        .to(main, { height: 'auto', border: 'none', pointerEvents: 'auto' }, STEP * 1.3);
      run.tl = tl;
      startNextTick(run, tl);
      return;
    }

    // The paper fade: the new page rises out of the paper, which clears once the
    // page is nearly opaque, so the Desk's dark windows deepen last.
    const fade = FADE[run.plan];
    const fading = [main, viewCanvas()].filter(Boolean);
    gsap.set('#loader', { autoAlpha: 0, display: 'none' });
    gsap.set(layoutRef.current, { height: '100%', opacity: 1 });
    gsap.set(main, { clearProps: 'transform,transformOrigin,left,border,borderRadius', opacity: 1, pointerEvents: 'auto', willChange: 'opacity, transform' });
    markPageShrunk(false);
    gsap.set(paper, { display: 'block', autoAlpha: 1 });
    if (!run.steady) gsap.set(header, { left: 0, top: 0, scale: 1, autoAlpha: 1 });
    const anims = fading.map((el) => el.animate({ opacity: [0, 1] }, { duration: fade.in, easing: EASE.out, fill: 'both' }));
    if (fade.rise) anims.push(main.animate({ transform: [`translateY(${fade.rise}px)`, 'none'] }, { duration: fade.in, easing: EASE.rise, fill: 'both' }));
    anims.push(paper.animate({ opacity: [1, 0] }, { delay: fade.clear, duration: fade.in - fade.clear - 20, easing: EASE.inOut, fill: 'both' }));
    if (!run.steady) anims.push(header.animate({ opacity: [0, 1] }, { delay: 40, duration: fade.in - 60, easing: EASE.out, fill: 'both' }));
    // The new animations hold the same look the exit's held, so they can go now.
    exitAnims.forEach((anim) => anim.cancel());
    lenis.resize();
    lenis.scrollTo(0, { force: true, immediate: true });
    playPhase(run, anims, finishEnter);
  };

  useEffect(() => {
    // A tap or key press during a page change finishes it at once; the tap then
    // reaches the new page as usual.
    const onInput = (event) => {
      const run = runRef.current;
      if (run.phase === 'idle') return;
      if (event.type === 'keydown' && (event.repeat || MODIFIER_KEYS.includes(event.key))) return;
      if (run.phase === 'exit') run.skip = true;
      finishPhase();
    };
    // Safari's edge swipe plays its own animation; the page change then needs none.
    const onPopState = (event) => {
      runRef.current.swipe = event.hasUAVisualTransition ? pathKey(window.location.pathname.slice(router.basePath.length)) : null;
    };
    document.addEventListener('pointerdown', onInput, true);
    document.addEventListener('keydown', onInput, true);
    window.addEventListener('popstate', onPopState, true);
    return () => {
      document.removeEventListener('pointerdown', onInput, true);
      document.removeEventListener('keydown', onInput, true);
      window.removeEventListener('popstate', onPopState, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause motion switched on during a page change finishes it.
  useEffect(() => {
    const run = runRef.current;
    if (!still || run.phase === 'idle') return;
    if (run.phase === 'exit') run.skip = true;
    finishPhase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  // Back and Forward to another page: Next would scroll the outgoing page to its top
  // as the change begins (for history entries it did not create with scroll: false),
  // a visible jump before the fade. The arriving page is reset to its top anyway.
  useEffect(() => {
    router.beforePopState((state) => {
      const as = String(state.as || '');
      const path = as.startsWith(router.basePath) ? as.slice(router.basePath.length) : as;
      if (pathKey(path) !== pathKey(router.asPath)) state.options.scroll = false;
      return true;
    });
    return () => router.beforePopState(() => true);
  }, [router]);

  // In-page anchors (#assignment-m2 from the menu, search or a link) never run the
  // curtain: close any open panel and glide to the item.
  useEffect(() => {
    let pending;
    const cancel = () => clearTimeout(pending);
    // Close the panel that initiated navigation, before the destination mounts.
    // A completion event must not dismiss a Search opened on the new view.
    const onHashStart = () => {
      cancel();
      closePanels();
    };
    const onHash = (url) => {
      cancel();
      runRef.current.swipe = null;
      const hash = String(url).split('#')[1];
      if (hash) {
        pending = setTimeout(
          () => {
            // A later click or browser Back can overtake the panel-close delay.
            if (window.location.hash.slice(1) === hash) scrollToHash({ hash });
          },
          useStore.getState().still ? 0 : 450,
        );
      }
    };
    router.events.on('hashChangeStart', onHashStart);
    router.events.on('routeChangeStart', cancel);
    router.events.on('hashChangeComplete', onHash);
    return () => {
      cancel();
      router.events.off('hashChangeStart', onHashStart);
      router.events.off('routeChangeStart', cancel);
      router.events.off('hashChangeComplete', onHash);
    };
  }, [router]);

  return (
    <>
      <SwitchTransition>
        <ReactTransition key={pathKey(router.asPath)} in={false} unmountOnExit timeout={animated ? WATCHDOG_MS : 0} addEndListener={addEndListener} onEnter={handleEnter} onExit={handleExit}>
          {children}
        </ReactTransition>
      </SwitchTransition>

      {courseIdFromPath(footerPath) ? (
        <CompactFooter />
      ) : (
        <>
          <CompanionStatement />
          <footer className={styles.footer}>
            <Footer />
          </footer>
        </>
      )}
    </>
  );
}

export default Layout;
