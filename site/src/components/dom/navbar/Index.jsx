import { nativeIOSScroll, scrollRoot, scrollTop, scrollViewport } from '@src/utils/scrollRoot';
import { buildShellTimeline } from '@src/components/dom/navbar/panelShell';
import { setBrowserSurfaces, setEdgeBleed } from '@src/utils/theme';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import MenuButton from '@src/components/dom/navbar/components/MenuButton';
import MenuLinks from '@src/components/dom/navbar/components/MenuLinks';
import SearchPanel from '@src/components/dom/navbar/components/SearchPanel';
import clsx from 'clsx';
import styles from '@src/components/dom/navbar/styles/index.module.scss';
import { useCallback, useEffect, useRef } from 'react';
import useIsMobile, { isMobileNow } from '@src/hooks/useIsMobile';
import useScroll from '@src/hooks/useScroll';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

const Time = dynamic(() => import('@src/components/dom/Time'), { ssr: false, loading: () => <span aria-hidden="true">--:--</span> });

// Safari 26's bottom bar covers about 56px of an iPhone's screen when collapsed
// and 98px when expanded; the footer counts as under it from about half of that.
const FOOTER_UNDER_BAR = 40;

function Navbar() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [lenis, isLoading, isMenuOpen, isSearchOpen, setIsSearchOpen, still, isTransitioning] = useStore(
    useShallow((state) => [state.lenis, state.isLoading, state.isMenuOpen, state.isSearchOpen, state.setIsSearchOpen, state.still, state.isTransitioning]),
  );
  const shellRef = useRef(null);
  const headerRef = useRef(null);
  const controlsRef = useRef(null);
  const headerHeight = useRef(0);
  const isOpen = isMenuOpen || isSearchOpen;

  // The shell owns the fixed outer header for its menu animation. Move its
  // controls with the real scroller so no floating button covers page content.
  const scrollHeader = useCallback(({ scroll }) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const height = headerHeight.current || headerRef.current?.offsetHeight || 0;
    const transform = `translateY(${-Math.min(Math.max(0, scroll), height)}px)`;
    if (controls.style.transform !== transform) controls.style.transform = transform;
    const offscreen = height > 0 && scroll >= height;
    if (controls.inert !== offscreen) {
      controls.dataset.scrolledAway = String(offscreen);
      controls.inert = offscreen;
    }
  }, []);
  useScroll(scrollHeader);
  useEffect(() => {
    const header = headerRef.current;
    const controls = controlsRef.current;
    if (!header || !controls) return undefined;
    const wordmark = controls.querySelector(`.${styles.wordmark}`);
    const clock = controls.querySelector('[data-toronto-clock]');
    const actions = controls.querySelector(`.${styles.rightContainer}`);
    const measure = () => {
      if (wordmark && clock && actions) {
        // Reserve equal space on both sides; stack only when it cannot fit.
        const requiredWidth = 2 * Math.max(wordmark.offsetWidth, actions.offsetWidth) + clock.offsetWidth;
        const stacked = String(requiredWidth > controls.clientWidth);
        if (controls.dataset.headerStacked !== stacked) controls.dataset.headerStacked = stacked;
      }
      headerHeight.current = header.offsetHeight;
      const baseline = parseFloat(getComputedStyle(controls).minHeight);
      const extra = Math.max(0, controls.offsetHeight - baseline);
      document.documentElement.style.setProperty('--navigation-extra-height', `${extra}px`);
      scrollHeader({ scroll: scrollTop() });
    };
    const observer = new ResizeObserver(measure);
    [header, wordmark, clock, actions].filter(Boolean).forEach((node) => observer.observe(node));
    measure();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--navigation-extra-height');
    };
  }, [scrollHeader]);

  const scrollToPosition = useCallback(
    (position, duration = 1.5) => {
      if (lenis) {
        lenis.scrollTo(position, {
          duration,
          force: true,
          immediate: still,
          easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
          onComplete: () => {
            lenis.start();
          },
        });
      }
    },
    [lenis, still],
  );

  const goToTop = useCallback(() => {
    if (router.pathname === '/') {
      scrollToPosition(0);
    }
  }, [router.pathname, scrollToPosition]);

  // The footer is an actual dark full-bleed surface. The previous browser-edge
  // fix considered only Menu/Search, leaving an off-white Safari bar at the
  // bottom of every course when the footer scrolled into view.
  useEffect(() => {
    let frame = 0;
    const main = document.querySelector('main');
    const scroller = scrollRoot();
    if (!main || !scroller) return undefined;
    const update = () => {
      frame = 0;
      const current = useStore.getState();
      const overlay = current.isMenuOpen || current.isSearchOpen;
      const footer = main.querySelector('footer [data-surface="dark"]');
      const scrollerRect = scrollViewport();
      const footerRect = footer?.getBoundingClientRect();
      // Sample what reaches the BOTTOM of the real scroll viewport, rather
      // than the route or menu state. This works across all course pages.
      // On iPhone and iPad the footer ends the document, and Safari stops the
      // document's end above its bottom bar, inside the viewport: the bottom is
      // dark as soon as the footer fills most of the area under that bar.
      const darkFooter = nativeIOSScroll()
        ? !!footerRect && footerRect.top < scrollerRect.bottom - FOOTER_UNDER_BAR
        : !!footerRect && footerRect.top < scrollerRect.bottom - 1 && footerRect.bottom >= scrollerRect.bottom - 1;
      setBrowserSurfaces(overlay ? 'dark' : 'light', overlay || darkFooter ? 'dark' : 'light');
    };
    // Pages that end in the dark footer continue it below their end; course
    // pages end light. The top of every page is light, but a dark panel can
    // start close to it (the cards on /courses/). Also run straight from the
    // scroll event, so a route change's reset to the top paints with its paper.
    // Only the document scroll mode (iPhone, iPad) reaches under browser bars.
    const edges = () => {
      if (!nativeIOSScroll()) return;
      const scrolled = window.scrollY;
      const viewport = window.innerHeight;
      const scrollable = document.scrollingElement.scrollHeight - viewport;
      const panels = Array.from(main.querySelectorAll('[data-surface="dark"]'))
        .map((panel) => panel.getBoundingClientRect())
        .filter((rect) => rect.height);
      const darkFromStart = Math.min(Infinity, ...panels.map((rect) => scrolled + rect.top));
      const darkFromEnd = Math.min(Infinity, ...panels.map((rect) => scrollable - scrolled + viewport - rect.bottom));
      setEdgeBleed({ scrollTop: scrolled, maxScroll: scrollable, endsDark: !!main.querySelector('footer [data-surface="dark"]'), darkFromStart, darkFromEnd });
    };
    const schedule = () => {
      edges();
      if (!frame) frame = requestAnimationFrame(update);
    };
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    const observer = new MutationObserver(schedule);
    observer.observe(main, { childList: true, subtree: true });
    // Course content can expand after hydration and its route transition.
    // Recheck when layout geometry changes even without a scroll event.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(main);
    if (main.firstElementChild) resizeObserver.observe(main.firstElementChild);
    const footer = main.querySelector('footer [data-surface="dark"]');
    if (footer) resizeObserver.observe(footer);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [isOpen, isLoading, router.asPath]);

  // Shared panel shell: desktop moves the page, mobile leaves it stationary.
  useEffect(() => {
    const tl = buildShellTimeline({ isMobile });
    shellRef.current = tl;
    if (useStore.getState().isMenuOpen || useStore.getState().isSearchOpen) tl.progress(1);
    return () => {
      // Restore the previous presentation before crossing a breakpoint. Route
      // transitions keep owning main/header when only isLoading changes.
      if (isMobile !== isMobileNow() && tl.progress() > 0) tl.progress(0);
      tl.kill();
    };
  }, [isLoading, isMobile]);

  useEffect(() => {
    const tl = shellRef.current;
    if (!tl) return;
    tl.timeScale(still ? 30 : 1);
    if (isTransitioning && nativeIOSScroll()) {
      // Route entry owns the document's opacity/geometry until it settles.
      // Reversing the menu shell here would reveal the outgoing page again.
      tl.pause();
    } else if (isOpen) {
      tl.play();
    } else {
      tl.reverse();
    }

    // While a panel is open, the page underneath is out of reach (focus, screen readers).
    const layout = document.getElementById('layout');
    const header = document.querySelector('header');
    [layout, header].forEach((node) => {
      if (!node) return;
      if (isOpen) node.setAttribute('inert', '');
      else node.removeAttribute('inert');
    });

    const { lenis: currentLenis, isLoading: loading, isTransitioning: transitioning } = useStore.getState();
    if (currentLenis && !loading && !transitioning) {
      if (isOpen) currentLenis.stop();
      else currentLenis.start();
    }
  }, [isOpen, still, isTransitioning]);

  // Cmd/Ctrl-K toggles the search panel (the old palette's shortcut).
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.isComposing && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const state = useStore.getState();
        if (state.isSearchOpen) {
          state.setIsSearchOpen(false);
        } else if (!state.isLoading) {
          if (state.isMenuOpen) state.setIsMenuOpen(false);
          state.setIsSearchOpen(true);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const openSearch = useCallback(() => {
    if (!useStore.getState().isLoading) setIsSearchOpen(true);
  }, [setIsSearchOpen]);

  return (
    <>
      <div aria-hidden="true" className={styles.panelBackdrop} data-open={isOpen} />
      <MenuLinks />
      <SearchPanel />

      <header ref={headerRef} className={styles.root}>
        <div ref={controlsRef} className={styles.innerHeader}>
          <Link onClick={goToTop} aria-label="TMU Course Guides, Desk" scroll={false} href="/" className={styles.wordmark}>
            <span className={clsx('bold', 'h4')}>GUIDES</span>
          </Link>

          <div className={clsx(styles.clock, 'p-x')} data-toronto-clock>
            <span>Toronto</span>
            <Time />
          </div>
          <div className={styles.rightContainer}>
            {!isMobile && <ButtonLink glass onClick={openSearch} label="SEARCH" ariaLabel="Search the guide. Shortcut: Command K" ariaHaspopup="dialog" ariaControls="search" />}
            <MenuButton />
          </div>
        </div>
      </header>
    </>
  );
}

export default Navbar;
