import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Vector2 } from 'three';

// Run the production event handlers: only the React refs/effect are supplied.
const source = readFileSync(new URL('../src/components/canvas/fluid/hooks/usePointerEvents.jsx', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm, '')
  .replace('export default usePointerEvents;', 'return usePointerEvents;');

function mount(ios = true) {
  const target = new EventTarget();
  let cleanup = () => {};
  const hook = new Function('useEffect', 'useRef', 'Vector2', 'nativeIOSScroll', source)(
    effect => { cleanup = effect(); },
    value => ({ current: value }),
    Vector2,
    () => ios,
  );
  const stack = hook({ current: target }, { width: 400, height: 800 }, 1);
  function emit(type, values = {}) {
    const event = new Event(type, { cancelable: true });
    Object.entries(values).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'liquid must not intercept native gestures');
  }
  const take = () => stack.current.splice(0);
  return { emit, take, cleanup: () => cleanup() };
}
const finger = (id, x, y) => ({ identifier: id, clientX: x, clientY: y });
function gesture(h, type, active, changed = active) {
  h.emit(type, { touches: active, changedTouches: changed, targetTouches: active });
}

test('each immediate retouch creates visible liquid even if iOS sends no touchmove', () => {
  const h = mount();
  try {
    gesture(h, 'touchstart', [finger(1, 120, 240)]);
    const first = h.take();
    assert.equal(first.length, 1, 'the first contact itself must seed the fluid');
    assert.equal(first[0].mouseX, 120 / 400);
    assert.equal(first[0].mouseY, 1 - 240 / 800);
    assert.ok(first[0].dye >= 16, 'contact ink must be perceptible without finger movement');
    assert.equal(first[0].velocityX, 0, 'a tap must not inject a preferred motion direction');
    assert.equal(first[0].velocityY, 0);

    gesture(h, 'touchend', [], [finger(1, 120, 240)]);
    gesture(h, 'touchstart', [finger(1, 300, 520)]);
    const second = h.take();
    assert.equal(second.length, 1, 'immediate reuse of a finger identifier must create fresh fluid');
    assert.equal(second[0].mouseX, 300 / 400);
    assert.equal(second[0].mouseY, 1 - 520 / 800);
    assert.ok(second[0].dye >= 16);
  } finally { h.cleanup(); }
});

test('two very fast taps before a frame is drawn both survive in the queue', () => {
  const h = mount();
  try {
    gesture(h, 'touchstart', [finger(3, 100, 100)]);
    gesture(h, 'touchend', [], [finger(3, 100, 100)]);
    gesture(h, 'touchstart', [finger(4, 200, 200)]);
    assert.deepEqual(h.take().map(s => s.mouseX), [0.25, 0.5]);
  } finally { h.cleanup(); }
});

test('a newly added second or third finger seeds ink and does not stop moving fingers', () => {
  const h = mount();
  try {
    gesture(h, 'touchstart', [finger(10, 100, 100)]);
    h.take();
    gesture(h, 'touchstart', [finger(10, 100, 100), finger(20, 200, 200)], [finger(20, 200, 200)]);
    gesture(h, 'touchstart', [finger(10, 100, 100), finger(20, 200, 200), finger(30, 300, 300)], [finger(30, 300, 300)]);
    assert.deepEqual(h.take().map(s => s.mouseX), [0.5, 0.75]);
    gesture(h, 'touchmove', [finger(10, 105, 105), finger(20, 205, 205), finger(30, 305, 305)]);
    assert.equal(h.take().length, 3, 'all three moving fingers still cause liquid motion');
  } finally { h.cleanup(); }
});

test('non-iOS touch pointerdown makes a fresh contact too', () => {
  const h = mount(false);
  try {
    h.emit('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: 200, clientY: 400 });
    assert.equal(h.take().length, 1);
    h.emit('pointerup', { pointerId: 7, pointerType: 'touch', clientX: 200, clientY: 400 });
    h.emit('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: 100, clientY: 100 });
    assert.equal(h.take().length, 1);
  } finally { h.cleanup(); }
});

test('contact ink is forwarded into both shader passes for the visible touch bloom', () => {
  const renderer = readFileSync(new URL('../src/components/canvas/fluid/Fluid.jsx', import.meta.url), 'utf8');
  assert.match(renderer, /velocityX,\s*velocityY,\s*dye\s*=\s*10/);
  assert.match(renderer, /new Vector3\(velocityX,\s*velocityY,\s*dye\)/);
});
