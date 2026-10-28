import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTouchScrollFilter } from '../src/utils/touch-scroll.mjs';

const touch = (type, count) => ({ event: { type, touches: Array(count).fill({}) } });

test('normal one-finger scrolling and wheel input reach Lenis', () => {
  const filter = createTouchScrollFilter();
  assert.equal(filter(touch('touchstart', 1)), true);
  assert.equal(filter(touch('touchmove', 1)), true);
  assert.equal(filter(touch('touchend', 0)), true);
  assert.equal(filter({ event: { type: 'wheel' } }), true);
});

test('a pinch stays native through both releases and resets on the next gesture', () => {
  const filter = createTouchScrollFilter();
  assert.equal(filter(touch('touchstart', 1)), true);
  assert.equal(filter(touch('touchstart', 2)), false);
  assert.equal(filter(touch('touchmove', 2)), false);
  assert.equal(filter(touch('touchend', 1)), false, 'the first release must not feed Lenis a stale pinch delta');
  assert.equal(filter(touch('touchmove', 1)), false, 'the remaining finger still belongs to the pinch');
  assert.equal(filter(touch('touchend', 0)), false, 'the final release must not start touch inertia');
  assert.equal(filter(touch('touchstart', 1)), true);
  assert.equal(filter(touch('touchmove', 1)), true);
});

test('cancelled multitouch does not disable later single-finger or wheel scrolling', () => {
  const filter = createTouchScrollFilter();
  assert.equal(filter(touch('touchstart', 2)), false);
  assert.equal(filter(touch('touchcancel', 0)), false);
  assert.equal(filter({ event: { type: 'wheel' } }), true);
  assert.equal(filter(touch('touchstart', 1)), true);
  assert.equal(filter(touch('touchmove', 1)), true);
});

// Lenis starts touch inertia only when the release reuses a last touchmove of
// more than 5 px. At 120 Hz that touchmove covers half a 60 Hz frame.
test('a release measures the last touchmove per 60 Hz frame', () => {
  const release = () => ({ event: { type: 'touchend', touches: [] }, deltaX: 1, deltaY: -3 });
  let share = 1;
  const filter = createTouchScrollFilter(() => share);
  const atSixty = release();
  assert.equal(filter(atSixty), true);
  assert.deepEqual([atSixty.deltaX, atSixty.deltaY], [1, -3]);
  share = 0.5;
  const atOneTwenty = release();
  assert.equal(filter(atOneTwenty), true);
  assert.deepEqual([atOneTwenty.deltaX, atOneTwenty.deltaY], [2, -6]);
  const moving = { event: { type: 'touchmove', touches: [{}] }, deltaX: 1, deltaY: -3 };
  filter(moving);
  assert.deepEqual([moving.deltaX, moving.deltaY], [1, -3], 'only the release is rescaled');
});
