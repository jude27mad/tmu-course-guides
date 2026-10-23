import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Transition as ReactTransition, SwitchTransition } from 'react-transition-group';
import { courseIdFromPath, pathKey, wantsSRGB } from '@src/utils/routes';

import Footer from '@src/components/dom/Footer';
import CompactFooter from '@src/pages/course/components/workspace/CompactFooter';
import PreFooter from '@src/components/dom/PreFooter';
import gsap from 'gsap';
import { scrollToHash } from '@src/utils/scrollToHash';
import styles from '@src/components/dom/styles/layout.module.scss';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';
import { TOKENS } from '@src/lib/palette.mjs';

// The original route curtain (main shrinks to a card and slides out left while the
// "Loading" card slides in, then the reverse), retimed from ~6.35 s to ~2.2 s:
// exit 0.8 s (+0.8 s when a panel has to close first), enter 1.3 s.
const STEP = 0.4;
const ENTER_DELAY = 0.25;
const ENTER_MS = 1400;
const EXIT_MS = 850;
const PANEL_CLOSE = 0.8;

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

function Layout({ children, layoutRef, mainRef, router }) {
  const [lenis, introOut, setIsLoading, isMenuOpen, isSearchOpen, setIsAbout, still] = useStore(
    useShallow((state) => [state.lenis, state.introOut, state.setIsLoading, state.isMenuOpen, state.isSearchOpen, state.setIsAbout, state.still]),
  );

  const enterTimelineRef = useRef();
  const exitTimelineRef = useRef();

  const [isEntering, setIsEntering] = useState(false);

  const panelOpen = isMenuOpen || isSearchOpen;
  const menuTime = useMemo(() => (panelOpen ? PANEL_CLOSE : 0), [panelOpen]);
  const animated = introOut && !still;

  const closePanels = () => {
    const state = useStore.getState();
    if (state.isMenuOpen) state.setIsMenuOpen(false);
    if (state.isSearchOpen) state.setIsSearchOpen(false);
  };

  const finishEnter = () => {
    setIsAbout(wantsSRGB(router.pathname));
    useStore.getState().setIsTransitioning(false);
    setIsLoading(false);
    lenis.start();
    gsap.set(mainRef.current, { willChange: 'auto' });
    landOnPage();
    scrollToHash({ immediate: true });
  };

  const handleEnter = useCallback(
    () => {
      if (!introOut) return;
      // The exit is timed to end just before the new page mounts; on a janky frame it
      // may be a tick short, so finish it (its onComplete parks main and sets isLoading).
      if (exitTimelineRef.current) exitTimelineRef.current.progress(1);

      if (still) {
        // Motion off: no curtain; the new page is simply there.
        gsap.set('#loader', { x: '100%' });
        gsap.set(layoutRef.current, { height: '100%', opacity: 1 });
        gsap.set(mainRef.current, { x: 0, scale: 1, borderRadius: 0, border: 'none', height: 'auto', pointerEvents: 'auto', opacity: 1 });
        gsap.set('header', { autoAlpha: 1, left: 0, top: 0, scale: 1 });
        finishEnter();
        return;
      }

      const tl = gsap.timeline({ onComplete: finishEnter });

      enterTimelineRef.current = tl;
      setIsEntering(true);

      tl.set(
        layoutRef.current,
        {
          height: '90%',
          opacity: 1,
          onComplete: () => {
            setIsAbout(wantsSRGB(router.pathname));
            setIsEntering(false);
          },
        },
        ENTER_DELAY,
      )
        .to('#loader', { x: '-100%', ease: 'power2.inOut', duration: STEP }, ENTER_DELAY)
        .to(mainRef.current, { ease: 'power2.inOut', x: '0px', duration: STEP }, ENTER_DELAY)
        .to(mainRef.current, { ease: 'power2.inOut', borderRadius: 0, scale: 1, duration: STEP }, ENTER_DELAY + STEP)
        .to(layoutRef.current, { ease: 'power2.inOut', height: '100%', opacity: 1, duration: STEP }, ENTER_DELAY + STEP)
        .to('header', { ease: 'power2.inOut', autoAlpha: 1, duration: STEP }, ENTER_DELAY + STEP * 1.6)
        .to(mainRef.current, { ease: 'power2.inOut', height: 'auto', border: 'none', pointerEvents: 'auto', duration: STEP }, ENTER_DELAY + STEP * 1.6);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [introOut, still],
  );

  const handleExit = useCallback(
    () => {
      if (!introOut) return;
      if (enterTimelineRef.current) enterTimelineRef.current.pause();

      useStore.getState().setIsTransitioning(true);
      lenis.stop();
      closePanels();

      if (still) {
        setIsLoading(true);
        lenis.scrollTo(0, { force: true, immediate: true });
        return;
      }

      if (isEntering === false) {
        const tl = gsap.timeline({
          onComplete: () => {
            setIsLoading(true);
            lenis.scrollTo(0, { force: true, immediate: true });
          },
        });

        exitTimelineRef.current = tl;
        tl.set(mainRef.current, { willChange: 'transform' }, 0);

        if (document?.getElementById('scrollbar')) {
          tl.to(document.getElementById('scrollbar'), { ease: 'power2.inOut', autoAlpha: 0, duration: STEP }, menuTime);
        }

        tl.to(
          'header',
          {
            ease: 'power2.inOut',
            autoAlpha: 0,
            duration: STEP,
            onComplete: () => {
              gsap.set('#loader', {
                scale: 0.9,
                x: '100%',
                borderRadius: '1.3888888889vw',
                autoAlpha: 1, // hidden if the intro ran with motion off
              });
              gsap.set('header', {
                left: 0,
                top: 0,
                scale: 1,
                duration: 0,
              });
            },
            overwrite: true,
          },
          menuTime,
        )
          .to(layoutRef.current, { ease: 'power2.inOut', height: '90svh', opacity: 1, duration: STEP }, menuTime)
          .to(
            mainRef.current,
            {
              ease: 'power2.inOut',
              scale: 0.9,
              opacity: 1,
              border: `2px solid ${TOKENS.page}`,
              borderRadius: '1.3888888889vw',
              duration: STEP,
            },
            menuTime,
          )
          .to(mainRef.current, { ease: 'power2.inOut', x: '-100%', duration: STEP }, STEP + menuTime)
          .to('#loader', { ease: 'power2.inOut', x: '0px', duration: STEP }, STEP + menuTime)
          .set(mainRef.current, { x: '100%' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [introOut, menuTime, isEntering, still],
  );

  // In-page anchors (#assignment-m2 from the menu, search or a link) never run the
  // curtain: close any open panel and glide to the item.
  useEffect(() => {
    let pending;
    const cancel = () => clearTimeout(pending);
    const onHash = (url) => {
      cancel();
      closePanels();
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
    router.events.on('hashChangeStart', cancel);
    router.events.on('routeChangeStart', cancel);
    router.events.on('hashChangeComplete', onHash);
    return () => {
      cancel();
      router.events.off('hashChangeStart', cancel);
      router.events.off('routeChangeStart', cancel);
      router.events.off('hashChangeComplete', onHash);
    };
  }, [router]);

  return (
    <>
      <SwitchTransition>
        <ReactTransition
          key={pathKey(router.asPath)}
          in={false}
          unmountOnExit
          timeout={{
            enter: animated ? ENTER_MS : 0,
            exit: animated ? EXIT_MS + menuTime * 1000 : 0,
          }}
          onEnter={handleEnter}
          onExit={handleExit}
        >
          {children}
        </ReactTransition>
      </SwitchTransition>

      {courseIdFromPath(router.asPath) ? (
        <CompactFooter />
      ) : (
        <>
          <PreFooter />
          <footer className={styles.footer}>
            <Footer />
          </footer>
        </>
      )}
    </>
  );
}

export default Layout;
