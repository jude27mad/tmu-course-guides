import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector2 } from 'three';

export const referenceSource = readFileSync(new URL('../fixtures/giats/usePointerEvents.jsx', import.meta.url), 'utf8');
const productionSource = readFileSync(new URL('../../src/components/canvas/fluid/hooks/usePointerEvents.jsx', import.meta.url), 'utf8');
export function mount({ ios = true, source = productionSource } = {}) {
  let cleanup;
  const options = [];
  const element = new EventTarget();
  const add = element.addEventListener.bind(element);
  element.addEventListener = (name, listener, opts) => {
    options.push({ name, passive: opts?.passive });
    add(name, listener, opts);
  };
  const code = source.replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default usePointerEvents;', 'return usePointerEvents;');
  const hook = new Function('useEffect', 'useRef', 'Vector2', 'nativeIOSScroll', code)(
    effect => { cleanup = effect(); }, value => ({ current: value }), Vector2, () => ios,
  );
  const queue = hook({ current: element }, { width: 400, height: 800 }, 2);
  return {
    emit(type, values = {}) {
      const event = new Event(type, { cancelable: true });
      Object.entries(values).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
      element.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false, 'fluid must leave scrolling and zoom native');
    },
    take: () => queue.current.splice(0), options, cleanup: () => cleanup?.(),
  };
}
export const finger = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
export function touch(h, type, touches, changedTouches = touches, targetTouches = touches) {
  h.emit(type, { touches, changedTouches, targetTouches });
}
