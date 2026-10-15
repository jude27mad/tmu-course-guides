import * as THREE from 'three';

/* eslint-disable no-plusplus */
/* eslint-disable @react-three/no-new-in-loop */
/* eslint-disable no-shadow */
import { useEffect, useMemo, useRef, useState } from 'react';

import { COURSES } from '@src/lib';
import { InstancedRigidBodies } from '@react-three/rapier';
import { MeshTransmissionMaterial } from '@react-three/drei';
import { easing } from 'maath';
import { useFrame } from '@react-three/fiber';

// The cycling accents are the three course menu colours (decision 3).
const accents = COURSES.map((course) => course.palette.menuColor);

const r = THREE.MathUtils.randFloatSpread;

// Stands in for the glass spheres' transmission buffer while the hero is off
// screen, so drei skips its extra render of the scene every frame.
const idleBuffer = new THREE.Texture();

const target = new THREE.Vector3();
const current = new THREE.Vector3();
const nextColor = new THREE.Color();
const currentColor = new THREE.Color();

export default function FloatRigidBody({ totalCount, transparentCount, isMobile, active = true, near = true }) {
  const apiNormal = useRef(null);
  const apiTransparent = useRef(null);
  const sphereRef = useRef();

  const [currentAccentIndex, setCurrentAccentIndex] = useState(0);

  const normalCount = totalCount - transparentCount;
  const darkCount = !isMobile ? 7 : 4;

  const { factors, xFactors, yFactors, zFactors, normalInstances, transparentInstances, colors } = useMemo(() => {
    const factors = [];

    const xFactors = [];
    const yFactors = [];
    const zFactors = [];

    const normalInstances = [];
    const transparentInstances = [];
    const colors = new Float32Array(normalCount * 3);
    const color = new THREE.Color();
    apiNormal.current = [];
    apiTransparent.current = [];
    for (let i = 0; i < totalCount; i++) {
      const instance = {
        key: isMobile ? `mobileInstance_${i}` : `desktopInstance_${i}`,
        position: [r(isMobile ? 10 : 20), r(10), r(20)],
        scale: isMobile ? 0.8 : 1,
      };
      factors.push(THREE.MathUtils.randInt(20, 100));

      xFactors.push(THREE.MathUtils.randFloatSpread(isMobile ? 14 : 40));
      yFactors.push(THREE.MathUtils.randFloatSpread(10));
      zFactors.push(THREE.MathUtils.randFloatSpread(10));
      if (i < normalCount) {
        normalInstances.push(instance);
        if (i < darkCount) {
          colors.set(color.set('#1A1A1A').toArray(), i * 3);
        } else {
          colors.set(color.set(accents[0]).toArray(), i * 3);
        }
      } else {
        transparentInstances.push(instance);
      }
    }

    return { factors, xFactors, yFactors, zFactors, normalInstances, transparentInstances, colors };
  }, [isMobile, normalCount, totalCount, darkCount]);

  useEffect(() => {
    if (!active) return undefined;
    const interval = setInterval(() => {
      setCurrentAccentIndex((prevIndex) => (prevIndex + 1) % accents.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [active]);

  const drift = (bodies, offset, time) => {
    bodies.forEach((body, i) => {
      if (!body) return;
      const k = offset + i;
      const t = factors[k] + time * 0.25;

      target.set(
        Math.cos(t) + Math.sin(t * 1) / 10 + xFactors[k] + Math.cos((t / 10) * factors[k]) + (Math.sin(t * 1) * factors[k]) / 10,
        Math.sin(t) + Math.cos(t * 2) / 10 + yFactors[k] + Math.sin((t / 10) * factors[k]) + (Math.cos(t * 2) * factors[k]) / 10,
        Math.sin(t) + Math.cos(t * 2) / 10 + zFactors[k] + Math.cos((t / 10) * factors[k]) + (Math.sin(t * 3) * factors[k]) / 4,
      );

      const apiTranslation = body.translation();
      current.set(apiTranslation.x, apiTranslation.y, apiTranslation.z);

      const forceMagnitude = 0.5;
      target.sub(current).normalize().multiplyScalar(forceMagnitude);

      body.applyImpulse(target, true);
    });
  };

  useFrame((state) => {
    // Off screen or motion off: nothing to push, nothing to recolour.
    if (!active) return;
    const time = state.clock.elapsedTime;
    if (apiNormal.current) {
      drift(apiNormal.current, 0, time);

      nextColor.set(accents[currentAccentIndex]);
      for (let i = darkCount; i < normalCount; i++) {
        currentColor.fromArray(colors, i * 3);
        easing.dampC(currentColor, nextColor, 0.1, state.delta);
        currentColor.toArray(colors, i * 3);
      }

      if (sphereRef.current && sphereRef.current.geometry.attributes.color) {
        sphereRef.current.geometry.attributes.color.needsUpdate = true;
      }
    }

    if (apiTransparent.current) {
      drift(apiTransparent.current, normalCount, time);
    }
  });

  return (
    <>
      <InstancedRigidBodies type="dynamic" ref={apiNormal} colliders="ball" instances={normalInstances} linearDamping={50} angularDamping={50} friction={0.1}>
        <instancedMesh dispose={null} ref={sphereRef} castShadow receiveShadow args={[null, null, normalCount]}>
          <sphereGeometry>
            <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
          </sphereGeometry>
          <meshStandardMaterial vertexColors roughness={0.5} metalness={0.2} />
        </instancedMesh>
      </InstancedRigidBodies>
      <InstancedRigidBodies type="dynamic" ref={apiTransparent} colliders="ball" instances={transparentInstances} linearDamping={50} angularDamping={50} friction={0.1}>
        <instancedMesh dispose={null} castShadow receiveShadow args={[null, null, transparentCount]}>
          <sphereGeometry />
          {/* phones: 4 samples into a 256² buffer (the original: 10 samples at full size) */}
          <MeshTransmissionMaterial
            buffer={near ? undefined : idleBuffer}
            samples={isMobile ? 4 : 10}
            resolution={isMobile ? 256 : undefined}
            transmission={1.0}
            roughness={0}
            thickness={4}
            ior={1.5}
            chromaticAberration={0.06}
            anisotropy={0.2}
            distortion={0}
            displacementScale={0.3}
            temporalDistortion={0.5}
            clearcoat={1}
            attenuationDistance={0.5}
          />
        </instancedMesh>
      </InstancedRigidBodies>
    </>
  );
}
