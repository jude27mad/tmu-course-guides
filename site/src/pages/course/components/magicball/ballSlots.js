import { useEffect, useId, useState, useSyncExternalStore } from 'react';

// Which MagicBall windows may mount their 3D. On a phone only one ball lives at
// a time: the window with the most pixels on screen (brief, decision 9). On
// desktop every window near the viewport mounts its own ball, as in the original.
const visible = new Map(); // id -> visible height in px (0 = out of range)
const listeners = new Set();
let active = null;

function recompute() {
  let best = null;
  let bestHeight = 0;
  visible.forEach((height, id) => {
    if (height > bestHeight) {
      best = id;
      bestHeight = height;
    }
  });
  if (best !== active) {
    active = best;
    listeners.forEach((listener) => listener());
  }
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getActive = () => active;
const getServerActive = () => null;

const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

export default function useBallSlot(ref, { single = false, rootMargin = '35% 0px' } = {}) {
  const id = useId();
  const [inRange, setInRange] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        setInRange(entry.isIntersecting);
        visible.set(id, entry.isIntersecting ? Math.max(1, entry.intersectionRect.height) : 0);
        recompute();
      },
      { rootMargin, threshold: THRESHOLDS },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      visible.delete(id);
      recompute();
    };
  }, [ref, id, rootMargin]);

  const current = useSyncExternalStore(subscribe, getActive, getServerActive);
  return single ? current === id : inRange;
}
