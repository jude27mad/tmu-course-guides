import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Vector2 } from 'three';

// Exercise the production hook's event handlers. Only React's lifecycle is
// supplied here: the real listeners, coordinates and shader splats run intact.
const source = readFileSync(new URL('../src/components/canvas/fluid/hooks/usePointerEvents.jsx', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm, '')
  .replace('export default usePointerEvents;', 'return usePointerEvents;');
function mount(ios = true) {
  let cleanup;
  const options = [];
  const element = new EventTarget();
  const originalAdd = element.addEventListener.bind(element);
  element.addEventListener = (name, listener, opts) => {
    options.push({ name, passive: opts?.passive });
    originalAdd(name, listener, opts);
  };
  const hook = new Function('useEffect', 'useRef', 'Vector2', 'nativeIOSScroll', source)(
    effect => { cleanup = effect(); }, value => ({ current: value }), Vector2, () => ios,
  );
  const stack = hook({ current: element }, { width: 400, height: 800 }, 2);
  const emit = (name, data) => {
    const event = new Event(name, { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { value }])));
    element.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'fluid must leave scrolling and pinch zoom native');
  };
  return { emit, options, take: () => stack.current.splice(0), cleanup: () => cleanup?.() };
}
const finger = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
const touch = (h, type, touches, changedTouches = touches) => h.emit(type, { touches, changedTouches, targetTouches: touches });
const sorted = splats => splats.sort((a, b) => a.mouseX - b.mouseX);

test('fluid follows one, then two, then three fingers with Giats shared swirls', () => {
  const h = mount();
  try {
    touch(h, 'touchstart', [finger(7, 100, 400)]);
    touch(h, 'touchmove', [finger(7, 110, 390)]);
    assert.deepEqual(h.take(), [{ mouseX: 0.275, mouseY: 1 - 390 / 800, velocityX: 20, velocityY: 20 }]);
    touch(h, 'touchstart', [finger(7, 110, 390), finger(31, 280, 400)], [finger(31, 280, 400)]);
    // TouchList order may change. Identity, not the array index, owns a trail.
    touch(h, 'touchmove', [finger(31, 270, 390), finger(7, 120, 380)]);
    assert.deepEqual(sorted(h.take()), [
      { mouseX: 0.3, mouseY: 1 - 380 / 800, velocityX: -300, velocityY: 20 },
      { mouseX: 0.675, mouseY: 1 - 390 / 800, velocityX: 320, velocityY: 0 },
    ]);
    touch(h, 'touchstart', [finger(7, 120, 380), finger(31, 270, 390), finger(99, 200, 600)], [finger(99, 200, 600)]);
    touch(h, 'touchmove', [finger(99, 210, 590), finger(31, 260, 380), finger(7, 130, 370)]);
    assert.deepEqual(sorted(h.take()), [
      { mouseX: 0.325, mouseY: 1 - 370 / 800, velocityX: -260, velocityY: 20 },
      { mouseX: 0.525, mouseY: 1 - 590 / 800, velocityX: 180, velocityY: -420 },
      { mouseX: 0.65, mouseY: 1 - 380 / 800, velocityX: 100, velocityY: 420 },
    ]);
    touch(h, 'touchend', [finger(7, 130, 370), finger(99, 210, 590)], [finger(31, 260, 380)]);
    touch(h, 'touchmove', [finger(7, 140, 360), finger(99, 220, 580)]);
    assert.equal(h.take().length, 2, 'lifting one finger must not reset the other two');
  } finally { h.cleanup(); }
});

test('a cancelled finger is forgotten without breaking the other finger', () => {
  const h = mount();
  try {
    touch(h, 'touchstart', [finger(1, 20, 40), finger(2, 200, 400)]);
    touch(h, 'touchmove', [finger(1, 30, 50), finger(2, 210, 410)]);
    h.take();
    touch(h, 'touchcancel', [finger(2, 210, 410)], [finger(1, 30, 50)]);
    touch(h, 'touchmove', [finger(2, 220, 420)]);
    assert.deepEqual(h.take(), [{ mouseX: 0.55, mouseY: 1 - 420 / 800, velocityX: 20, velocityY: -20 }]);
  } finally { h.cleanup(); }
});

test('touch coordinates at zero are valid and stationary fingers add no impulse', () => {
  const h = mount();
  try {
    touch(h, 'touchstart', [finger(1, 10, 10)]);
    touch(h, 'touchmove', [finger(1, 0, 0)]);
    assert.deepEqual(h.take(), [{ mouseX: 0, mouseY: 1, velocityX: -20, velocityY: 20 }]);
    touch(h, 'touchmove', [finger(1, 0, 0)]);
    assert.deepEqual(h.take(), []);
  } finally { h.cleanup(); }
});

test('pointer-mode browsers share Giats momentum across moving fingers', () => {
  const h = mount(false);
  const pointer = (type, pointerId, clientX, clientY) => h.emit(type, { pointerId, pointerType: 'touch', clientX, clientY });
  try {
    pointer('pointerdown', 2, 100, 200);
    pointer('pointermove', 2, 110, 210);
    pointer('pointerdown', 5, 300, 600);
    pointer('pointermove', 5, 290, 590);
    pointer('pointermove', 2, 120, 220);
    const splats = h.take();
    assert.equal(splats.length, 3);
    assert.deepEqual(splats.map(s => [s.velocityX, s.velocityY]), [[20, -20], [360, -760], [-340, 740]]);
  } finally { h.cleanup(); }
});

test('iOS does not double-count pointer events and all input listeners are passive', () => {
  const h = mount();
  try {
    touch(h, 'touchstart', [finger(1, 100, 200)]);
    h.emit('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 110, clientY: 210 });
    touch(h, 'touchmove', [finger(1, 110, 210)]);
    assert.equal(h.take().length, 1);
    assert.ok(h.options.every(option => option.passive), JSON.stringify(h.options));
  } finally { h.cleanup(); }
});

test('unmount removes listeners and a new gesture does not reuse old positions', () => {
  const h = mount();
  touch(h, 'touchstart', [finger(1, 100, 200)]);
  touch(h, 'touchmove', [finger(1, 110, 210)]);
  h.take();
  touch(h, 'touchend', [], [finger(1, 110, 210)]);
  touch(h, 'touchstart', [finger(1, 300, 600)]);
  assert.deepEqual(h.take(), []);
  touch(h, 'touchmove', [finger(1, 310, 610)]);
  assert.equal(h.take()[0]?.velocityX, 20);
  h.cleanup();
  touch(h, 'touchmove', [finger(1, 320, 620)]);
  assert.deepEqual(h.take(), []);
});
