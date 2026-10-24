import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const block = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing rule: ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

// Safari 26 shows the page under its translucent status bar and toolbar, but lays fixed layers out
// between them. The fixed artwork, cards and grain stopped in a hard line at both bars, and anything
// parked just above the viewport showed under the status bar. See docs/qa/safari-toolbar-transparency.md.
test('the fixed artwork, cards and grain continue under both bars on iPhone', () => {
  const global = read('../src/styles/global.scss');
  const app = read('../src/pages/app.module.scss');
  assert.match(global, /--edge-bleed-top:\s*\d+px;/);
  assert.match(global, /--edge-bleed-bottom:\s*\d+px;/);
  const documentMode = global.slice(global.indexOf("html[data-scroll-mode='document'] {"));
  // The grain is fixed in document mode too, reaching past both edges.
  assert.doesNotMatch(documentMode.slice(0, documentMode.indexOf('\n}')), /#layout::before\s*\{[^}]*position:\s*absolute/);
  assert.match(documentMode, /#layout::before\s*\{[^}]*top:\s*calc\(-1 \* var\(--edge-bleed-top\)\)/);
  // Background artwork and the shared scene, not the fluid (it maps touches from the viewport top).
  assert.match(app, /\.canvasContainer:not\(:global\(#fluidCanvas\)\)\s*\{[^}]*top:\s*calc\(-1 \* var\(--edge-bleed-top\)\)/);
  assert.match(app, /\.background\s*\{[^}]*top:\s*calc\(-1 \* var\(--edge-bleed-top\)\)/);
  assert.doesNotMatch(app, /clip-path/);
});

test('inside the viewport the dark sweep is drawn as before', () => {
  const shader = read('../src/components/canvas/background/shaders/fragmentShader.js');
  assert.match(shader, /uv\.y = uv\.y \* uUvScaleY \+ uUvOffsetY;/);
  const background = read('../src/components/canvas/background/Background.jsx');
  assert.match(background, /uniforms\.uUvScaleY\.value = canvasHeight \/ band;/);
  assert.match(background, /uniforms\.uUvOffsetY\.value = -bottom \/ band;/);
});

test('paper covers the reach above the start of a page and below a light end, fading with the page', () => {
  const global = read('../src/styles/global.scss');
  const caps = block(global, '  #main::before,\n  #main::after');
  assert.match(caps, /position:\s*fixed;/);
  assert.match(caps, /z-index:\s*-1;/);
  assert.match(caps, /background-color:\s*var\(--white\);/);
  assert.match(global, /#main::before \{ top: calc\(-1 \* var\(--edge-bleed-top\)\); height: var\(--edge-bleed-top\); \}/);
  assert.match(global, /#main::after \{ bottom: calc\(-1 \* var\(--edge-bleed-bottom\)\); height: var\(--edge-bleed-bottom\); \}/);
  assert.match(global, /&:not\(\[data-edge-top='open'\]\) #main::before,\s*&\[data-edge-bottom='closed'\] #main::after \{\s*display: block;/);
  // Set straight from the scroll event too, so a route change's reset to the top paints with its paper.
  const navbar = read('../src/components/dom/navbar/Index.jsx');
  assert.match(navbar, /const schedule = \(\) => \{\s*edges\(\);/);
  assert.match(navbar, /Array\.from\(main\.querySelectorAll\('\[data-surface="dark"\]'\)\)/);
  assert.match(navbar, /setEdgeBleed\(\{ scrollTop: scrolled, maxScroll: scrollable, endsDark: !!main\.querySelector\('footer \[data-surface="dark"\]'\), darkFromStart, darkFromEnd \}\)/);
});

test('the paper steps aside for a dark panel near either end, and otherwise 480px from it', () => {
  // The production function, evaluated from its source against a stub document.
  const theme = read('../src/utils/theme.js');
  const source = theme.slice(theme.indexOf('const EDGE_SWITCH'), theme.indexOf('// Compatibility for callers')).replace('export function', 'function');
  const dataset = {};
  const setEdgeBleed = new Function('document', `${source}\nreturn setEdgeBleed;`)({ documentElement: { dataset } });
  const edges = (state) => {
    setEdgeBleed(state);
    return [dataset.edgeTop, dataset.edgeBottom];
  };
  assert.deepEqual(edges({ scrollTop: 0, maxScroll: 3000, endsDark: false }), ['closed', 'open']);
  assert.deepEqual(edges({ scrollTop: 479, maxScroll: 3000, endsDark: false }), ['closed', 'open']);
  assert.deepEqual(edges({ scrollTop: 480, maxScroll: 3000, endsDark: false }), ['open', 'open']);
  assert.deepEqual(edges({ scrollTop: 2600, maxScroll: 3000, endsDark: false }), ['open', 'closed']);
  assert.deepEqual(edges({ scrollTop: 2600, maxScroll: 3000, endsDark: true }), ['open', 'open']);
  // The course cards start 173px into /courses/: they show the artwork through their ink.
  assert.deepEqual(edges({ scrollTop: 172, maxScroll: 3000, endsDark: true, darkFromStart: 173 }), ['closed', 'open']);
  assert.deepEqual(edges({ scrollTop: 173, maxScroll: 3000, endsDark: true, darkFromStart: 173 }), ['open', 'open']);
  assert.deepEqual(edges({ scrollTop: 2850, maxScroll: 3000, endsDark: false, darkFromEnd: 150 }), ['open', 'open']);
  assert.deepEqual(edges({ scrollTop: 2851, maxScroll: 3000, endsDark: false, darkFromEnd: 150 }), ['open', 'closed']);
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
  // It darkens with the panel's own tween (0.28s power3.out).
  assert.match(backdrop, /transition: opacity 0\.28s cubic-bezier\(0\.215, 0\.61, 0\.355, 1\);/);
});

test('the parked skip link is invisible until it has focus', () => {
  const global = read('../src/styles/global.scss');
  const skip = global.slice(global.indexOf('.skip-link {'), global.indexOf('// No JavaScript'));
  assert.match(skip, /transform:\s*translateY\(-200%\);\s*[\s\S]*opacity:\s*0;/);
  assert.match(skip, /&:focus-visible\s*\{[^}]*opacity:\s*1;/);
});
