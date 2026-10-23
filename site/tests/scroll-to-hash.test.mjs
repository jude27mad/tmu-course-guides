import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Run the production function in an isolated DOM/store boundary. Only remove
// the bundler import/export syntax; scrolling and event handling run unchanged.
const source = readFileSync(new URL('../src/utils/scrollToHash.js', import.meta.url), 'utf8')
  .replace("import { useStore } from '@src/store';", '')
  .replace('export function scrollToHash', 'function scrollToHash')
  .replace('export default scrollToHash;', '');

for (const [immediate, still] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`guide-hash reports instant scrolling for immediate=${immediate}, still=${still}`, () => {
    const calls = [];
    const element = {
      matches: () => true,
      focus: (options) => calls.push(['focus', options.preventScroll]),
    };
    const document = new EventTarget();
    document.getElementById = (id) => id === 'assessment-quiz-2' ? element : null;
    document.querySelector = () => ({ offsetHeight: 40 });
    document.addEventListener('guide-hash', (event) => {
      calls.push(['event', event.detail.immediate]);
      assert.equal(event.cancelable, true);
      assert.equal(event.detail.id, 'assessment-quiz-2');
      assert.equal(event.detail.element, element);
    });
    const scrollToHash = vm.runInNewContext(`${source}\nscrollToHash;`, {
      window: { location: { hash: '#assessment-quiz-2' } }, document, CustomEvent,
      useStore: { getState: () => ({ lenis: { scrollTo: (target, options) => {
        assert.equal(target, element);
        calls.push(['scroll', options.immediate, options.offset]);
      } }, still }) },
    });
    assert.equal(scrollToHash(immediate ? { immediate } : undefined), true);
    assert.deepEqual(calls, [['event', immediate || still], ['scroll', immediate || still, -56], ['focus', true]]);
  });
}

test('canceling guide-hash still handles the request without scrolling', () => {
  const document = new EventTarget();
  let detail;
  document.getElementById = () => null;
  document.addEventListener('guide-hash', (event) => {
    detail = event.detail;
    event.preventDefault();
  });
  const scrollToHash = vm.runInNewContext(`${source}\nscrollToHash;`, {
    window: {}, document, CustomEvent,
    useStore: { getState: () => assert.fail('a canceled hash must not scroll') },
  });
  assert.equal(scrollToHash({ hash: '#guide-tools', immediate: true }), true);
  assert.equal(detail.immediate, true);
});
