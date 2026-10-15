import { useEffect, useState } from 'react';

// true while `ref` is within the viewport grown by `rootMargin`.
// Use it to pause work that nobody can see: <Physics paused={!inView}>,
// `if (!inView) return` in useFrame, frameloop="never" on a canvas.
// `main` is the scroller, but it is a fixed full-screen element, so the
// viewport is the right root.
export default function useInView(ref, { rootMargin = '0px', threshold = 0, initial = false } = {}) {
  const [inView, setInView] = useState(initial);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin, threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold]);

  return inView;
}
