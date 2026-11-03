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
      ([entry]) => {
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
