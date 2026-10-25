import assert from 'node:assert/strict';
import test from 'node:test';
import { mount } from './helpers/fluid-harness.mjs';

test('pointer movement continues after another finger lifts', () => {
  const h = mount();
  try {
    h.emit('pointermove', { pointerType: 'touch', pointerId: 11, clientX: 100, clientY: 200 });
    h.emit('pointermove', { pointerType: 'touch', pointerId: 42, clientX: 300, clientY: 600 });
    assert.equal(h.take().length, 1, 'the first point seeds history; the second produces the original shared swirl');
    h.emit('pointerup', { pointerType: 'touch', pointerId: 11, clientX: 100, clientY: 200 });
    assert.deepEqual(h.take(), [], 'lifting a finger does not add a new stroke');
    h.emit('pointermove', { pointerType: 'touch', pointerId: 42, clientX: 280, clientY: 580 });
    assert.deepEqual(h.take(), [{ mouseX: 0.7, mouseY: 1 - 580 / 800, velocityX: -40, velocityY: 40 }]);
  } finally { h.cleanup(); }
});
