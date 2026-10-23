/* eslint-disable @react-three/no-new-in-loop */

import { Camera, Scene, Texture, Vector2, Vector3 } from 'three';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useMemo, useRef } from 'react';

import Effect from '@src/components/canvas/fluid/effect/Fluid';
import useFBOs from '@src/components/canvas/fluid/hooks/useFBOs';
import useMaterials from '@src/components/canvas/fluid/hooks/useMaterials';
import useOpts from '@src/components/canvas/fluid/hooks/useOpts';
import usePointerEvents from '@src/components/canvas/fluid/hooks/usePointerEvents';

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

  // Cached vectors for useFrame allocations to avoid stutter
  const pointerVec = useMemo(() => new Vector2(), []);
  const colorVec = useMemo(() => new Vector3(), []);

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

  useFrame(() => {
    if (!meshRef.current || !postRef.current) return;

    while (splatStack.current.length > 0) {
      const { mouseX, mouseY, velocityX, velocityY } = splatStack.current.pop();

      pointerVec.set(mouseX, mouseY);
      colorVec.set(velocityX, velocityY, 10.0);

      setShaderMaterial('splat');
      setUniforms('splat', 'uTarget', FBOs.velocity.read.texture);
      setUniforms('splat', 'uPointer', pointerVec);
      setUniforms('splat', 'uColor', colorVec);
      setUniforms('splat', 'uRadius', radius / 100.0);
      setRenderTarget('velocity');
      setUniforms('splat', 'uTarget', FBOs.density.read.texture);
      setRenderTarget('density');
    }

    // curl
    setShaderMaterial('curl');
    setUniforms('curl', 'uVelocity', FBOs.velocity.read.texture);
    setRenderTarget('curl');

    // vorticity
    setShaderMaterial('vorticity');
    setUniforms('vorticity', 'uVelocity', FBOs.velocity.read.texture);
    setUniforms('vorticity', 'uCurl', FBOs.curl.texture);
    setUniforms('vorticity', 'uCurlValue', curl);
    setRenderTarget('velocity');

    // divergence
    setShaderMaterial('divergence');
    setUniforms('divergence', 'uVelocity', FBOs.velocity.read.texture);
    setRenderTarget('divergence');

    // clear
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
    setUniforms('advection', 'uDissipation', velocityDissipation);
    setRenderTarget('velocity');

    setUniforms('advection', 'uSource', FBOs.density.read.texture);
    setUniforms('advection', 'uDissipation', densityDissipation);
    setRenderTarget('density');

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
