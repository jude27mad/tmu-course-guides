/* eslint-disable react/no-unknown-property, import/extensions */
import * as THREE from 'three';

import { Environment, Sphere, View } from '@react-three/drei';
import { Suspense, useEffect, useRef, useState } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import { gradientTexture, heightTexture, labelTexture } from '@src/pages/course/components/magicball/textures';

import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import useBallSlot from '@src/pages/course/components/magicball/ballSlots';
import useInView from '@src/hooks/useInView';
import useIsMobile from '@src/hooks/useIsMobile';
import useStill from '@src/hooks/useStill';
import { withBasePath } from '@src/utils/basePath';

extend({ RoundedBoxGeometry });

// The original MagicBall (pages/about/components/magicball), adapted:
// - the label is drawn once on a 2D canvas (no drei <Text>/troika, no per-frame render target);
// - base and height maps are generated in the course palette (no peakpx.jpg, noise1/2.png);
// - warehouse.hdr (CC0) lights both the sphere and the rounded box;
// - fewer raymarch steps on phones, and only one ball mounted at a time there;
// - nothing moves while motion is off or the window is out of view.
const DESKTOP_ITERATIONS = 48;
const PHONE_ITERATIONS = 20;
const DEFAULT_SMOOTHING = 0.02;
const DEFAULT_RAY_DIR_POS = { x: 0, y: 0, z: 1 };
const DEFAULT_RAY_ORIG_POS = { x: 0, y: 0, z: 0 };
const ENVIRONMENT = '/other/warehouse.hdr';

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

// Same patch as the original's (kept verbatim apart from the comments), so every ball shares one program.
function onBeforeCompile(shader) {
  shader.uniforms = { ...shader.uniforms, ...this.userData.uniforms };

  shader.vertexShader = /* glsl */ `
      varying vec3 v_pos;
      varying vec3 v_dir;
      varying vec2 vUv;

    ${shader.vertexShader}`;

  shader.vertexShader = shader.vertexShader.replace(
    /void main\(\) {/,
    (match) =>
      `${match}
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
    (match) =>
      `${sNoiseFuncs}

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
            float height = length(p);
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
}
const programKey = () => 'course-magic-marble';

function MagicMarbleMaterial({ roughness, color, label, isSphere, palette, iterations, running }) {
  const [uniforms] = useState(() => ({
    time: { value: 1 },
    volumeColor: { value: new THREE.Color(color) },
    baseMap: { value: gradientTexture(palette, isSphere ? 'sphere' : 'box') },
    heightVolumeMap: { value: heightTexture(isSphere ? 'sphere' : 'box') },
    iterations: { value: iterations },
    smoothing: { value: DEFAULT_SMOOTHING },
    rayDirPos: { value: DEFAULT_RAY_DIR_POS },
    rayOrigPos: { value: DEFAULT_RAY_ORIG_POS },
    uRepeats: { value: isSphere ? { x: 5, y: 4 } : { x: 1, y: 1 } },
    uTextSpeed: { value: 0.3 },
    uHasTexture: { value: true },
    uTexture: { value: labelTexture(label, { widthRatio: isSphere ? 0.62 : 0.72 }) },
    uUseTextAnimation: { value: true },
    uTime: { value: 0 },
  }));

  useEffect(() => {
    uniforms.volumeColor.value.set(color);
    uniforms.uTexture.value = labelTexture(label, { widthRatio: isSphere ? 0.62 : 0.72 });
    uniforms.iterations.value = iterations;
  }, [uniforms, color, label, isSphere, iterations]);

  useFrame(({ clock }) => {
    if (!running) return;
    uniforms.time.value = 1 + clock.elapsedTime * 0.05;
  });

  return <meshStandardMaterial roughness={roughness} userData={{ uniforms }} onBeforeCompile={onBeforeCompile} customProgramCacheKey={programKey} />;
}

function Marble({ roughness, color, label, isSphere, palette, iterations, running }) {
  const mesh = useRef();

  useFrame(({ clock }) => {
    if (!running || !mesh.current) return;
    mesh.current.rotation.y = clock.getElapsedTime();
  });

  const material = <MagicMarbleMaterial roughness={roughness} color={color} label={label} isSphere={isSphere} palette={palette} iterations={iterations} running={running} />;

  return isSphere ? (
    <Sphere args={[1.8, 32, 32]} ref={mesh}>
      {material}
    </Sphere>
  ) : (
    <mesh ref={mesh}>
      <roundedBoxGeometry attach="geometry" args={[2.7, 2.7, 2.7, 7, 0.2]} />
      {material}
    </mesh>
  );
}

// `single`: phone rule, only the most visible ball of the page is mounted.
// The wrapper keeps its size either way, so the window around it never jumps.
export default function MagicBall({ roughness = 0.4, color, isSphere = true, label, palette, className, viewClassName, single }) {
  const wrapperRef = useRef(null);
  const isMobile = useIsMobile();
  const still = useStill();
  const mounted = useBallSlot(wrapperRef, { single: single ?? isMobile });
  const inView = useInView(wrapperRef);

  return (
    <div ref={wrapperRef} className={className} aria-hidden="true">
      {mounted && palette ? (
        <View className={viewClassName}>
          <Suspense fallback={null}>
            <Marble roughness={roughness} color={color} label={label} isSphere={isSphere} palette={palette} iterations={isMobile ? PHONE_ITERATIONS : DESKTOP_ITERATIONS} running={inView && !still} />
            <Environment files={withBasePath(ENVIRONMENT)} blur={1} />
          </Suspense>
        </View>
      ) : null}
    </div>
  );
}
