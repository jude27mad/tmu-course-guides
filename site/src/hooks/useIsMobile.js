import { useSyncExternalStore } from 'react';

// The original single breakpoint: innerWidth < 812 (SCSS @include mobile = max-width 812px).
// The original started `false` and flipped after mount, so phones first built the
// desktop tree (18 floating meshes, desktop ScrollTriggers) and then rebuilt it.
// useSyncExternalStore keeps the static HTML hydration-safe (server value false)
// and gives every component mounted after hydration (R3F trees, the next route)
// the right answer on its first render.
const MOBILE_WIDTH = 812;

const subscribe = (onChange) => {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
};

export const isMobileNow = () => typeof window !== 'undefined' && window.innerWidth < MOBILE_WIDTH;

const getServerSnapshot = () => false;

const useIsMobile = () => useSyncExternalStore(subscribe, isMobileNow, getServerSnapshot);

export default useIsMobile;
