import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Execute the actual game callbacks without a React render between events.
// This catches stale state and effect-based triggers that miss batched 0-to-1
// transitions when one gesture hits several discs or a miss and slice coincide.
const gameSource = readFileSync(new URL('../src/components/dom/prefooter/Index.jsx', import.meta.url), 'utf8');
function mountGame(records, target) {
  let game = { started: false, score: 0, best: records.read().best };
  const start = gameSource.indexOf('  const streakScore =');
  const end = gameSource.indexOf('\n  return (', start);
  assert.ok(start >= 0 && end > start, 'game event callbacks are available');
  const callbacks = new Function('useRef', 'useCallback', 'dispatch', 'gameRecords', 'window', 'GAME_CELEBRATION_EVENT',
    gameSource.slice(start, end) + '\nreturn { onSlice, onMiss };')(
    value => ({ current: value }), callback => callback,
    event => { game = scoreAfterEvent(game, event); }, records, target, GAME_CELEBRATION_EVENT,
  );
  return { ...callbacks, state: () => game };
}

const regularBloom = [
  { mouseX: 0.4, mouseY: 0.5, velocityX: -90, velocityY: 0, radiusScale: 36 },
  { mouseX: 0.6, mouseY: 0.5, velocityX: 90, velocityY: 0, radiusScale: 36 },
  { mouseX: 0.5, mouseY: 0.4, velocityX: 0, velocityY: -90, radiusScale: 36 },
  { mouseX: 0.5, mouseY: 0.6, velocityX: 0, velocityY: 90, radiusScale: 36 },
];

test('the original bloom recurs on each 0-to-1; full-screen discovery happens once across misses and reloads', () => {
  const storage = browserStorage();
  const target = new EventTarget();
  const queue = { current: [] };
  const ordinary = { mouseX: 0.2, mouseY: 0.3, velocityX: 2, velocityY: 3 };
  const cleanup = listenForGameCelebration(target, queue, { width: 400, height: 800 });
  const discoveries = [];
  target.addEventListener(GAME_CELEBRATION_EVENT, event => discoveries.push(event.detail.discovery));
  for (let reload = 0; reload < 3; reload++) {
    const game = mountGame(createGameRecords(() => storage), target);
    game.onMiss();
    assert.deepEqual(queue.current, [], 'a miss at zero never celebrates');
    for (let round = 0; round < 3; round++) {
      queue.current.push(ordinary);
      game.onSlice();
      const splats = queue.current.splice(0);
      assert.equal(splats.shift(), ordinary, 'ordinary pointer input is untouched');
      assert.deepEqual(splats.slice(0, 4), regularBloom, 'the recurring effect is unchanged');
      assert.equal(splats.length, reload === 0 && round === 0 ? 8 : 4);
      assert.equal(game.state().score, 1);
      game.onSlice();
      game.onSlice();
      assert.equal(game.state().score, 3);
      assert.deepEqual(queue.current, [], 'higher scores and multi-disc slices do not celebrate again');
      game.onMiss();
      assert.equal(game.state().score, 0);
    }
  }
  assert.deepEqual(discoveries, [true, ...Array(8).fill(false)]);
  cleanup();
  target.dispatchEvent(new CustomEvent(GAME_CELEBRATION_EVENT, { detail: { discovery: true } }));
  assert.deepEqual(queue.current, [], 'unmount removes the listener');
  const nextCleanup = listenForGameCelebration(target, queue, { width: 800, height: 400 });
  assert.deepEqual(queue.current, [], 'remount does not replay the celebration');
  const remounted = mountGame(createGameRecords(() => storage), target);
  remounted.onSlice();
  assert.deepEqual(queue.current, regularBloom, 'a new route keeps the regular effect without rediscovering');
  nextCleanup();
});

test('existing browser discovery records stay claimed, while a different browser gets the huge burst', () => {
  const storage = browserStorage();
  storage.values.set('tmu-guide:disc-game:v1', JSON.stringify({ best: 42, celebrated: true }));
  for (const [saved, expected] of [[storage, 4], [browserStorage(), 8]]) {
    const target = new EventTarget();
    const queue = { current: [] };
    const cleanup = listenForGameCelebration(target, queue, { width: 400, height: 800 });
    const game = mountGame(createGameRecords(() => saved), target);
    game.onSlice();
    assert.equal(queue.current.length, expected);
    if (saved === storage) assert.equal(game.state().best, 42);
    cleanup();
  }
});

test('discovery splats cover the full fluid canvas in portrait, landscape and ultrawide sizes', () => {
  for (const [width, height] of [[400, 900], [900, 400], [1440, 900], [3440, 1440], [5120, 1440]]) {
    const target = new EventTarget();
    const queue = { current: [] };
    const cleanup = listenForGameCelebration(target, queue, { width, height });
    target.dispatchEvent(new CustomEvent(GAME_CELEBRATION_EVENT, { detail: { discovery: true } }));
    assert.equal(queue.current.length, 8, 'the one-time burst has a fixed, bounded rendering cost');
    const radius = width < 812 ? 0.11 : 0.14;
    // Sample the existing splat shader's Gaussian across the entire canvas,
    // including all corners and edges. A large centre-only burst fails here.
    for (let row = 0; row <= 8; row++) {
      for (let column = 0; column <= 8; column++) {
        const density = [0, 0, 0];
        for (const splat of queue.current) {
          const dx = (column / 8 - splat.mouseX) * width / height;
          const dy = row / 8 - splat.mouseY;
          const weight = Math.exp(-(dx * dx + dy * dy) / (radius * splat.radiusScale / 100));
          density[0] += weight * splat.velocityX;
          density[1] += weight * splat.velocityY;
          density[2] += weight * 10;
        }
        assert.ok(Math.hypot(...density) > 35, `visible fluid at ${column},${row} on ${width}x${height}`);
      }
    }
    cleanup();
  }
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
