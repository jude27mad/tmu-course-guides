import { create } from 'zustand';

import { TOKENS } from './lib/palette.mjs';

// The pointer fluid's dye, retained on every page. The shared Desk palette
// applies this same tint when courses mount and unmount.
export const DEFAULT_FLUID_COLOR = TOKENS.fluid;

// eslint-disable-next-line import/prefer-default-export
export const useStore = create((set, get) => ({
  lenis: undefined,
  setLenis: (lenis) => set({ lenis }),
  introOut: false,
  setIntroOut: (introOut) => set({ introOut }),
  isMenuOpen: false,
  setIsMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
  // The SEARCH panel (navbar pill, phone menu row, Cmd/Ctrl-K). Shares the
  // menu's "main slides left" animation; only one of the two is open.
  isSearchOpen: false,
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  isLoading: true,
  setIsLoading: (isLoading) => set({ isLoading }),
  // true from a route's exit until the next page has entered (Layout); panels
  // closing during it must not restart Lenis.
  isTransitioning: false,
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
  fluidColor: DEFAULT_FLUID_COLOR,
  setFluidColor: (fluidColor) => set({ fluidColor }),
  // true = the shared View.Port canvas outputs sRGB (the original used it on /about
  // for the MagicBalls); Layout sets it per route, pages may override.
  isAbout: false,
  setIsAbout: (isAbout) => set({ isAbout }),

  // Motion. `still` is true when the device asks for reduced motion or the
  // student saved "Pause motion" (localStorage 'guide-motion-paused').
  // _app.page.jsx keeps these in sync with useMotionPaused() from @src/lib/react.
  // While still: no loader curtain, instant transitions, appear animations
  // shown at once, static background, no fluid, physics paused, marquee stopped.
  still: false,
  motionSaved: false, // the saved "Pause motion" preference
  motionReduced: false, // prefers-reduced-motion (or a page override)
  setMotionState: ({ still, saved, reduced, setPaused }) => set({ still: !!still, motionSaved: !!saved, motionReduced: !!reduced, setMotionPausedFn: setPaused || get().setMotionPausedFn }),
  setMotionPausedFn: null,
  // Toggle the saved preference ("Pause motion" / "Play motion").
  toggleMotion: () => {
    const { setMotionPausedFn, motionSaved } = get();
    if (setMotionPausedFn) setMotionPausedFn(!motionSaved);
  },
}));
