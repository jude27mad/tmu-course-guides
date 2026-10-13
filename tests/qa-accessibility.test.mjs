import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../tools/ui-build/node_modules/jsdom/lib/api.js';

const hub = readFileSync(new URL('../assets/hub.js', import.meta.url), 'utf8');
// Removing the hub's Skip-aware insertion would make these direct-load checks fail.
for (const base of ['/', '/tmu-course-guides/']) {
  for (const route of ['desk', 'mth140', 'mth141']) {
    test(`${route} at ${base}: shared hub keeps the authored Skip link first`, () => {
      const dom = new JSDOM(`<!doctype html><body ${route === 'desk' ? 'data-page="desk"' : `data-course="${route}"`}><a class="skip-link" href="#main">Skip to coursework</a><main id="main">Course content</main></body>`, {
        url: `https://guide.test${base}${route === 'desk' ? '' : route + '/'}`,
        runScripts: 'outside-only'
      });
      try {
        const {window: w} = dom;
        Object.defineProperty(w.document, 'currentScript', {value: {src: `https://guide.test${base}assets/hub.js`}});
        const skip = w.document.querySelector('.skip-link');
        w.eval(hub);
        const shell = w.document.querySelector('.hub-shell');
        assert.equal(w.document.querySelector('a[href],button,input,select,textarea'), skip);
        w.eval(hub); // Repeated shell initialization must not duplicate or reorder it.
        assert.equal(w.document.querySelector('.hub-shell'), shell);
        assert.equal(w.document.querySelectorAll('.skip-link').length, 1);
        assert.equal(w.document.querySelector('a[href],button,input,select,textarea'), skip);
        assert.equal(shell.querySelector('.hub-brand').href, `https://guide.test${base}`);
      } finally { dom.window.close(); }
    });
  }
}

// Real stylesheet cascade, not font-size arithmetic: the browser harness also
// measures the rendered boxes at three widths in both themes.
for (const selector of ['.hub-brand', 'footer a', 'footer .reset']) {
  test(`course chrome gives ${selector} a 44px target independent of text metrics`, () => {
    const dom = new JSDOM('<!doctype html><body class="editorial workspace" data-course="cen100"><a class="hub-brand" href="/">TMU Course Guides</a><footer><a href="/privacy.html">Privacy</a><button class="reset">Clear my ticks</button></footer></body>');
    try {
      for (const file of ['hub.css', 'editorial.css', 'workspace.css', 'night/layout.css']) {
        const style = dom.window.document.createElement('style');
        style.textContent = readFileSync(new URL(`../assets/${file}`, import.meta.url), 'utf8');
        dom.window.document.head.append(style);
      }
      const style = dom.window.getComputedStyle(dom.window.document.querySelector(selector));
      assert.ok(parseFloat(style.minHeight) >= 44, `${selector}: min-height is ${style.minHeight}`);
      assert.ok(parseFloat(style.minWidth) >= 44, `${selector}: min-width is ${style.minWidth}`);
      assert.notEqual(style.display, 'inline', 'the minimum dimensions must affect the clickable box');
    } finally { dom.window.close(); }
  });
}
