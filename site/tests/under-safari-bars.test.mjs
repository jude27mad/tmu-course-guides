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

test('the fixed copy of the dark end\'s fade replaces the page\'s own only while the page bounces past its end', () => {
  // At rest at the end the page's own fade stays: this runs a frame or more after
  // the page moves, and hiding it there showed a lit strip under the toolbar when
  // scrolling up from the end.
  const theme = read('../src/utils/theme.js');
  const source = theme.slice(theme.indexOf('const EDGE_SWITCH'), theme.indexOf('// Compatibility for callers')).replace('export function', 'function');
  const dataset = {};
  const setEdgeBleed = new Function('document', `${source}\nreturn setEdgeBleed;`)({ documentElement: { dataset } });
  const past = (state) => {
    setEdgeBleed(state);
    return dataset.edgePast;
  };
  assert.equal(past({ scrollTop: 2990, maxScroll: 3000, endsDark: true }), 'none');
  assert.equal(past({ scrollTop: 3000, maxScroll: 3000, endsDark: true }), 'none');
  assert.equal(past({ scrollTop: 3000.6, maxScroll: 3000, endsDark: true }), 'none');
  assert.equal(past({ scrollTop: 3001, maxScroll: 3000, endsDark: true }), 'end');
  assert.equal(past({ scrollTop: 3060, maxScroll: 3000, endsDark: true }), 'end');
  assert.equal(past({ scrollTop: 3060, maxScroll: 3000, endsDark: false }), 'none');
  const app = read('../src/pages/app.module.scss');
  const layout = read('../src/components/dom/styles/layout.module.scss');
  assert.doesNotMatch(app + layout, /data-edge-end/);
});

test('the open phone menu shows the artwork, which continues under the bars', () => {
  // Giats's menu has no surface of its own: the page shrinks aside and the dark
  // artwork behind it fills the screen, reaching under Safari's bars (.background).
  const menu = read('../src/components/dom/navbar/styles/menuLinks.module.scss');
  const panel = menu.slice(menu.indexOf('.menu {'), menu.indexOf('.menuWrapper {'));
  assert.doesNotMatch(panel, /^\s*background(-color|-image)?:/m);
  // Only an invisible guard catches taps on phones while the panel closes.
  const navbar = read('../src/components/dom/navbar/styles/index.module.scss');
  const guard = navbar.slice(navbar.indexOf('.panelGuard {'), navbar.indexOf('.root {'));
  assert.match(guard, /transition: visibility 0s 0\.92s;/);
  assert.doesNotMatch(guard, /^\s*background(-color|-image)?:/m);
  const app = read('../src/pages/app.module.scss');
  assert.match(app, /\.background\s*\{[^}]*top:\s*calc\(-1 \* var\(--edge-bleed-top\)\)/);
  assert.match(app, /\.background\s*\{[^}]*height:\s*calc\(var\(--app-viewport-height\) \+ var\(--edge-bleed-top\) \+ var\(--edge-bleed-bottom\)\)/);
});

test('the parked skip link is invisible until it has focus', () => {
  const global = read('../src/styles/global.scss');
  const skip = global.slice(global.indexOf('.skip-link {'), global.indexOf('// No JavaScript'));
  assert.match(skip, /transform:\s*translateY\(-200%\);\s*[\s\S]*opacity:\s*0;/);
  assert.match(skip, /&:focus-visible\s*\{[^}]*opacity:\s*1;/);
});

test('the paper caps stand down while a panel shell shrinks the page (iPhone and iPad)', () => {
  // A transformed main holds its fixed caps, which would frame the shrunk page.
  const shell = read('../src/components/dom/navbar/panelShell.js');
  assert.match(shell, /export function markPageShrunk\(shrunk\)/);
  assert.match(shell, /onStart: \(\) => \{[\s\S]*?if \(ios\) markPageShrunk\(true\);[\s\S]*?onReverseComplete/);
  // The card is refitted while the page is shrunk (scroll during the close, rotation).
  assert.match(shell, /window\.addEventListener\('scroll', fitShrunkPage, \{ passive: true \}\);/);
  assert.match(shell, /window\.removeEventListener\('resize', fitShrunkPage\);/);
  assert.match(shell, /onReverseComplete: \(\) => \{[\s\S]*?if \(ios\) \{[\s\S]*?markPageShrunk\(false\);/);
  // Leaving from an open panel pauses the shell; the route entry restores main instead.
  const layout = read('../src/components/dom/Layout.jsx');
  assert.equal(layout.match(/markPageShrunk\(false\);/g)?.length, 2);
  const global = read('../src/styles/global.scss');
  const shown = global.indexOf("&:not([data-edge-top='open']) #main::before");
  const hidden = global.search(/&\[data-page-shrunk\] #main::before,\s*&\[data-page-shrunk\] #main::after \{\s*display: none;/);
  assert.ok(shown !== -1 && hidden > shown, 'the stand-down rule follows the rule that shows the caps (same specificity)');
  // The shrunk document is clipped to the part that was on screen: one card, like Giats's.
  assert.match(shell, /root\.style\.setProperty\('--page-clip-top'/);
  assert.match(shell, /root\.style\.removeProperty\('--page-clip-bottom'\)/);
});

test('the shrinking page keeps what Safari shows under its bars until it has shrunk', () => {
  // Cut at the layout viewport from the tap, the page under both bars turned dark
  // while it still filled the screen, and stayed dark until a close had finished.
  const global = read('../src/styles/global.scss');
  const clip = global.slice(global.indexOf('&[data-page-shrunk] #main {'));
  const rule = clip.slice(0, clip.indexOf('}')).replace(/\s+/g, ' ');
  assert.match(rule, /clip-path: inset\( max\(0px, var\(--page-clip-top, 0px\) - \(1 - var\(--panel-cover, 1\)\) \* var\(--edge-bleed-top\)\) 0px max\(0px, var\(--page-clip-bottom, 0px\) - \(1 - var\(--panel-cover, 1\)\) \* var\(--edge-bleed-bottom\)\) 0px round calc\(var\(--panel-cover, 1\) \* 1\.3888888889vw\) \);/);
  // --panel-cover runs with the page's own shrink: same timeline, start, duration
  // and ease, so reversing the shell returns it, and only in document mode.
  const shell = read('../src/components/dom/navbar/panelShell.js');
  assert.match(shell, /if \(ios\) tl\.fromTo\(document\.documentElement, \{ '--panel-cover': 0, '--panel-ink': 0 \}, \{ '--panel-cover': 1, '--panel-ink': 1 \}, 0\);/);
  const body = shell.slice(shell.indexOf('export function buildShellTimeline'));
  assert.ok(body.indexOf("'--panel-cover'") > body.indexOf('tl.to(main, {'), 'added beside the page tween, with the timeline defaults');
  assert.doesNotMatch(body.slice(body.indexOf("'--panel-cover'"), body.indexOf('\n', body.indexOf("'--panel-cover'"))), /duration|ease/);
});

test('past the ends of the page Safari shows the root colour, so the body stays clear', () => {
  // WebKit blends the body's background over the root's for the colour past the
  // page's ends (documentBackgroundColor): an ink body put a black box under the
  // status bar at the top of every page and under the toolbar at the end of
  // every course page.
  const global = read('../src/styles/global.scss');
  const clear = global.search(/html\[data-scroll-mode='document'\] body \{\s*background-color: transparent;\s*\}/);
  assert.ok(clear !== -1);
  // Same specificity as the open panels' body rule, so it must come after it.
  assert.ok(clear > global.indexOf("html[data-browser-surface='dark'] body {"));
  assert.doesNotMatch(global, /html\[data-scroll-mode='document'\] body \{\s*background-color: var\(--black\)/);
  // The dark panels keep their ink fallback, on the app's root instead.
  const app = read('../src/pages/app.module.scss');
  const documentMode = app.slice(app.indexOf(":global(html[data-scroll-mode='document']) {"));
  assert.match(documentMode, /\.root \{[^}]*background-color: var\(--black\);[^}]*\}/);
});

test('while a panel shrinks the page, the colour past its ends goes from the page\'s to the ink with it', () => {
  const global = read('../src/styles/global.scss');
  const supports = global.slice(global.indexOf('@supports (background-color: color-mix(in srgb, red 50%, blue)) {'));
  const block = supports.slice(0, supports.indexOf('\n}'));
  assert.match(block, /html\[data-scroll-mode='document'\]\[data-page-shrunk\] \{\s*background-color: color-mix\(in srgb, var\(--black\) calc\(var\(--panel-ink, 1\) \* 100%\), var\(--pageUnderGrain\)\);\s*\}/);
  // Where the dark footer was at the bottom before the tap it was the ink, and stays so.
  assert.match(block, /html\[data-scroll-mode='document'\]\[data-page-shrunk\]\[data-footer-bottom='dark'\] \{\s*background-color: var\(--black\);\s*\}/);
  // Not "at the end" (data-edge-end): the shell's page border lengthens the document
  // by a few pixels, which moved the end off the bar and turned that colour to paper.
  assert.doesNotMatch(block, /data-edge-end/);
  // After the open panels' and the dark footer's root rules, at equal or higher specificity.
  const at = global.indexOf('@supports (background-color: color-mix(');
  assert.ok(at > global.indexOf("html[data-browser-surface='dark'],"));
  assert.ok(at > global.indexOf("html[data-scroll-mode='document'][data-browser-bottom='dark'] {"));
});

test('the shared canvas drops a View\'s last frame once nothing draws', () => {
  const app = read('../src/pages/_app.page.jsx');
  assert.match(app, /<ClearViews \/>[\s\S]*<View\.Port \/>/);
  // The production component, evaluated from its source against a stub renderer.
  const source = read('../src/components/canvas/ClearViews.jsx')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*$/gm, '')
    .replace('export default ClearViews;', 'return ClearViews;');
  let frame;
  let priority;
  const ClearViews = new Function('useRef', 'useFrame', source)(
    (value) => ({ current: value }),
    (callback, order) => {
      frame = callback;
      priority = order;
    },
  );
  ClearViews();
  // drei Views draw at priority 1 and up, after this.
  assert.equal(priority, 0);
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
  // Inside a dark panel, wherever the artwork is not painted, the ink shows (the
  // app's root; past the page's ends Safari shows the root colour, see above).
  const documentMode = read('../src/pages/app.module.scss');
  assert.match(documentMode.slice(documentMode.indexOf(":global(html[data-scroll-mode='document']) {")), /\.root \{[^}]*background-color: var\(--black\);/);
  // Safari shows the artwork's reach under its bottom bar. A fixed layer that
  // shades it at the layout viewport's bottom edge (#67 faded it to ink there)
  // ends in a line where the bar begins, so the fixed fade is invisible...
  const app = read('../src/pages/app.module.scss');
  const background = app.slice(app.indexOf("  .background {\n    background-color: transparent;"));
  const fade = background.slice(background.indexOf('&::after {'), background.indexOf('}', background.indexOf('&::after {')));
  assert.match(fade, /position: fixed;[^}]*bottom: 0;[^}]*height: var\(--dark-end-fade-height\);[^}]*background-image: var\(--dark-end-fade\);/);
  assert.match(fade, /opacity: 0;/);
  // It replaces the page's own fade in the same frame, so it must not fade in.
  assert.doesNotMatch(fade, /transition/);
  // ...except while a page that ends dark bounces past its end, where the artwork
  // shows between the end and the bar, and Safari's flat ink under the bar.
  assert.match(app, /:global\(html\[data-scroll-mode='document'\]\[data-edge-past='end'\]\) \.background::after \{\s*opacity: 1;\s*\}/);
  assert.equal((app.match(/\.background::after/g) || []).length, 1);
  // The moving footer (its reveal translates it) does not fade to ink itself:
  // when the page bounces past its end, the artwork under it would meet that ink
  // in a hard edge. The page's own fade is on the wrapper (next test).
  const footer = read('../src/components/dom/styles/footer.module.scss');
  assert.doesNotMatch(footer, /linear-gradient/);
});

test('a page that ends dark fades into the ink over its own last stretch, so its end crosses the toolbar without an edge', () => {
  // Past the end Safari paints the root's flat ink, and during the last stretch of
  // scrolling the end crosses the area under the toolbar, where Safari shows the
  // page and the lit artwork through the footer: a dark box rose from the bottom
  // of the screen on the Desk, Courses, Privacy and Website updates.
  const global = read('../src/styles/global.scss');
  const documentMode = global.slice(global.indexOf("html[data-scroll-mode='document'] {\n  overflow-x"));
  const shared = documentMode.slice(0, documentMode.indexOf('body {'));
  assert.match(shared, /--dark-end-fade-height: \d+px;/);
  const gradient = shared.slice(shared.indexOf('--dark-end-fade: linear-gradient('), shared.indexOf(');', shared.indexOf('--dark-end-fade: linear-gradient(')));
  // From clear to exactly the colour past a dark end (the root's, var(--black)).
  assert.match(gradient, /linear-gradient\(\s*to bottom,\s*rgba\(var\(--inkRgb\), 0\),/);
  assert.match(gradient, /,\s*var\(--black\)\s*$/);
  assert.match(global, /html\[data-scroll-mode='document'\]\[data-browser-bottom='dark'\] \{\s*background-color: var\(--black\);/);
  // Eased: the shade only ever increases, and gently at both ends.
  const stops = [...gradient.matchAll(/rgba\(var\(--inkRgb\), ([\d.]+)\)(?: ([\d.]+)%)?/g)].map((match) => Number(match[1]));
  assert.ok(stops.length >= 5 && stops.every((value, i) => i === 0 || value > stops[i - 1]), `rising stops: ${stops}`);
  assert.ok(stops[1] < 0.1 && stops.at(-1) > 0.9, `soft at both ends: ${stops}`);
  // On the wrapper that ends the document, not on the footer inside it, which its
  // reveal moves up from the end; behind the footer's content, above the artwork.
  const layoutJsx = read('../src/components/dom/Layout.jsx');
  assert.match(layoutJsx, /<footer className=\{styles\.footer\}>\s*<Footer \/>\s*<\/footer>/);
  const layout = read('../src/components/dom/styles/layout.module.scss');
  const own = layout.slice(layout.indexOf(":global(html[data-scroll-mode='document']) .footer {"));
  assert.match(own, /^:global\(html\[data-scroll-mode='document'\]\) \.footer \{\s*position: relative;/);
  const after = own.slice(own.indexOf('&::after {'), own.indexOf('}', own.indexOf('&::after {')));
  assert.match(after, /position: absolute;[^}]*bottom: 0;[^}]*height: var\(--dark-end-fade-height\);[^}]*z-index: -1;[^}]*background-image: var\(--dark-end-fade\);/);
  assert.doesNotMatch(after, /position: fixed/);
  // While the page bounces past its end the fixed copy (above) takes over, in the same frame.
  assert.match(layout, /:global\(html\[data-scroll-mode='document'\]\[data-edge-past='end'\]\) \.footer::after \{\s*visibility: hidden;\s*\}/);
  // Leaving from an open panel the paper rises behind the shrunk page (#routePaper,
  // below main): the page's own fade would stay over it as an ink band.
  assert.match(layout, /:global\(html\[data-scroll-mode='document'\]\[data-page-shrunk\]\[data-footer-bottom='light'\]\) \.footer::after \{\s*visibility: hidden;\s*\}/);
  const shell = read('../src/components/dom/navbar/panelShell.js');
  assert.match(shell.slice(shell.indexOf('export function fadePanelEdges')), /root\.dataset\.footerBottom = 'light';/);
  assert.doesNotMatch(layout, /transition/);
  // Document mode only: on computers `main` scrolls and no browser bar is involved.
  assert.doesNotMatch(layout.replace(/\/\/.*$/gm, '').slice(0, layout.replace(/\/\/.*$/gm, '').indexOf(':global(')), /::after/);
});

test('the footer\'s colour before the tap is kept while the page is shrunk', () => {
  // The shell's border and transform move the footer; the navbar must not re-read it then.
  const navbar = read('../src/components/dom/navbar/Index.jsx');
  const update = navbar.slice(navbar.indexOf('const update = () => {'), navbar.indexOf('const edges = () => {'));
  assert.match(update, /if \(!\('pageShrunk' in root\.dataset\)\) root\.dataset\.footerBottom = darkFooter \? 'dark' : 'light';/);
  // Not tied to the open panels, unlike data-browser-bottom.
  assert.doesNotMatch(update.slice(update.indexOf('root.dataset.footerBottom')), /overlay/);
});

test('leaving for another page from an open panel lifts the colour past the ends with the paper', () => {
  const shell = read('../src/components/dom/navbar/panelShell.js');
  const fade = shell.slice(shell.indexOf('export function fadePanelEdges(duration) {'), shell.indexOf('export function buildShellTimeline'));
  assert.match(fade, /if \(!\('pageShrunk' in root\.dataset\)\) return;/);
  assert.match(fade, /root\.dataset\.footerBottom = 'light';/);
  // Only the colour: --panel-cover would widen the still visible card's clip.
  assert.match(fade, /gsap\.to\(root, \{ '--panel-ink': 0, duration, ease: 'power2\.out' \}\);/);
  assert.doesNotMatch(fade, /--panel-cover/);
  const layout = read('../src/components/dom/Layout.jsx');
  const exit = layout.slice(layout.indexOf('const handleExit = () => {'), layout.indexOf('const handleEnter = () => {'));
  const paper = exit.slice(exit.indexOf('// The paper fade.'));
  assert.match(paper, /if \(ios && panelOpen\) fadePanelEdges\(fade\.paper \/ 1000\);/);
});
