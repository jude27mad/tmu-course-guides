/* eslint-disable react/no-unknown-property, react/jsx-props-no-spreading, import/extensions */
import * as THREE from 'three';

import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { PerspectiveCamera, View } from '@react-three/drei';
import { bandTexture, cardTexture, loadBadgeFonts, redrawCard } from '@src/components/courseBadge/badgeTextures';
import { extend, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import useStill from '@src/hooks/useStill';
import useScroll from '@src/hooks/useScroll';

extend({ MeshLineGeometry, MeshLineMaterial, RoundedBoxGeometry });

// Original lanyard geometry, materials, rope joints and scroll impulses.
// The world lives beside View.Port, independently of any particular window.
const SPACING = 30; // world units between the lanyards (they never meet)
const ANCHOR_Y = 4;
const JOINT = 1.45; // card anchor above the card centre
// The original start: the rope laid out to the right, so the card swings in. With
// motion off the lanyard starts (and stays) hanging at rest.
const SWING_START = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [1.5, 0],
  [2, 0],
];
const REST_START = [
  [0, 0],
  [0, -1],
  [0, -2],
  [0, -3],
  [0, -3 - JOINT],
];
const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 2, linearDamping: 2 };

function Lanyard({ body, x, rest, swinging, paused, enabled }) {
  const scroll = useRef({ direction: 0, isScrolling: false, velocity: 0 });
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const start = rest ? REST_START : SWING_START;

  useRopeJoint(body.fixed, body.j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(body.j1, body.j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(body.j2, body.j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(body.j3, body.card, [
    [0, 0, 0],
    [0, JOINT, 0],
  ]);

  useScroll(({ direction, isScrolling, velocity }) => {
    scroll.current.direction = direction;
    scroll.current.isScrolling = isScrolling;
    scroll.current.velocity = velocity;
  });

  useFrame(() => {
    const card = body.card.current;
    if (paused || !card) return;
    if (scroll.current.isScrolling && swinging()) {
      const moveDistance = Math.abs(scroll.current.velocity) * 0.005;
      const directionVector = scroll.current.direction === 1 ? 1 : -1;
      card.applyImpulse({ x: directionVector * moveDistance, y: 0, z: 0 }, true);
    }
    ang.copy(card.angvel());
    rot.copy(card.rotation());
    card.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
  });

  useEffect(() => {
    [body.fixed, body.j1, body.j2, body.j3, body.card].forEach((ref) => ref.current?.setEnabled(enabled));
  }, [body, enabled]);

  const at = (i) => [x + start[i][0], ANCHOR_Y + start[i][1], 0];

  return (
    <>
      <RigidBody ref={body.fixed} {...segmentProps} type="fixed" position={at(0)} />
      <RigidBody position={at(1)} ref={body.j1} {...segmentProps}>
        <BallCollider args={[0.1]} />
      </RigidBody>
      <RigidBody position={at(2)} ref={body.j2} {...segmentProps}>
        <BallCollider args={[0.1]} />
      </RigidBody>
      <RigidBody position={at(3)} ref={body.j3} {...segmentProps}>
        <BallCollider args={[0.1]} />
      </RigidBody>
      <RigidBody position={at(4)} ref={body.card} {...segmentProps} type="dynamic">
        <CuboidCollider args={[0.8, 1.125, 0.01]} />
        {/* follows the card body (interpolated); the windows read it */}
        <object3D ref={body.cardObject} />
      </RigidBody>
    </>
  );
}

export function BadgeWorld({ registry }) {
  const { entries } = useSyncExternalStore(registry.subscribe, registry.getState, registry.getState);
  const rest = useStill();
  if (!entries.length) return null;
  const paused = rest || !entries.some((entry) => entry.visible);
  return (
    <Physics paused={paused} interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
      {entries.map((entry) => (
        <Lanyard
          key={`${entry.id}-${rest}`}
          body={entry.body}
          x={entry.slot * SPACING}
          rest={rest}
          paused={paused || !entry.visible}
          enabled={entry.visible || rest}
          swinging={() => entry.swing}
        />
      ))}
    </Physics>
  );
}

function useBadgeTextures(look) {
  const [textures, setTextures] = useState(null);
  const invalidate = useThree((state) => state.invalidate);
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    let cancelled = false;
    let made = null;
    loadBadgeFonts().then(() => {
      if (cancelled) return;
      made = { code: lookRef.current.code, card: cardTexture(lookRef.current), band: bandTexture(lookRef.current) };
      setTextures(made);
      invalidate();
    });
    return () => {
      cancelled = true;
      made?.card.dispose();
      made?.band.dispose();
    };
  }, [look.code, look.background, look.color, look.strap, look.strapColor, invalidate]);

  // the next date changes on the card face without a new texture
  useEffect(() => {
    if (textures?.code === look.code) {
      redrawCard(textures.card, look);
      invalidate();
    }
  }, [textures, look, invalidate]);

  return textures?.code === look.code ? textures : null;
}

// One window's card and band, drawn from its lanyard in the shared world.
function BadgeCard({ body, offsetX, look, idle, element, maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef();
  const card = useRef();
  const textures = useBadgeTextures(look);
  const lerped = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], []);
  const started = useRef(false);
  useEffect(() => {
    if (element) element.dataset.badgeRendered = 'false';
    return () => {
      if (element) element.dataset.badgeRendered = 'false';
    };
  }, [element, look.code]);
  const [curve] = useState(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    c.curveType = 'chordal';
    return c;
  });

  const materials = useMemo(() => {
    if (!textures) return null;
    // RoundedBox groups: right, left, top, bottom, front, back
    const edge = new THREE.MeshStandardMaterial({ color: look.background, roughness: 0.5, metalness: 0.4 });
    const face = new THREE.MeshPhysicalMaterial({ map: textures.card, alphaTest: 0.5, clearcoat: 1, clearcoatRoughness: 0.15, roughness: 0.5, metalness: 0.4 });
    return [edge, edge, edge, edge, face, face];
  }, [textures, look.background]);

  useEffect(
    () => () => {
      if (materials) [materials[0], materials[4]].forEach((material) => material.dispose());
    },
    [materials],
  );

  useFrame((_, delta) => {
    // the world is paused (off screen or motion off): nothing moves after the first pose
    if (textures && started.current && element) element.dataset.badgeRendered = 'true';
    if (idle && started.current) return;
    const { fixed, j1, j2, j3, cardObject } = body;
    const object = cardObject.current?.parent;
    if (!fixed.current || !j1.current || !j2.current || !j3.current || !object || !card.current || !band.current) return;

    card.current.position.set(object.position.x - offsetX, object.position.y, object.position.z);
    card.current.quaternion.copy(object.quaternion);

    [j1, j2].forEach((ref, k) => {
      const t = ref.current.translation();
      if (!started.current) lerped[k].copy(t);
      const clampedDistance = Math.max(0.1, Math.min(1, lerped[k].distanceTo(t)));
      // clamped to 1 (scaffold fix): at low frame rates the lerp overshot and the band went NaN
      lerped[k].lerp(t, Math.min(1, delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))));
    });
    started.current = true;
    curve.points[0].copy(j3.current.translation());
    curve.points[1].copy(lerped[1]);
    curve.points[2].copy(lerped[0]);
    curve.points[3].copy(fixed.current.translation());
    curve.points.forEach((point) => {
      point.x -= offsetX;
    });
    band.current.geometry.setPoints(curve.getPoints(32));
  });

  return (
    <>
      <group ref={card}>
        {materials && (
          <mesh material={materials}>
            {/* three's RoundedBoxGeometry (as the MagicBall boxes): per-face UVs, so the back reads the right way round */}
            <roundedBoxGeometry args={[1.6, 2.25, 0.02, 2, 0.01]} />
          </mesh>
        )}
        {/* clamp and clip ring */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.42, 0.16, 0.07]} />
          <meshStandardMaterial color={look.clip} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.36, 0]}>
          <torusGeometry args={[0.1, 0.028, 12, 24]} />
          <meshStandardMaterial color={look.clip} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        {textures && <meshLineMaterial color="white" resolution={[1, 1]} depthTest={false} useMap map={textures.band} repeat={[-3, 1]} lineWidth={1} />}
      </mesh>
    </>
  );
}

// View's scissor covers its own rectangle. Also clip to the stacked directory
// card, which may cover part of that rectangle as cards slide past one another.
function ClipToCard({ element }) {
  const { scene, gl } = useThree();
  const scissor = useMemo(() => new THREE.Vector4(), []);
  useEffect(() => {
    const previous = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => {
      previous?.apply(scene, args);
      const clip = element?.closest('[data-badge-clip]');
      if (!clip) return;
      const bounds = clip.getBoundingClientRect();
      const canvas = gl.domElement.getBoundingClientRect();
      gl.getScissor(scissor);
      const left = Math.max(scissor.x, bounds.left - canvas.left);
      const bottom = Math.max(scissor.y, canvas.bottom - bounds.bottom);
      const right = Math.min(scissor.x + scissor.z, bounds.right - canvas.left);
      const top = Math.min(scissor.y + scissor.w, canvas.bottom - bounds.top);
      gl.setScissor(left, bottom, Math.max(0, right - left), Math.max(0, top - bottom));
    };
    return () => {
      scene.onBeforeRender = previous;
    };
  }, [element, scene, gl, scissor]);

  useFrame(() => {
    const backing = element?.closest('[data-badge-clip]')?.querySelector('[data-badge-backing]');
    if (!backing) return;
    const window = element.getBoundingClientRect();
    const panel = backing.getBoundingClientRect();
    const left = window.left - panel.left;
    const top = window.top - panel.top;
    const right = left + window.width;
    const bottom = top + window.height;
    // A hole in the original animated panel, so it cannot tint the badge.
    const path = `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px)`;
    if (backing.style.clipPath !== path) backing.style.clipPath = path;
  });
  return null;
}

export function BadgeView({ entry, look, rest }) {
  return (
    <View visible={entry.visible} style={{ position: 'relative', display: 'block', backgroundColor: 'transparent', height: '100%', width: '100%' }}>
      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={25} />
      <ambientLight intensity={Math.PI} />
      <BadgeCard key={`${entry.id}-${rest}`} body={entry.body} offsetX={entry.slot * SPACING} look={look} idle={!entry.visible || rest} element={entry.element} />
      <ClipToCard element={entry.element} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <directionalLight position={[-5, 5, 5]} intensity={1} />
      <directionalLight position={[0, 5, -5]} intensity={2} />
    </View>
  );
}
