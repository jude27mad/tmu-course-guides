import assert from 'node:assert/strict';
import test from 'node:test';
import { mount, referenceSource, finger, touch } from './helpers/fluid-harness.mjs';

test('one, two and three pointers retain the unmodified Giats calculation', () => {
  const actual = mount();
  const reference = mount({ source: referenceSource, ios: false });
  try {
    for (const fingers of [
      [finger(1, 100, 200)], [finger(1, 110, 210)],
      [finger(2, 290, 590), finger(1, 120, 220)],
      [finger(3, 200, 400), finger(1, 130, 230), finger(2, 280, 580)],
      [finger(2, 270, 570), finger(3, 210, 410)],
    ]) {
      fingers.forEach(point => actual.emit('pointermove', { ...point, pointerType: 'touch', pointerId: point.identifier }));
      fingers.forEach(point => reference.emit('pointermove', point));
      assert.deepEqual(actual.take(), reference.take());
    }
  } finally { actual.cleanup(); reference.cleanup(); }
});

test('legacy touch events do not double-count the restored pointer input', () => {
  const h = mount();
  try {
    h.emit('pointermove', { pointerType: 'touch', clientX: 100, clientY: 200 });
    touch(h, 'touchmove', [finger(1, 100, 200)]);
    assert.deepEqual(h.take(), [], 'the original first sample only establishes the shared position');
    h.emit('pointermove', { pointerType: 'touch', clientX: 110, clientY: 210 });
    touch(h, 'touchmove', [finger(1, 110, 210)]);
    assert.deepEqual(h.take(), [{ mouseX: 0.275, mouseY: 1 - 210 / 800, velocityX: 20, velocityY: -20 }]);
    assert.ok(h.options.every(option => option.passive));
  } finally { h.cleanup(); }
});

test('the original pointer input accepts mouse and pen movement', () => {
  const h = mount();
  try {
    h.emit('pointermove', { pointerType: 'mouse', clientX: 100, clientY: 200 });
    h.emit('pointermove', { pointerType: 'pen', clientX: 120, clientY: 230 });
    assert.deepEqual(h.take(), [{ mouseX: 0.3, mouseY: 1 - 230 / 800, velocityX: 40, velocityY: -60 }]);
  } finally { h.cleanup(); }
});

test('unmount detaches the pointer input', () => {
  const h = mount();
  h.emit('pointermove', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 200 });
  h.cleanup();
  touch(h, 'touchmove', [finger(1, 120, 220)]);
  h.emit('pointermove', { pointerType: 'mouse', clientX: 140, clientY: 240 });
  assert.deepEqual(h.take(), []);
});
