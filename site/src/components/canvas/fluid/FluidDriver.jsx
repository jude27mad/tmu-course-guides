import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// The fluid canvas renders on demand: a pointer move starts the simulation,
// and it keeps stepping for IDLE_MS after the last move (the dye has faded by
// then), then stops. On touch screens the canvas is also hidden while idle
// (`idleClassName`), so the full-screen difference blend is not composited.
const IDLE_MS = 2200;

function FluidDriver({ mainRef, hideWhenIdle, idleClassName }) {
  const invalidate = useThree((state) => state.invalidate);
  const activeUntil = useRef(0);
  const idle = useRef(false);

  const setIdle = (value) => {
    if (idle.current === value) return;
    idle.current = value;
    if (!hideWhenIdle) return;
    const element = document.getElementById('fluidCanvas');
    if (element) element.classList.toggle(idleClassName, value);
  };

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return undefined;
    const onMove = () => {
      activeUntil.current = performance.now() + IDLE_MS;
      setIdle(false);
      invalidate();
    };
    element.addEventListener('pointermove', onMove, { passive: true });
    element.addEventListener('pointerdown', onMove, { passive: true });
    setIdle(true);
    return () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerdown', onMove);
      const canvas = document.getElementById('fluidCanvas');
      if (canvas) canvas.classList.remove(idleClassName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainRef, invalidate, hideWhenIdle, idleClassName]);

  useFrame(() => {
    if (performance.now() < activeUntil.current) invalidate();
    else setIdle(true);
  });

  return null;
}

export default FluidDriver;
