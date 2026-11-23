import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createBadgeGrab } from '../src/components/courseBadge/badgeGrab.mjs';

const require = createRequire(import.meta.url);
const rapier = require('@dimforge/rapier3d-compat');
await rapier.init();

test('the pointer pulls the live dynamic body, and releasing keeps its momentum and existing joints', () => {
  const world = new rapier.World({ x: 0, y: -40, z: 0 });
  try {
    const anchor = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(0, 4, 0));
    const card = world.createRigidBody(rapier.RigidBodyDesc.dynamic().setLinearDamping(2).setAngularDamping(2));
    world.createCollider(rapier.ColliderDesc.cuboid(0.8, 1.125, 0.01), card);
    const zero = { x: 0, y: 0, z: 0 };
    const tether = world.createImpulseJoint(rapier.JointData.rope(4.45, zero, zero), anchor, card, true);
    const grab = createBadgeGrab({
      world, rapier, card, localPoint: zero, start: card.translation(), anchor: anchor.translation(), reach: 4.45,
    });
    assert.equal(world.bodies.len(), 3);
    assert.equal(world.impulseJoints.len(), 2);
    for (let frame = 1; frame <= 12; frame += 1) {
      grab.move(frame * 0.1, 0.2, 0);
      grab.step(world.timestep);
      world.step();
    }
    assert.ok(card.isDynamic(), 'the original card still obeys its original tether while held');
    assert.ok(card.translation().x > 0.25, 'the pointer visibly moved the body');
    assert.ok(card.linvel().x > 0.1, 'moving the pointer imparts velocity');
    const position = card.translation();
    const velocity = card.linvel();
    grab.release();
    assert.equal(world.bodies.len(), 2);
    assert.equal(world.impulseJoints.len(), 1);
    assert.ok(tether.isValid());
    assert.deepEqual(card.linvel(), velocity, 'release preserves the measured velocity');
    assert.deepEqual(card.translation(), position, 'release cannot teleport the badge');
    world.step();
    assert.ok(card.translation().x > position.x, 'the released card travels freely');
  } finally {
    world.free();
  }
});
