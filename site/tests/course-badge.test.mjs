import test from 'node:test';
import assert from 'node:assert/strict';

let createBadgeRegistry;
try {
  ({ createBadgeRegistry } = await import('../src/components/courseBadge/badgeRegistry.mjs'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

test('a badge world supports a singleton unrelated to course-array order', () => {
  assert.equal(typeof createBadgeRegistry, 'function', 'the reusable registry must exist');
  const registry = createBadgeRegistry();
  const entry = registry.register('header-mth141', { courseId: 'mth141' });
  assert.equal(entry.slot, 0);
  assert.equal(registry.getState().entries.length, 1);
  assert.ok(entry.body.card);
  registry.update('header-mth141', { visible: true, swing: true });
  assert.equal(registry.getState().entries[0].visible, true);
});

test('removing the first badge leaves later simulations and body refs intact', () => {
  const registry = createBadgeRegistry();
  registry.register('first', { courseId: 'cen100' });
  const second = registry.register('second', { courseId: 'mth140' });
  registry.unregister('first');
  assert.equal(registry.getState().entries[0].body, second.body);
  assert.equal(registry.getState().entries[0].slot, 1);
  const replacement = registry.register('third', { courseId: 'mth141' });
  assert.equal(replacement.slot, 0);
  assert.notEqual(replacement.body, second.body);
});

test('Next up can change course without replacing its lanyard or growing the world', () => {
  const registry = createBadgeRegistry();
  const first = registry.register('desk-next', { courseId: 'cen100' });
  registry.update('desk-next', { courseId: 'mth140' });
  const next = registry.getState().entries[0];
  assert.equal(next.body, first.body);
  assert.equal(next.slot, first.slot);
  assert.equal(next.courseId, 'mth140');
  assert.equal(registry.getState().entries.length, 1);
});

test('registry notifications stop after unsubscribe and unmount releases all entries', () => {
  const registry = createBadgeRegistry();
  let notifications = 0;
  const off = registry.subscribe(() => { notifications += 1; });
  registry.register('one', { courseId: 'mth141' });
  registry.update('one', { visible: true });
  assert.equal(notifications, 2);
  off();
  registry.unregister('one');
  assert.equal(notifications, 2);
  assert.equal(registry.getState().entries.length, 0);
  assert.equal(createBadgeRegistry().getState().entries.length, 0);
});

test('directory cards retain one swing through forward and reverse visibility handoffs', () => {
  const registry = createBadgeRegistry();
  const cards = ['cen100', 'mth140', 'mth141'].map(courseId =>
    registry.register(`directory-${courseId}`, { courseId, motionGroup: 'course-directory' }));
  const first = cards[0];
  for (const card of cards) {
    assert.equal(card.body, first.body, 'the arriving card must read the outgoing card’s live pose and velocity');
    assert.equal(card.slot, first.slot);
  }
  const rigId = registry.getState().rigs[0].id;
  for (const active of [0, 1, 2, 1, 0]) {
    cards.forEach((card, index) => registry.update(card.id, { visible: index === active, swing: index === active }));
    assert.equal(registry.getState().rigs.length, 1, 'one impulse consumer, even when badge windows overlap');
    const [rig] = registry.getState().rigs;
    assert.equal(rig.id, rigId, 'visibility must never remount the lanyard');
    assert.equal(rig.body, first.body);
    assert.equal(rig.swing, true);
  }
  cards.forEach(card => registry.update(card.id, { visible: false, swing: false }));
  assert.equal(registry.getState().rigs[0].body, first.body, 'leaving the viewport retains the simulation');
  assert.equal(registry.getState().rigs[0].swing, false, 'offscreen motion receives no extra scroll impulse');
  cards.forEach(card => registry.update(card.id, { visible: true, swing: true }));
  assert.equal(registry.getState().rigs.length, 1, 'overlapping windows cannot multiply the scroll force');
});

test('shared directory motion leaves unrelated badges independent and releases on final unmount', () => {
  const registry = createBadgeRegistry();
  const first = registry.register('directory-cen100', { motionGroup: 'course-directory' });
  const second = registry.register('directory-mth140', { motionGroup: 'course-directory' });
  const header = registry.register('header-mth140', { courseId: 'mth140' });
  const desk = registry.register('desk-next', { courseId: 'mth140' });
  assert.equal(second.body, first.body);
  assert.notEqual(header.body, first.body);
  assert.notEqual(desk.body, header.body);
  assert.notEqual(header.slot, first.slot);
  const rigId = registry.getState().rigs[0].id;
  registry.unregister(first.id);
  assert.equal(registry.getState().rigs[0].id, rigId);
  assert.equal(registry.getState().rigs[0].body, first.body);
  const replacement = registry.register('directory-mth141', { motionGroup: 'course-directory' });
  assert.equal(replacement.body, first.body);
  registry.unregister(second.id);
  registry.unregister(replacement.id);
  assert.equal(registry.getState().rigs.length, 2);
  assert.equal(registry.getState().entries[0].body, header.body);
  registry.unregister(header.id);
  registry.unregister(desk.id);
  assert.deepEqual(registry.getState(), { entries: [], rigs: [] });
  const returnVisit = registry.register('directory-cen100', { motionGroup: 'course-directory' });
  assert.notEqual(returnVisit.body, first.body, 'a fresh page visit must not retain stale Rapier refs');
  assert.equal(returnVisit.slot, 0);
});
