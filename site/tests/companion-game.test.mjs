import test from 'node:test';
import assert from 'node:assert/strict';
let createSpawnSchedule, createDiscFlight, GAME_GRAVITY, scoreAfterEvent, scoreBoundary;
try { ({ createSpawnSchedule, createDiscFlight, GAME_GRAVITY, scoreAfterEvent, scoreBoundary } = await import('../src/components/dom/prefooter/gameTiming.mjs')); }
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

test('lowering the score does not change flights already below it', () => {
  for (const isMobile of [false, true]) {
    const options = { viewportHeight: 12, isMobile, random: () => 0.5 };
    assert.deepEqual(createDiscFlight(options), createDiscFlight({ ...options, ceilingY: 4 }));
  }
});
