import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { easeFor, frameShare } from '../src/utils/frameStep.mjs';

// The lanyard and strap were tuned per rendered frame at 60 Hz. These run the
// production callbacks at 120 Hz and compare them with one 60 Hz frame.
const require = createRequire(import.meta.url);
const THREE = require('three');
const { MeshLineGeometry } = require('meshline');
const source = readFileSync(new URL('../src/components/courseBadge/BadgeScene.jsx', import.meta.url), 'utf8');
const slice = (hook, from = 0) => {
  const start = source.indexOf(hook, from);
  return source.slice(start, source.indexOf('\n  });', start) + 6);
};
const lanyardFrame = slice('useFrame(');
const lanyardStep = slice('useBeforePhysicsStep(');
const cardFrame = slice('useFrame(', source.indexOf('function BadgeCard('));

function lanyard({ fresh }) {
  const calls = [];
  const card = { current: {
    applyImpulse: (value) => calls.push(['impulse', value.x]),
    angvel: () => ({ x: 0, y: 0.8, z: 0 }),
    rotation: () => ({ x: 0, y: 0.3, z: 0, w: 0.95 }),
    setAngvel: (value) => calls.push(['angular', value.y]),
    isSleeping: () => false,
  } };
  const scope = {
    card, fixed: { current: {} }, rest: false, intersected: true, ang: new THREE.Vector3(), rot: new THREE.Vector3(),
    isScrolling: { current: true }, speed: { current: 12 }, scrollDirection: { current: 1 },
    impulseVector: { current: { x: 0, y: 0, z: 0 } }, fresh: { current: fresh }, frameShare,
  };
  let frame;
  let step;
  new Function(...Object.keys(scope), 'useFrame', 'useBeforePhysicsStep', `${lanyardFrame}\n${lanyardStep}`)(
    ...Object.values(scope), (callback) => { frame = callback; }, (callback) => { step = callback; },
  );
  return { calls, scope, frame: (delta) => frame({}, delta), step: () => step() };
}

test('the yaw correction runs once per physics step, however many frames draw it', () => {
  const rig = lanyard({ fresh: true });
  rig.frame(1 / 120);
  rig.frame(1 / 120);
  assert.equal(rig.calls.filter(([kind]) => kind === 'angular').length, 0);
  rig.step();
  assert.deepEqual(rig.calls.filter(([kind]) => kind === 'angular'), [['angular', 0.8 - 0.3 * 0.25]]);
});

test('a sleeping card does not store up yaw correction', () => {
  const rig = lanyard({ fresh: true });
  rig.scope.card.current.isSleeping = () => true;
  rig.step();
  assert.equal(rig.calls.length, 0);
});

test('a repeated native scroll sample pushes for the time its frame covers', () => {
  const sixty = lanyard({ fresh: false });
  sixty.frame(1 / 60);
  const oneTwenty = lanyard({ fresh: false });
  oneTwenty.frame(1 / 120);
  oneTwenty.frame(1 / 120);
  const total = (rig) => rig.calls.reduce((sum, [kind, x]) => sum + (kind === 'impulse' ? x : 0), 0);
  assert.ok(Math.abs(total(oneTwenty) - total(sixty)) < 1e-12);
  // a fresh per-frame sample (smooth scrolling) is already per frame
  const fresh = lanyard({ fresh: true });
  fresh.frame(1 / 120);
  assert.equal(total(fresh), 12 * 0.005);
});

function strap() {
  let callback;
  const joints = { j1: new THREE.Vector3(0, 3, 0), j2: new THREE.Vector3(0, 2, 0), j3: new THREE.Vector3(0, 1, 0) };
  const marker = (key) => ({ current: { get parent() { return { position: joints[key] }; } } });
  const object = new THREE.Object3D();
  const geometry = new MeshLineGeometry();
  let rebuilds = 0;
  const setPoints = geometry.setPoints.bind(geometry);
  geometry.setPoints = (points) => { rebuilds += 1; setPoints(points); };
  const scope = {
    textures: true, started: { current: false }, element: { dataset: {} }, idle: false,
    body: { fixed: { current: { translation: () => new THREE.Vector3(0, 4, 0) } }, j1Object: marker('j1'), j2Object: marker('j2'), j3Object: marker('j3'), cardObject: { current: { parent: object } } },
    card: { current: new THREE.Object3D() }, band: { current: { geometry } }, offsetX: 0,
    lerped: [new THREE.Vector3(), new THREE.Vector3()], maxSpeed: 50, minSpeed: 10,
    drawn: new Float64Array(12).fill(NaN), frameShare, easeFor,
    curve: Object.assign(new THREE.CatmullRomCurve3(Array.from({ length: 4 }, () => new THREE.Vector3())), { curveType: 'chordal' }),
    useFrame: (frame) => { callback = frame; },
  };
  new Function(...Object.keys(scope), cardFrame)(...Object.values(scope));
  return { joints, scope, frame: (delta) => callback({}, delta), rebuilds: () => rebuilds, dispose: () => geometry.dispose() };
}

test('the strap catches up with its joints as far in two 120 Hz frames as in one 60 Hz frame', () => {
  const sixty = strap();
  const oneTwenty = strap();
  try {
    for (const rig of [sixty, oneTwenty]) {
      rig.frame(1 / 60);
      rig.joints.j1.set(100, 3, 0);
    }
    sixty.frame(1 / 60);
    oneTwenty.frame(1 / 120);
    oneTwenty.frame(1 / 120);
    assert.ok(Math.abs(oneTwenty.scope.lerped[0].x - sixty.scope.lerped[0].x) < 1e-9, `${oneTwenty.scope.lerped[0].x} vs ${sixty.scope.lerped[0].x}`);
  } finally { sixty.dispose(); oneTwenty.dispose(); }
});

test('a strap at rest is not rebuilt every frame', () => {
  const rig = strap();
  try {
    for (let frame = 0; frame < 5; frame += 1) rig.frame(1 / 60);
    assert.equal(rig.rebuilds(), 1);
    rig.joints.j3.set(0.2, 1, 0);
    rig.frame(1 / 60);
    assert.equal(rig.rebuilds(), 2);
  } finally { rig.dispose(); }
});

test('the card draws its edges and faces as two groups covering every vertex', async () => {
  const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
  const geometry = new RoundedBoxGeometry(1.6, 2.25, 0.02, 2, 0.01);
  const before = geometry.groups.map((group) => ({ ...group }));
  const merge = source.slice(source.indexOf('function mergeFaceGroups('), source.indexOf('\n}\n', source.indexOf('function mergeFaceGroups(')) + 2);
  new Function(`${merge}\nreturn mergeFaceGroups;`)()(geometry);
  assert.deepEqual(geometry.groups, [
    { start: before[0].start, count: before[4].start - before[0].start, materialIndex: 0 },
    { start: before[4].start, count: before[5].start + before[5].count - before[4].start, materialIndex: 1 },
  ]);
  assert.equal(geometry.groups[1].start + geometry.groups[1].count, geometry.getAttribute('position').count);
  geometry.dispose();
});
