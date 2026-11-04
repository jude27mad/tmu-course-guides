import { useEffect, useState } from 'react';

// true once `ref` has entered the viewport; false again only when it leaves
// below the fold, so a title reveals again when scrolled back down to it.
// One callback can carry several queued entries for the element (a busy main
// thread during the intro delivers a stale "not intersecting" before the
// current "intersecting"): the last one is the current state. react-use's
// useIntersection kept the first, and a title already on screen then stayed
// hidden until it was scrolled away and back.
const useIntersected = (ref, threshold = 0) => {
  const [intersected, setIntersected] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
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
