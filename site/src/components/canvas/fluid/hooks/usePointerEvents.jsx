import { nativeIOSScroll } from '@src/utils/scrollRoot';
import { useEffect, useRef } from 'react';

import { Vector2 } from 'three';

const usePointerEvents = (mainRef, size, force) => {
  const splatStack = useRef([]);
  const lastMouse = useRef(new Vector2());
  const hasMoved = useRef(false);

  useEffect(() => {
    if (!mainRef.current) {
      console.error('Main reference is not initialized');
      return undefined;
    }

    const element = mainRef.current;

    const handlePointerMove = (event) => {
      const clientX = event.clientX || event.touches?.[0]?.clientX;
      const clientY = event.clientY || event.touches?.[0]?.clientY;

      if (clientX === undefined || clientY === undefined) return;

      const deltaX = clientX - lastMouse.current.x;
      const deltaY = clientY - lastMouse.current.y;

      if (!hasMoved.current) {
        hasMoved.current = true;
        lastMouse.current.set(clientX, clientY);
        return;
      }

      lastMouse.current.set(clientX, clientY);

      splatStack.current.push({
        mouseX: clientX / size.width,
        mouseY: 1.0 - clientY / size.height,
        velocityX: deltaX * force,
        velocityY: -deltaY * force,
      });
    };

    const touchMove = (event) => {
      if (event.touches.length !== 1) return;
      handlePointerMove({ clientX: event.touches[0].clientX, clientY: event.touches[0].clientY });
    };
    const reset = () => {
      hasMoved.current = false;
    };
    const ios = nativeIOSScroll();
    const pointerMove = (event) => {
      if (!ios || event.pointerType !== 'touch') handlePointerMove(event);
    };
    element.addEventListener('pointermove', pointerMove, { passive: true });
    if (ios) {
      element.addEventListener('touchstart', reset, { passive: true });
      element.addEventListener('touchmove', touchMove, { passive: true });
      element.addEventListener('touchend', reset, { passive: true });
      element.addEventListener('touchcancel', reset, { passive: true });
    }

    return () => {
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('touchstart', reset);
      element.removeEventListener('touchmove', touchMove);
      element.removeEventListener('touchend', reset);
      element.removeEventListener('touchcancel', reset);
    };
  }, [mainRef, size, force]);

  return splatStack;
};

export default usePointerEvents;
