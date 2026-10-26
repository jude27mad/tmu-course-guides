import { SEARCH_COPY as COPY, SEARCH_GROUPS as GROUPS, getCourse, searchEntries, searchGuide, searchIndex } from '@src/lib';
import { buildPanelTimeline, trapPanelFocus } from '@src/components/dom/navbar/panelShell';
import { courseIdFromPath, pathKey } from '@src/utils/routes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';
import menuStyles from '@src/components/dom/navbar/styles/menuLinks.module.scss';
import styles from '@src/components/dom/navbar/styles/searchPanel.module.scss';
import useIsMobile from '@src/hooks/useIsMobile';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

// The old command palette (assets/night/palette.mjs) as the original menu panel:
// same index, groups, ranking, copy and keyboard model (combobox + listbox,
// Arrow keys, Home/End, Enter, Escape, Cmd/Ctrl-K), plus its last row,
// 'Search the guide for "…"', which lists the guides' full-text matches here.

const isMotionEntry = (entry) => entry.action === 'motion';

function Highlight({ text, indices }) {
  if (!indices?.length) return text;
  const marked = new Set(indices);
  const parts = [];
  let run = '';
  let runMarked = false;
  [...String(text)].forEach((char, position) => {
    const isMarked = marked.has(position);
    if (isMarked !== runMarked && run) {
      parts.push(runMarked ? <mark key={`mark-${parts.length}`}>{run}</mark> : run);
      run = '';
    }
    runMarked = isMarked;
    run += char;
  });
  if (run) parts.push(runMarked ? <mark key="mark-end">{run}</mark> : run);
  return parts;
}

function SearchPanel() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isSearchOpen, setIsSearchOpen, isLoading, still, motionSaved, motionReduced, toggleMotion] = useStore(
    useShallow((state) => [state.isSearchOpen, state.setIsSearchOpen, state.isLoading, state.still, state.motionSaved, state.motionReduced, state.toggleMotion]),
  );
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timeline = useRef(null);
  const openerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState(null);
  const [guideQuery, setGuideQuery] = useState(null);
  const [active, setActive] = useState(-1);
  const courseId = courseIdFromPath(router.asPath);

  const trimmed = query.trim();
  const guide = useMemo(() => (guideQuery && guideQuery === trimmed ? searchGuide(guideQuery, { course: courseId }) : null), [guideQuery, trimmed, courseId]);

  const results = useMemo(() => {
    if (guide) {
      return guide.results.map((result) => ({
        id: `guide-${result.href}-${result.title}`,
        group: null,
        title: result.title,
        detail: [getCourse(result.courseId)?.code, result.tab].filter(Boolean).join(' · '),
        href: result.href,
      }));
    }
    if (!entries) return [];
    const found = searchEntries(entries, query);
    if (!trimmed) return found;
    return [...found, { id: 'guide-search', group: null, type: 'guide-search', title: COPY.suggestion(trimmed), ariaLabel: COPY.suggestionLabel(trimmed) }];
  }, [entries, query, trimmed, guide]);
  const found = guide ? guide.results.length : results.filter((entry) => entry.type !== 'guide-search').length;

  useEffect(() => {
    const panel = panelRef.current;
    const tl = buildPanelTimeline(panel, panel.querySelectorAll('[data-menu-anim]'), { isMobile });
    timeline.current = tl;
    if (useStore.getState().isSearchOpen) tl.progress(1);
    return () => {
      tl.kill();
    };
  }, [isLoading, isMobile]);

  // The index is rebuilt on open (fresh time and saved progress) and when motion changes.
  useEffect(() => {
    if (!isSearchOpen) return;
    try {
      setEntries(searchIndex({ now: new Date(), course: courseId, motionForced: motionReduced }));
    } catch (error) {
      setEntries([]);
    }
  }, [isSearchOpen, motionSaved, motionReduced, courseId]);

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return undefined;
    let focusFrame = 0;
    let focusTimer = 0;
    panelRef.current.inert = !isSearchOpen;
    tl.timeScale(still ? 30 : 1);
    if (isSearchOpen) {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      const focused = document.activeElement;
      // Opened from the menu: focus goes back to the menu pill afterwards.
      openerRef.current = focused && !focused.closest?.('#menu') && focused !== document.body ? focused : document.getElementById('menu-button');
      setQuery('');
      setGuideQuery(null);
      if (still) tl.progress(1).pause();
      else tl.play();
      const enterSearch = () => {
        const panel = panelRef.current;
        if (useStore.getState().isSearchOpen && !panel?.contains(document.activeElement)) inputRef.current?.focus({ preventScroll: true });
      };
      focusFrame = requestAnimationFrame(() => {
        focusFrame = requestAnimationFrame(() => {
          enterSearch();
        });
      });
      focusTimer = window.setTimeout(enterSearch, 180);
    } else {
      const opener = openerRef.current;
      openerRef.current = null;
      const panel = panelRef.current;
      const restoreFocus = () => {
        const state = useStore.getState();
        if (!state.isSearchOpen && !state.isMenuOpen && !state.isTransitioning && opener?.isConnected && (panel?.contains(document.activeElement) || document.activeElement === document.body)) {
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
  }, [isSearchOpen]);

  // The first enabled result is active after every new search.
  useEffect(() => {
    setActive(results.findIndex((entry) => !entry.disabled));
  }, [results]);

  useEffect(() => {
    if (active < 0) return;
    const option = listRef.current?.querySelector(`[data-result="${active}"]`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = useCallback(() => setIsSearchOpen(false), [setIsSearchOpen]);

  const run = useCallback(
    (position) => {
      const entry = results[position];
      if (!entry || entry.disabled) return;
      if (isMotionEntry(entry)) {
        toggleMotion();
        return;
      }
      if (entry.type === 'guide-search') {
        setGuideQuery(trimmed);
        inputRef.current?.focus();
        return;
      }
      const { href } = entry;
      if (!href) return;
      if (entry.external || /^https?:\/\//.test(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        close();
        return;
      }
      const target = href.startsWith('#') ? `${pathKey(router.asPath)}${href}` : href;
      // Another page: the route transition closes the panel first (as with the menu).
      // The same page (an anchor on it): close here; Layout glides to the anchor.
      if (pathKey(target) === pathKey(router.asPath)) close();
      router.push(target, undefined, { scroll: false });
    },
    [results, router, close, toggleMotion, trimmed],
  );

  const step = (direction, edge = false) => {
    const enabled = results.map((entry, i) => (entry.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const at = enabled.indexOf(active);
    if (edge) setActive(direction > 0 ? enabled[enabled.length - 1] : enabled[0]);
    else setActive(enabled[(at + direction + enabled.length) % enabled.length]);
  };

  const onKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    trapPanelFocus(event, panelRef.current);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.target !== inputRef.current) return;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.key === 'ArrowDown') step(1);
    else if (event.key === 'ArrowUp') step(-1);
    else if (event.key === 'Home') step(-1, true);
    else if (event.key === 'End') step(1, true);
    else if (event.key === 'Enter') run(active);
  };

  // Consecutive results under their group heading (none for the guide rows).
  const grouped = [];
  results.forEach((entry, index) => {
    const key = entry.group || null;
    const last = grouped[grouped.length - 1];
    if (last && last.key === key) last.items.push({ entry, index });
    else grouped.push({ key, items: [{ entry, index }] });
  });

  let status = '';
  if (guide) status = guide.status;
  else if (trimmed) status = found ? COPY.results(found) : COPY.emptyLabel(trimmed);
  const showEmpty = !guide && trimmed && !found;

  return (
    // The dialog handles its own keys (Escape; the combobox model on the input).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div id="search" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="search-title" aria-hidden={!isSearchOpen} className={clsx(menuStyles.menu, styles.root)} onKeyDown={onKeyDown}>
      <div ref={scrollRef} className={clsx(menuStyles.menuWrapper, styles.wrapper, 'layout-block-inner')} data-lenis-prevent="">
        <div data-menu-anim="" className={styles.field}>
          <h2 id="search-title" className={menuStyles.menuHeading}>
            {COPY.title}
          </h2>
          <label htmlFor="search-input" className="sr-only">
            {COPY.label}
          </label>
          <div className={styles.inputLine}>
            <input
              ref={inputRef}
              id="search-input"
              className={clsx('h4', styles.input)}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isSearchOpen}
              aria-controls="search-results"
              aria-activedescendant={active >= 0 ? `search-option-${active}` : undefined}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder={COPY.placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                className={clsx('p-x', styles.clear)}
                aria-label={COPY.clearLabel}
                onClick={() => {
                  setQuery('');
                  setGuideQuery(null);
                  inputRef.current?.focus();
                }}
              >
                {COPY.clear}
              </button>
            )}
          </div>
        </div>

        <div data-menu-anim="" className={styles.results}>
          {showEmpty && (
            <p className={clsx('p-l', styles.empty)} aria-hidden="true">
              {COPY.empty(trimmed)}
            </p>
          )}
          {guide && (
            <p className={clsx('p-l', styles.empty)} aria-hidden="true">
              {guide.status}
            </p>
          )}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div id="search-results" role="listbox" aria-labelledby="search-title" ref={listRef} onPointerDown={(event) => event.preventDefault()}>
            {grouped.map((group) => (
              <div
                key={`${group.key}-${group.items[0].index}`}
                role={group.key ? 'group' : 'presentation'}
                aria-label={group.key ? GROUPS[group.key] || group.key : undefined}
                className={menuStyles.menuList}
              >
                {group.key && (
                  <div className={menuStyles.menuHeading} aria-hidden="true">
                    {group.key}
                  </div>
                )}
                {group.items.map(({ entry, index }) => (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={entry.id || `${entry.title}-${entry.href}`}
                    id={`search-option-${index}`}
                    data-result={index}
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === active}
                    aria-disabled={entry.disabled || undefined}
                    aria-label={entry.ariaLabel || undefined}
                    className={clsx(
                      menuStyles.menuListItem,
                      styles.option,
                      index === active && menuStyles.menuListItemActive,
                      entry.disabled && styles.disabled,
                      entry.type === 'guide-search' && styles.suggestion,
                    )}
                    onPointerMove={() => {
                      if (!entry.disabled && active !== index) setActive(index);
                    }}
                    onClick={() => run(index)}
                  >
                    <p>
                      <span>
                        <Highlight text={entry.title} indices={entry.match?.indices} />
                      </span>
                      {entry.detail && <small className={clsx('p-x', menuStyles.menuListItemMeta)}>{entry.detail}</small>}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {status}
        </p>

        <button type="button" onClick={close} className={menuStyles.menuClose} aria-label={COPY.closeLabel}>
          <span aria-hidden="true">&#10005;</span>
        </button>
      </div>
    </div>
  );
}

export default SearchPanel;
