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
  const documentMode = global.slice(global.indexOf("html[data-scroll-mode='document'] {\n  overflow-x"));
  // The grain is part of the page: Safari cuts a fixed element's own painting at the layout viewport.
  assert.match(documentMode.slice(0, documentMode.indexOf('\n}')), /#layout::before \{ position: absolute; top: 0; width: 100%; height: 100%; \}/);
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
  // Elsewhere nothing reaches under a browser bar, so it costs no layout reads on each DOM change.
  assert.match(navbar, /const edges = \(\) => \{\s*if \(!nativeIOSScroll\(\)\) return;/);
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

test('the artwork fades into the ink at the bottom bar only while a dark end is at the bar', () => {
  const theme = read('../src/utils/theme.js');
  const source = theme.slice(theme.indexOf('const EDGE_SWITCH'), theme.indexOf('// Compatibility for callers')).replace('export function', 'function');
  const dataset = {};
  const setEdgeBleed = new Function('document', `${source}\nreturn setEdgeBleed;`)({ documentElement: { dataset } });
  const end = (state) => {
    setEdgeBleed(state);
    return dataset.edgeEnd;
  };
  assert.equal(end({ scrollTop: 0, maxScroll: 3000, endsDark: true }), 'none');
  assert.equal(end({ scrollTop: 2998.5, maxScroll: 3000, endsDark: true }), 'none');
  assert.equal(end({ scrollTop: 2999.5, maxScroll: 3000, endsDark: true }), 'dark');
  // Bouncing past the end.
  assert.equal(end({ scrollTop: 3060, maxScroll: 3000, endsDark: true }), 'dark');
  // A page that ends light has paper past its end (the root's #f1f1f1, and the cap).
  assert.equal(end({ scrollTop: 3000, maxScroll: 3000, endsDark: false }), 'none');
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

test('the paper caps stand down while a panel shell shrinks the page (iPad, landscape iPhone)', () => {
  // A transformed main holds its fixed caps, which would frame the shrunk page.
  const shell = read('../src/components/dom/navbar/panelShell.js');
  assert.match(shell, /export function markPageShrunk\(shrunk\)/);
  assert.match(shell, /onStart: \(\) => \{[\s\S]*?if \(ios && !isMobile\) \{[\s\S]*?markPageShrunk\(true\);[\s\S]*?onReverseComplete/);
  assert.match(shell, /onReverseComplete: \(\) => \{[\s\S]*?if \(ios && !isMobile\) \{[\s\S]*?markPageShrunk\(false\);/);
  // Leaving from an open panel pauses the shell; the route entry restores main instead.
  const layout = read('../src/components/dom/Layout.jsx');
  assert.equal(layout.match(/markPageShrunk\(false\);/g)?.length, 2);
  const global = read('../src/styles/global.scss');
  const shown = global.indexOf("&:not([data-edge-top='open']) #main::before");
  const hidden = global.search(/&\[data-page-shrunk\] #main::before,\s*&\[data-page-shrunk\] #main::after \{\s*display: none;/);
  assert.ok(shown !== -1 && hidden > shown, 'the stand-down rule follows the rule that shows the caps (same specificity)');
});

test('the shared canvas drops a View\'s last frame once nothing draws', () => {
  const app = read('../src/pages/_app.page.jsx');
  assert.match(app, /<ClearViews \/>[\s\S]*<View\.Port \/>/);
  // The production component, evaluated from its source against a stub renderer.
  const source = read('../src/components/canvas/ClearViews.jsx')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default ClearViews;', 'return ClearViews;');
  const subscribers = [];
  const ClearViews = new Function('useRef', 'useFrame', source)(
    (value) => ({ current: value }),
    (callback, order) => subscribers.push([callback, order]),
  );
  ClearViews();
  const [[frame, priority], ...others] = subscribers;
  // drei Views draw at priority 1 and up, after this.
  assert.equal(priority, 0);
  // A no-op above priority 0 turns off R3F's automatic render of the empty
  // default scene, so a route without a view does no canvas work at all.
  assert.deepEqual(others.map(([, order]) => order), [1]);
  const gl = { info: { render: { frame: 0 } }, clears: 0, setScissorTest() {}, clear() { this.clears += 1; } };
  const tick = (views) => {
    frame({ gl });
    gl.info.render.frame += views;
  };
  tick(1); // a badge on screen
  tick(1);
  assert.equal(gl.clears, 2);
  tick(0); // its window leaves: the frame it left behind is cleared
  assert.equal(gl.clears, 3);
  tick(0); // nothing drew since: the empty canvas is left alone
  tick(0);
  assert.equal(gl.clears, 3);
  tick(1); // a badge returns
  tick(0);
  assert.equal(gl.clears, 4);
});

test('the loader\'s paper continues under the bars', () => {
  const loader = read('../src/components/dom/styles/loader.module.scss');
  assert.match(loader, /:global\(html\[data-scroll-mode='document'\]\) & \{\s*box-shadow:\s*0 calc\(-1 \* var\(--edge-bleed-top\)\) 0 0 var\(--white\),\s*0 var\(--edge-bleed-bottom\) 0 0 var\(--white\);/);
});

test('a changing page fades into paper that covers the reach under the bars too', () => {
  // main's own caps fade with it; #routePaper is in the page's flow and stops at its edges.
  const app = read('../src/pages/app.module.scss');
  const documentMode = app.slice(app.indexOf(":global(html[data-scroll-mode='document']) {"));
  assert.match(documentMode, /\.routePaper::before,\s*\.routePaper::after \{[^}]*position: fixed;[^}]*background-color: var\(--white\);/);
  assert.match(documentMode, /\.routePaper::before \{ top: calc\(-1 \* var\(--edge-bleed-top\)\); height: var\(--edge-bleed-top\); \}/);
  assert.match(documentMode, /\.routePaper::after \{ bottom: calc\(-1 \* var\(--edge-bleed-bottom\)\); height: var\(--edge-bleed-bottom\); \}/);
});

test('Safari\'s flat fill past the page and under its bottom bar is the page as seen through its grain', () => {
  const global = read('../src/styles/global.scss');
  assert.match(global, /html\[data-scroll-mode='document'\] \{\s*background-color: var\(--pageUnderGrain\);\s*\}/);
  // The dark menu and a dark end still take the ink: those rules come later with equal or higher specificity.
  assert.ok(global.indexOf("html[data-scroll-mode='document'] {\n  background-color: var(--pageUnderGrain)") < global.indexOf("html[data-browser-surface='dark'],"));
  const theme = read('../src/utils/theme.js');
  assert.match(theme, /const lightEdge = \(paper\) => \(document\.documentElement\.dataset\.scrollMode === 'document' \? TOKENS\.pageUnderGrain : paper\);/);
  assert.match(theme, /meta\.setAttribute\('content', topDark \? TOKENS\.ink : lightEdge\(DEFAULT_PALETTE\.secondary\)\)/);
});

test('the artwork runs on unchanged under the bottom bar, and fades into the ink only past a dark end', () => {
  const global = read('../src/styles/global.scss');
  assert.match(global, /html\[data-scroll-mode='document'\] body \{\s*background-color: var\(--black\);\s*\}/);
  // Safari shows the artwork's reach under its bottom bar. A layer that shades it
  // at the layout viewport's bottom edge (#67 faded it to ink there) ends in a
  // line where the bar begins, so the fade is invisible...
  const app = read('../src/pages/app.module.scss');
  const background = app.slice(app.indexOf("  .background {\n    background-color: transparent;"));
  const fade = background.slice(background.indexOf('&::after {'), background.indexOf('}', background.indexOf('&::after {')));
  assert.match(fade, /position: fixed;[^}]*bottom: 0;[^}]*height: 96px;[^}]*linear-gradient\(to bottom, rgba\(var\(--inkRgb\), 0\), var\(--black\)\)/);
  assert.match(fade, /opacity: 0;/);
  // ...except while the end of a page that ends dark is at the bar, where Safari
  // shows the root's flat ink under the bar instead.
  assert.match(app, /:global\(html\[data-scroll-mode='document'\]\[data-edge-end='dark'\]\) \.background::after \{\s*opacity: 1;\s*\}/);
  assert.equal((app.match(/\.background::after/g) || []).length, 1);
  // The footer no longer fades to flat ink itself: when the page bounces past its
  // end, the artwork under it would meet that ink in a hard edge.
  const footer = read('../src/components/dom/styles/footer.module.scss');
  assert.doesNotMatch(footer, /linear-gradient/);
});
