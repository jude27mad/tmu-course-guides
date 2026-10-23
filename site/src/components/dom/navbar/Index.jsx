import { buildShellTimeline } from '@src/components/dom/navbar/panelShell';
import { setBrowserSurface } from '@src/utils/theme';
import ButtonLink from '@src/components/animationComponents/buttonLink/Index';
import Link from 'next/link';
import MenuButton from '@src/components/dom/navbar/components/MenuButton';
import MenuLinks from '@src/components/dom/navbar/components/MenuLinks';
import SearchPanel from '@src/components/dom/navbar/components/SearchPanel';
import clsx from 'clsx';
import styles from '@src/components/dom/navbar/styles/index.module.scss';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const isOpen = isMenuOpen || isSearchOpen;
  const [atTop, setAtTop] = useState(true);

  // The wordmark has no backing, so page text scrolling under it ran into it.
  // It shows at the top of each page and fades out once the page scrolls.
  useScroll(({ scroll }) => setAtTop(scroll < 24));

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

  // Safari's exposed toolbar region follows the currently visible overlay.
  // This is independent of route palettes; both Menu and Search use the same shell.
  useEffect(() => {
    setBrowserSurface(isOpen ? 'dark' : 'light');
    return () => setBrowserSurface('light');
  }, [isOpen]);

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

      <header className={styles.root}>
        <div className={styles.innerHeader}>
          <Link onClick={goToTop} aria-label="TMU Course Guides, Desk" scroll={false} href="/" className={clsx(styles.wordmark, !atTop && styles.wordmarkHidden)}>
            <span className={clsx('bold', 'h4')}>GUIDES</span>
          </Link>

          <div className={styles.rightContainer}>
            {!isMobile && <ButtonLink onClick={openSearch} label="SEARCH" ariaLabel="Search the guide. Shortcut: Command K" ariaHaspopup="dialog" ariaControls="search" />}
            <MenuButton />
          </div>
        </div>
      </header>
    </>
  );
}

export default Navbar;
