import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { nativeIOSScroll } from '@src/utils/scrollRoot';

// drei stops drawing a View once its window leaves the viewport but keeps its
// last frame in the canvas. On iPhone the shared View.Port canvas reaches under
// Safari's bars (--edge-bleed-* in global.scss), where that frame would stay in
// view, so a frame after one that drew starts empty. Views draw after this
// (priority 1 and up); an empty canvas is left alone.
function ClearViews({ registry }) {
  const cleared = useRef(-1);
  useFrame(({ gl }) => {
    if (nativeIOSScroll()) {
      const surface = gl.domElement.closest('#viewCanvas');
      const entries = registry.getState().entries;
      if (surface && entries.length) {
        const bounds = surface.getBoundingClientRect();
        const offset = parseFloat(surface.style.getPropertyValue('--badge-scroll-offset')) || 0;
        const shift = window.scrollY - offset;
        // Reframe only when a badge reaches the viewport (including Safari's
        // existing bleed). Otherwise retain its last paint at that document
        // position, ready for a native scroll back before another JS frame.
        const visible = entries.some(({ element }) => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > bounds.top + shift && rect.top < bounds.bottom + shift;
        });
        if (!visible) return;
        if (shift) surface.style.setProperty('--badge-scroll-offset', `${window.scrollY}px`);
      }
    }
    if (gl.info.render.frame === cleared.current) return;
    gl.setScissorTest(false);
    gl.clear(true, true, true);
    cleared.current = gl.info.render.frame;
  }, 0);
  return null;
}

export default ClearViews;
