/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';

import { Environment, PerspectiveCamera, Sphere, View } from '@react-three/drei';
import { disposeMarbleTextures, loadMarbleFont, marbleTextures } from '@src/pages/components/about/components/marbleTextures';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

import { withBasePath } from '@src/utils/basePath';

// The original MagicBall (pages/about/components/magicball), ported for the Desk's
// "Next up" window: the same marble (a meshStandardMaterial patched with a
// height-volume raymarch) in the next item's course palette, with the course
// code as its label. Differences, all for phones (design-map §6.5 item 4):
// the label, base and height maps are canvases drawn once (no troika, no
// per-frame render target, no downloaded images), the raymarch takes 20 steps
// on phones instead of 48, and the ball only turns while its window is in view.
const DESKTOP_ITERATIONS = 48;
const PHONE_ITERATIONS = 20;
const RADIUS = 1.8;
// share of the window's smaller side the ball fills
const FILL = 0.62;
const FOV = 75;

const sNoiseFuncs = `
vec3 mod289(vec3 x) {
   return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
   return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
   return mod289(((x*34.0)+1.0)*x);
}

#define noiseFactor 0.2

float snoise(vec2 v) {
 const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
 vec2 i  = floor(v + dot(v, C.yy));
 vec2 x0 = v - i + dot(i, C.xx);

 vec2 i1;
 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
 vec4 x12 = x0.xyxy + C.xxzz;
 x12.xy -= i1;

 i = mod289(i);
 vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

 vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
 m = m*m;
 m = m*m;

 vec3 x = 2.0 * fract(p * C.www) - 1.0;
 vec3 h = abs(x) - 0.5;
 vec3 ox = floor(x + 0.5);
 vec3 a0 = x - ox;

 m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

 vec3 g;
 g.x  = a0.x  * x0.x  + h.x  * x0.y;
 g.yz = a0.yz * x12.xz + h.yz * x12.yw;
 return noiseFactor * dot(m, g);
}`;

function MarbleMaterial({ color, roughness, textures, iterations, timeUniform }) {
  const [uniforms] = useState(() => ({
    time: timeUniform,
    volumeColor: { value: new THREE.Color(color) },
    baseMap: { value: textures.base },
    heightVolumeMap: { value: textures.height },
    iterations: { value: iterations },
    smoothing: { value: 0.02 },
    rayDirPos: { value: { x: 0, y: 0, z: 1 } },
    rayOrigPos: { value: { x: 0, y: 0, z: 0 } },
    uRepeats: { value: { x: 5, y: 4 } },
    uTextSpeed: { value: 0.3 },
    uHasTexture: { value: true },
    uTexture: { value: textures.label },
    uUseTextAnimation: { value: true },
  }));

  useEffect(() => {
    uniforms.volumeColor.value.set(color);
    uniforms.baseMap.value = textures.base;
    uniforms.heightVolumeMap.value = textures.height;
    uniforms.uTexture.value = textures.label;
    uniforms.iterations.value = iterations;
  }, [color, textures, iterations, uniforms]);

  const onBeforeCompile = useMemo(
    () => (shader) => {
      shader.uniforms = { ...shader.uniforms, ...uniforms };

      shader.vertexShader = /* glsl */ `
      varying vec3 v_pos;
      varying vec3 v_dir;
      varying vec2 vUv;

    ${shader.vertexShader}`;

      shader.vertexShader = shader.vertexShader.replace(
        /void main\(\) {/,
        (match) => `${match}
        vUv = uv;
        vNormal = normal;

        vec3 newPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        `,
      );

      shader.fragmentShader = /* glsl */ `
      #define FLIP vec2(1., -1.)

      uniform vec3 volumeColor;
      uniform sampler2D baseMap;
      uniform sampler2D heightVolumeMap;
      uniform int iterations;
      uniform float smoothing;
      uniform float time;
      uniform vec3 rayDirPos;
      uniform vec3 rayOrigPos;

      uniform bool uHasTexture;
      uniform vec2 uRepeats;
      uniform sampler2D uTexture;
      uniform float uTextSpeed;
      uniform float uTime;
      uniform bool uUseTextAnimation;

      varying vec3 v_pos;
      varying vec3 v_dir;
      varying vec2 vUv;

    ${shader.fragmentShader}`;

      shader.fragmentShader = shader.fragmentShader.replace(
        /void main\(\) {/,
        (match) => `${sNoiseFuncs}

      vec3 raymarching_sphere(vec3 rayOrigin, vec3 rayDir) {
        float perIteration = 1.0 / float(iterations);
        vec3 deltaRay = rayDir * perIteration;
        vec3 p = rayOrigin;
        float totalVolume = 0.0;
        vec2 uv2 = vUv;

        for (int i = 0; i < iterations; ++i) {
            vec2 uv = uv2;
            float s = snoise(vec2(uv.x * 1.0 + time * 10.0, uv.y * 1.3 + time * 10.0));
            uv *= 1.0 + s * 100.0;
            float heightMapVal = texture(heightVolumeMap, uv).r;
            float cutoff = 1.0 - float(i) * perIteration;
            float slice = smoothstep(cutoff, cutoff + smoothing, heightMapVal);
            totalVolume += slice * perIteration;
            p += deltaRay;

            if (totalVolume >= 1.0) {
                break;
            }
        }

        float s2 = snoise(vec2(uv2.x * 1.0 - time * 10.0, uv2.y * 1.3 - time * 10.0));
        uv2 *= 1.0 + s2 * 100.0;

        return mix(texture(baseMap, uv2).rgb, volumeColor.rgb, totalVolume);
    }
      ${match}`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        /vec4 diffuseColor.*;/,
        `
      vec2 repeat = vec2(uRepeats.x, uRepeats.y);
      float animationSpeed = uUseTextAnimation ? uTime * uTextSpeed * 0.5: 0.0;
      vec2 uv = fract(animationSpeed + vUv * repeat);
      vec3 textureColor = texture2D(uTexture, uv).rgb;

      vec3 rayDir = normalize(v_dir) + rayDirPos;
      vec3 rayOrigin = v_pos + rayOrigPos;
      vec3 rgb = raymarching_sphere(rayOrigin, rayDir);
      vec4 sphereColor = vec4(rgb, 1.0);
      vec4 textColor =  vec4(0.0, 0.0, 0.0, 1.0);
      vec4 diffuseColor = mix(sphereColor, textColor, step(0.5, textureColor.r));`,
      );

      // The shared canvas outputs linear colour on the Desk (the original hero and
      // badges were tuned for that); his MagicBalls were seen with sRGB output
      // (/about), so the marble encodes its own output to look the same here.
      // (The output colour space is part of three's program key, so this runs
      // again if the canvas switches.)
      if (shader.outputColorSpace !== THREE.SRGBColorSpace) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', '#include <colorspace_fragment>\n gl_FragColor = sRGBTransferOETF( gl_FragColor );');
      }
    },
    [uniforms],
  );

  return <meshStandardMaterial roughness={roughness} onBeforeCompile={onBeforeCompile} customProgramCacheKey={() => 'desk-marble'} />;
}

function Ball({ label, palette, active, isMobile }) {
  const mesh = useRef();
  const clock = useRef(0);
  const [timeUniform] = useState(() => ({ value: 1 }));
  const [textures, setTextures] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let made = null;
    loadMarbleFont().then(() => {
      if (cancelled) return;
      made = marbleTextures({ label, palette });
      setTextures(made);
    });
    return () => {
      cancelled = true;
      disposeMarbleTextures(made);
    };
  }, [label, palette]);

  useFrame((state, delta) => {
    // Camera distance so the ball fills FILL of the window's smaller side
    // (the View's portal size is its window).
    const { camera, size } = state;
    const aspect = size.width && size.height ? size.width / size.height : camera.aspect || 1;
    const z = (RADIUS * 2) / (FILL * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.min(1, aspect));
    if (Math.abs(camera.position.z - z) > 0.001) camera.position.z = z;
    if (!active || !mesh.current) return;
    clock.current += Math.min(delta, 0.1);
    mesh.current.rotation.y = clock.current;
    timeUniform.value = 1 + clock.current * 0.05;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={FOV} near={0.1} far={50} />
      {textures && (
        <Sphere args={[RADIUS, 32, 32]} ref={mesh}>
          <MarbleMaterial color={palette.menuColor} roughness={isMobile ? 0.5 : 0.4} textures={textures} iterations={isMobile ? PHONE_ITERATIONS : DESKTOP_ITERATIONS} timeUniform={timeUniform} />
        </Sphere>
      )}
    </>
  );
}

export default function Marble({ course, active, isMobile }) {
  return (
    <View style={{ position: 'relative', display: 'block', backgroundColor: 'transparent', height: '100%', width: '100%' }}>
      {course && <Ball key={course.id} label={course.code} palette={course.palette} active={active} isMobile={isMobile} />}
      <Environment files={withBasePath('/other/warehouse.hdr')} blur={1} />
    </View>
  );
}
