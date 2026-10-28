/* eslint-disable @react-three/no-new-in-loop */

import { Camera, Scene, Texture, Vector2, Vector3 } from 'three';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';

import Effect from '@src/components/canvas/fluid/effect/Fluid';
import useFBOs from '@src/components/canvas/fluid/hooks/useFBOs';
import useMaterials from '@src/components/canvas/fluid/hooks/useMaterials';
import useOpts from '@src/components/canvas/fluid/hooks/useOpts';
import usePointerEvents from '@src/components/canvas/fluid/hooks/usePointerEvents';
// eslint-disable-next-line import/extensions
import { decayFor, frameSteps } from '@src/utils/frameStep.mjs';
// eslint-disable-next-line import/extensions
import { listenForGameCelebration } from './gameCelebration.mjs';

// The original advanced the simulation 0.016 s, dissipated once and added a
// full dye splat for every rendered frame, so at 120 Hz the fluid moved twice
// as fast and faded far sooner. Each frame now covers its share of a 60 Hz
// frame. A burst (the game celebration) is a one-off and keeps its full dye.
const STEP_DT = 0.016;
const SPLAT_DYE = 10.0;

function Fluid({ mainRef, fluidColor }) {
  const OPTS = useOpts();
  const { force, radius, curl, swirl, intensity, backgroundColor, showBackground, pressure, densityDissipation, velocityDissipation } = OPTS;
  const size = useThree((three) => three.size);
  const gl = useThree((three) => three.gl);

  const bufferScene = useRef(new Scene());
  const bufferCamera = useRef(new Camera());
  const meshRef = useRef(null);
  const postRef = useRef(null);
  const FBOs = useFBOs();
  const materials = useMaterials();
  const splatStack = usePointerEvents(mainRef, size, force);

  const pointerRef = useRef(new Vector2());
  const colorRef = useRef(new Vector3());

  useEffect(() => listenForGameCelebration(window, splatStack, size), [splatStack, size]);

  const setShaderMaterial = useCallback(
    (name) => {
      if (!meshRef.current) return;
      meshRef.current.material = materials[name];
      meshRef.current.material.needsUpdate = true;
    },
    [materials],
  );

  const setRenderTarget = useCallback(
    (name) => {
      const target = FBOs[name];
      if ('write' in target) {
        gl.setRenderTarget(target.write);
        gl.clear();
        gl.render(bufferScene.current, bufferCamera.current);
        target.swap();
      } else {
        gl.setRenderTarget(target);
        gl.clear();
        gl.render(bufferScene.current, bufferCamera.current);
      }
    },
    [bufferCamera, bufferScene, FBOs, gl],
  );

  const setUniforms = useCallback(
    (material, uniform, value) => {
      const mat = materials[material];
      if (mat && mat.uniforms[uniform]) {
        mat.uniforms[uniform].value = value;
      }
    },
    [materials],
  );

  useFrame((_, delta) => {
    if (!meshRef.current || !postRef.current) return;
    const steps = frameSteps(delta);
    if (!steps) return;

    while (splatStack.current.length > 0) {
      const { mouseX, mouseY, velocityX, velocityY, radiusScale = 1, burst = false } = splatStack.current.pop();

      pointerRef.current.set(mouseX, mouseY);
      colorRef.current.set(velocityX, velocityY, burst ? SPLAT_DYE : SPLAT_DYE * steps);

      setShaderMaterial('splat');
      setUniforms('splat', 'uTarget', FBOs.velocity.read.texture);
      setUniforms('splat', 'uPointer', pointerRef.current);
      setUniforms('splat', 'uColor', colorRef.current);
      setUniforms('splat', 'uRadius', (radius * radiusScale) / 100.0);
      setRenderTarget('velocity');
      setUniforms('splat', 'uTarget', FBOs.density.read.texture);
      setRenderTarget('density');
    }

    // Preserve the original shaderUpdates snapshot across the vorticity swap.
    const velocityTexture = FBOs.velocity.read.texture;

    setShaderMaterial('curl');
    setUniforms('curl', 'uVelocity', velocityTexture);
    setRenderTarget('curl');

    setShaderMaterial('vorticity');
    setUniforms('vorticity', 'uVelocity', velocityTexture);
    setUniforms('vorticity', 'uCurl', FBOs.curl.texture);
    setUniforms('vorticity', 'uCurlValue', curl);
    setUniforms('vorticity', 'dt', STEP_DT * steps);
    setRenderTarget('velocity');

    setShaderMaterial('divergence');
    setUniforms('divergence', 'uVelocity', velocityTexture);
    setRenderTarget('divergence');

    setShaderMaterial('clear');
    setUniforms('clear', 'uTexture', FBOs.pressure.read.texture);
    setUniforms('clear', 'uClearValue', pressure);
    setRenderTarget('pressure');

    setShaderMaterial('pressure');
    setUniforms('pressure', 'uDivergence', FBOs.divergence.texture);
    for (let i = 0; i < swirl; i += 1) {
      setUniforms('pressure', 'uPressure', FBOs.pressure.read.texture);
      setRenderTarget('pressure');
    }

    setShaderMaterial('gradientSubstract');
    setUniforms('gradientSubstract', 'uPressure', FBOs.pressure.read.texture);
    setUniforms('gradientSubstract', 'uVelocity', FBOs.velocity.read.texture);
    setRenderTarget('velocity');

    setShaderMaterial('advection');
    setUniforms('advection', 'uVelocity', FBOs.velocity.read.texture);
    setUniforms('advection', 'uSource', FBOs.velocity.read.texture);
    setUniforms('advection', 'dt', STEP_DT * steps);
    setUniforms('advection', 'uDissipation', decayFor(velocityDissipation, steps));
    setRenderTarget('velocity');

    setUniforms('advection', 'uSource', FBOs.density.read.texture);
    setUniforms('advection', 'uDissipation', decayFor(densityDissipation, steps));
    setRenderTarget('density');

    // Every pass swaps the density buffers, so the texture captured when the
    // effect was created held this frame's dye only every other frame: an
    // idle trail refreshed at half the display rate. Show the current one.
    postRef.current.updateUniform('tFluid', FBOs.density.read.texture);

    gl.setRenderTarget(null);
    gl.clear();
  }, 0);

  return (
    <>
      {createPortal(
        <mesh ref={meshRef} scale={[1, 1, 0]}>
          <planeGeometry args={[2, 2, 1, 1]} />
        </mesh>,
        bufferScene.current,
      )}
      <Effect
        intensity={intensity * 0.0001}
        backgroundColor={backgroundColor}
        fluidColor={fluidColor}
        showBackground={showBackground}
        ref={postRef}
        tFluid={FBOs?.density?.read?.texture || new Texture()}
      />
    </>
  );
}
export default Fluid;
