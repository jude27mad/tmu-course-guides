import assert from 'node:assert/strict';
import test from 'node:test';
import { mount } from './helpers/fluid-harness.mjs';

// The request to restore Giats supersedes the guide's added contact blooms and
// release impulses. Keep fast-retouch coverage against that original contract.
test('pointer contacts and releases do not invent fluid impulses', () => {
  const h = mount();
  const emit = (phase, x, y) => h.emit(`pointer${{ start: 'down', end: 'up' }[phase]}`, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y });
  try {
    for (let i = 0; i < 8; i++) {
      emit('start', 120, i % 2 ? 300 : 650);
      emit('end', 120, i % 2 ? 650 : 300);
    }
    assert.deepEqual(h.take(), []);
  } finally { h.cleanup(); }
});

test('rapid retouch keeps the original shared last-movement history', () => {
  const h = mount();
  try {
    h.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 });
    h.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 110, clientY: 210 });
    h.take();
    h.emit('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 220 });
    h.emit('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 600 });
    h.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 310, clientY: 610 });
    assert.deepEqual(h.take(), [{ mouseX: 0.775, mouseY: 1 - 610 / 800, velocityX: 400, velocityY: -800 }]);
  } finally { h.cleanup(); }
});

test('successive fast movement reversals preserve the full original input strength', () => {
  const h = mount();
  try {
    h.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 195, clientY: 650 });
    for (let i = 0; i < 8; i++) {
      const to = i % 2 ? 650 : 300;
      h.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 195, clientY: to });
      assert.equal(h.take()[0].velocityY, i % 2 ? -700 : 700);
    }
  } finally { h.cleanup(); }
});
