import { useEffect, useRef } from 'react';

import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@src/store';

// Subscribes `callback` to Lenis 'scroll' events ({ scroll, limit, velocity, direction, ... }).
// The original re-subscribed on every render (its deps held a fresh array); the
// latest callback is now read through a ref and the listener is attached once per Lenis.
// `deps` is kept for API compatibility and is no longer needed.
// eslint-disable-next-line no-unused-vars
function useScroll(callback, deps = []) {
  const [lenis] = useStore(useShallow((state) => [state.lenis]));
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useIsomorphicLayoutEffect(() => {
    if (!lenis) return undefined;
    const listener = (event) => callbackRef.current?.(event);
    lenis.on('scroll', listener);
    lenis.emit();

    return () => {
      lenis.off('scroll', listener);
    };
  }, [lenis]);
}
export default useScroll;
