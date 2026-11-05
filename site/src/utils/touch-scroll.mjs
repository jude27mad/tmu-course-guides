import { isGameTouch } from '../components/dom/prefooter/gameTouch.mjs';

// A fresh filter belongs to each Lenis instance. `getShare` reports the share
// of a 60 Hz frame the current frame covers (0.5 at 120 Hz).
export function createTouchScrollFilter(getShare = () => 1) {
  let multiTouch = false;
  return (data) => {
    const { event } = data;
    if (!event.touches) return true;
    // Ignore the entire pinch, including one-finger/final releases: Lenis
    // reuses its last movement delta on touchend. Reset only on a new gesture.
    if (event.type === 'touchstart' && event.touches.length === 1) multiTouch = false;
    if (event.touches.length > 1) multiTouch = true;
    const allowed = !multiTouch && !isGameTouch(event);
    // That reused delta, the last touchmove's travel, must exceed 5 px to start
    // inertia. Touchmove follows the display, so measure it per 60 Hz frame.
    if (allowed && event.type === 'touchend') {
      const share = getShare();
      if (share !== 1) {
        data.deltaX /= share;
        data.deltaY /= share;
      }
    }
    return allowed;
  };
}
