import assert from 'node:assert/strict';
import test from 'node:test';
import { mount, finger, touch } from './helpers/fluid-harness.mjs';

test('the adapter forwards changed fingers across different child targets after a lift', () => {
  const h = mount();
  try {
    const first = finger(11, 100, 200);
    const second = finger(42, 300, 600);
    touch(h, 'touchmove', [first, second], [first, second], [first]);
    assert.equal(h.take().length, 1, 'the first point seeds history; the second produces the original shared swirl');
    touch(h, 'touchend', [second], [first], []);
    assert.deepEqual(h.take(), [], 'lifting a finger does not add a new stroke');
    const next = finger(42, 280, 580);
    touch(h, 'touchmove', [next], [next], [next]);
    assert.deepEqual(h.take(), [{ mouseX: 0.7, mouseY: 1 - 580 / 800, velocityX: -40, velocityY: 40 }]);
  } finally { h.cleanup(); }
});
