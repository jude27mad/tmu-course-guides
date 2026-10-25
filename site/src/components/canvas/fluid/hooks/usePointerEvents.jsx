import { nativeIOSScroll } from '@src/utils/scrollRoot';
import { useEffect, useRef } from 'react';
import { Vector2 } from 'three';

const usePointerEvents = (mainRef, size, force) => {
  const splatStack = useRef([]);
  // Toolbar resizing must not tear down listeners or forget fingers mid-gesture.
  const input = useRef({ size, force });
  input.current = { size, force };

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return undefined;
    const ios = nativeIOSScroll();
    // Identity, not TouchList order, owns each finger's previous coordinates.
    const positions = new Map();
    // Giats's original brush compares movement with the last moving pointer.
    // Keep per-finger positions for clean releases, but let active fingers share
    // momentum so two- and three-finger gestures retain the original swirls.
    let sharedMove = null;
    const forget = (key) => {
      positions.delete(key);
      if (sharedMove?.key === key) {
        const next = positions.entries().next().value;
        sharedMove = next ? { key: next[0], x: next[1].x, y: next[1].y } : null;
      }
    };
    const sample = (key, clientX, clientY, start = false) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
      const previous = positions.get(key);
      if (!previous) {
        positions.set(key, new Vector2(clientX, clientY));
        // Safari may deliver touchstart/touchend without any touchmove for an
        // immediate retouch. Seed visible dye on contact, independently of
        // direction or swipe velocity; movement keeps its original strength.
        if (start) {
          const { size: viewport } = input.current;
          if (viewport.width > 0 && viewport.height > 0) {
            splatStack.current.push({
              mouseX: clientX / viewport.width,
              mouseY: 1 - clientY / viewport.height,
              velocityX: 0,
              velocityY: 0,
              dye: 32,
            });
          }
        }
        return;
      }
      const deltaX = clientX - previous.x;
      const deltaY = clientY - previous.y;
      previous.set(clientX, clientY);
      if (start || (!deltaX && !deltaY)) return;
      const shared = positions.size > 1 && sharedMove && sharedMove.key !== key;
      const impulseX = shared ? clientX - sharedMove.x : deltaX;
      const impulseY = shared ? clientY - sharedMove.y : deltaY;
      sharedMove = { key, x: clientX, y: clientY };
      const { size: viewport, force: strength } = input.current;
      if (!(viewport.width > 0 && viewport.height > 0)) return;
      splatStack.current.push({
        mouseX: clientX / viewport.width,
        mouseY: 1 - clientY / viewport.height,
        velocityX: impulseX * strength,
        velocityY: -impulseY * strength,
      });
    };

    const pointerKey = (event) => `pointer:${event.pointerId ?? 'mouse'}`;
    const pointerStart = (event) => {
      if (!ios || event.pointerType !== 'touch') sample(pointerKey(event), event.clientX, event.clientY, true);
    };
    const pointerMove = (event) => {
      // iOS still supplies touchmove after native scrolling cancels pointermove.
      // Do not inject the same movement twice when both streams are delivered.
      if (!ios || event.pointerType !== 'touch') sample(pointerKey(event), event.clientX, event.clientY);
    };
    const pointerEnd = (event) => {
      const key = pointerKey(event);
      // A quick gesture can end between move events. Preserve that last delta
      // before releasing its identity, but never use cancellation coordinates.
      if (event.type === 'pointerup' && (!ios || event.pointerType !== 'touch') && positions.has(key)) sample(key, event.clientX, event.clientY);
      forget(key);
    };
    const touchStart = (event) => {
      Array.from(event.changedTouches || event.touches).forEach((touch) => {
        sample(`touch:${touch.identifier}`, touch.clientX, touch.clientY, true);
      });
    };
    const touchMove = (event) => {
      // targetTouches excludes fingers that began on different child elements.
      Array.from(event.changedTouches || event.touches).forEach((touch) => {
        sample(`touch:${touch.identifier}`, touch.clientX, touch.clientY);
      });
    };
    const touchEnd = (event) => {
      // Remove only the released/cancelled identities, never other fingers.
      Array.from(event.changedTouches || []).forEach((touch) => {
        const key = `touch:${touch.identifier}`;
        if (event.type === 'touchend' && positions.has(key)) sample(key, touch.clientX, touch.clientY);
        forget(key);
      });
    };

    const listeners = [
      ['pointerdown', pointerStart],
      ['pointermove', pointerMove],
      ['pointerup', pointerEnd],
      ['pointercancel', pointerEnd],
      ['pointerleave', pointerEnd],
    ];
    if (ios) listeners.push(['touchstart', touchStart], ['touchmove', touchMove], ['touchend', touchEnd], ['touchcancel', touchEnd]);
    // Visual feedback never prevents scrolling, pinch zoom or browser gestures.
    listeners.forEach(([type, listener]) => element.addEventListener(type, listener, { passive: true }));
    return () => {
      listeners.forEach(([type, listener]) => element.removeEventListener(type, listener));
      positions.clear();
      sharedMove = null;
      splatStack.current.length = 0;
    };
  }, [mainRef]);

  return splatStack;
};

export default usePointerEvents;
