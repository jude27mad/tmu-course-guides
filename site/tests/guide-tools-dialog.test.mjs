import assert from 'node:assert/strict';
import test from 'node:test';
import { bindGuideTools, openGuideTools } from '../src/pages/course/components/tools/dialog.mjs';

// Small DOM boundary for the controller. Native focus trapping, Escape and
// touch/desktop geometry are additionally checked in the browser smoke test.
function fixture({ stopped = false } = {}) {
  const doc = new EventTarget();
  const values = new Map([['overflow', 'auto']]);
  const priorities = new Map([['overflow', 'important']]);
  const main = {
    scrollTop: 430,
    style: {
      getPropertyValue: (key) => values.get(key) || '',
      getPropertyPriority: (key) => priorities.get(key) || '',
      setProperty: (key, value, priority = '') => {
        values.set(key, value);
        priorities.set(key, priority);
      },
      removeProperty: (key) => {
        values.delete(key);
        priorities.delete(key);
      },
    },
  };
  const opener = {
    isConnected: true,
    focus: () => {
      doc.activeElement = opener;
    },
  };
  const close = new EventTarget();
  close.focus = () => {
    doc.activeElement = close;
  };
  const dialog = new EventTarget();
  Object.assign(dialog, {
    ownerDocument: doc,
    open: false,
    isConnected: true,
    showModal() {
      this.open = true;
      doc.activeElement = close;
    },
    close() {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    },
    querySelector: (selector) => (selector === '[data-close-tools]' ? close : null),
    getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 600 }),
  });
  doc.activeElement = opener;
  doc.querySelector = (selector) => (selector === 'main' ? main : null);
  const lenis = {
    isStopped: stopped,
    stop() {
      this.isStopped = true;
    },
    start() {
      this.isStopped = false;
    },
  };
  const dispose = bindGuideTools(dialog, { getLenis: () => lenis });
  return { doc, main, opener, close, dialog, lenis, dispose };
}

function pointer(target, type, x, y) {
  const event = new Event(type);
  Object.assign(event, { clientX: x, clientY: y });
  target.dispatchEvent(event);
}

test('the header action opens a modal without moving the page', () => {
  const f = fixture();
  openGuideTools(f.doc);
  assert.equal(f.dialog.open, true);
  assert.equal(f.doc.activeElement, f.close);
  assert.equal(f.main.scrollTop, 430);
  assert.equal(f.main.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(f.lenis.isStopped, true);
  f.dispose();
});

test('Close restores focus and the original scroll settings', () => {
  const f = fixture();
  openGuideTools(f.doc);
  f.close.dispatchEvent(new Event('click'));
  assert.equal(f.dialog.open, false);
  assert.equal(f.doc.activeElement, f.opener);
  assert.equal(f.main.style.getPropertyValue('overflow'), 'auto');
  assert.equal(f.main.style.getPropertyPriority('overflow'), 'important');
  assert.equal(f.lenis.isStopped, false);
  f.dispose();
});

test('native Escape/close releases the background scroll lock', () => {
  const f = fixture();
  openGuideTools(f.doc);
  f.dialog.close();
  assert.equal(f.main.style.getPropertyValue('overflow'), 'auto');
  assert.equal(f.doc.activeElement, f.opener);
  assert.equal(f.lenis.isStopped, false);
  f.dispose();
});

test('closing does not resume scrolling that was already stopped', () => {
  const f = fixture({ stopped: true });
  openGuideTools(f.doc);
  f.close.dispatchEvent(new Event('click'));
  assert.equal(f.lenis.isStopped, true);
  f.dispose();
});

test('repeated opens do not replace the original return-focus target', () => {
  const f = fixture();
  openGuideTools(f.doc);
  openGuideTools(f.doc);
  f.close.dispatchEvent(new Event('click'));
  assert.equal(f.doc.activeElement, f.opener);
  assert.equal(f.main.style.getPropertyValue('overflow'), 'auto');
  f.dispose();
});

test('guide-tools and legacy math-tools hashes open without page scrolling', () => {
  const f = fixture();
  for (const id of ['guide-tools', 'math-tools']) {
    const event = new CustomEvent('guide-hash', { cancelable: true, detail: { id } });
    assert.equal(f.doc.dispatchEvent(event), false);
    assert.equal(event.defaultPrevented, true);
    assert.equal(f.dialog.open, true);
    f.close.dispatchEvent(new Event('click'));
  }
  const unrelated = new CustomEvent('guide-hash', { cancelable: true, detail: { id: 'section-picker' } });
  assert.equal(f.doc.dispatchEvent(unrelated), true);
  assert.equal(f.dialog.open, false);
  f.dispose();
});

test('only a complete click on the backdrop dismisses the tools', () => {
  const f = fixture();
  openGuideTools(f.doc);
  pointer(f.dialog, 'pointerdown', 200, 200);
  pointer(f.dialog, 'click', 200, 200);
  assert.equal(f.dialog.open, true, 'clicking the dialog padding must not dismiss it');
  pointer(f.dialog, 'pointerdown', 200, 200);
  pointer(f.dialog, 'click', 20, 20);
  assert.equal(f.dialog.open, true, 'dragging from inside must not dismiss it');
  pointer(f.dialog, 'pointerdown', 20, 20);
  pointer(f.dialog, 'click', 20, 20);
  assert.equal(f.dialog.open, false);
  f.dispose();
});

test('route cleanup closes tools, restores scrolling and removes listeners', () => {
  const f = fixture();
  openGuideTools(f.doc);
  f.dispose();
  assert.equal(f.dialog.open, false);
  assert.equal(f.main.style.getPropertyValue('overflow'), 'auto');
  assert.equal(f.lenis.isStopped, false);
  openGuideTools(f.doc);
  assert.equal(f.dialog.open, false);
});

test('a late native close event does not unlock a reopened dialog', () => {
  const f = fixture();
  openGuideTools(f.doc);
  f.close.dispatchEvent(new Event('click'));
  openGuideTools(f.doc);
  f.dialog.dispatchEvent(new Event('close'));
  assert.equal(f.dialog.open, true);
  assert.equal(f.main.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(f.lenis.isStopped, true);
  f.dispose();
});
