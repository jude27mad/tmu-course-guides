import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import gsap from 'gsap';
import { useStore } from '@src/store';
// eslint-disable-next-line import/extensions
import { openGuideTools } from '@src/pages/course/components/tools/dialog.mjs';
// eslint-disable-next-line import/extensions
import { resolveCourseLocation } from './location.mjs';

const hashOf = () => window.location.hash.replace(/^#/, '');
// Match the shell's power2 slide easing, at a shorter pace for in-course moves.
const VIEW_MOTION = { duration: 0.4, ease: 'power2.inOut' };
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
const saveEntry = (entry) => {
  snapshots.set(entry.key, entry);
  if (snapshots.size > 100) snapshots.delete(snapshots.keys().next().value);
  window.history.replaceState({ ...window.history.state, courseWorkspace: entry }, '');
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
  const active = useRef(null);
  const restoring = useRef(false);
  const transition = useRef(null);
  const pending = useRef(null);
  const reveal = useRef(false);
  const focusAtNavigation = useRef(null);
  const location = resolveCourseLocation(entry.hash, courseId, info);

  const remember = useCallback(() => {
    const previous = active.current;
    if (!previous || restoring.current || previous.hash !== hashOf()) return;
    const focus = document.activeElement;
    const next = {
      ...previous,
      scroll: document.querySelector('main')?.scrollTop || 0,
      focus: focus?.id || previous.focus,
    };
    active.current = next;
    saveEntry(next);
  }, []);

  const navigate = useCallback(
    (hash) => {
      remember();
      return router.push({ pathname: router.pathname, query: router.query, hash }, undefined, { shallow: true, scroll: false });
    },
    [remember, router],
  );

  useEffect(() => {
    const sync = () => {
      const hash = hashOf();
      const key = window.history.state?.key || hash;
      if (active.current?.key === key && active.current?.hash === hash) return;
      const saved = window.history.state?.courseWorkspace || snapshots.get(key);
      const previous = active.current;
      const target = resolveCourseLocation(hash, courseId, info);
      const validSaved = saved?.courseId === courseId && saved.hash === hash;
      const from = previous && resolveCourseLocation(previous.hash, courseId, info);
      let returnTo = null;
      if (isDetail(target) && from) {
        if (isDetail(from) && previous.returnTo && !!from.item === !!target.item)
          returnTo = {
            ...previous.returnTo,
            depth: (previous.returnTo.depth || 1) + 1,
          };
        else returnTo = { hash: previous.hash, view: from.view, depth: 1 };
      }
      const next = validSaved
        ? { ...saved, key, restore: true }
        : {
            courseId,
            hash,
            key,
            initial: !previous,
            scroll: 0,
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
          duration: 0.18,
          x: -20,
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
    const main = document.querySelector('main');
    router.events.on('hashChangeStart', remember);
    router.events.on('routeChangeStart', remember);
    router.events.on('hashChangeComplete', sync);
    router.events.on('routeChangeComplete', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    document.addEventListener('guide-hash', onGuideHash);
    main?.addEventListener('scroll', remember, { passive: true });
    sync();
    return () => {
      router.events.off('hashChangeStart', remember);
      router.events.off('routeChangeStart', remember);
      router.events.off('hashChangeComplete', sync);
      router.events.off('routeChangeComplete', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      document.removeEventListener('guide-hash', onGuideHash);
      main?.removeEventListener('scroll', remember);
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

  useEffect(() => {
    if (isLoading) return undefined;
    if (['guide-tools', 'math-tools'].includes(entry.hash)) {
      openGuideTools();
      restoring.current = false;
      return undefined;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (active.current?.key !== entry.key || active.current?.hash !== entry.hash) return;
        const main = document.querySelector('main');
        const content = document.getElementById('course-content');
        if (!main || !content) return;
        const target = document.getElementById(location.item?.anchor || location.panel || 'course-content');
        const nav = document.querySelector('nav[aria-label="Course views"]');
        const offset = nav ? parseFloat(getComputedStyle(nav).top) + nav.offsetHeight : document.querySelector('header')?.offsetHeight || 0;
        let top = Math.max(0, main.scrollTop + (target || content).getBoundingClientRect().top - main.getBoundingClientRect().top - offset - 12);
        if (entry.initial && !entry.hash) top = 0;
        if (entry.restore) top = entry.scroll;
        const { lenis } = useStore.getState();
        lenis?.resize();
        if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
        else main.scrollTop = top;
        // Restore geometry while the new content is hidden; then reveal and focus
        // it. This keeps Back's exact position and never scrolls a moving element.
        const finish = () => {
          if (active.current?.key !== entry.key || active.current?.hash !== entry.hash) return;
          resetContent(content);
          // A keyboard user may already have focused a control in the new view
          // (especially with motion off). Do not steal that focus after two RAFs.
          const focusMoved = document.activeElement !== focusAtNavigation.current && document.activeElement !== content && content.contains(document.activeElement);
          if ((!entry.initial || entry.hash) && !focusMoved) {
            const focus = (entry.restore && document.getElementById(entry.focus)) || target || content;
            focus.focus({ preventScroll: true });
          }
          restoring.current = false;
        };
        if (reveal.current && !useStore.getState().still) {
          gsap.set(content, { x: 20, opacity: 0 });
          transition.current = gsap.to(content, {
            ...VIEW_MOTION,
            x: 0,
            opacity: 1,
            onComplete: finish,
          });
        } else finish();
        reveal.current = false;
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
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
    navigate,
    back,
    remember,
    returnView: entry.returnTo?.view || fallbackView,
  };
}
