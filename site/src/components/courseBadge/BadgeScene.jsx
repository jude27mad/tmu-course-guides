/* eslint-disable react/no-unknown-property, react/jsx-props-no-spreading, import/extensions */
import * as THREE from 'three';

import { BallCollider, CuboidCollider, Physics, RigidBody, useBeforePhysicsStep, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { PerspectiveCamera } from '@react-three/drei';
import BadgeViewport from '@src/components/courseBadge/BadgeViewport';
import { bandTexture, cardTexture, loadBadgeFonts, redrawCard } from '@src/components/courseBadge/badgeTextures';
import { extend, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import useStill from '@src/hooks/useStill';
import useScroll from '@src/hooks/useScroll';
import { easeFor, frameShare } from '@src/utils/frameStep.mjs';

extend({ MeshLineGeometry, MeshLineMaterial, RoundedBoxGeometry });

// Original Giats motion, copied from upstream 1e0b7b0. Page placement only
// translates each rig; it must never tune the simulation (see giats-motion tests).
// The world lives beside View.Port, independently of any particular window.
const SPACING = 30; // world units between the lanyards (they never meet)
const ANCHOR_Y = 4;
const JOINT = 1.45; // card anchor above the card centre
// Giats starts all five bodies at the anchor height and lets the card drop.
// With motion off the lanyard starts (and stays) hanging at rest.
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

// RoundedBox draws six groups (right, left, top, bottom, front, back). The four
// edges share one material and the two faces another, so draw two groups.
function mergeFaceGroups(geometry) {
  if (geometry?.groups.length !== 6) return;
  const [right, , , bottom, front, back] = geometry.groups;
  geometry.clearGroups();
  geometry.addGroup(right.start, bottom.start + bottom.count - right.start, 0);
  geometry.addGroup(front.start, back.start + back.count - front.start, 1);
}

function Lanyard({ body, x, rest, intersected }) {
  const { fixed, card } = body;
  const scrollDirection = useRef(0);
  const isScrolling = useRef(false);
  const speed = useRef(0);
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const impulseVector = useRef({ x: 0, y: 0, z: 0 });
  const fresh = useRef(false);
  const [start] = useState(() => (rest ? REST_START : SWING_START));

  useRopeJoint(body.fixed, body.j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(body.j1, body.j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(body.j2, body.j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(body.j3, body.card, [
    [0, 0, 0],
    [0, JOINT, 0],
  ]);

  useScroll(({ direction, isScrolling: useScrolling, velocity }) => {
    scrollDirection.current = direction;
    isScrolling.current = useScrolling;
    speed.current = velocity;
    fresh.current = true;
  });

  // Original per-render-frame impulse. No cap, smoothing, timeout, fixed-step
  // substitution or location-dependent strength. Smooth scrolling reports a
  // fresh per-frame velocity every frame. A native scroll event's velocity is
  // repeated until the next event, so a repeat pushes only for its share of a
  // 60 Hz frame; at 120 Hz it would otherwise push twice as long.
  useFrame((_, delta) => {
    if (rest || !card.current) return;
    if (isScrolling.current && intersected) {
      const share = fresh.current ? 1 : frameShare(delta);
      fresh.current = false;
      const moveDistance = Math.abs(speed.current) * 0.005 * share;
      const directionVector = scrollDirection.current === 1 ? 1 : -1;
      impulseVector.current.x = directionVector * moveDistance;
      impulseVector.current.y = 0;
      impulseVector.current.z = 0;
      card.current.applyImpulse(impulseVector.current, true);
    }
  });

  // Original angular correction, once per physics step: once per render frame,
  // a 120 Hz display applied it twice per step and the card turned back to
  // face front too quickly. A sleeping card is skipped: it does not integrate,
  // so the correction would pile up and spin it on the next scroll.
  useBeforePhysicsStep(() => {
    if (rest || !card.current || !fixed.current || card.current.isSleeping?.()) return;
    ang.copy(card.current.angvel());
    rot.copy(card.current.rotation());
    card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
  });

  const positions = useMemo(() => start.map(([dx, dy]) => [x + dx, ANCHOR_Y + dy, 0]), [x, start]);

  return (
    <>
      <RigidBody ref={body.fixed} {...segmentProps} type="fixed" position={positions[0]} />
      {/* each joint's marker follows its interpolated pose, as cardObject does */}
      <RigidBody position={positions[1]} ref={body.j1} {...segmentProps}>
        <BallCollider args={[0.1]} />
        <object3D ref={body.j1Object} />
      </RigidBody>
      <RigidBody position={positions[2]} ref={body.j2} {...segmentProps}>
        <BallCollider args={[0.1]} />
        <object3D ref={body.j2Object} />
      </RigidBody>
      <RigidBody position={positions[3]} ref={body.j3} {...segmentProps}>
        <BallCollider args={[0.1]} />
        <object3D ref={body.j3Object} />
      </RigidBody>
      <RigidBody position={positions[4]} ref={body.card} {...segmentProps} type="dynamic">
        <CuboidCollider args={[0.8, 1.125, 0.01]} />
        {/* follows the card body (interpolated); the windows read it */}
        <object3D ref={body.cardObject} />
      </RigidBody>
    </>
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
  // the strap's control points when it was last rebuilt
  const drawn = useMemo(() => new Float64Array(12).fill(NaN), []);
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
    // the merged RoundedBox groups: edges, then front and back
    const edge = new THREE.MeshStandardMaterial({ color: look.background, roughness: 0.5, metalness: 0.4 });
    const face = new THREE.MeshPhysicalMaterial({ map: textures.card, alphaTest: 0.5, clearcoat: 1, clearcoatRoughness: 0.15, roughness: 0.5, metalness: 0.4 });
    return [edge, face];
  }, [textures, look.background]);

  useEffect(
    () => () => {
      if (materials) materials.forEach((material) => material.dispose());
    },
    [materials],
  );

  useFrame((_, delta) => {
    // The explicit Pause motion control retains its pose. Offscreen placement
    // does not stop or restart the original simulation.
    if (textures && started.current && element?.dataset.badgeRendered !== 'true') element.dataset.badgeRendered = 'true';
    if (idle && started.current) return;
    // The strap follows the joints' interpolated poses, as the card does: their
    // raw physics positions move only at each 60 Hz step.
    const { fixed, j1Object, j2Object, j3Object, cardObject } = body;
    const object = cardObject.current?.parent;
    const j1 = j1Object.current?.parent;
    const j2 = j2Object.current?.parent;
    const j3 = j3Object.current?.parent;
    if (!fixed.current || !j1 || !j2 || !j3 || !object || !card.current || !band.current) return;

    card.current.position.set(object.position.x - offsetX, object.position.y, object.position.z);
    card.current.quaternion.copy(object.quaternion);

    // Giats's strap follow factor, min(1, delta * speed), applies per 60 Hz
    // frame; a faster display applies it for its share of one.
    const share = frameShare(delta);
    const follow = (distance) => {
      const speed = minSpeed + Math.max(0.1, Math.min(1, distance)) * (maxSpeed - minSpeed);
      return share === 1 ? Math.min(1, delta * speed) : easeFor(Math.min(1, speed / 60), share);
    };

    const t1 = j1.position;
    if (!started.current) lerped[0].copy(t1);
    lerped[0].lerp(t1, follow(lerped[0].distanceTo(t1)));

    const t2 = j2.position;
    if (!started.current) lerped[1].copy(t2);
    lerped[1].lerp(t2, follow(lerped[1].distanceTo(t2)));

    started.current = true;
    curve.points[0].copy(j3.position);
    curve.points[1].copy(lerped[1]);
    curve.points[2].copy(lerped[0]);
    curve.points[3].copy(fixed.current.translation());

    curve.points[0].x -= offsetX;
    curve.points[1].x -= offsetX;
    curve.points[2].x -= offsetX;
    curve.points[3].x -= offsetX;

    // Rebuild the strap only when it moved: setPoints reallocates its buffers.
    let moved = false;
    for (let i = 0; i < 4; i += 1) {
      const { x, y, z } = curve.points[i];
      if (drawn[i * 3] !== x || drawn[i * 3 + 1] !== y || drawn[i * 3 + 2] !== z) {
        drawn.set([x, y, z], i * 3);
        moved = true;
      }
    }
    if (moved) band.current.geometry.setPoints(curve.getPoints(32));
  });

  return (
    <>
      <group ref={card}>
        {materials && (
          <mesh material={materials}>
            {/* three's RoundedBoxGeometry (as the MagicBall boxes): per-face UVs, so the back reads the right way round */}
            <roundedBoxGeometry ref={mergeFaceGroups} args={[1.6, 2.25, 0.02, 2, 0.01]} />
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
  const size = useMemo(() => new THREE.Vector2(), []);
  useEffect(() => {
    const previous = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => {
      previous?.apply(scene, args);
      const clip = element?.closest('[data-badge-clip]');
      if (!clip) return;
      const bounds = clip.getBoundingClientRect();
      const canvas = gl.domElement.getBoundingClientRect();
      gl.getSize(size);
      const scaleX = size.x / canvas.width;
      const scaleY = size.y / canvas.height;
      gl.getScissor(scissor);
      const left = Math.max(scissor.x, (bounds.left - canvas.left) * scaleX);
      const bottom = Math.max(scissor.y, (canvas.bottom - bounds.bottom) * scaleY);
      const right = Math.min(scissor.x + scissor.z, (bounds.right - canvas.left) * scaleX);
      const top = Math.min(scissor.y + scissor.w, (canvas.bottom - bounds.top) * scaleY);
      gl.setScissor(left, bottom, Math.max(0, right - left), Math.max(0, top - bottom));
    };
    return () => {
      scene.onBeforeRender = previous;
    };
  }, [element, scene, gl, scissor, size]);

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
    // Drawing follows current bounds; the observer still gates only Giats's
    // original scroll impulse, independently of the continuously running world.
    <BadgeViewport element={entry.element}>
      <PerspectiveCamera manual makeDefault position={[0, 0, 10]} fov={25} />
      <ambientLight intensity={Math.PI} />
      <BadgeCard key={entry.id} body={entry.body} offsetX={entry.slot * SPACING} look={look} idle={rest} element={entry.element} />
      <ClipToCard element={entry.element} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <directionalLight position={[-5, 5, 5]} intensity={1} />
      <directionalLight position={[0, 5, -5]} intensity={2} />
    </BadgeViewport>
  );
}

export function BadgeWorld({ registry }) {
  const { entries, rigs } = useSyncExternalStore(registry.subscribe, registry.getState, registry.getState);
  const rest = useStill();
  if (!entries.length) return null;
  return (
    <>
      <Physics paused={rest} interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
        {rigs.map((rig) => (
          <Lanyard key={rig.id} body={rig.body} x={rig.slot * SPACING} rest={rest} intersected={rig.swing} />
        ))}
      </Physics>
      {entries.map((entry) => entry.look && <BadgeView key={entry.id} entry={entry} look={entry.look} rest={rest} />)}
    </>
  );
}
