import { useStore } from '@src/store';

// true when motion is off: prefers-reduced-motion or the saved "Pause motion"
// (localStorage 'guide-motion-paused'). Mirrors useMotionPaused()[0] from
// @src/lib/react, kept in the store by _app.page.jsx so every shell component
// and every R3F tree reads the same value without its own listeners.
const useStill = () => useStore((state) => state.still);

export default useStill;
