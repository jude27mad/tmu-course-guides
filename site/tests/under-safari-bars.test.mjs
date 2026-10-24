import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

// Safari 26 shows the page under its translucent status bar and toolbar, but lays fixed layers out
// between them. The fixed artwork, cards and grain stopped in a hard line at both bars, and anything
// parked just above the viewport showed under the status bar. See docs/qa/safari-toolbar-transparency.md.
test('the fixed artwork, cards and grain continue under both bars on iPhone', () => {
  const global = read('../src/styles/global.scss');
  const app = read('../src/pages/app.module.scss');
  assert.match(global, /--edge-bleed-top:\s*\d+px;/);
  assert.match(global, /--edge-bleed-bottom:\s*\d+px;/);
  // The grain is fixed in document mode too, reaching past both edges.
  const documentMode = global.slice(global.indexOf("html[data-scroll-mode='document'] {"));
  assert.doesNotMatch(documentMode.slice(0, documentMode.indexOf('\n}')), /#layout::before\s*\{[^}]*position:\s*absolute/);
  assert.match(documentMode, /#layout::before\s*\{[^}]*top:\s*calc\(-1 \* var\(--edge-bleed-top\)\)/);
  // Background artwork and the shared scene, not the fluid (it maps touches from the viewport top).
  assert.match(app, /\.canvasContainer:not\(:global\(#fluidCanvas\)\)\s*\{[^}]*top:\s*calc\(-1 \* var\(--edge-bleed-top\)\)/);
  assert.match(app, /\.background\s*\{[^}]*top:\s*calc\(-1 \* var\(--edge-bleed-top\)\)/);
  for (const rule of [app.match(/\.canvasContainer:not\([^{]*\{[^}]*\}/)[0], app.match(/:global\(html\[data-scroll-mode='document'\]\)[\s\S]*?\.background\s*\{[^}]*\}/)[0]]) {
    assert.match(rule, /clip-path:\s*inset\(var\(--edge-clip-top\) 0 var\(--edge-clip-bottom\) 0\)/);
  }
});

test('the upward reach is hidden above the start of a page and the downward reach below a light end', () => {
  const global = read('../src/styles/global.scss');
  assert.match(global, /--edge-clip-top:\s*var\(--edge-bleed-top\);/);
  assert.match(global, /&\[data-edge-top='open'\]\s*\{\s*--edge-clip-top:\s*0px;/);
  assert.match(global, /&\[data-edge-bottom='closed'\]\s*\{\s*--edge-clip-bottom:\s*var\(--edge-bleed-bottom\);/);
  const theme = read('../src/utils/theme.js');
  assert.match(theme, /export function setEdgeBleed\(/);
  assert.match(theme, /root\.dataset\.edgeTop = scrollTop >= top \? 'open' : 'closed'/);
  assert.match(theme, /root\.dataset\.edgeBottom = endsDark \|\| maxScroll - scrollTop >= bottom \? 'open' : 'closed'/);
  const navbar = read('../src/components/dom/navbar/Index.jsx');
  assert.match(navbar, /setEdgeBleed\(\{ scrollTop: scrolled, maxScroll: scrollable, endsDark: !!footer \}\)/);
});

test('the open menu panel continues under the bars, highlight included', () => {
  const navbar = read('../src/components/dom/navbar/styles/index.module.scss');
  const backdrop = navbar.slice(navbar.indexOf('.panelBackdrop {'), navbar.indexOf('.root {'));
  assert.match(backdrop, /top:\s*calc\(-1 \* var\(--edge-bleed-top, 0px\)\)/);
  assert.match(backdrop, /bottom:\s*calc\(-1 \* var\(--edge-bleed-bottom, 0px\)\)/);
  // The same highlight as the panel, placed at the panel's top right corner.
  const menu = read('../src/components/dom/navbar/styles/menuLinks.module.scss');
  assert.match(menu, /radial-gradient\(ellipse at top right, rgba\(var\(--onDarkRgb\), 0\.06\), transparent 65%\)/);
  assert.match(backdrop, /rgba\(var\(--onDarkRgb\), 0\.06\),\s*transparent 65%/);
  assert.match(backdrop, /at 100% var\(--edge-bleed-top, 0px\)/);
});

test('the parked skip link is invisible until it has focus', () => {
  const global = read('../src/styles/global.scss');
  const skip = global.slice(global.indexOf('.skip-link {'), global.indexOf('// No JavaScript'));
  assert.match(skip, /transform:\s*translateY\(-200%\);\s*[\s\S]*opacity:\s*0;/);
  assert.match(skip, /&:focus-visible\s*\{[^}]*opacity:\s*1;/);
});
