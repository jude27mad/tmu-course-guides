import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { Vector2 } from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const originalPointer = read('./fixtures/giats/usePointerEvents.jsx');
const currentPointer = read('../src/components/canvas/fluid/hooks/usePointerEvents.jsx');
const originalBadge = read('./fixtures/giats/Badge.jsx');
const currentBadge = read('../src/components/courseBadge/BadgeScene.jsx');

function pointer(source) {
  let cleanup;
  const target = new EventTarget();
  const code = source.replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default usePointerEvents;', 'return usePointerEvents;');
  const hook = new Function('useEffect', 'useRef', 'Vector2', 'nativeIOSScroll', code)(
    effect => { cleanup = effect(); }, value => ({ current: value }), Vector2, () => false,
  );
  const queue = hook({ current: target }, { width: 400, height: 800 }, 1);
  return {
    emit(type, values) {
      const event = new Event(type, { cancelable: true });
      Object.entries(values).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
      target.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false);
    },
    take: () => queue.current.splice(0),
    cleanup: () => cleanup?.(),
  };
}

// Catches added contact blooms, per-finger resets, and release impulses. Both
// hooks execute the same actual browser event sequence, including retouch.
test('the fluid produces the original splats across movement, multiple fingers and retouch', () => {
  const reference = pointer(originalPointer);
  const actual = pointer(currentPointer);
  const events = [
    ['pointerdown', 1, 100, 200], ['pointermove', 1, 110, 210], ['pointermove', 1, 120, 220],
    ['pointerdown', 2, 300, 600], ['pointermove', 2, 290, 590], ['pointermove', 1, 130, 230],
    ['pointerup', 2, 280, 580], ['pointermove', 1, 140, 240], ['pointerup', 1, 140, 240],
    ['pointerdown', 1, 200, 400], ['pointermove', 1, 210, 410], ['pointercancel', 1, 0, 0],
  ];
  try {
    for (const [type, pointerId, clientX, clientY] of events) {
      const values = { pointerId, pointerType: 'touch', clientX, clientY };
      reference.emit(type, values);
      actual.emit(type, values);
      assert.deepEqual(actual.take(), reference.take(), `${type}: ${pointerId} at ${clientX},${clientY}`);
    }
  } finally { reference.cleanup(); actual.cleanup(); }
});

// Read each implementation's actual body configuration, then let Rapier evolve
// it. This fails on the near-hanging start and extra damping introduced when the
// cards moved, while allowing any translation needed by their page placement.
function rig(source, original) {
  const props = new Function(`return (${source.match(/const segmentProps = (\{[^;]+\});/)[1]});`)();
  const positions = original
    ? [[0, 0], ...[...source.matchAll(/<RigidBody position=\{\[([^\]]+)\]\}/g)].map(match => new Function(`return [${match[1]}];`)().slice(0, 2))]
    : new Function('JOINT', `return ${source.match(/const SWING_START = (\[[\s\S]*?\]);/)[1]};`)(1.45);
  return { props, positions };
}

await RAPIER.init();
function drop({ props, positions }, offset) {
  const world = new RAPIER.World({ x: 0, y: -40, z: 0 });
  world.timestep = 1 / 60;
  const zero = { x: 0, y: 0, z: 0 };
  try {
    const bodies = positions.map(([x, y], index) => {
      const desc = index ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
      desc.setTranslation(offset + x, 4 + y, 0).setCanSleep(props.canSleep)
        .setAngularDamping(props.angularDamping).setLinearDamping(props.linearDamping);
      const body = world.createRigidBody(desc);
      if (index) world.createCollider(index === 4 ? RAPIER.ColliderDesc.cuboid(0.8, 1.125, 0.01) : RAPIER.ColliderDesc.ball(0.1), body);
      return body;
    });
    for (let i = 0; i < 3; i++) world.createImpulseJoint(RAPIER.JointData.rope(1, zero, zero), bodies[i], bodies[i + 1], true);
    world.createImpulseJoint(RAPIER.JointData.spherical(zero, { x: 0, y: 1.45, z: 0 }), bodies[3], bodies[4], true);
    const samples = [];
    for (let frame = 0; frame < 120; frame++) {
      world.step();
      const p = bodies[4].translation();
      samples.push([p.x - offset, p.y, p.z]);
    }
    return samples;
  } finally { world.free(); }
}

test('the card drop and damping follow Giats at every shared-world position', () => {
  const reference = drop(rig(originalBadge, true), 0);
  for (const offset of [0, 30, 60]) {
    const actual = drop(rig(currentBadge, false), offset);
    actual.forEach((point, frame) => point.forEach((value, axis) => {
      assert.ok(Math.abs(value - reference[frame][axis]) < 0.002, `position ${offset}, frame ${frame}, axis ${axis}: ${value} vs ${reference[frame][axis]}`);
    }));
  }
});

// Run the actual frame callbacks, including the original angular correction.
// The doubles sit at Rapier's boundary and record the forces sent to the body.
function frameFor(source, { velocity, direction, scrolling = true, intersected = true }) {
  const calls = [];
  const point = (x, y) => ({ current: { translation: () => new THREE.Vector3(x, y, 0) } });
  const fixed = point(0, 4);
  const card = { current: {
    applyImpulse: (value, wake) => calls.push(['impulse', value, wake]),
    angvel: () => ({ x: 0.2, y: 0.8, z: -0.1 }),
    rotation: () => ({ x: 0.1, y: 0.3, z: 0.2, w: 0.9 }),
    setAngvel: value => calls.push(['angular', value]),
  } };
  const scope = {
    THREE, card, fixed, j1: point(0, 3), j2: point(0, 2), j3: point(0, 1),
    band: { current: { geometry: { setPoints() {} } } },
    curve: new THREE.CatmullRomCurve3(Array.from({ length: 4 }, () => new THREE.Vector3())),
    isScrolling: { current: scrolling }, speed: { current: velocity }, scrollDirection: { current: direction },
    intersected, rest: false, maxSpeed: 50, minSpeed: 10, ang: new THREE.Vector3(), rot: new THREE.Vector3(),
    useFrame: callback => callback({}, 1 / 60),
  };
  const start = source.indexOf('useFrame(');
  const end = source.indexOf('\n  });', start) + 6;
  new Function(...Object.keys(scope), source.slice(start, end))(...Object.values(scope));
  return calls;
}

test('scroll reversals send the original uncapped per-frame forces to every card', () => {
  for (const input of [
    { velocity: 4, direction: 1 }, { velocity: 400, direction: 1 },
    { velocity: -800, direction: -1 }, { velocity: 0, direction: 0 },
    { velocity: 50, direction: 1, scrolling: false },
    { velocity: -50, direction: -1, intersected: false },
  ]) assert.deepEqual(frameFor(currentBadge, input), frameFor(originalBadge, input), JSON.stringify(input));
});
