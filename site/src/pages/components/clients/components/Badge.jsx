/* eslint-disable react/no-unknown-property, react/jsx-props-no-spreading, import/extensions */
import * as THREE from 'three';

import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { PerspectiveCamera, View } from '@react-three/drei';
import { bandTexture, cardTexture, loadBadgeFonts, redrawCard } from '@src/pages/components/clients/components/badgeTextures';
import { extend, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';

import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import useInView from '@src/hooks/useInView';
import useScroll from '@src/hooks/useScroll';

extend({ MeshLineGeometry, MeshLineMaterial, RoundedBoxGeometry });

// The original lanyard badge (the pmndrs lanyard: a fixed anchor, three rope
// joints and a card on a spherical joint, swinging with the scroll), with
// two changes for phones and for rights:
// - ONE Physics world for the three badges (he ran one per badge). The world
//   lives in the first badge's View and simulates the three lanyards side by
//   side, far apart; every window's View draws its own card and band from
//   those bodies.
// - The card is a RoundedBox with a generated face (course code, name, next
//   date) and the band a generated print; no GLB, no client PNGs.
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

export function createBadgeRig(count) {
  return {
    bodies: Array.from({ length: count }, () => ({
      fixed: { current: null },
      j1: { current: null },
      j2: { current: null },
      j3: { current: null },
      card: { current: null },
      cardObject: { current: null },
    })),
    // per badge: its window is at least 70 % visible (the original swing condition)
    swing: Array.from({ length: count }, () => false),
  };
}

function Lanyard({ body, x, rest, swinging, paused }) {
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

// The one world (mounted in the first badge's View).
function BadgeWorld({ rig, paused, rest }) {
  return (
    <Physics paused={paused} interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
      {rig.bodies.map((body, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Lanyard key={i} body={body} x={i * SPACING} rest={rest} paused={paused} swinging={() => rig.swing[i]} />
      ))}
    </Physics>
  );
}

function useBadgeTextures(look) {
  const [textures, setTextures] = useState(null);
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    let cancelled = false;
    let made = null;
    loadBadgeFonts().then(() => {
      if (cancelled) return;
      made = { card: cardTexture(lookRef.current), band: bandTexture(lookRef.current) };
      setTextures(made);
    });
    return () => {
      cancelled = true;
      made?.card.dispose();
      made?.band.dispose();
    };
  }, [look.code, look.background, look.color]);

  // the next date changes on the card face without a new texture
  useEffect(() => {
    if (textures) redrawCard(textures.card, look);
  }, [textures, look.nextLabel, look.nextValue, look]);

  return textures;
}

// One window's card and band, drawn from its lanyard in the shared world.
function BadgeCard({ body, offsetX, look, idle, maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef();
  const card = useRef();
  const textures = useBadgeTextures(look);
  const lerped = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], []);
  const started = useRef(false);
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
            {/* three's RoundedBoxGeometry: per-face UVs, so the back reads the right way round */}
            <roundedBoxGeometry args={[1.6, 2.25, 0.02, 2, 0.01]} />
          </mesh>
        )}
        {/* clamp and clip ring */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.42, 0.16, 0.07]} />
          <meshStandardMaterial color="#bdbdbd" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.36, 0]}>
          <torusGeometry args={[0.1, 0.028, 12, 24]} />
          <meshStandardMaterial color="#bdbdbd" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        {textures && <meshLineMaterial color="white" resolution={[1, 1]} depthTest={false} useMap map={textures.band} repeat={[-3, 1]} lineWidth={1} />}
      </mesh>
    </>
  );
}

// A badge window. `world` mounts the shared Physics world in this View.
export default function Badge({ index, rig, look, world = false, paused = false, rest = false }) {
  const el = useRef();
  const swing = useInView(el, { threshold: 0.7 });

  useEffect(() => {
    rig.swing[index] = swing;
  }, [rig, index, swing]);

  return (
    <View
      ref={(node) => {
        el.current = node;
      }}
      style={{ position: 'relative', display: 'block', backgroundColor: 'transparent', borderRadius: '1.3888888889vw', height: '100%', width: '100%' }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={25} />
      <ambientLight intensity={Math.PI} />
      {world && <BadgeWorld rig={rig} paused={paused} rest={rest} />}
      <BadgeCard body={rig.bodies[index]} offsetX={index * SPACING} look={look} idle={paused} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <directionalLight position={[-5, 5, 5]} intensity={1} />
      <directionalLight position={[0, 5, -5]} intensity={2} />
    </View>
  );
}
