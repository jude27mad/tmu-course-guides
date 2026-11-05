import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { blockAutoscroll, blockWheel, canScroll, lockKey } from '../src/utils/scrollTrialGuards.mjs';

// The browser-scrolled page is an opt-in trial (?scroll=fast). Without the link nothing changes; with it,
// input that scrolls nothing today must still scroll nothing.
const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

function boot({ search = '', stored = null, userAgent = 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', platform = 'Linux armv8l', touch = 5 } = {}) {
  const source = read('../src/pages/_document.page.jsx');
  const script = source.match(/const BOOT = `([\s\S]*?)`;/)?.[1];
  assert.ok(script, 'find the production bootstrap');
  const attributes = {};
  const store = new Map(stored ? [['guide-scroll-trial', stored]] : []);
  const root = { dataset: {}, classList: { add() {} }, setAttribute: (name, value) => { attributes[name] = value; } };
  runInNewContext(script, {
    document: { documentElement: root },
    navigator: { userAgent, platform, maxTouchPoints: touch },
    window: { matchMedia: () => ({ matches: false }) },
    matchMedia: () => ({ matches: false }),
    URLSearchParams,
    location: { search },
    localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) },
  });
  return { attributes, stored: store.get('guide-scroll-trial') ?? null, root };
}

test('the trial is off unless the visitor opens it by link, and the link that ends it is remembered too', () => {
  assert.equal(boot().attributes['data-scroll-trial'], undefined, 'no link, nothing stored: today\'s page');
  const on = boot({ search: '?scroll=fast' });
  assert.equal(on.attributes['data-scroll-trial'], 'fast');
  assert.equal(on.stored, 'fast', 'remembered for later visits');
  assert.equal(boot({ stored: 'fast' }).attributes['data-scroll-trial'], 'fast', 'a later visit without the link');
  const off = boot({ search: '?scroll=classic', stored: 'fast' });
  assert.equal(off.attributes['data-scroll-trial'], undefined);
  assert.equal(off.stored, null, 'forgotten');
  assert.equal(boot({ search: '?scroll=other', stored: null }).attributes['data-scroll-trial'], undefined);
  assert.equal(boot({ search: '?scroll=other', stored: 'fast' }).attributes['data-scroll-trial'], 'fast', 'an unknown value keeps the choice');
});

test('the trial cannot break the motion setting or the layout choice before it', () => {
  // A browser that refuses storage (Safari private mode throws on setItem) still gets the motion setting.
  const source = read('../src/pages/_document.page.jsx');
  const script = source.match(/const BOOT = `([\s\S]*?)`;/)[1];
  const attributes = {};
  const root = { dataset: {}, classList: { add() {} }, setAttribute: (name, value) => { attributes[name] = value; } };
  runInNewContext(script, {
    document: { documentElement: root }, navigator: { userAgent: 'x', platform: 'Win32', maxTouchPoints: 0 },
    window: { matchMedia: () => ({ matches: false }) }, matchMedia: () => ({ matches: false }), URLSearchParams,
    location: { search: '?motion=off&scroll=fast' },
    localStorage: { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} },
  });
  assert.equal(attributes['data-motion'], 'off');
  assert.equal(root.dataset.scrollMode, 'contained');
  assert.equal(attributes['data-scroll-trial'], 'fast', 'the link still works for this visit when storage refuses');
  // iPhone and iPad keep their document layout and never get the trial (the selectors and scrollTrial() exclude it too).
  const iphone = boot({ search: '?scroll=fast', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' });
  assert.equal(iphone.root.dataset.scrollMode, 'document');
  assert.equal(iphone.attributes['data-scroll-trial'], undefined);
  assert.ok(!/\\/.test(script), 'BOOT is a template literal: no backslashes');
});

test('only the opted-in, motion-on, contained page becomes a scroller, and never while Lenis is stopped', () => {
  const css = read('../src/pages/app.module.scss');
  // today's page is untouched
  assert.match(css.slice(css.indexOf('.layout {'), css.indexOf('.mainContainer {')), /\.main \{[\s\S]*?overflow: hidden;/);
  const start = css.indexOf(":global(html[data-scroll-trial='fast'][data-motion='on']:not([data-scroll-mode='document'])) .layout .main {");
  assert.notEqual(start, -1, 'the trial rule is scoped to the opt-in, motion on and the contained layout');
  const block = css.slice(start, css.indexOf('\n}\n', start));
  assert.match(block, /touch-action: pinch-zoom;/, 'a pan never becomes native panning');
  assert.match(block, /&:not\(:global\(\.lenis-stopped\)\):not\(\[data-multitouch\]\):not\(\[data-keylock\]\) \{\s*overflow-y: auto;\s*overscroll-behavior-y: contain;\s*\}/, 'locked while Lenis is stopped, during a two-finger gesture and for a key Lenis does not take');
  assert.doesNotMatch(block, /overscroll-behavior: contain|overscroll-behavior-x/, 'horizontal overscroll still reaches the back gesture');
  assert.match(block, /:global\(\[data-lenis-prevent\] \*\) \{\s*overscroll-behavior-y: contain;/, 'calendar scrollers keep their overscroll');
  const source = read('../src/utils/scrollRoot.js');
  assert.match(source, /dataset\.scrollTrial === 'fast' && dataset\.motion === 'on' && dataset\.scrollMode !== 'document'/);
});

// A tiny DOM: enough for closest/contains/parentElement and computed overflow.
function dom() {
  const styles = new Map();
  const view = { getComputedStyle: (element) => styles.get(element) || { overflowX: 'visible', overflowY: 'visible' } };
  const doc = { defaultView: view };
  const make = (tag, { parent = null, attrs = {}, overflowY, scroll } = {}) => {
    const element = {
      nodeType: 1, tagName: tag.toUpperCase(), parentElement: parent, ownerDocument: doc, attrs,
      scrollTop: 0, scrollLeft: 0, scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100,
      ...scroll,
      matches(selector) {
        return selector.split(/,\s*/).some((part) => {
          const [, name, rest = ''] = part.match(/^([a-z]*)(.*)$/) || [];
          if (name && name.toUpperCase() !== this.tagName) return false;
          const positive = rest.replace(/:not\([^)]*\)/g, '');
          for (const [, key, value] of positive.matchAll(/\[([a-z-]+)(?:="([^"]*)")?\]/g)) if (!(key in this.attrs) || (value !== undefined && this.attrs[key] !== value)) return false;
          for (const [, key, value] of rest.matchAll(/:not\(\[([a-z-]+)(?:="([^"]*)")?\]\)/g)) if (value === undefined ? key in this.attrs : this.attrs[key] === value) return false;
          return Boolean(name) || /\[/.test(rest);
        });
      },
      closest(selector) {
        for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
        return null;
      },
      contains(other) {
        for (let node = other; node; node = node.parentElement) if (node === this) return true;
        return false;
      },
    };
    if (overflowY) styles.set(element, { overflowY, overflowX: 'hidden' });
    return element;
  };
  doc.body = make('body');
  doc.documentElement = make('html');
  return { doc, make };
}

const key = (name, extra = {}) => ({ key: name, defaultPrevented: false, ctrlKey: false, metaKey: false, altKey: false, ...extra });

test('a scroll key Lenis did not take locks main for its own default action', () => {
  const { doc, make } = dom();
  const main = make('main', { parent: doc.body, overflowY: 'auto', scroll: { scrollHeight: 5000 } });
  const inside = (tag, attrs) => make(tag, { parent: main, attrs });
  for (const name of ['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp']) {
    assert.equal(lockKey(key(name), main, inside('button', {})), true, `${name} on a focused button`);
    assert.equal(lockKey(key(name), main, inside('textarea', {})), true, `${name} in a note: the caret still moves, nothing else scrolls`);
    assert.equal(lockKey(key(name), main, inside('input', { type: 'date' })), true, `${name} in a date field`);
  }
  assert.equal(lockKey(key('End', { ctrlKey: true }), main, doc.body), true, 'Ctrl+End with the page focused');
  assert.equal(lockKey(key('ArrowDown', { metaKey: true }), main, main), true, 'Cmd+Down with main focused');
  assert.equal(lockKey(key('ArrowDown', { defaultPrevented: true }), main, doc.body), false, 'Lenis already glided');
  assert.equal(lockKey(key(' '), main, inside('button', {})), false, 'Space presses a button or types a space');
  assert.equal(lockKey(key('ArrowLeft'), main, inside('input', {})), false, 'not a vertical scroll key');
  assert.equal(lockKey(key('a'), main, inside('textarea', {})), false, 'typing');
  assert.equal(lockKey(key('PageDown'), main, make('button', { parent: doc.body })), false, 'focus outside main: the menu and dialogs keep their keys');
});

test('a wheel in the calendar that it cannot scroll stays put, and other wheels are Lenis\'s', () => {
  const { doc, make } = dom();
  const main = make('main', { parent: doc.body, overflowY: 'auto', scroll: { scrollHeight: 5000 } });
  const calendar = make('div', { parent: main, attrs: { 'data-lenis-prevent': '' } });
  const header = make('button', { parent: calendar });
  const grid = make('div', { parent: calendar, overflowY: 'auto', scroll: { scrollHeight: 600, clientHeight: 300 } });
  const cell = make('div', { parent: grid });
  const wheel = (target, deltaY, extra = {}) => ({ target, deltaY, deltaX: 0, ctrlKey: false, defaultPrevented: false, ...extra });
  assert.equal(blockWheel(wheel(header, 120), main), true, 'nothing in the calendar header scrolls');
  assert.equal(blockWheel(wheel(cell, 120), main), false, 'the time grid scrolls itself');
  grid.scrollTop = 300;
  assert.equal(blockWheel(wheel(cell, 120), main), true, 'at its end the page does not take over');
  assert.equal(blockWheel(wheel(cell, -120), main), false);
  assert.equal(blockWheel(wheel(header, 0, { deltaX: 80 }), main), false, 'sideways: the back gesture');
  assert.equal(blockWheel(wheel(header, 120, { ctrlKey: true }), main), false, 'Ctrl+wheel zooms');
  assert.equal(blockWheel(wheel(make('p', { parent: main }), 120), main), false, 'outside the calendar Lenis takes it');
  assert.equal(canScroll(make('div', { parent: main, overflowY: 'hidden', scroll: { scrollHeight: 900 } }), 1), false, 'a clipped box is not user-scrollable');
});

test('a middle-button press outside links does not start the browser\'s autoscroll', () => {
  const { doc, make } = dom();
  const main = make('main', { parent: doc.body });
  const link = make('a', { parent: main, attrs: { href: '/x' } });
  const text = make('span', { parent: link });
  assert.equal(blockAutoscroll({ button: 1, target: make('p', { parent: main }) }), true);
  assert.equal(blockAutoscroll({ button: 1, target: text }), false, 'a link still opens in a new tab');
  assert.equal(blockAutoscroll({ button: 0, target: main }), false);
  assert.equal(blockAutoscroll({ button: 1, target: make('textarea', { parent: main }) }, 'Win32'), true, 'a text field that cannot scroll would start it on main');
  assert.equal(blockAutoscroll({ button: 1, target: make('textarea', { parent: main }) }, 'Linux x86_64'), false, 'Linux pastes there');
  const longNote = make('textarea', { parent: main, overflowY: 'auto', scroll: { scrollHeight: 754, clientHeight: 84, scrollTop: 300 } });
  assert.equal(blockAutoscroll({ button: 1, target: longNote }, 'Win32', main), false, 'a long note still autoscrolls itself, as today');
});
