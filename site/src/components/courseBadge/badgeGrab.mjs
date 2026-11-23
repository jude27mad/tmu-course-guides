// A cursor body exists only during a pull. Pin the picked point to it so the card
// can rotate in the hand, then remove it to release the original dynamic body.
// eslint-disable-next-line import/prefer-default-export
export function createBadgeGrab({ world, rapier, card, localPoint, start, anchor, reach }) {
  const hand = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z));
  world.createImpulseJoint(rapier.JointData.spherical(localPoint, { x: 0, y: 0, z: 0 }), card, hand, true);
  const target = { ...start };
  const next = { x: 0, y: 0, z: 0 };
  let released = false;

  return {
    move(x, y, z) {
      // The pointer can leave the window. Its anchor stays within the length
      // of the physical strap, measured through the selected point on the card.
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      const dz = z - anchor.z;
      const scale = Math.min(1, reach / (Math.hypot(dx, dy, dz) || 1));
      target.x = anchor.x + dx * scale;
      target.y = anchor.y + dy * scale;
      target.z = anchor.z + dz * scale;
    },
    step(dt) {
      if (released) return;
      const p = hand.translation();
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dz = target.z - p.z;
      // Bound the cursor speed, including when a tab or pointer skips frames.
      const scale = Math.min(1, (12 * dt) / (Math.hypot(dx, dy, dz) || 1));
      next.x = p.x + dx * scale;
      next.y = p.y + dy * scale;
      next.z = p.z + dz * scale;
      hand.setNextKinematicTranslation(next);
    },
    release() {
      if (released) return;
      released = true;
      // Removing a body also removes its attached joint. Leave the card's
      // velocities alone so a quick sweep throws and a held card just drops.
      if (hand.isValid()) world.removeRigidBody(hand);
      if (card.isValid()) card.wakeUp();
    },
  };
}
