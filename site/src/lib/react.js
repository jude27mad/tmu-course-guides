/* eslint-disable import/extensions */
/*
 * React hooks over the data API (documented in ./README.md). Server renders and the first client render see no
 * saved state (no clock, no storage), so the exported HTML never bakes in a build-time "now" or someone's
 * progress; the real values arrive right after mount. React is imported as a default export because this
 * folder is an ES-module package and React is CommonJS.
 */
import React from 'react';

import { STORAGE_KEYS, getSection, motionPaused, setMotionPaused, setSection as saveSection, sharedProgress } from './index.js';

const { useCallback, useEffect, useMemo, useState } = React;

const hasWindow = () => typeof window !== 'undefined';

/**
 * The current time as a Date, refreshed on the wall-clock boundary of `intervalMs` (default: each minute; pass
 * 1000 for seconds) and immediately when the tab becomes visible again, on bfcache restore and on focus.
 * Returns null until mounted, so server and client markup agree.
 */
export const useNow = (intervalMs = 60000) => {
  const [now, setNow] = useState(null);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (!document.hidden) setNow(new Date());
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    };
    const refresh = () => {
      if (!document.hidden) tick();
    };
    const onPageShow = (event) => {
      if (event.persisted) tick();
    };
    tick();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', refresh);
    };
  }, [intervalMs]);

  return now;
};

// Before mount nothing is read; writes (which only happen in event handlers, after mount) go to the shared instance.
const PRE_MOUNT = {
  isDone: () => false,
  markDone: (...args) => sharedProgress().markDone(...args),
  undo: () => sharedProgress().undo(),
  canUndo: () => false,
  pendingUndo: () => null,
  setDone: (...args) => sharedProgress().setDone(...args),
  isTicked: () => false,
  toggleTick: (...args) => sharedProgress().toggleTick(...args),
  tickCount: () => ({ checked: 0, total: 0 }),
  clearTicks: () => sharedProgress().clearTicks(),
  getNote: () => '',
  setNote: (...args) => sharedProgress().setNote(...args),
  getTarget: () => '',
  setTarget: (...args) => sharedProgress().setTarget(...args),
  subscribe: () => () => {},
};

/**
 * The shared progress API (createProgress over the browser's storage), re-rendering the component after any
 * change from this page or another tab. `version` changes with every update; `ready` is false until mounted.
 */
export const useProgress = () => {
  const [api, setApi] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const progress = sharedProgress();
    setApi(progress);
    return progress.subscribe(() => setVersion((value) => value + 1));
  }, []);

  return useMemo(() => ({ ...(api || PRE_MOUNT), version, ready: !!api }), [api, version]);
};

/**
 * [section, setSection] for a course: the saved section number (null when none or before mount) and a setter
 * that saves it in the old format (see setSection in index.js) and returns whether storage accepted it.
 */
export const useSection = (courseId) => {
  const [section, setState] = useState(null);

  useEffect(() => {
    const read = () => setState(getSection(courseId));
    read();
    return sharedProgress().subscribe((detail) => {
      if (detail.key === null || detail.courseId === courseId) read();
    });
  }, [courseId]);

  const update = useCallback(
    (value) => {
      const saved = saveSection(courseId, value);
      setState(getSection(courseId));
      return saved;
    },
    [courseId],
  );

  return [section, update];
};

function readMotion() {
  if (!hasWindow()) return { saved: false, reduced: false, forced: false, full: false };
  let mode = null;
  let reduced = false;
  try {
    mode = new URLSearchParams(window.location.search).get('motion');
    reduced = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // Keep the defaults.
  }
  const full = mode === 'full';
  return { saved: full ? false : motionPaused(), reduced: reduced && !full, forced: mode === 'off', full };
}

/**
 * [still, setPaused, state]: `still` is true when motion should stop (device reduced-motion setting, ?motion=off,
 * or the saved "Pause motion" choice in guide-motion-paused); `setPaused(bool)` saves the choice ("true"/"false");
 * `state` = { saved, reduced, forced, full } (full: ?motion=full overrides the device setting for this view).
 * Read synchronously on the client's first render so a loader or curtain can be skipped from the start.
 */
export const useMotionPaused = () => {
  const [state, setState] = useState(readMotion);

  useEffect(() => {
    try {
      // The old site removed this legacy key on every load.
      window.localStorage.removeItem(STORAGE_KEYS.legacyMotion);
    } catch {
      // Storage blocked: nothing to clean.
    }
    const update = () => setState(readMotion());
    update();
    const media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    media?.addEventListener?.('change', update);
    const off = sharedProgress().subscribe((detail) => {
      if (detail.key === null || detail.key === STORAGE_KEYS.motion) update();
    });
    return () => {
      media?.removeEventListener?.('change', update);
      off();
    };
  }, []);

  const setPaused = useCallback((value) => {
    const saved = setMotionPaused(value);
    setState(readMotion());
    return saved;
  }, []);

  return [state.forced || state.reduced || state.saved, setPaused, state];
};
