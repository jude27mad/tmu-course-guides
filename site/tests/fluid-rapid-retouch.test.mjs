import assert from 'node:assert/strict';
import test from 'node:test';
import { mount, finger, touch } from './helpers/fluid-harness.mjs';

// The request to restore Giats supersedes the guide's added contact blooms and
// release impulses. Keep fast-retouch coverage against that original contract.
for (const ios of [true, false]) {
  test(`${ios ? 'native' : 'pointer'} contacts and releases do not invent fluid impulses`, () => {
    const h = mount({ ios });
    const emit = (phase, x, y) => ios
      ? touch(h, `touch${phase}`, phase === 'end' ? [] : [finger(1, x, y)], [finger(1, x, y)])
      : h.emit(`pointer${{ start: 'down', end: 'up' }[phase]}`, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y });
    try {
      for (let i = 0; i < 8; i++) {
        emit('start', 120, i % 2 ? 300 : 650);
        emit('end', 120, i % 2 ? 650 : 300);
      }
      assert.deepEqual(h.take(), []);
    } finally { h.cleanup(); }
  });
}

test('rapid retouch keeps the original shared last-movement history', () => {
  const h = mount();
  try {
    touch(h, 'touchmove', [finger(1, 100, 200)]);
    touch(h, 'touchmove', [finger(1, 110, 210)]);
    h.take();
    touch(h, 'touchend', [], [finger(1, 120, 220)]);
    touch(h, 'touchstart', [finger(1, 300, 600)]);
    touch(h, 'touchmove', [finger(1, 310, 610)]);
    assert.deepEqual(h.take(), [{ mouseX: 0.775, mouseY: 1 - 610 / 800, velocityX: 400, velocityY: -800 }]);
  } finally { h.cleanup(); }
});

test('successive fast movement reversals preserve the full original input strength', () => {
  const h = mount();
  try {
    touch(h, 'touchmove', [finger(1, 195, 650)]);
    for (let i = 0; i < 8; i++) {
      const to = i % 2 ? 650 : 300;
      touch(h, 'touchmove', [finger(1, 195, to)]);
      assert.equal(h.take()[0].velocityY, i % 2 ? -700 : 700);
    }
  } finally { h.cleanup(); }
});
