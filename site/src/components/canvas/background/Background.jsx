import * as THREE from 'three';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

import { TOKENS, rgbOf } from '@src/lib/palette.mjs';
import fragmentShader from '@src/components/canvas/background/shaders/fragmentShader';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import vertexShader from '@src/components/canvas/background/shaders/vertexShader';

// The original moved the offsets 0.00005 per frame at 60 fps; the canvas now renders
// on demand at a lower rate, so the step is applied per second of real time.
const OFFSET_STEP_PER_SECOND = 0.00005 * 60;
const OFFSET_MAX = 5.0;
const OFFSET_MIN = 0.1;

// The dark panels' light sweep, built only from the panel greys: ink -> raised -> sheen (the brightest point).
const unitRgb = (hex) =>
  rgbOf(hex)
    .split(', ')
    .map((channel) => Number(channel) / 255);

function updateOffset(uniform, isIncreasing, step, min, max) {
  if (uniform.value >= max && isIncreasing.current) {
    isIncreasing.current = false;
  } else if (uniform.value <= min && !isIncreasing.current) {
    isIncreasing.current = true;
  }

  uniform.value += isIncreasing.current ? step : -step;
}

function Background({ still = false }) {
  const ref = useRef();
  const viewport = useThree((state) => state.viewport);
  const canvasWidth = useThree((state) => state.size.width);
  const canvasHeight = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);

  const isOffsetXIncreasing = useRef(true);
  const isOffsetYIncreasing = useRef(true);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: unitRgb(TOKENS.sheen) },
      uColor2: { value: unitRgb(TOKENS.raised) },
      uColor3: { value: unitRgb(TOKENS.ink) },
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
    }),
    [],
  );

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

      updateOffset(materialUniforms.uOffsetX, isOffsetXIncreasing, OFFSET_STEP_PER_SECOND * dt, OFFSET_MIN, OFFSET_MAX);
      updateOffset(materialUniforms.uOffsetY, isOffsetYIncreasing, OFFSET_STEP_PER_SECOND * dt, OFFSET_MIN, OFFSET_MAX);
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
