import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let createSpawnSchedule, createDiscFlight, GAME_GRAVITY, scoreAfterEvent, scoreBoundary, gameDifficulty;
try { ({ createSpawnSchedule, createDiscFlight, GAME_GRAVITY, scoreAfterEvent, scoreBoundary, gameDifficulty } = await import('../src/components/dom/prefooter/gameTiming.mjs')); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

function clock() {
  let time = 0;
  let id = 0;
  const pending = new Map();
  return {
    now: () => time,
    schedule(fn, delay) { const key = ++id; pending.set(key, { fn, at: time + delay }); return key; },
    cancel(key) { pending.delete(key); },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at; pending.delete(next[0]); next[1].fn();
      }
      time = end;
    },
    count: () => pending.size,
  };
}
function setup(interval = 3000) {
  assert.equal(typeof createSpawnSchedule, 'function', 'a lifecycle-aware spawn schedule exists');
  const timer = clock();
  const times = [];
  const schedule = createSpawnSchedule({ ...timer, spawn: () => times.push(timer.now()), interval: () => interval });
  return { timer, times, schedule };
}

test('the hidden game first appears after 750ms of ready active time', () => {
  const { timer, times, schedule } = setup();
  timer.advance(2000); assert.deepEqual(times, []);
  schedule.setActive(true); timer.advance(749); assert.deepEqual(times, []);
  timer.advance(1); assert.deepEqual(times, [2750]);
});
test('hiding the game pauses startup, without spawning offscreen or restarting its delay', () => {
  const { timer, times, schedule } = setup();
  schedule.setActive(true); timer.advance(400); schedule.setActive(false);
  assert.equal(timer.count(), 0); timer.advance(10000); assert.deepEqual(times, []);
  schedule.setActive(true); timer.advance(349); assert.deepEqual(times, []);
  timer.advance(1); assert.deepEqual(times, [10750]);
});
test('resume does not burst, preserves the phone cadence, and repeated activation is idempotent', () => {
  const { timer, times, schedule } = setup(5000);
  schedule.setActive(true); schedule.setActive(true); timer.advance(750);
  timer.advance(1000); schedule.setActive(false); timer.advance(30000);
  schedule.setActive(true); timer.advance(3999); assert.equal(times.length, 1);
  timer.advance(1); assert.equal(times.length, 2); timer.advance(5000); assert.equal(times.length, 3);
});
test('unmount cancels all future spawns', () => {
  const { timer, times, schedule } = setup();
  schedule.setActive(true); timer.advance(750); schedule.dispose();
  assert.equal(timer.count(), 0); timer.advance(30000); assert.equal(times.length, 1);
});

test('discs launch below the stage, peak visibly, then fall back under the same gravity', () => {
  for (const viewportHeight of [5, 9, 14, 20]) {
    for (const isMobile of [false, true]) {
      for (const seed of [0, 0.5, 0.999]) {
        const flight = createDiscFlight({ viewportHeight, isMobile, random: () => seed });
        assert.ok(flight.startY + flight.radius < -viewportHeight / 2);
        assert.ok(flight.velocityY > 0);
        const apexTime = -flight.velocityY / GAME_GRAVITY;
        const yAt = t => flight.startY + flight.velocityY * t + 0.5 * GAME_GRAVITY * t * t;
        const apex = yAt(apexTime);
        assert.ok(apex > 0 && apex + flight.radius < viewportHeight / 2, 'the full disc turns around on screen');
        assert.ok(Math.abs(yAt(apexTime * 2) - flight.startY) < 1e-10);
        assert.ok(flight.velocityY + GAME_GRAVITY * apexTime * 2 < 0);
      }
    }
  }
});

test('score is hidden until the first slice and stays visible at zero after every miss', () => {
  const initial = { started: false, score: 0, best: 0 };
  assert.equal(scoreAfterEvent(initial, 'miss'), initial);
  const first = scoreAfterEvent(initial, 'slice');
  assert.deepEqual(first, { started: true, score: 1, best: 1 });
  const second = scoreAfterEvent(first, 'slice');
  assert.deepEqual(second, { started: true, score: 2, best: 2 });
  const missed = scoreAfterEvent(second, 'miss');
  assert.deepEqual(missed, { started: true, score: 0, best: 2 });
  assert.equal(scoreAfterEvent(missed, 'miss'), missed);
  assert.deepEqual(scoreAfterEvent(missed, 'slice'), { started: true, score: 1, best: 2 });
  assert.deepEqual(initial, { started: false, score: 0, best: 0 }, 'no other state is mutated');
});

test('restoring a best never reveals the game early or loses slices already dispatched', () => {
  const initial = { started: false, score: 0, best: 0 };
  const restored = scoreAfterEvent(initial, { type: 'restore', best: 8 });
  assert.deepEqual(restored, { started: false, score: 0, best: 8 });
  const events = ['slice', 'slice', 'miss', 'slice'];
  assert.deepEqual(events.reduce(scoreAfterEvent, restored), { started: true, score: 1, best: 8 });
  const scored = events.reduce(scoreAfterEvent, initial);
  assert.deepEqual(scoreAfterEvent(scored, { type: 'restore', best: 0 }), { started: true, score: 1, best: 2 });
});

test('the score boundary follows scrolling and resizing without moving the screen bottom', () => {
  for (const canvasTop of [0, 24, -40]) {
    for (const canvasHeight of [390, 844, 1080]) {
      const viewportHeight = 12;
      for (const scoreBottom of [-200, 80, canvasHeight * 0.7, canvasHeight + 200]) {
        const { inset, ceilingY } = scoreBoundary({ scoreBottom, canvasTop, canvasHeight, viewportHeight });
        assert.ok(inset >= 0 && inset <= canvasHeight);
        const screenY = canvasTop + (0.5 - ceilingY / viewportHeight) * canvasHeight;
        assert.ok(Math.abs(screenY - (canvasTop + inset)) < 1e-9);
        if (scoreBottom + 8 >= canvasTop && scoreBottom + 8 <= canvasTop + canvasHeight) {
          assert.ok(Math.abs(screenY - scoreBottom - 8) < 1e-9, 'the limit stays eight pixels below the score');
        }
      }
    }
  }
});

test('a launched disc turns below the score with room for its full radius', () => {
  for (const viewportHeight of [5, 9, 14, 20]) {
    for (const isMobile of [false, true]) {
      const radius = (isMobile ? 0.4 : 0.5) * 1.05;
      for (const ceilingY of [-viewportHeight / 2 + radius * 2, 0, viewportHeight * 0.3]) {
        for (const seed of [0, 0.5, 0.999]) {
          const flight = createDiscFlight({ viewportHeight, isMobile, ceilingY, random: () => seed });
          const apex = flight.startY + flight.velocityY ** 2 / (-2 * GAME_GRAVITY);
          assert.ok(apex + flight.radius <= ceilingY + 1e-10, 'even the top of the disc stays below the score');
          assert.ok(flight.velocityY > 0);
          assert.ok(flight.startY + flight.radius < -viewportHeight / 2, 'the launch stays below the screen bottom');
        }
      }
    }
  }
});

test('the game clips at the paper edge without moving the score limit or launch point', () => {
  const canvas = { scoreBottom: 72, canvasTop: 0, canvasHeight: 800, viewportHeight: 12 };
  // Reversing scroll must expand the visible area again, including while a
  // disc is airborne; it must not depend on the previous frame's clipping.
  for (const [stageBottom, expectedBottom, expectedFloor] of [
    [1000, 0, -6],
    [500, 300, -1.5],
    [200, 600, 3],
    [650, 150, -3.75],
    [-20, 720, 4.8],
    [800, 0, -6],
  ]) {
    const boundary = scoreBoundary({ ...canvas, stageBottom });
    assert.equal(boundary.bottomInset, expectedBottom, `paper edge at ${stageBottom}px`);
    assert.equal(boundary.inset, 80, 'the score keeps its existing eight-pixel gap');
    assert.ok(Math.abs(boundary.floorY - expectedFloor) < 1e-10);
    assert.ok(Math.abs(boundary.ceilingY - 4.8) < 1e-10);
  }
});

test('paper clipping accounts for canvas offset and viewport resize', () => {
  const boundary = scoreBoundary({ scoreBottom: 96, canvasTop: 24, canvasHeight: 400, viewportHeight: 12, stageBottom: 224 });
  assert.equal(boundary.inset, 80);
  assert.equal(boundary.bottomInset, 200);
  assert.equal(boundary.floorY, 0);
  assert.ok(Math.abs(boundary.ceilingY - 3.6) < 1e-10);
});

test('lowering the score does not change flights already below it', () => {
  for (const isMobile of [false, true]) {
    const options = { viewportHeight: 12, isMobile, random: () => 0.5 };
    assert.deepEqual(createDiscFlight(options), createDiscFlight({ ...options, ceilingY: 4 }));
  }
});

test('longer streaks gradually shorten the wave interval and flight time within playable limits', () => {
  for (const isMobile of [false, true]) {
    const start = gameDifficulty({ score: 0, isMobile });
    assert.deepEqual(start, { interval: isMobile ? 5000 : 3000, speed: 1 });
    let previous = start;
    for (const score of [1, 5, 10, 30, 60, 100, 1000, Number.MAX_SAFE_INTEGER]) {
      const current = gameDifficulty({ score, isMobile });
      assert.ok(current.interval < previous.interval, `a streak of ${score} brings waves sooner`);
      assert.ok(current.speed > previous.speed, `a streak of ${score} speeds up new flights`);
      assert.ok(current.interval >= (isMobile ? 1400 : 900));
      assert.ok(current.speed <= 1.65);
      previous = current;
    }
    for (const score of [-1, NaN, Infinity]) assert.deepEqual(gameDifficulty({ score, isMobile }), start);
  }
});

test('faster discs follow the same arc and score boundary, with a shorter reaction window', () => {
  for (const viewportHeight of [5, 9, 14, 20]) {
    for (const isMobile of [false, true]) {
      for (const randomValue of [0, 0.5, 0.999]) {
        const options = { viewportHeight, isMobile, ceilingY: viewportHeight * 0.2, random: () => randomValue };
        const baseline = createDiscFlight(options);
        for (const score of [10, 30, 100, 10000]) {
          const { speed } = gameDifficulty({ score, isMobile });
          const fast = createDiscFlight({ ...options, speed });
          const gravity = GAME_GRAVITY * fast.gravityScale;
          const basePeakTime = -baseline.velocityY / GAME_GRAVITY;
          const peakTime = -fast.velocityY / gravity;
          assert.ok(peakTime < basePeakTime);
          assert.equal(fast.startY, baseline.startY);
          assert.equal(fast.radius, baseline.radius);
          assert.equal(fast.spin, baseline.spin);
          for (const fraction of [0, 0.25, 0.5, 1, 1.5, 2]) {
            const t = basePeakTime * fraction;
            const fastT = peakTime * fraction;
            const y = baseline.startY + baseline.velocityY * t + 0.5 * GAME_GRAVITY * t * t;
            const fastY = fast.startY + fast.velocityY * fastT + 0.5 * gravity * fastT * fastT;
            assert.ok(Math.abs(y - fastY) < 1e-9, 'the launch, apex and descent retain the same path');
          }
          const peak = fast.startY + fast.velocityY * peakTime + 0.5 * gravity * peakTime * peakTime;
          assert.ok(peak + fast.radius <= options.ceilingY + 1e-9);
        }
      }
    }
  }
});

// Run the production spawner with a controlled clock and no React render between
// score events. A swipe can score several discs before React commits the display.
function spawner(isMobile) {
  const source = readFileSync(new URL('../src/components/dom/prefooter/FruitNinja.jsx', import.meta.url), 'utf8');
  const limits = source.slice(source.indexOf('const MAX_ALIVE'), source.indexOf('function useEmojiTextures'));
  const hook = source.slice(source.indexOf('function useFruitSpawner('), source.indexOf('function FruitNinja('));
  const timer = clock();
  const streakRef = { current: 0 };
  const times = [];
  const cleanups = [];
  let fruits = [];
  const useSpawner = new Function('useState', 'useRef', 'useMemo', 'useCallback', 'useEffect', 'createSpawnSchedule', 'gameDifficulty', 'randomInt',
    `${limits}\n${hook}\nreturn useFruitSpawner;`)(
    initial => [initial, update => { fruits = update(fruits); }],
    value => ({ current: value }), factory => factory(), callback => callback,
    setup => { const cleanup = setup(); if (cleanup) cleanups.push(cleanup); },
    options => createSpawnSchedule({ ...timer, ...options, spawn: () => { times.push(timer.now()); options.spawn(); } }),
    gameDifficulty, (min, max) => max,
  );
  const [, remove] = useSpawner({ viewport: { width: 8, height: 12 }, textures: [{}, {}, {}], isMobile, active: true, getCeiling: () => 4, streakRef });
  return { timer, streakRef, times, remove, fruits: () => fruits, dispose: () => cleanups.reverse().forEach(cleanup => cleanup()) };
}

test('new waves use the current streak, retain airborne speeds and obey the existing body caps', () => {
  for (const isMobile of [false, true]) {
    const game = spawner(isMobile);
    try {
      game.timer.advance(750);
      const first = game.fruits();
      assert.equal(first.length, 6);
      assert.ok(first.every(fruit => fruit.speed === 1));
      first.slice(0, 3).forEach(fruit => game.remove(fruit.id));
      game.streakRef.current = 30;
      game.timer.advance(isMobile ? 5000 : 3000);
      const harder = gameDifficulty({ score: 30, isMobile });
      const next = game.fruits().filter(fruit => !first.includes(fruit));
      assert.ok(next.length > 0 && next.every(fruit => fruit.speed === harder.speed));
      assert.ok(first.every(fruit => fruit.speed === 1), 'airborne discs never change speed');
      game.timer.advance(harder.interval * 5);
      assert.equal(game.fruits().length, isMobile ? 6 : 10, 'higher difficulty never increases the rendering cap');

      game.streakRef.current = 0;
      game.fruits().forEach(fruit => game.remove(fruit.id));
      game.timer.advance(harder.interval);
      assert.ok(game.fruits().length > 0 && game.fruits().every(fruit => fruit.speed === 1), 'a missed streak resets the next wave');
      const waves = game.times.length;
      game.timer.advance((isMobile ? 5000 : 3000) - 1);
      assert.equal(game.times.length, waves, 'the reset also restores the starting cadence');
      game.timer.advance(1);
      assert.equal(game.times.length, waves + 1);
    } finally { game.dispose(); }
  }
});
