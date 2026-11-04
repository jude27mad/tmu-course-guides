import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import gsapPackage from 'gsap';

const { gsap } = gsapPackage;
const require = createRequire(import.meta.url);

// A page chosen in Menu or Search (the hand-off): the panel's rows leave at the tap,
// the old page changes behind them while it is still the dim card the shell made of
// it, and the new page grows back out of that card. The owner's iPhone showed the old
// page, the dark menu and the new page overlapping in a washed grey mix instead.

// The production helpers, with the bundler's default import and @src aliases resolved
// (as artwork-navigation.test.mjs does).
async function loadShell() {
  const source = (await readFile(new URL('../src/components/dom/navbar/panelShell.js', import.meta.url), 'utf8'))
    .replace("import gsap from 'gsap';", `import { gsap } from '${pathToFileURL(require.resolve('gsap')).href}';`)
    .replace("'@src/lib/palette.mjs'", `'${new URL('../src/lib/palette.mjs', import.meta.url).href}'`)
    .replace("'@src/utils/scrollRoot'", `'${new URL('../src/utils/scrollRoot.js', import.meta.url).href}'`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

// An element that records its Web Animations.
const element = (computed, props = {}) => ({
  computed,
  animations: [],
  animate(keyframes, timing) {
    const animation = { keyframes, timing, cancel() {} };
    this.animations.push(animation);
    return animation;
  },
  ...props,
});

function withDocument({ ios }, run) {
  const saved = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  const properties = {};
  const root = {
    dataset: ios ? { scrollMode: 'document', pageShrunk: '', footerBottom: 'dark' } : { scrollMode: 'contained' },
    style: { setProperty: (name, value) => { properties[name] = value; }, removeProperty: (name) => { delete properties[name]; } },
  };
  // The shell left the page as a card: shifted 40vw left of a 390px screen, scaled 0.9, with rounded corners.
  const main = element({ left: '-156px', borderTopLeftRadius: '5.4px' }, { scaleX: 0.9, offsetTop: 0, offsetHeight: 2400, offsetParent: null });
  const layout = element({ opacity: '0.05' });
  const header = element({});
  const scene = element({});
  globalThis.document = { documentElement: root, querySelector: (selector) => (selector === 'main' ? main : null) };
  globalThis.window = { scrollY: 0, innerHeight: 844, addEventListener() {}, removeEventListener() {} };
  globalThis.getComputedStyle = (node) => node.computed;
  try {
    return run({ root, properties, main, layout, header, scene });
  } finally {
    gsap.killTweensOf([main, layout, header, scene, root]);
    gsap.ticker.sleep();
    Object.entries(saved).forEach(([key, value]) => {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    });
  }
}

const find = (node, property) => node.animations.find((animation) => property in animation.keyframes);

test('a page chosen in the menu grows back from the card the panel made, as the dark recedes', async () => {
  const { growPageBack, HANDOFF } = await loadShell();
  withDocument({ ios: false }, ({ main, layout, header, scene }) => {
    const { anims, edges } = growPageBack({ main, layout, header, scene });
    assert.equal(edges, null, "Safari's edges are only on iPhone and iPad");
    // The card: from where the shell left it to full size, its corners rounding off.
    const card = find(main, 'transform');
    assert.deepEqual(card.keyframes.transform, ['translate(-156px, 0px) scale(0.9)', 'none']);
    assert.equal(card.timing.duration, HANDOFF.grow);
    assert.deepEqual(find(main, 'borderRadius').keyframes.borderRadius, ['5.4px', '0px']);
    // The new page is lit before it has moved much, and the dark recedes from the
    // panel's dim well before the card settles.
    assert.deepEqual(find(main, 'opacity').keyframes.opacity, [0, 1]);
    assert.deepEqual(find(layout, 'opacity').keyframes.opacity, [0.05, 1]);
    assert.ok(find(main, 'opacity').timing.duration < find(layout, 'opacity').timing.duration);
    assert.ok(HANDOFF.light < HANDOFF.grow);
    // Every animation holds its end state until the route clears it.
    assert.ok(anims.every((animation) => animation.timing.fill === 'both'));
    // The header and the 3D layer come in as the card settles, not while it moves.
    const headerIn = find(header, 'opacity').timing;
    const sceneIn = find(scene, 'opacity').timing;
    assert.ok(headerIn.delay > HANDOFF.grow / 2 && sceneIn.delay >= headerIn.delay);
    assert.ok(headerIn.delay + headerIn.duration <= HANDOFF.grow && sceneIn.delay + sceneIn.duration <= HANDOFF.grow, 'both are in by the time the card has arrived');
    // Underneath, the page is already at rest: no shell offset, edge or dim is left behind.
    assert.equal(Number(layout.opacity), 1);
    assert.equal(Number(main.opacity), 1);
    assert.equal(main.pointerEvents, 'auto');
    assert.equal(Number(header.left), 0);
    assert.equal(Number(header.scale), 1);
  });
});

test("on iPhone and iPad the card is refitted to the new page and Safari's edges come back with it", async () => {
  const { growPageBack, HANDOFF } = await loadShell();
  withDocument({ ios: true }, ({ root, properties, main, layout, header, scene }) => {
    const { edges } = growPageBack({ main, layout, header, scene });
    // Refitted at the new page's top: one screen, scaled about its middle.
    assert.equal(properties['--page-clip-top'], '0px');
    assert.equal(properties['--page-clip-bottom'], `${2400 - 844}px`);
    assert.equal(main.transformOrigin, '50% 422px');
    // The new page opens at its light top, and Safari's colour past its ends and the
    // card's reach under the bars start from the panel's and return to the page's.
    assert.equal(root.dataset.footerBottom, 'light');
    assert.equal(root['--panel-cover'], 1);
    assert.equal(root['--panel-ink'], 1);
    assert.ok(edges.paused(), 'Layout starts it on the next tick, with the animations');
    assert.equal(edges.duration(), HANDOFF.grow / 1000);
    edges.progress(0.5);
    assert.ok(root['--panel-cover'] > 0 && root['--panel-cover'] < 1);
    edges.progress(1);
    assert.equal(root['--panel-cover'], 0);
    assert.equal(root['--panel-ink'], 0);
    edges.kill();
  });
});

test("Safari's edges keep time with the card: the GSAP ease is the card's CSS curve", async () => {
  const { cubicBezier } = await loadShell();
  // CSS's named curves, sampled where their values are known.
  const linear = cubicBezier(0, 0, 1, 1);
  [0, 0.25, 0.5, 0.75, 1].forEach((x) => assert.ok(Math.abs(linear(x) - x) < 1e-5));
  const ease = cubicBezier(0.25, 0.1, 0.25, 1);
  assert.ok(Math.abs(ease(0.5) - 0.8024) < 1e-3, `ease(0.5) is about 0.8024, got ${ease(0.5)}`);
  const inOut = cubicBezier(0.42, 0, 0.58, 1);
  assert.ok(Math.abs(inOut(0.5) - 0.5) < 1e-4);
  assert.ok(Math.abs(inOut(0.25) + inOut(0.75) - 1) < 1e-4, 'ease-in-out is symmetric');
  // Monotonic from 0 to 1, the card's curve included.
  const layout = await readFile(new URL('../src/components/dom/navbar/panelShell.js', import.meta.url), 'utf8');
  const curve = JSON.parse(layout.match(/const GROW_CURVE = (\[[^\]]+\]);/)[1]);
  const grow = cubicBezier(...curve);
  let previous = 0;
  for (let x = 0; x <= 1.0001; x += 0.01) {
    const y = grow(Math.min(1, x));
    assert.ok(y >= previous - 1e-9, `rises at ${x}`);
    previous = y;
  }
  assert.equal(grow(0), 0);
  assert.equal(grow(1), 1);
});

test("the panel's rows fade where they stand, and come back when the animation is cancelled", async () => {
  const { fadePanelRows, HANDOFF } = await loadShell();
  const rows = element({});
  const fade = fadePanelRows({ firstElementChild: rows });
  assert.deepEqual(fade.keyframes.opacity, [1, 0]);
  assert.equal(fade.timing.duration, HANDOFF.rows);
  assert.equal(fade.timing.fill, 'forwards', 'they stay hidden until the panel is');
  assert.equal(fadePanelRows(null), null);
});

test("Layout hands a page chosen in a panel to the hand-off, and puts the panel's rows back", async () => {
  const layout = await readFile(new URL('../src/components/dom/Layout.jsx', import.meta.url), 'utf8');
  const exit = layout.slice(layout.indexOf('const handleExit = () => {'), layout.indexOf('const handleEnter = () => {'));
  // Chosen with motion on and no swipe of Safari's own; the panel is found before it closes.
  assert.ok(exit.indexOf("panel = document.getElementById('search')") < exit.indexOf('closePanels();'));
  assert.match(exit, /const handoff = !!panel && !state\.still && !swiped;/);
  assert.match(exit, /state\.setIsTransitioning\(handoff \? 'handoff' : true\);/);
  // The rows start to leave at the tap (or here, if the tap's fade did not run), and
  // the exit ends with them; the new page then mounts under the held shell.
  assert.match(layout, /router\.events\.on\('routeChangeStart', onStart\);/);
  assert.match(exit, /if \(!run\.rows\) run\.rows = fadePanelRows\(panel\);/);
  assert.match(exit, /const out = \{ duration: Math\.max\(hidden \? 0 : HANDOFF\.out, rowsLeft\), easing: EASE\.in, fill: 'both' \};/);
  // The old page, the 3D layer and the scrollbar leave together and stay hidden until it is replaced.
  assert.match(exit, /const leaving = \[main, viewCanvas\(\), document\.getElementById\('scrollbar'\)\]\.filter\(Boolean\);\s*playPhase\(\s*run,\s*leaving\.map\(\(el\) => el\.animate\(\{ opacity: 0 \}, out\)\),\s*covered,\s*\);/);
  // They come back if the page could not be opened, or once the panel is hidden.
  assert.match(layout, /router\.events\.on\('routeChangeError', onSettled\);/);
  const finish = layout.slice(layout.indexOf('const finishEnter = () => {'), layout.indexOf('const handleExit = () => {'));
  assert.match(finish, /showPanelRows\(run\);/);
  // A stopped phase (a second change) must not write the faded rows into their style.
  const stop = layout.slice(layout.indexOf('const stopMotion = (run) => {'), layout.indexOf('const finishPhase = () => {'));
  assert.doesNotMatch(stop, /rows/);
  // The held shell never reverses to bring the pointer fluid back.
  assert.match(finish, /if \(nativeIOSScroll\(\) \|\| run\.plan === 'handoff'\) \{\s*const fluid/);
});
