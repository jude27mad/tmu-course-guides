import { useEffect } from 'react';

import Background from '@src/components/canvas/background/Background';
import { Canvas, useThree } from '@react-three/fiber';
import WebGLGate from '@src/components/canvas/WebGLGate';
import useStill from '@src/hooks/useStill';

// The background drift is extremely slow (a full sweep takes ~27 min), so it
// does not need 60 fps: the canvas renders on demand, FPS times a second while
// motion is on, and once (a static frame) while motion is off. It cannot join
// the shared View.Port canvas: it must stay visible around `main` when the
// menu, the search panel and the route curtain shrink and move #layout.
const FPS = 12;

function Ticker({ still }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    if (still) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') invalidate();
    }, 1000 / FPS);
    return () => clearInterval(timer);
  }, [still, invalidate]);
  return null;
}

function Index() {
  const devicePixelRatio = typeof window !== 'undefined' ? Math.min(1, window.devicePixelRatio) : 1;
  const still = useStill();

  // Without WebGL the panel behind the page keeps its solid ink colour (app.module.scss .background).
  return (
    <WebGLGate>
      <Canvas
        flat
        linear
        frameloop="demand"
        dpr={[devicePixelRatio, 1]}
        gl={{
          antialias: false,
          stencil: false,
          depth: false,
          powerPreference: 'low-power',
        }}
      >
        <Ticker still={still} />
        <Background still={still} />
      </Canvas>
    </WebGLGate>
  );
}
export default Index;
