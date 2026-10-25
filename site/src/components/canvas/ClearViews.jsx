import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// drei stops drawing a View once its window leaves the viewport but keeps its
// last frame in the canvas. On iPhone the shared View.Port canvas reaches under
// Safari's bars (--edge-bleed-* in global.scss), where that frame would stay in
// view, so a frame after one that drew starts empty. Views draw after this
// (priority 1 and up); an empty canvas is left alone.
function ClearViews() {
  const cleared = useRef(-1);
  useFrame(({ gl }) => {
    if (gl.info.render.frame === cleared.current) return;
    gl.setScissorTest(false);
    gl.clear(true, true, true);
    cleared.current = gl.info.render.frame;
  }, 0);
  return null;
}

export default ClearViews;
