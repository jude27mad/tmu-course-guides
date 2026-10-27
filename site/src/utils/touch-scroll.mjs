import { isGameTouch } from '../components/dom/prefooter/gameTouch.mjs';

// A fresh filter belongs to each Lenis instance.
export function createTouchScrollFilter() {
  let multiTouch = false;
  return ({ event }) => {
    if (!event.touches) return true;
    // Ignore the entire pinch, including one-finger/final releases: Lenis
    // reuses its last movement delta on touchend. Reset only on a new gesture.
    if (event.type === 'touchstart' && event.touches.length === 1) multiTouch = false;
    if (event.touches.length > 1) multiTouch = true;
    return !multiTouch && !isGameTouch(event);
  };
}
