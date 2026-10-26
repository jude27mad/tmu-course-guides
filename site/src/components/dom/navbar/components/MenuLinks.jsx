import { buildPanelTimeline, firstFocusable, trapPanelFocus } from '@src/components/dom/navbar/panelShell';
import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import clsx from 'clsx';
import footerLinks from '@src/components/dom/navbar/constants/footerLinks';
import menuLinks from '@src/components/dom/navbar/constants/menuLinks';
import { openSearchPanel } from '@src/components/dom/navbar/components/SearchPanel';
import { pathKey } from '@src/utils/routes';
import styles from '@src/components/dom/navbar/styles/menuLinks.module.scss';
import { upcomingAcrossCourses } from '@src/utils/upcoming';
import useIsMobile from '@src/hooks/useIsMobile';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

const UPCOMING_SLOTS = 3;

function MenuLinks() {
  const timeline = useRef(null);
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen, isLoading, still, motionSaved, motionReduced, toggleMotion] = useStore(
    useShallow((state) => [state.isMenuOpen, state.setIsMenuOpen, state.isLoading, state.still, state.motionSaved, state.motionReduced, state.toggleMotion]),
  );
  const menuRef = useRef();
  const scrollRef = useRef(null);
  const openerRef = useRef(null);
  const router = useRouter();
  const current = pathKey(router.asPath);
  const [thisWeek, setThisWeek] = useState([]);

  // Rows are fixed (three upcoming slots), so the timeline is built once per layout.
  useEffect(() => {
    const menu = menuRef.current;
    const items = menu.querySelectorAll('[data-menu-anim]');
    const tl = buildPanelTimeline(menu, items, { isMobile });
    timeline.current = tl;
    if (useStore.getState().isMenuOpen) tl.progress(1);
    return () => {
      tl.kill();
    };
  }, [isLoading, isMobile]);

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return undefined;
    let focusFrame = 0;
    let focusTimer = 0;
    menuRef.current.inert = !isMenuOpen;
    tl.timeScale(still ? 30 : 1);
    if (isMenuOpen) {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      const focused = document.activeElement;
      // Safari taps need not focus the button. Always have a reachable opener
      // to restore after Close or Escape, including a quick close/reopen.
      openerRef.current = focused && focused !== document.body && !menuRef.current.contains(focused) ? focused : document.getElementById('menu-button');
      setThisWeek(upcomingAcrossCourses({ now: new Date(), count: UPCOMING_SLOTS }));
      // Finish immediately when motion is paused. A 30x tween can finish in
      // the same frame as the tap, before Safari accepts focus in the panel.
      if (still) tl.progress(1).pause();
      else tl.play();
      const target = firstFocusable(menuRef.current);
      const enterMenu = () => {
        const menu = menuRef.current;
        if (useStore.getState().isMenuOpen && !menu?.contains(document.activeElement)) target?.focus({ preventScroll: true });
      };
      // Allow the modal to become visible and inert to be lifted. Recheck
      // after rapid reduced-motion transitions or hydration settle.
      focusFrame = requestAnimationFrame(() => {
        focusFrame = requestAnimationFrame(() => {
          enterMenu();
        });
      });
      focusTimer = window.setTimeout(enterMenu, 180);
    } else if (useStore.getState().isSearchOpen) {
      // Handing over to the search panel: the shell stays open, the menu goes at once.
      tl.pause(0);
    } else {
      const opener = openerRef.current;
      openerRef.current = null;
      const menu = menuRef.current;
      // The header must finish becoming visible as well as lifting inert before
      // Safari will accept focus. Do this after the closing animation completes.
      const restoreFocus = () => {
        const state = useStore.getState();
        if (!state.isMenuOpen && !state.isSearchOpen && !state.isTransitioning && opener?.isConnected && (menu?.contains(document.activeElement) || document.activeElement === document.body)) {
          opener.focus({ preventScroll: true });
        }
      };
      tl.eventCallback('onReverseComplete', restoreFocus);
      if (still) tl.progress(0).pause();
      else tl.reverse();
      if (tl.progress() === 0) focusFrame = requestAnimationFrame(restoreFocus);
      focusTimer = window.setTimeout(restoreFocus, still ? 100 : 500);
    }
    return () => {
      cancelAnimationFrame(focusFrame);
      clearTimeout(focusTimer);
      tl.eventCallback('onReverseComplete', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen]);

  const close = () => {
    if (isMobile) {
      // Restore focus while Close/Escape is still the user's direct action.
      // WebKit may ignore focus() from a later animation callback.
      const header = document.querySelector('header');
      if (header) {
        header.inert = false;
        header.style.visibility = 'visible';
      }
      const opener = openerRef.current || document.getElementById('menu-button');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
    setIsMenuOpen(false);
  };

  // Escape closes the menu; Tab stays within the modal until it closes.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      trapPanelFocus(event, menuRef.current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen]);

  // A link to the page already open (or one of its anchors) has no route
  // transition to close the menu, so close it here.
  const onLinkClick = (href) => () => {
    if (pathKey(href) === current) close();
  };

  const renderRow = (key, content, { active = false, className } = {}) => (
    <div key={key} data-menu-anim="" className={clsx(styles.menuListItem, active && styles.menuListItemActive, className)}>
      {content}
    </div>
  );

  const motionLabel = motionSaved ? 'Play motion' : 'Pause motion';
  const motionHint = motionSaved ? 'Restores animation and glass effects' : 'Stops animation and makes glass controls solid';

  return (
    <div id="menu" ref={menuRef} className={styles.menu} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!isMenuOpen}>
      <nav ref={scrollRef} className={clsx(styles.menuWrapper, 'layout-block-inner')} data-lenis-prevent="" aria-label="Site navigation">
        {renderRow(
          'search',
          <button type="button" onClick={openSearchPanel} aria-label="Search the guide. Shortcut: Command K" aria-haspopup="dialog" aria-controls="search">
            <span>SEARCH</span>
          </button>,
        )}
        <div data-menu-anim="" className={styles.menuList}>
          <h2 className={styles.menuHeading}>Sitemap</h2>
          {menuLinks.map((link) =>
            renderRow(
              link.title,
              <Link scroll={false} href={link.href} onClick={onLinkClick(link.href)} aria-current={current === link.href ? 'page' : undefined}>
                <span>{link.title}</span>
              </Link>,
              { active: current === link.href },
            ),
          )}
        </div>

        <div data-menu-anim="" className={clsx(styles.menuList, styles.upcomingList)}>
          <h2 className={styles.menuHeading}>Coming up</h2>
          {Array.from({ length: UPCOMING_SLOTS }, (_, index) => {
            const item = thisWeek[index];
            if (!item) {
              return renderRow(
                `slot-${index}`,
                index === 0 && thisWeek.length === 0 ? (
                  <p>
                    <span>No upcoming deadlines</span>
                  </p>
                ) : null,
                { className: styles.menuListItemEmpty },
              );
            }
            return renderRow(
              `slot-${index}`,
              <Link scroll={false} href={item.href} onClick={onLinkClick(item.href)} aria-label={`${item.title}, ${item.code}, ${item.when}`}>
                <span>{item.title}</span>
                <small className={clsx('p-x', styles.menuListItemMeta)}>{[item.code, item.when].filter(Boolean).join(' · ')}</small>
              </Link>,
            );
          })}
        </div>

        <div data-menu-anim="" className={styles.menuList}>
          {renderRow(
            'motion',
            <button type="button" onClick={toggleMotion} disabled={motionReduced} aria-label={motionLabel} aria-pressed={motionSaved} aria-describedby="menu-motion-note">
              <span>{motionLabel}</span>
              <small id="menu-motion-note" className={clsx('p-x', styles.menuListItemMeta)}>
                {motionReduced ? 'Reduced motion is enabled by your device or page setting' : motionHint}
              </small>
            </button>,
          )}
        </div>

        <div data-menu-anim="" className={styles.menuList}>
          <h2 className={styles.menuHeading}>Official sources</h2>
          {footerLinks.map((link) =>
            renderRow(
              link.title,
              <a target="_blank" rel="noopener noreferrer" href={link.href}>
                <span>{link.title}</span>
              </a>,
            ),
          )}
        </div>
        <button type="button" onClick={close} className={styles.menuClose} aria-label="Close menu">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
            <path d="M3 3 17 17M17 3 3 17" />
          </svg>
        </button>
      </nav>
    </div>
  );
}

export default MenuLinks;
