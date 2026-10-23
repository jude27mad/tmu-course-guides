import { buildShellTimeline } from '@src/components/dom/navbar/panelShell';
import { setBrowserSurface } from '@src/utils/theme';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import Link from 'next/link';
import MenuButton from '@src/components/dom/navbar/components/MenuButton';
import MenuLinks from '@src/components/dom/navbar/components/MenuLinks';
import SearchPanel from '@src/components/dom/navbar/components/SearchPanel';
import clsx from 'clsx';
import styles from '@src/components/dom/navbar/styles/index.module.scss';
import { useCallback, useEffect, useRef } from 'react';
import useIsMobile from '@src/hooks/useIsMobile';
import useScroll from '@src/hooks/useScroll';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

function Navbar() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [lenis, isLoading, isMenuOpen, isSearchOpen, setIsSearchOpen, still] = useStore(
    useShallow((state) => [state.lenis, state.isLoading, state.isMenuOpen, state.isSearchOpen, state.setIsSearchOpen, state.still]),
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
    if (!header) return undefined;
    const measure = () => {
      headerHeight.current = header.offsetHeight;
      scrollHeader({ scroll: document.querySelector('main')?.scrollTop || 0 });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    return () => observer.disconnect();
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
    if (!main) return undefined;
    const update = () => {
      frame = 0;
      const current = useStore.getState();
      const overlay = current.isMenuOpen || current.isSearchOpen;
      const footer = main.querySelector('footer');
      const scrollerRect = main.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      // Sample what reaches the BOTTOM of the real scroll viewport, rather
      // than the route or menu state. This works across all course pages.
      const darkFooter = !!footerRect && footerRect.top < scrollerRect.bottom - 1 && footerRect.bottom >= scrollerRect.bottom - 1;
      setBrowserSurface(overlay || darkFooter ? 'dark' : 'light');
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    main.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    const observer = new MutationObserver(schedule);
    observer.observe(main, { childList: true, subtree: true });
    // Course content can expand after hydration and its route transition.
    // Recheck when layout geometry changes even without a scroll event.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(main);
    if (main.firstElementChild) resizeObserver.observe(main.firstElementChild);
    const footer = main.querySelector('footer');
    if (footer) resizeObserver.observe(footer);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      main.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [isOpen, isLoading, router.asPath]);

  // The shared "main slides left" animation for the menu and the search panel.
  useEffect(() => {
    const tl = buildShellTimeline({ isMobile });
    shellRef.current = tl;
    if (useStore.getState().isMenuOpen || useStore.getState().isSearchOpen) tl.progress(1);
    return () => {
      tl.kill();
    };
  }, [isLoading, isMobile]);

  useEffect(() => {
    const tl = shellRef.current;
    if (!tl) return;
    tl.timeScale(still ? 30 : 1);
    if (isOpen) {
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

    const { lenis: currentLenis, isLoading: loading, isTransitioning } = useStore.getState();
    if (currentLenis && !loading && !isTransitioning) {
      if (isOpen) currentLenis.stop();
      else currentLenis.start();
    }
  }, [isOpen, still]);

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
      <MenuLinks />
      <SearchPanel />

      <header ref={headerRef} className={styles.root}>
        <div ref={controlsRef} className={styles.innerHeader}>
          <Link onClick={goToTop} aria-label="TMU Course Guides, Desk" scroll={false} href="/" className={styles.wordmark}>
            <span className={clsx('bold', 'h4')}>GUIDES</span>
          </Link>

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
