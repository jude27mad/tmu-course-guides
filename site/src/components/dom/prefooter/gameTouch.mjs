// Mark only the events owned by a slicing gesture. Lenis still receives the
// touches (and resets its deltas), but must not turn them into page movement.
const gameTouches = new WeakSet();
export const isGameTouch = (event) => gameTouches.has(event);

export function bindGameTouch(element, { canStart, sample }) {
  let start = null;
  let mode = 'ignore';

  const touchstart = (event) => {
    start = null;
    mode = 'ignore';
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!canStart(touch, event)) return;
    start = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    mode = 'pending';
  };

  const touchmove = (event) => {
    if (event.touches.length !== 1) mode = 'ignore';
    if (mode === 'ignore' || mode === 'scroll') return;
    const touch = event.touches[0];
    if (touch.identifier !== start.id || !event.cancelable) {
      mode = 'scroll';
      return;
    }
    if (mode === 'pending') {
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (dx === 0 && dy === 0) return;
      // Decide on the first movement, before Safari commits to native scroll.
      // Once chosen, keep the entire arc with its original owner.
      mode = dx > dy ? 'slice' : 'scroll';
    }
    if (mode !== 'slice') return;
    gameTouches.add(event);
    event.preventDefault();
    sample([touch]);
  };

  const touchend = (event) => {
    // Lenis reuses the last move on release. Suppress a slicing fling too.
    if (mode === 'slice') gameTouches.add(event);
    if (mode === 'pending' && event.touches.length === 0) sample(Array.from(event.changedTouches));
    start = null;
    mode = 'ignore';
  };

  const touchcancel = (event) => {
    if (mode === 'slice') gameTouches.add(event);
    start = null;
    mode = 'ignore';
  };

  // Capture runs before Lenis's bubbling listeners in both scroll layouts.
  // Do not stop propagation: the fluid and other observers keep their input.
  const handlers = { touchstart, touchmove, touchend, touchcancel };
  const passive = { capture: true, passive: true };
  const blocking = { capture: true, passive: false };
  Object.entries(handlers).forEach(([name, handler]) => element.addEventListener(name, handler, name === 'touchmove' ? blocking : passive));
  return () => {
    Object.entries(handlers).forEach(([name, handler]) => element.removeEventListener(name, handler, name === 'touchmove' ? blocking : passive));
  };
}
