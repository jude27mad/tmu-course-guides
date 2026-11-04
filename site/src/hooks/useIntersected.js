import { useState } from 'react';

import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';

// Whether the element has come into view, and false again once it is back below the viewport. One
// observer sets it directly: react-use's useIntersection kept every entry in state, so each crossing
// rendered twice (the entry, then this flag), even when the flag did not change.
const useIntersected = (ref, threshold = 0) => {
  const [intersected, setIntersected] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        // One callback can carry a stale entry and then the current one for the same element (a busy
        // main thread during the intro); the last is the element's state now, as in useInView.
        const entry = entries[entries.length - 1];
        if (entry.isIntersecting) setIntersected(true);
        else if (entry.boundingClientRect.top > 0) setIntersected(false);
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return intersected;
};
export default useIntersected;
