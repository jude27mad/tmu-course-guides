import * as THREE from 'three';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';

import fragmentShader from '@src/components/canvas/background/shaders/fragmentShader';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import vertexShader from '@src/components/canvas/background/shaders/vertexShader';
import useMediaQuery from '@src/hooks/useMediaQuery';
// eslint-disable-next-line import/extensions
import { ARTWORK_FLOOR, DARK_QUERY, prefersDark } from '@src/lib/palette.mjs';

// The original moves the offsets 0.00005 every frame it draws (twice as fast on a
// 120 Hz screen). While a panel is open the canvas draws every display frame and
// does the same (`live`); behind the page it renders on demand at a lower rate,
// so the step is applied per second of real time at the 60 fps pace.
const OFFSET_STEP_PER_FRAME = 0.00005;
const OFFSET_STEP_PER_SECOND = OFFSET_STEP_PER_FRAME * 60;
const OFFSET_MAX = 5.0;
const OFFSET_MIN = 0.1;

// Giats's light sweep: a grey glow (63) over grey (38) and a near-black violet (9, 5, 12).
const SWEEP = {
  glow: [63 / 255, 63 / 255, 63 / 255],
  mid: [38 / 255, 38 / 255, 38 / 255],
  deep: [9 / 255, 5 / 255, 12 / 255],
};

function updateOffset(uniform, isIncreasing, step, min, max) {
  if (uniform.value >= max && isIncreasing.current) {
    isIncreasing.current = false;
  } else if (uniform.value <= min && !isIncreasing.current) {
    isIncreasing.current = true;
  }

  uniform.value += isIncreasing.current ? step : -step;
}

function Background({ still = false, live = false }) {
  const ref = useRef();
  const viewport = useThree((state) => state.viewport);
  const canvasWidth = useThree((state) => state.size.width);
  const canvasHeight = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);

  // Dark mode floors the sweep at the page's ink (ARTWORK_FLOOR); `dark` only says when to look again, since the
  // canvas can mount during hydration, while it is still the server's false.
  const dark = useMediaQuery(DARK_QUERY);
  const isOffsetXIncreasing = useRef(true);
  const isOffsetYIncreasing = useRef(true);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: SWEEP.glow },
      uColor2: { value: SWEEP.mid },
      uColor3: { value: SWEEP.deep },
      uColorAccent: { value: new THREE.Color(20.0, 20.0, 20.0) },
      uLinesBlur: { value: 0.49 },
      uNoise: { value: 0.02 },
      uOffsetX: { value: 0.34 },
      uOffsetY: { value: 0.0 },
      uLinesAmount: { value: 5.0 },
      uPlaneRes: { value: new THREE.Vector2(1, 1) },
      uMouse2D: { value: new THREE.Vector2(1.0, 1.0) },
      uBackgroundScale: { value: 3.0 },
      uUvScaleY: { value: 1 },
      uUvOffsetY: { value: 0 },
      uFloor: { value: ARTWORK_FLOOR.light },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uFloor.value = prefersDark() ? ARTWORK_FLOOR.dark : ARTWORK_FLOOR.light;
    invalidate();
  }, [dark, uniforms, invalidate]);

  // On iPhone the canvas reaches --edge-bleed-* past the layout viewport (see
  // global.scss). Draw the viewport band exactly as before; the reach continues it.
  useIsomorphicLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const top = parseFloat(style.getPropertyValue('--edge-bleed-top')) || 0;
    const bottom = parseFloat(style.getPropertyValue('--edge-bleed-bottom')) || 0;
    const band = canvasHeight - top - bottom;
    if (!(band > 0)) return;
    // Resize the existing shader's viewport, retaining its drift and material.
    uniforms.uPlaneRes.value.set(canvasWidth, band);
    uniforms.uUvScaleY.value = canvasHeight / band;
    uniforms.uUvOffsetY.value = -bottom / band;
    invalidate();
  }, [canvasWidth, canvasHeight, uniforms, invalidate]);

  useFrame((state, delta) => {
    if (still) return;
    if (ref.current && ref.current.material && ref.current.material.uniforms) {
      const materialUniforms = ref.current.material.uniforms;
      // delta is the time since the last rendered frame; clamp tab-switch gaps
      const dt = Math.min(delta, 0.25);
      materialUniforms.uTime.value += dt * 0.001;

      const step = live ? OFFSET_STEP_PER_FRAME : OFFSET_STEP_PER_SECOND * dt;
      updateOffset(materialUniforms.uOffsetX, isOffsetXIncreasing, step, OFFSET_MIN, OFFSET_MAX);
      updateOffset(materialUniforms.uOffsetY, isOffsetYIncreasing, step, OFFSET_MIN, OFFSET_MAX);
    }
  });

  return (
    <mesh ref={ref} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial attach="material" uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
    </mesh>
  );
}

export default Background;
