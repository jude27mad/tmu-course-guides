import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTouchScrollFilter } from '../src/components/canvas/fluid/touch-scroll.mjs';

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
