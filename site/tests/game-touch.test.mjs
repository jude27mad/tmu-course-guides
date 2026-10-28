import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTouchScrollFilter } from '../src/utils/touch-scroll.mjs';

let bindGameTouch;
try { ({ bindGameTouch } = await import('../src/components/dom/prefooter/gameTouch.mjs')); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

const finger = (clientX, clientY, identifier = 1) => ({ identifier, clientX, clientY });

function setup() {
  assert.equal(typeof bindGameTouch, 'function', 'game touch arbitration must be available');
  const element = new EventTarget();
  const samples = [];
  const observed = [];
  const filter = createTouchScrollFilter();
  const dispose = bindGameTouch(element, {
    canStart: (touch, event) => touch.clientY >= 200 && !event.control,
    sample: (touches) => samples.push(touches.map(({ clientX, clientY }) => [clientX, clientY])),
  });
  element.addEventListener('touchmove', event => observed.push(event));
  const emit = (type, touches, { changedTouches = touches, cancelable = true, control = false } = {}) => {
    const event = new Event(type, { cancelable });
    Object.assign(event, { touches, changedTouches, control });
    element.dispatchEvent(event);
    return { event, scroll: filter({ event }) };
  };
  return { emit, samples, observed, dispose };
}

test('a sideways-starting arc stays with the game through vertical bends and reversals', () => {
  const h = setup();
  h.emit('touchstart', [finger(100, 400)]);
  for (const [x, y] of [[125, 402], [160, 490], [95, 530], [80, 350]]) {
    const { event, scroll } = h.emit('touchmove', [finger(x, y)]);
    assert.equal(event.defaultPrevented, true, 'native scroll must not follow a slicing arc');
    assert.equal(scroll, false, 'Lenis must not scroll the same arc');
  }
  assert.deepEqual(h.samples, [[[125, 402]], [[160, 490]], [[95, 530]], [[80, 350]]]);
  assert.equal(h.observed.length, 4, 'other input observers still receive every move');
  const release = h.emit('touchend', [], { changedTouches: [finger(80, 350)] });
  assert.equal(release.scroll, false, 'a slice release must not fling the page');
  h.dispose();
});

test('vertical-starting gestures stay scrollable even when they bend sideways', () => {
  const h = setup();
  h.emit('touchstart', [finger(100, 400)]);
  for (const [x, y] of [[102, 425], [220, 430], [80, 390]]) {
    const { event, scroll } = h.emit('touchmove', [finger(x, y)]);
    assert.equal(event.defaultPrevented, false);
    assert.equal(scroll, true);
  }
  assert.equal(h.emit('touchend', []).scroll, true);
  assert.deepEqual(h.samples, [], 'scrolling must not score accidental slices');
  h.dispose();
});

test('lifting between slices allows immediate replay and the next vertical swipe scrolls', () => {
  const h = setup();
  for (let index = 0; index < 3; index += 1) {
    assert.equal(h.emit('touchstart', [finger(180, 450)]).scroll, true);
    assert.equal(h.emit('touchmove', [finger(140, 460)]).scroll, false);
    assert.equal(h.emit('touchend', [], { changedTouches: [finger(140, 460)] }).scroll, false);
  }
  h.emit('touchstart', [finger(180, 450)]);
  const next = h.emit('touchmove', [finger(182, 400)]);
  assert.equal(next.event.defaultPrevented, false);
  assert.equal(next.scroll, true);
  h.dispose();
});

test('touches outside the game or on controls are never claimed later in the swipe', () => {
  for (const options of [{ startY: 100, control: false }, { startY: 400, control: true }]) {
    const h = setup();
    h.emit('touchstart', [finger(100, options.startY)], options);
    const move = h.emit('touchmove', [finger(200, 420)]);
    assert.equal(move.event.defaultPrevented, false);
    assert.equal(move.scroll, true);
    assert.deepEqual(h.samples, []);
    h.dispose();
  }
});

test('pinching stays native, including the remaining finger, before a fresh slice', () => {
  const h = setup();
  h.emit('touchstart', [finger(100, 400)]);
  h.emit('touchmove', [finger(130, 405)]);
  const before = h.samples.length;
  h.emit('touchstart', [finger(130, 405), finger(220, 450, 2)]);
  const pinch = h.emit('touchmove', [finger(80, 405), finger(260, 450, 2)]);
  assert.equal(pinch.event.defaultPrevented, false);
  assert.equal(pinch.scroll, false, 'the existing Lenis pinch filter still applies');
  h.emit('touchend', [finger(80, 405)], { changedTouches: [finger(260, 450, 2)] });
  const tail = h.emit('touchmove', [finger(180, 410)]);
  assert.equal(tail.event.defaultPrevented, false);
  assert.equal(h.samples.length, before);
  h.emit('touchend', []);
  h.emit('touchstart', [finger(100, 400)]);
  assert.equal(h.emit('touchmove', [finger(130, 405)]).scroll, false);
  h.dispose();
});

test('cancellation and cleanup never leave scrolling blocked', () => {
  const h = setup();
  h.emit('touchstart', [finger(100, 400)]);
  h.emit('touchmove', [finger(130, 405)]);
  h.emit('touchcancel', []);
  h.emit('touchstart', [finger(100, 400)]);
  assert.equal(h.emit('touchmove', [finger(105, 440)]).scroll, true);
  h.emit('touchend', []);
  h.emit('touchstart', [finger(100, 400)]);
  h.emit('touchmove', [finger(130, 405)]);
  const before = h.samples.length;
  h.dispose();
  const after = h.emit('touchmove', [finger(150, 450)]);
  assert.equal(after.event.defaultPrevented, false);
  assert.equal(after.scroll, true);
  assert.equal(h.samples.length, before);
  assert.equal(h.emit('wheel', undefined).scroll, true);
});

test('a gesture already claimed by the browser cannot become a slice midway', () => {
  const h = setup();
  h.emit('touchstart', [finger(100, 400)]);
  h.emit('touchmove', [finger(130, 405)], { cancelable: false });
  const later = h.emit('touchmove', [finger(180, 450)]);
  assert.equal(later.event.defaultPrevented, false);
  assert.equal(later.scroll, true);
  assert.deepEqual(h.samples, []);
  h.dispose();
});

test('an unmoved tap still slices without blocking its start or normal scrolling', () => {
  const h = setup();
  const start = h.emit('touchstart', [finger(100, 400)]);
  assert.equal(start.event.defaultPrevented, false);
  assert.deepEqual(h.samples, []);
  h.emit('touchend', [], { changedTouches: [finger(100, 400)] });
  assert.deepEqual(h.samples, [[[100, 400]]]);
  h.dispose();
});
