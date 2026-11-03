import { useEffect, useState } from 'react';

import Background from '@src/components/canvas/background/Background';
import { Canvas, useThree } from '@react-three/fiber';
import { PANEL_DEFAULTS } from '@src/components/dom/navbar/panelShell';
import WebGLGate from '@src/components/canvas/WebGLGate';
import useStill from '@src/hooks/useStill';
import { useStore } from '@src/store';

// Behind the page the background drift is extremely slow, so it does not need
// 60 fps: the canvas renders on demand, FPS times a second while motion is on,
// and once (a static frame) while motion is off. While the Menu or Search is
// open (and while it closes) the artwork fills the screen, as on Giats's site:
// it renders every display frame and drifts at the original's per-frame pace
// (Background `live`). It cannot join the shared View.Port canvas: it must stay
// visible around `main` when the menu, the search panel and the route curtain
// shrink and move #layout.
const FPS = 12;
// The shell's closing tween, plus a frame or two.
const LIVE_AFTER_CLOSE_MS = PANEL_DEFAULTS.duration * 1000 + 100;

function useLive(still) {
  const open = useStore((state) => state.isMenuOpen || state.isSearchOpen);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (still) {
      setLive(false);
      return undefined;
    }
    if (open) {
      setLive(true);
      return undefined;
    }
    const timer = setTimeout(() => setLive(false), LIVE_AFTER_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, still]);
  return live && !still;
}

function Ticker({ still, live }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    if (still) return undefined;
    if (live) {
      let frame = requestAnimationFrame(function tick() {
        invalidate();
        frame = requestAnimationFrame(tick);
      });
      return () => cancelAnimationFrame(frame);
    }
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') invalidate();
    }, 1000 / FPS);
    return () => clearInterval(timer);
  }, [still, live, invalidate]);
  return null;
}

function Index() {
  const devicePixelRatio = typeof window !== 'undefined' ? Math.min(1, window.devicePixelRatio) : 1;
  const still = useStill();
  const live = useLive(still);

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
        <Ticker still={still} live={live} />
        <Background still={still} live={live} />
      </Canvas>
    </WebGLGate>
  );
}
export default Index;
