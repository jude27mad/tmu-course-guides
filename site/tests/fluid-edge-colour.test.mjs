import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const rule = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing rule: ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

// The original fluid shader/input stays intact. Its wrapper background belongs
// in CSS so Safari's document mode is transparent from the first paint.
test('the fluid has no exported inline background overriding the Safari shell', () => {
  const page = read('../src/pages/_app.page.jsx');
  const fluid = page.slice(page.indexOf('id="fluidCanvas"'), page.indexOf('</Canvas>', page.indexOf('id="fluidCanvas"')));
  assert.doesNotMatch(fluid, /background(?:Color)?\s*:/);
  assert.doesNotMatch(fluid, /nativeIOSScroll\(\)\s*\?\s*['"]transparent['"]/);

  const css = read('../src/styles/global.scss');
  assert.match(rule(css, "html:not([data-scroll-mode='document']) #fluidCanvas"), /background-color:\s*black;/);
});

test('the real first-paint bootstrap chooses the Safari document shell only on iOS', () => {
  const source = read('../src/pages/_document.page.jsx');
  const boot = source.match(/const BOOT = `([\s\S]*?)`;/)?.[1];
  assert.ok(boot, 'find the production bootstrap, not a copy of its device detection');
  const cases = [
    ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5, 'document'],
    ['iPad Safari', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 'iPad', 5, 'document'],
    ['iPad desktop identity', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5, 'document'],
    ['Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 0, 'contained'],
    ['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0, 'contained'],
    ['Android', 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', 'Linux armv8l', 5, 'contained'],
  ];
  for (const [name, userAgent, platform, maxTouchPoints, expected] of cases) {
    for (const paused of [false, true]) {
      const root = { dataset: {}, classList: { add() {} }, setAttribute() {} };
      const matchMedia = () => ({ matches: false });
      runInNewContext(boot, {
        document: { documentElement: root },
        navigator: { userAgent, platform, maxTouchPoints },
        window: { matchMedia }, matchMedia, URLSearchParams,
        location: { search: '' },
        localStorage: { getItem: () => paused ? 'true' : null },
      });
      assert.equal(root.dataset.scrollMode, expected, `${name}, paused=${paused}`);
    }
  }
});

test('the transparent Safari guards can decide the edge search', () => {
  const css = read('../src/styles/global.scss');
  const guard = rule(css, "html[data-scroll-mode='document'] .safari-toolbar-blend");
  // pointer-events:none makes WebKit repeat the edge search with the guard skipped.
  assert.match(guard, /pointer-events:\s*auto;/);
  assert.doesNotMatch(guard, /pointer-events:\s*none/);
  // The sampled row is 4px inside the layout viewport; each guard reaches past it.
  assert.match(guard, /height:\s*8px;/);
  assert.match(rule(css, "html[data-scroll-mode='document'] [data-safari-blend='top']"), /top:\s*-2px;[\s\S]*margin-bottom:\s*-8px;/);
  assert.match(rule(css, "html[data-scroll-mode='document'] [data-safari-blend='bottom']"), /bottom:\s*-2px;[\s\S]*margin-top:\s*-8px;/);
});

test('the guards leave the corners open to taps', () => {
  const css = read('../src/styles/global.scss');
  const guard = rule(css, "html[data-scroll-mode='document'] .safari-toolbar-blend");
  // WebKit samples the middle of each edge; the open phone menu must receive input at the corners.
  assert.match(guard, /width:\s*50%;/);
  assert.match(guard, /margin-left:\s*25%;/);
  assert.doesNotMatch(css, /\.safari-toolbar-blend\s*\{[^}]*pointer-events:\s*none/);
});

test('the dark footer at the bottom edge gives Safari an ink fallback under the toolbar', () => {
  const css = read('../src/styles/global.scss');
  assert.match(css, /html\[data-scroll-mode='document'\]\[data-browser-bottom='dark'\] body \{\s*background-color: var\(--black\);/);
  // Desktop Safari tints its top bar from html/body, and there `main` already covers the page.
  assert.doesNotMatch(css, /(?<!\])html\[data-browser-bottom='dark'\]/);
});

