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
    const sample = (key, clientX, clientY, start = false) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
      const previous = positions.get(key);
      if (!previous) {
        positions.set(key, new Vector2(clientX, clientY));
        return;
      }
      const deltaX = clientX - previous.x;
      const deltaY = clientY - previous.y;
      previous.set(clientX, clientY);
      if (start || (!deltaX && !deltaY)) return;
      const { size: viewport, force: strength } = input.current;
      if (!(viewport.width > 0 && viewport.height > 0)) return;
      splatStack.current.push({
        mouseX: clientX / viewport.width,
        mouseY: 1 - clientY / viewport.height,
        velocityX: deltaX * strength,
        velocityY: -deltaY * strength,
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
    const pointerEnd = (event) => positions.delete(pointerKey(event));
    const touchStart = (event) => {
      Array.from(event.changedTouches || event.targetTouches || event.touches).forEach((touch) => {
        sample(`touch:${touch.identifier}`, touch.clientX, touch.clientY, true);
      });
    };
    const touchMove = (event) => {
      Array.from(event.targetTouches || event.touches).forEach((touch) => {
        sample(`touch:${touch.identifier}`, touch.clientX, touch.clientY);
      });
    };
    const touchEnd = (event) => {
      // Removing one finger must not reset the remaining fingers' velocity.
      const active = new Set(Array.from(event.targetTouches || event.touches, (touch) => `touch:${touch.identifier}`));
      positions.forEach((position, key) => {
        if (key.startsWith('touch:') && !active.has(key)) positions.delete(key);
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
      splatStack.current.length = 0;
    };
  }, [mainRef]);

  return splatStack;
};

export default usePointerEvents;
