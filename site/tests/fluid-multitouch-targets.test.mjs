import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Vector2 } from 'three';

const source = readFileSync(new URL('../src/components/canvas/fluid/hooks/usePointerEvents.jsx', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm, '')
  .replace('export default usePointerEvents;', 'return usePointerEvents;');

test('fingers on different child elements keep their trails when either finger lifts', () => {
  let cleanup;
  const element = new EventTarget();
  const hook = new Function('useEffect', 'useRef', 'Vector2', 'nativeIOSScroll', source)(
    effect => { cleanup = effect(); }, value => ({ current: value }), Vector2, () => true,
  );
  const queue = hook({ current: element }, { width: 400, height: 800 }, 2);
  const finger = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
  const emit = (type, touches, targetTouches, changedTouches) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      touches: { value: touches }, targetTouches: { value: targetTouches }, changedTouches: { value: changedTouches },
    });
    element.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  };
  try {
    const first = finger(11, 100, 200);
    const second = finger(42, 300, 600);
    emit('touchstart', [first], [first], [first]);
    // The second finger began on another child node, so targetTouches differs.
    emit('touchstart', [first, second], [second], [second]);
    assert.equal(queue.current.length, 2, 'both fingers started with contact ink');
    queue.current.length = 0;
    const movedFirst = finger(11, 110, 210);
    const movedSecond = finger(42, 290, 590);
    emit('touchmove', [movedFirst, movedSecond], [movedFirst], [movedFirst, movedSecond]);
    assert.equal(queue.current.length, 2, 'both moving fingers must reach the simulation');
    queue.current.length = 0;
    // touchend targets the removed finger's node. targetTouches is now empty,
    // but the second finger elsewhere on the same page remains active.
    emit('touchend', [movedSecond], [], [movedFirst]);
    const next = finger(42, 280, 580);
    emit('touchmove', [next], [next], [next]);
    assert.equal(queue.current.length, 1);
    assert.deepEqual([queue.current[0].velocityX, queue.current[0].velocityY], [-20, 20]);
  } finally { cleanup(); }
});
