import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameRecords } from '../src/components/dom/prefooter/gameRecords.mjs';
import { scoreAfterEvent } from '../src/components/dom/prefooter/gameTiming.mjs';
import { GAME_CELEBRATION_EVENT, listenForGameCelebration } from '../src/components/canvas/fluid/gameCelebration.mjs';

function browserStorage() {
  const values = new Map([['course-progress', 'keep this']]);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('best survives misses and reloads, is browser-local and leaves course progress alone', () => {
  const storage = browserStorage();
  const records = createGameRecords(() => storage);
  let game = { started: false, score: 0, best: records.read().best };
  for (const event of ['slice', 'slice', 'slice', 'miss', 'slice']) {
    game = scoreAfterEvent(game, event);
    records.saveBest(game.best);
  }
  assert.equal(game.score, 1);
  const reloaded = createGameRecords(() => storage);
  assert.equal(reloaded.read().best, 3);
  reloaded.saveBest(1);
  assert.equal(records.read().best, 3);
  assert.equal(createGameRecords(() => browserStorage()).read().best, 0);
  assert.equal(storage.values.get('course-progress'), 'keep this');
  assert.equal(storage.values.size, 2);
});

test('two tabs preserve a higher saved record and the first-slice claim', () => {
  const storage = browserStorage();
  const first = createGameRecords(() => storage);
  const second = createGameRecords(() => storage);
  second.read();
  first.saveBest(20);
  assert.equal(first.claimCelebration(), true);
  second.saveBest(5);
  assert.deepEqual(second.read(), { best: 20, celebrated: true });
  assert.equal(second.claimCelebration(), false);
});

test('a first-slice bloom happens once despite multi-disc slices, misses and reloads', () => {
  const storage = browserStorage();
  const target = new EventTarget();
  const ordinary = { mouseX: 0.2, mouseY: 0.3, velocityX: 2, velocityY: 3 };
  const queue = { current: [ordinary] };
  const cleanup = listenForGameCelebration(target, queue);
  for (let reload = 0; reload < 3; reload++) {
    const records = createGameRecords(() => storage);
    let game = { started: false, score: 0, best: 0 };
    for (const event of ['slice', 'slice', 'slice', 'miss', 'slice', 'miss', 'slice']) {
      game = scoreAfterEvent(game, event);
      if (event === 'slice' && records.claimCelebration()) target.dispatchEvent(new Event(GAME_CELEBRATION_EVENT));
    }
    assert.equal(game.score, 1);
  }
  assert.equal(queue.current.length, 5, 'exactly four celebration splats are added');
  assert.equal(queue.current[0], ordinary, 'ordinary pointer input is untouched');
  assert.ok(queue.current.slice(1).every(splat => splat.radiusScale > 1));
  cleanup();
  target.dispatchEvent(new Event(GAME_CELEBRATION_EVENT));
  assert.equal(queue.current.length, 5, 'unmount removes the listener');
  const nextQueue = { current: [] };
  const nextCleanup = listenForGameCelebration(target, nextQueue);
  assert.deepEqual(nextQueue.current, [], 'remount does not replay the celebration');
  nextCleanup();
});

test('missing, blocked, malformed and unwritable storage never interrupt the game', () => {
  for (const getStorage of [
    () => null,
    () => { throw new Error('blocked'); },
    () => ({ getItem: () => '{broken', setItem: () => { throw new Error('quota'); } }),
    () => ({ getItem: () => '{"best":-4,"celebrated":"false"}', setItem() {} }),
    () => ({ getItem: () => '{"best":1.5}', setItem() {} }),
  ]) {
    const records = createGameRecords(getStorage);
    assert.deepEqual(records.read(), { best: 0, celebrated: false });
    records.saveBest(7);
    records.saveBest(Infinity);
    records.saveBest(NaN);
    assert.equal(records.claimCelebration(), true);
    assert.equal(records.claimCelebration(), false);
    assert.deepEqual(records.read(), { best: 7, celebrated: true });
  }
});
