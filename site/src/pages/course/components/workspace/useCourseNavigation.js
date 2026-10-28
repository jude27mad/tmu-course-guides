import { scrollRoot, scrollTop, scrollViewport } from '@src/utils/scrollRoot';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import gsap from 'gsap';
import { useStore } from '@src/store';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import useDelayedFeedback from '@src/hooks/useDelayedFeedback';
// eslint-disable-next-line import/extensions
import { openGuideTools } from '@src/pages/course/components/tools/dialog.mjs';
// eslint-disable-next-line import/extensions
import { resolveCourseLocation } from './location.mjs';

const hashOf = () => window.location.hash.replace(/^#/, '');
// Match the shell's power2 slide easing, at a shorter pace for in-course moves.
const VIEW_MOTION = { duration: 0.26, ease: 'power2.inOut' };
const viewKey = (location) => location.item?.anchor || (location.infoDetail && location.panel) || location.view;
const isDetail = (location) => location?.item || location?.infoDetail;
const resetContent = (content) => {
  if (!content) return;
  gsap.set(content, {
    clearProps: 'transform,opacity,willChange,pointerEvents',
  });
  content.inert = false;
  content.removeAttribute('aria-busy');
};
// Next strips custom history fields during popstate; keep a bounded in-memory copy
// keyed by its entry key, including across course route unmounts. No progress keys change.
const snapshots = new Map();
const saveEntry = (entry, persist = true) => {
  snapshots.set(entry.key, entry);
  if (snapshots.size > 100) snapshots.delete(snapshots.keys().next().value);
  if (persist) window.history.replaceState({ ...window.history.state, courseWorkspace: entry }, '');
};

// Keep snapshots on each browser-history entry, never in progress storage.
// Next owns the URLs/history keys; retain its state when attaching our snapshot.
export default function useCourseNavigation(courseId, info) {
  const router = useRouter();
  const isLoading = useStore((state) => state.isLoading);
  const still = useStore((state) => state.still);
  const [entry, setEntry] = useState({
    courseId,
    hash: '',
    key: '',
    initial: true,
    scroll: 0,
    focus: null,
    returnTo: null,
  });
  const [requested, setRequested] = useState(null);
  const active = useRef(null);
  const restoring = useRef(false);
  const transition = useRef(null);
  const pending = useRef(null);
  const reveal = useRef(false);
  const focusAtNavigation = useRef(null);
  const location = resolveCourseLocation(entry.hash, courseId, info);
  const showOpening = useDelayedFeedback(requested ? `${courseId}:${viewKey(requested)}` : null);

  const remember = useCallback((event) => {
    const previous = active.current;
    if (!previous || restoring.current || previous.hash !== hashOf()) return;
    const focus = document.activeElement;
    const next = {
      ...previous,
      scroll: scrollTop(),
      focus: focus?.id || previous.focus,
    };
    active.current = next;
    // Scroll frames only update memory. Persist when navigating/leaving instead
    // of serializing history on every frame (and hitting browser write limits).
    saveEntry(next, event?.type !== 'scroll');
  }, []);

  const navigate = useCallback(
    (hash) => {
      remember();
      return router.push({ pathname: router.pathname, query: router.query, hash }, undefined, { shallow: true, scroll: false }).catch((error) => {
        // Next rejects the previous render when a newer filter wins. This is a
        // successful interruption, not an unhandled page error.
        if (error.cancelled) return false;
        throw error;
      });
    },
    [remember, router],
  );

  useEffect(() => {
    const sync = () => {
      const hash = hashOf();
      const key = window.history.state?.key || hash;
      if (active.current?.key === key && active.current?.hash === hash) return;
      const saved = snapshots.get(key) || window.history.state?.courseWorkspace;
      const previous = active.current;
      const target = resolveCourseLocation(hash, courseId, info);
      const inPlace = !target.item && (!target.panel || target.panel === 'course-info');
      const validSaved = saved?.courseId === courseId && saved.hash === hash;
      const from = previous && resolveCourseLocation(previous.hash, courseId, info);
      let returnTo = null;
      if (isDetail(target) && from) {
        if (isDetail(from) && previous.returnTo && !!from.item === !!target.item)
          returnTo = {
            ...previous.returnTo,
            depth: (previous.returnTo.depth || 1) + 1,
          };
        // A detail opened from another detail that was itself opened directly (a link, search, reload)
        // has nowhere better to return than its view: "Back to Work" must not land on the other detail.
        else if (!(from.item && target.item && !previous.returnTo)) returnTo = { hash: previous.hash, view: from.view, depth: 1 };
      }
      const next = validSaved
        ? // `initial` describes this page view: Back to the first entry is not a fresh load, so focus returns.
          { ...saved, key, restore: true, initial: !previous }
        : {
            courseId,
            hash,
            key,
            initial: !previous,
            scroll: inPlace ? scrollTop() : 0,
            inPlace,
            focus: null,
            returnTo,
          };
      active.current = next;
      restoring.current = true;
      focusAtNavigation.current = document.activeElement;
      saveEntry(next);
      // Keep the outgoing view mounted until it has left. The URL remains the
      // source of truth; another click/Back cancels this tween and wins immediately.
      transition.current?.kill();
      const content = document.getElementById('course-content');
      const state = useStore.getState();
      const animate = previous && content && !state.still && !state.isLoading && !['guide-tools', 'math-tools'].includes(hash) && viewKey(from) !== viewKey(target);
      reveal.current = !!animate;
      pending.current = next;
      setRequested(animate ? target : null);
      const commit = () => {
        pending.current = null;
        setEntry(next);
      };
      if (animate) {
        content.inert = true;
        content.setAttribute('aria-busy', 'true');
        gsap.set(content, {
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        });
        transition.current = gsap.to(content, {
          ...VIEW_MOTION,
          duration: 0.12,
          x: -12,
          opacity: 0,
          onComplete: commit,
        });
      } else {
        resetContent(content);
        commit();
      }
    };
    const onGuideHash = (event) => {
      const id = event.detail?.id;
      if (!id || ['guide-tools', 'math-tools'].includes(id)) return;
      event.preventDefault();
      // This is a scroll notification, sometimes delayed by the shell. The
      // current URL owns navigation; replaying its old id creates history loops.
      sync();
    };
    const onRouteStart = (url) => {
      remember(url);
      // The outgoing workspace can stay mounted during the route animation.
      // Its old tab request must not announce itself while leaving the course.
      setRequested(null);
    };
    router.events.on('hashChangeStart', remember);
    router.events.on('routeChangeStart', onRouteStart);
    router.events.on('hashChangeComplete', sync);
    router.events.on('routeChangeComplete', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('pagehide', remember);
    document.addEventListener('guide-hash', onGuideHash);
    scrollRoot()?.addEventListener('scroll', remember, { passive: true });
    sync();
    return () => {
      router.events.off('hashChangeStart', remember);
      router.events.off('routeChangeStart', onRouteStart);
      router.events.off('hashChangeComplete', sync);
      router.events.off('routeChangeComplete', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      window.removeEventListener('pagehide', remember);
      document.removeEventListener('guide-hash', onGuideHash);
      scrollRoot()?.removeEventListener('scroll', remember);
    };
  }, [courseId, info, router.events, remember]);

  // Changing the motion preference mid-flight must never leave hidden content.
  useEffect(() => {
    if (!still) return;
    if (pending.current) {
      transition.current?.kill();
      const next = pending.current;
      pending.current = null;
      reveal.current = false;
      setEntry(next);
    } else transition.current?.progress(1);
  }, [still]);

  useEffect(
    () => () => {
      transition.current?.kill();
      pending.current = null;
      resetContent(document.getElementById('course-content'));
    },
    [],
  );

  useIsomorphicLayoutEffect(() => {
    if (isLoading) return undefined;
    if (['guide-tools', 'math-tools'].includes(entry.hash)) {
      openGuideTools();
      restoring.current = false;
      return undefined;
    }
    // Finish scroll and focus before painting the new view. Deferring this by
    // two frames lets a visible checkbox move underneath the first tap.
    if (active.current?.key !== entry.key || active.current?.hash !== entry.hash) return undefined;
    const main = document.querySelector('main');
    const content = document.getElementById('course-content');
    if (!main || !content) return undefined;
    // URL fragments select workspace views, not browser scroll anchors. Next's
    // own delayed hash scroll must not override our position/focus restoration.
    const targetId = location.item?.anchor || location.panel;
    const target = (targetId && document.getElementById(`course-view-${targetId}`)) || content;
    // The header now leaves with the page. Only detail/deep links move the
    // scroller; tabs and filters replace their panel at the current position.
    let top = Math.max(0, scrollTop() + (target || content).getBoundingClientRect().top - scrollViewport().top - 12);
    if (entry.inPlace) top = entry.scroll;
    if (entry.initial && !entry.hash) top = 0;
    if (entry.restore) top = entry.scroll;
    const { lenis } = useStore.getState();
    lenis?.resize();
    const scrollToTop = (value) => {
      if (lenis) lenis.scrollTo(value, { immediate: true, force: true });
      else if (scrollRoot() === window) window.scrollTo(0, value);
      else main.scrollTop = value;
    };
    scrollToTop(top);
    // Back to a list whose opener row has moved (marked done, it now sits under Done): bring the row
    // into view instead of restoring a position that shows a different row, with focus far off screen.
    const opener = entry.restore && entry.focus && document.getElementById(entry.focus);
    const view = opener && content.contains(opener) && scrollViewport();
    if (view) {
      const box = opener.getBoundingClientRect();
      if (box.bottom < view.top || box.top > view.bottom) scrollToTop(Math.max(0, scrollTop() + box.top - view.top - (view.bottom - view.top) / 3));
    }
    // Only the outgoing view is inert. Newly mounted controls must accept
    // the first tap, even while their entrance animation is still running.
    content.inert = false;
    content.removeAttribute('aria-busy');
    gsap.set(content, { clearProps: 'pointerEvents' });
    setRequested(null);
    // Restore focus with interactivity, not at the end of the cosmetic tween.
    // Respect a control that a child selected during this commit.
    const focusMoved = document.activeElement !== focusAtNavigation.current && document.activeElement !== content && content.contains(document.activeElement);
    const filterHasFocus = location.view === 'work' && entry.inPlace && !entry.restore && focusAtNavigation.current?.closest('[data-work-filters]');
    if ((!entry.initial || entry.hash) && !focusMoved && !filterHasFocus) {
      // The remembered control, when it is still shown in the page (not, say, a closed Search panel's input).
      const remembered = entry.restore && document.getElementById(entry.focus);
      const focus = (remembered && main.contains(remembered) && remembered.getClientRects().length && remembered) || target || content;
      focus.focus({ preventScroll: true });
    }
    restoring.current = false;
    const finish = () => {
      if (active.current?.key !== entry.key || active.current?.hash !== entry.hash) return;
      resetContent(content);
    };
    if (reveal.current && !useStore.getState().still) {
      gsap.set(content, { x: 12, opacity: 0 });
      transition.current = gsap.to(content, {
        ...VIEW_MOTION,
        x: 0,
        opacity: 1,
        onComplete: finish,
      });
    } else finish();
    reveal.current = false;
    return undefined;
    // Content/progress changes should never reset the reader's scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key, entry.hash, isLoading]);

  let fallbackView = location.kind === 'topic' ? 'study' : 'work';
  if (location.infoDetail) fallbackView = 'info';
  const back = () => {
    if (entry.returnTo) {
      remember();
      window.history.go(-(entry.returnTo.depth || 1));
    } else navigate(fallbackView === 'info' ? 'course-info' : fallbackView);
  };
  return {
    ...location,
    selectedView: requested?.view || location.view,
    opening: showOpening ? requested : null,
    acknowledge: (hash) => {
      const target = resolveCourseLocation(hash, courseId, info);
      setRequested(viewKey(target) === viewKey(location) ? null : target);
    },
    navigate,
    back,
    remember,
    returnView: entry.returnTo?.view || fallbackView,
  };
}
