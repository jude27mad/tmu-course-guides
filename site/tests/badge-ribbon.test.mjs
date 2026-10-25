import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { MeshLineGeometry } from 'meshline';

// Exercise the production renderer against a moving, finite physics pose.
// The original unbounded render lerp lost the ribbon in CI screenshots after
// long frames; the physics simulation itself must not be altered to fix that.
const source = readFileSync(new URL('../src/components/courseBadge/BadgeScene.jsx', import.meta.url), 'utf8');
const start = source.indexOf('useFrame(', source.indexOf('function BadgeCard('));
const end = source.indexOf('\n  });', start) + 6;

test('delayed rendering keeps the ribbon finite without changing the physics pose', () => {
  let callback;
  let sway = 0;
  const point = (x, y) => ({ current: { translation: () => new THREE.Vector3(x + sway, y, 0) } });
  const object = new THREE.Object3D();
  object.position.set(0.3, -0.45, 0);
  const body = { fixed: point(0, 4), j1: point(0, 3), j2: point(0, 2), j3: point(0, 1), cardObject: { current: { parent: object } } };
  const geometry = new MeshLineGeometry();
  const scope = {
    textures: true, started: { current: false }, element: { dataset: {} }, idle: false,
    body, card: { current: new THREE.Object3D() }, band: { current: { geometry } }, offsetX: 0,
    lerped: [new THREE.Vector3(), new THREE.Vector3()], maxSpeed: 50, minSpeed: 10,
    curve: new THREE.CatmullRomCurve3(Array.from({ length: 4 }, () => new THREE.Vector3())),
    useFrame: frame => { callback = frame; },
  };
  new Function(...Object.keys(scope), source.slice(start, end))(...Object.values(scope));
  const pose = object.matrix.clone();
  try {
    for (let frame = 0; frame < 300; frame++) {
      sway = Math.sin(frame * 0.15) * 0.4;
      callback({}, frame % 4 ? 1 / 60 : 0.32);
      const vertices = geometry.getAttribute('position').array;
      assert.ok(vertices.every(value => Number.isFinite(value) && Math.abs(value) < 10), `ribbon diverged at delayed frame ${frame}`);
      assert.deepEqual(object.position.toArray(), [0.3, -0.45, 0], 'rendering cannot retune the simulated card');
      assert.deepEqual(object.matrix.elements, pose.elements);
    }
  } finally { geometry.dispose(); }
});
