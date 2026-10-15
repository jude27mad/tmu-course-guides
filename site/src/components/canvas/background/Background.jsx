import * as THREE from 'three';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

import fragmentShader from '@src/components/canvas/background/shaders/fragmentShader';
import { useWindowSize } from '@darkroom.engineering/hamo';
import vertexShader from '@src/components/canvas/background/shaders/vertexShader';

// The original moved the offsets 0.00005 per frame at 60 fps; the canvas now renders
// on demand at a lower rate, so the step is applied per second of real time.
const OFFSET_STEP_PER_SECOND = 0.00005 * 60;
const OFFSET_MAX = 5.0;
const OFFSET_MIN = 0.1;

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
  const windowSize = useWindowSize();
  const { viewport } = useThree();

  const isOffsetXIncreasing = useRef(true);
  const isOffsetYIncreasing = useRef(true);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: [63 / 255, 63 / 255, 63 / 255] },
      uColor2: { value: [38 / 255, 38 / 255, 38 / 255] },
      uColor3: { value: [9 / 255, 5 / 255, 12 / 255] },
      uColorAccent: { value: new THREE.Color(20.0, 20.0, 20.0) },
      uLinesBlur: { value: 0.49 },
      uNoise: { value: 0.02 },
      uOffsetX: { value: 0.34 },
      uOffsetY: { value: 0.0 },
      uLinesAmount: { value: 5.0 },
      uPlaneRes: { value: new THREE.Vector2(windowSize.width, windowSize.height) },
      uMouse2D: { value: new THREE.Vector2(1.0, 1.0) },
      uBackgroundScale: { value: 3.0 },
    }),
    [windowSize],
  );

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
    <mesh ref={ref}>
      <planeGeometry args={[viewport.width, viewport.height, 1, 1]} />
      <shaderMaterial
        attach="material"
        args={[
          {
            uniforms,
            vertexShader,
            fragmentShader,
          },
        ]}
      />
    </mesh>
  );
}

export default Background;
