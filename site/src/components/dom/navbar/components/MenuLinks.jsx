import { buildPanelTimeline, firstFocusable } from '@src/components/dom/navbar/panelShell';
import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import clsx from 'clsx';
import footerLinks from '@src/components/dom/navbar/constants/footerLinks';
import menuLinks from '@src/components/dom/navbar/constants/menuLinks';
import { pathKey } from '@src/utils/routes';
import styles from '@src/components/dom/navbar/styles/menuLinks.module.scss';
import { upcomingAcrossCourses } from '@src/utils/upcoming';
import useIsMobile from '@src/hooks/useIsMobile';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

const THIS_WEEK_SLOTS = 3;

function MenuLinks() {
  const timeline = useRef(null);
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen, setIsSearchOpen, isLoading, still, motionSaved, motionReduced, toggleMotion] = useStore(
    useShallow((state) => [state.isMenuOpen, state.setIsMenuOpen, state.setIsSearchOpen, state.isLoading, state.still, state.motionSaved, state.motionReduced, state.toggleMotion]),
  );
  const menuRef = useRef();
  const openerRef = useRef(null);
  const router = useRouter();
  const current = pathKey(router.asPath);
  const [thisWeek, setThisWeek] = useState([]);

  // Rows are fixed (three "This week" slots), so the timeline is built once per layout.
  useEffect(() => {
    const menu = menuRef.current;
    const items = menu.querySelectorAll('[data-menu-anim]');
    const tl = buildPanelTimeline(menu, items);
    timeline.current = tl;
    if (useStore.getState().isMenuOpen) tl.progress(1);
    return () => {
      tl.kill();
    };
  }, [isLoading, isMobile]);

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    tl.timeScale(still ? 30 : 1);
    if (isMenuOpen) {
      openerRef.current = document.activeElement;
      setThisWeek(upcomingAcrossCourses({ now: new Date(), count: THIS_WEEK_SLOTS }));
      tl.play();
      const target = firstFocusable(menuRef.current);
      // after the panel becomes visible (autoAlpha sets visibility on the first tick)
      requestAnimationFrame(() => requestAnimationFrame(() => target?.focus({ preventScroll: true })));
    } else if (useStore.getState().isSearchOpen) {
      // Handing over to the search panel: the shell stays open, the menu goes at once.
      tl.pause(0);
    } else {
      tl.reverse();
      const opener = openerRef.current;
      openerRef.current = null;
      const menu = menuRef.current;
      // after the navbar has made the header reachable again (inert is lifted in its effect)
      requestAnimationFrame(() => {
        if (opener && opener.isConnected && (menu?.contains(document.activeElement) || document.activeElement === document.body)) opener.focus({ preventScroll: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen]);

  const close = () => setIsMenuOpen(false);

  // Escape closes the menu.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
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

  const openSearch = () => {
    setIsMenuOpen(false);
    setIsSearchOpen(true);
  };

  const renderRow = (key, content, { active = false, className } = {}) => (
    <div key={key} data-menu-anim="" className={clsx(styles.menuListItem, active && styles.menuListItemActive, className)}>
      {content}
    </div>
  );

  const motionLabel = motionSaved ? 'Play motion' : 'Pause motion';

  return (
    <nav id="menu" ref={menuRef} className={styles.menu} aria-label="Menu" aria-hidden={!isMenuOpen}>
      <div className={clsx(styles.menuWrapper, 'layout-block-inner')} data-lenis-prevent="">
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

        <div data-menu-anim="" className={styles.menuList}>
          <h2 className={styles.menuHeading}>This week</h2>
          {Array.from({ length: THIS_WEEK_SLOTS }, (_, index) => {
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
            'search',
            <button type="button" onClick={openSearch} aria-haspopup="dialog" aria-controls="search">
              <span>SEARCH</span>
            </button>,
            { className: styles.mobileOnly },
          )}
          {renderRow(
            'motion',
            <button type="button" onClick={toggleMotion} disabled={motionReduced} aria-pressed={motionSaved} aria-describedby={motionReduced ? 'menu-motion-note' : undefined}>
              <span>{motionLabel}</span>
              {motionReduced && (
                <small id="menu-motion-note" className={clsx('p-x', styles.menuListItemMeta)}>
                  Reduced motion is enabled by your device or page setting
                </small>
              )}
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
          <span aria-hidden="true">&#10005;</span>
        </button>
      </div>
    </nav>
  );
}

export default MenuLinks;
