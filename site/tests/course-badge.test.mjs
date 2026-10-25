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

