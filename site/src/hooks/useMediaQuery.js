import { useCallback, useSyncExternalStore } from 'react';

// A media query as React state that is right on the first client render.
// Components that hydrate the static HTML get `serverValue` first (so the
// markup matches) and the real value straight after; components that mount
// later (R3F trees, route changes, dynamic imports) get the real value at once.
export default function useMediaQuery(query, serverValue = false) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      if (list.addEventListener) list.addEventListener('change', onChange);
      else list.addListener(onChange);
      return () => {
        if (list.removeEventListener) list.removeEventListener('change', onChange);
        else list.removeListener(onChange);
      };
    },
    [query],
  );
  const getSnapshot = useCallback(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : serverValue), [query, serverValue]);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

// Touch-first devices (phones, tablets): native scrolling, no fluid while idle.
export const COARSE_POINTER = '(pointer: coarse)';
export const useCoarsePointer = () => useMediaQuery(COARSE_POINTER);

export const isCoarsePointer = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(COARSE_POINTER).matches;
