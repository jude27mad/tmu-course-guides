import test from 'node:test';
import assert from 'node:assert/strict';
let createSpawnSchedule;
try { ({ createSpawnSchedule } = await import('../src/components/dom/prefooter/gameTiming.mjs')); }
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
