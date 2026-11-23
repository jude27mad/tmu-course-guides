import test from 'node:test';
import assert from 'node:assert/strict';
import { bindBadgeDrag, isBadgeTouch } from '../src/components/courseBadge/badgeDrag.mjs';

function setup() {
  const link = new EventTarget();
  const document = new EventTarget();
  const window = Object.assign(new EventTarget(), { setTimeout, clearTimeout, AbortController });
  document.defaultView = window;
  const element = Object.assign(new EventTarget(), {
    dataset: {}, ownerDocument: document, closest: () => link,
    removeAttribute() {}, setPointerCapture() {}, hasPointerCapture: () => false,
  });
  const moves = [];
  let releases = 0;
  const unbind = bindBadgeDrag(element, {
    pick: () => ({}),
    grab: () => ({ move: (x, y) => moves.push([x, y]), release: () => { releases += 1; } }),
  });
  return { element, link, document, unbind, moves, releases: () => releases };
}

function send(target, type, values) {
  const event = Object.assign(new Event(type, { cancelable: true }), values);
  target.dispatchEvent(event);
  return event;
}
const mouse = (x = 0, y = 0) => ({ pointerType: 'mouse', isPrimary: true, pointerId: 1, button: 0, clientX: x, clientY: y });
const touch = (x, y) => ({ touches: [{ identifier: 1, clientX: x, clientY: y }] });

test('a click still opens the course, and releasing a drag outside it suppresses only that pointer click', () => {
  const { element, link, document, unbind, moves, releases } = setup();
  try {
    send(element, 'pointerdown', mouse());
    send(document, 'pointermove', mouse(1, 1));
    send(document, 'pointerup', mouse(1, 1));
    assert.equal(send(link, 'click', { detail: 1 }).defaultPrevented, false);
    assert.equal(releases(), 0);
    send(element, 'pointerdown', mouse());
    send(document, 'pointermove', mouse(20, 5));
    send(document, 'pointerup', mouse(1000, 1000));
    assert.deepEqual(moves, [[20, 5]]);
    assert.equal(releases(), 1);
    assert.equal(send(link, 'click', { detail: 0 }).defaultPrevented, false, 'keyboard activation remains available');
    assert.equal(send(link, 'click', { detail: 1 }).defaultPrevented, true);
    assert.equal(send(link, 'click', { detail: 1 }).defaultPrevented, false, 'the next independent click still works');
  } finally { unbind(); }
});

test('vertical movement stays available for scrolling while a horizontal touch pull owns only its own gesture', () => {
  const { element, document, unbind, moves, releases } = setup();
  try {
    send(element, 'touchstart', touch(20, 50));
    const swipe = send(element, 'touchmove', touch(21, 36));
    assert.equal(swipe.defaultPrevented, false);
    assert.equal(isBadgeTouch(swipe), false);
    send(element, 'touchend', { touches: [] });
    assert.deepEqual(moves, []);
    send(element, 'touchstart', touch(20, 50));
    const pull = send(element, 'touchmove', touch(44, 46));
    assert.equal(pull.defaultPrevented, true);
    assert.equal(isBadgeTouch(pull), true);
    assert.deepEqual(moves, [[44, 46]]);
    send(document, 'touchstart', { touches: [...touch(44, 46).touches, { identifier: 2, clientX: 14, clientY: 18 }] });
    assert.equal(releases(), 1, 'a second finger gives control back to the browser');
    assert.equal(isBadgeTouch(send(element, 'touchend', { touches: [] })), false);
  } finally { unbind(); }
});
