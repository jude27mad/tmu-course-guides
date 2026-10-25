import { Scene, Vector2 } from 'three';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useState } from 'react';

// A badge uses the app's existing renderer and its own camera/scene. Drawing
// follows this frame's DOM rectangle, without a React visibility round trip.
// Drei 9's View checks the previous offscreen state, then clears in a layout
// effect on re-entry; that leaves an empty window during fast scroll reversals.
function DrawBadge({ element }) {
  const { gl, scene, camera } = useThree();
  const size = useMemo(() => new Vector2(), []);

  useFrame(() => {
    const bounds = element?.getBoundingClientRect();
    const canvas = gl.domElement.getBoundingClientRect();
    if (!bounds?.width || !bounds.height || !canvas.width || !canvas.height) return;
    // A document-anchored surface can be entirely off screen. Keep its last
    // pixels there for compositor-driven re-entry, without spending GPU work.
    if (canvas.bottom <= 0 || canvas.top >= window.innerHeight) return;
    if (bounds.bottom <= canvas.top || bounds.top >= canvas.bottom || bounds.right <= canvas.left || bounds.left >= canvas.right) return;

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

export default function BadgeViewport({ element, children }) {
  const [scene] = useState(() => new Scene());
  return createPortal(
    <>
      <DrawBadge element={element} />
      {children}
    </>,
    scene,
    { events: { enabled: false } },
  );
}
