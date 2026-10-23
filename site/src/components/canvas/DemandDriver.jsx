import { scrollRoot } from '@src/utils/scrollRoot';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '@src/store';

// With motion off the shared View.Port canvas renders on demand (no 60 fps
// loop for scenes that stand still). drei Views follow their DOM windows, so a
// frame is still drawn while the page scrolls, resizes, or the shell moves
// `main` (menu, search, route curtain): each of those keeps frames coming for
// a short burst.
const BURST_MS = 1200;

function DemandDriver() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let until = 0;
    let frame = 0;
    const loop = () => {
      invalidate();
      if (performance.now() < until) frame = requestAnimationFrame(loop);
      else frame = 0;
    };
    const kick = () => {
      until = performance.now() + BURST_MS;
      if (!frame) frame = requestAnimationFrame(loop);
    };

    kick();
    let { lenis } = useStore.getState();
    lenis?.on('scroll', kick);
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.lenis !== lenis) {
        lenis?.off('scroll', kick);
        lenis = state.lenis;
        lenis?.on('scroll', kick);
      }
      if (state.isMenuOpen !== previous.isMenuOpen || state.isSearchOpen !== previous.isSearchOpen || state.isLoading !== previous.isLoading || state.isAbout !== previous.isAbout) kick();
    });
    window.addEventListener('resize', kick);
    const main = scrollRoot();
    main?.addEventListener('scroll', kick, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      lenis?.off('scroll', kick);
      unsubscribe();
      window.removeEventListener('resize', kick);
      main?.removeEventListener('scroll', kick);
    };
  }, [invalidate]);

  return null;
}

export default DemandDriver;
