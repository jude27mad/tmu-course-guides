import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const rule = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing rule: ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

// Safari 26.1+ colours the bands under its status bar and toolbar from a viewport-sized fixed layer with a
// visible background-color. On iPhone the fluid canvas is exactly that layer, and its black base was shipped
// in the exported HTML (hydration keeps the server's inline style), so both bands were solid black.
test('the fluid canvas gets its black base from CSS, never from client-only inline style', () => {
  const page = read('../src/pages/_app.page.jsx');
  const fluid = page.slice(page.indexOf('id="fluidCanvas"'), page.indexOf('</Canvas>', page.indexOf('id="fluidCanvas"')));
  assert.doesNotMatch(fluid, /background\s*:/, 'an inline background is exported with the server value and is never corrected on the iPhone');
  assert.doesNotMatch(fluid, /nativeIOSScroll\(\)\s*\?\s*['"]transparent['"]/);

  const css = read('../src/styles/global.scss');
  assert.match(rule(css, "html:not([data-scroll-mode='document']) #fluidCanvas"), /background-color:\s*black;/);
  assert.doesNotMatch(css, /html\[data-scroll-mode='document'\][^{]*#fluidCanvas[^{]*\{[^}]*background(?:-color)?:\s*(?!transparent)/);
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
