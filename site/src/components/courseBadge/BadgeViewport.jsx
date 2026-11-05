import { Scene, Vector2 } from 'three';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useState } from 'react';

// What one badge window needs from the page each frame. Every badge reads it
// before any badge writes (MeasureBadge runs first, the clip-path writes last):
// a layout read that follows a style write makes the browser lay the page out
// again, so interleaving them cost one forced layout per badge per scrolling frame.
export function createBadgeLayout() {
  return { bounds: null, canvas: null, clip: null, backing: null, panel: null, draw: false };
}

function MeasureBadge({ element, layout }) {
  const gl = useThree((state) => state.gl);
  useFrame(() => {
    const bounds = element?.getBoundingClientRect() ?? null;
    const canvas = gl.domElement.getBoundingClientRect();
    const clip = element?.closest('[data-badge-clip]') ?? null;
    const backing = clip?.querySelector('[data-badge-backing]') ?? null;
    layout.bounds = bounds;
    layout.canvas = canvas;
    layout.clip = clip?.getBoundingClientRect() ?? null;
    layout.backing = backing;
    layout.panel = backing?.getBoundingClientRect() ?? null;
    // Whether DrawBadge draws this window this frame: it has a size, the shared
    // surface is showing (a hidden or transitioning one needs no badge draw) and
    // the window overlaps it.
    layout.draw =
      !!(bounds?.width && bounds.height && canvas.width && canvas.height) &&
      !(canvas.bottom <= 0 || canvas.top >= window.innerHeight) &&
      !(bounds.bottom <= canvas.top || bounds.top >= canvas.bottom || bounds.right <= canvas.left || bounds.left >= canvas.right);
  }, -1);
  return null;
}

// A badge uses the app's existing renderer and its own camera/scene. Drawing
// follows this frame's DOM rectangle, without a React visibility round trip.
// Drei 9's View checks the previous offscreen state, then clears in a layout
// effect on re-entry; that leaves an empty window during fast scroll reversals.
function DrawBadge({ layout }) {
  const { gl, scene, camera } = useThree();
  const size = useMemo(() => new Vector2(), []);

  useFrame(() => {
    if (!layout.draw) return;
    const { bounds, canvas } = layout;

    // Account for the existing desktop shell scale as well as Safari's canvas
    // bleed. Renderer coordinates are logical pixels, before devicePixelRatio.
    gl.getSize(size);
    const scaleX = size.x / canvas.width;
    const scaleY = size.y / canvas.height;
    const width = bounds.width * scaleX;
    const height = bounds.height * scaleY;
    const left = (bounds.left - canvas.left) * scaleX;
    const bottom = (canvas.bottom - bounds.bottom) * scaleY;
    // Keep the visible card's proportions while a toolbar resize is ahead of
    // the canvas drawing-buffer resize (the two scale factors can differ).
    const aspect = bounds.width / bounds.height;
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }

    const { autoClear } = gl;
    gl.autoClear = false;
    gl.setViewport(left, bottom, width, height);
    gl.setScissor(left, bottom, width, height);
    gl.setScissorTest(true);
    try {
      gl.render(scene, camera);
    } finally {
      gl.setScissorTest(false);
      gl.autoClear = autoClear;
    }
  }, 1);

  return null;
}

export default function BadgeViewport({ element, layout, children }) {
  const [scene] = useState(() => new Scene());
  return createPortal(
    <>
      <MeasureBadge element={element} layout={layout} />
      <DrawBadge layout={layout} />
      {children}
    </>,
    scene,
    { events: { enabled: false } },
  );
}
