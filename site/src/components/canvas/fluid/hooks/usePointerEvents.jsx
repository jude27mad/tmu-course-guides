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

    // The calculation above is copied unchanged from Giats. Safari document
    // scrolling cancels touch pointermove, so only adapt its event transport:
    // each changed finger supplies the same coordinates to the original brush.
    // Do not synthesize contacts/releases, reset the shared pointer or add dye.
    const ios = nativeIOSScroll();
    const pointerMove = (event) => {
      if (!ios || event.pointerType !== 'touch') handlePointerMove(event);
    };
    const touchMove = (event) => {
      Array.from(event.changedTouches || event.touches).forEach(handlePointerMove);
    };
    element.addEventListener('pointermove', pointerMove, { passive: true });
    if (ios) element.addEventListener('touchmove', touchMove, { passive: true });

    return () => {
      element.removeEventListener('pointermove', pointerMove);
      if (ios) element.removeEventListener('touchmove', touchMove);
    };
  }, [mainRef, size, force]);

  return splatStack;
};

export default usePointerEvents;
