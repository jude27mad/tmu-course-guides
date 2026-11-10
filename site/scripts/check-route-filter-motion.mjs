// Run against the production export in GitHub CI. The owner's recording showed
// a document-height page being scaled/slid beside the route loader on iPhone.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-route-filter-motion';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
// Read the actual renderer stores without adding a production debug API.
const observeCanvasStores = (page) => page.addInitScript(() => {
  window.canvasStores = new Set();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => 1,
    onCommitFiberRoot: (_, root) => {
      if (root.containerInfo?.getState) window.canvasStores.add(root.containerInfo);
    },
    onCommitFiberUnmount: () => {},
  };
});
// Keep sideways-scroll coverage on both the Safari document shell and the
// contained desktop/Android shell without resetting the vertical position.
const assertPageWidth = async (page) => {
  const bounds = await page.evaluate(() => {
    const main = document.querySelector('main');
    main.scrollTo({ left: innerWidth * 0.6, top: main.scrollTop, behavior: 'instant' });
    window.scrollTo({ left: innerWidth * 0.6, top: scrollY, behavior: 'instant' });
    const rect = main.getBoundingClientRect();
    return { rootX: scrollX, mainX: main.scrollLeft, width: innerWidth,
      contentWidth: document.documentElement.scrollWidth, left: rect.left, right: rect.right };
  });
  assert.ok(bounds.contentWidth <= bounds.width + 1 && Math.abs(bounds.rootX) < 1 && Math.abs(bounds.mainX) < 1
    && Math.abs(bounds.left) < 1 && Math.abs(bounds.right - bounds.width) < 1,
  `the page cannot shift sideways: ${JSON.stringify(bounds)}`);
};

// These are compiled page-geometry checks. Linux WebKit does not render the
// real iPhone browser bars; physical Safari still supplies final visual evidence.
const assertSafariDocumentShell = async (page, darkEnd = false) => {
  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const main = document.querySelector('main');
    const fluid = document.querySelector('#fluidCanvas');
    const view = document.querySelector('#viewCanvas').getBoundingClientRect();
    return {
      mode: root.dataset.scrollMode,
      mainPosition: getComputedStyle(main).position,
      mainOverflow: getComputedStyle(main).overflowY,
      mainScrollTop: main.scrollTop,
      documentHeight: document.scrollingElement.scrollHeight,
      viewport: innerHeight,
      rootBackground: getComputedStyle(root).backgroundColor,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      fluidBackground: fluid ? getComputedStyle(fluid).backgroundColor : null,
      view: { top: view.top, bottom: view.bottom },
      guards: [...document.querySelectorAll('[data-safari-blend]')].map(node => {
        const css = getComputedStyle(node);
        return { display: css.display, position: css.position, background: css.backgroundColor, pointerEvents: css.pointerEvents };
      }),
      edgeEnd: root.dataset.edgeEnd,
    };
  });
  assert.equal(state.mode, 'document', 'iOS must activate Claude’s Safari integration');
  assert.equal(state.mainPosition, 'relative');
  assert.equal(state.mainOverflow, 'visible', 'main must not become a nested scroll box');
  assert.equal(state.mainScrollTop, 0, 'the document owns iOS scroll position');
  assert.ok(state.documentHeight > state.viewport, 'the document is the scrollable page');
  assert.equal(state.rootBackground, darkEnd ? 'rgb(24, 24, 27)' : 'rgb(241, 241, 241)');
  // Past the page's ends Safari paints the root's colour with the body's blended
  // over it: an opaque body put a black box past every light end.
  assert.equal(state.bodyBackground, 'rgba(0, 0, 0, 0)', 'the body must not tint Safari\'s colour past the page\'s ends');
  assert.ok(state.fluidBackground === null || state.fluidBackground === 'rgba(0, 0, 0, 0)', 'the fluid wrapper must not force a solid Safari band');
  assert.ok(state.view.top < 0 && state.view.bottom > state.viewport, 'the shared artwork reaches beyond both browser edges');
  assert.equal(state.guards.length, 2);
  for (const guard of state.guards) {
    assert.notEqual(guard.display, 'none');
    assert.equal(guard.position, 'sticky');
    assert.equal(guard.background, 'rgba(0, 0, 0, 0)');
    assert.equal(guard.pointerEvents, 'auto');
  }
  assert.equal(state.edgeEnd, darkEnd ? 'dark' : 'none');
  return state;
};
// What Safari shows under its bars while Menu or Search shrinks the page, every
// frame of an open and a close. Under the status bar and the toolbar it shows the
// page itself and, past the page's ends, one flat colour: the root's with the
// body's blended over it. The owner's iPhone showed both bands turn dark at the
// tap, with the page still full size, and stay dark until a close had finished:
// the shrunk page's clip cut it at the layout viewport, and the root and body
// turned to the ink at once. Bars as large as Safari's in either layout.
const STATUS_BAR = 62;
const TOOLBAR = 98;
async function recordShellBands(page, run) {
  await page.evaluate(() => {
    window.shellBands = [];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const px = (value) => parseFloat(value) || 0;
    const sample = () => {
      const root = document.documentElement;
      const main = document.querySelector('main');
      const rect = main.getBoundingClientRect();
      const style = getComputedStyle(main);
      const scale = style.transform === 'none' ? 1 : new DOMMatrix(style.transform).a;
      const rootStyle = getComputedStyle(root);
      const shrunk = root.dataset.pageShrunk !== undefined;
      const cover = shrunk ? Number(rootStyle.getPropertyValue('--panel-cover') || 1) : 0;
      // The clip the browser applies, in main's own pixels (inset(top right bottom
      // left round r), in any of its shortened forms).
      const clipPath = style.clipPath || style.webkitClipPath || 'none';
      const lengths = clipPath.startsWith('inset(') ? clipPath.slice(6).split(/\sround\s|\)/)[0].trim().split(/\s+/) : [];
      const resolved = lengths.length > 0 && lengths.every((length) => /^-?[\d.]+(e-?\d+)?px$|^0$/.test(length));
      // What global.scss's [data-page-shrunk] #main asks for, should a browser keep
      // its math unresolved in the computed value.
      const askedTop = Math.max(0, px(rootStyle.getPropertyValue('--page-clip-top')) - (1 - cover) * px(rootStyle.getPropertyValue('--edge-bleed-top')));
      const askedBottom = Math.max(0, px(rootStyle.getPropertyValue('--page-clip-bottom')) - (1 - cover) * px(rootStyle.getPropertyValue('--edge-bleed-bottom')));
      const insetTop = !shrunk ? 0 : resolved ? px(lengths[0]) : askedTop;
      const insetBottom = !shrunk ? 0 : resolved ? px(lengths[lengths.length >= 3 ? 2 : 0]) : askedBottom;
      const [r, g, b] = rgba(rootStyle.backgroundColor);
      const [R, G, B, A] = rgba(getComputedStyle(document.body).backgroundColor);
      const a = A / 255;
      window.shellBands.push({
        time: performance.now(),
        phase: window.shellPhase,
        shrunk,
        cover,
        clipPath,
        resolved,
        scale,
        cardTop: rect.top + insetTop * scale,
        cardBottom: rect.bottom - insetBottom * scale,
        documentTop: -scrollY,
        documentBottom: document.scrollingElement.scrollHeight - scrollY,
        viewport: innerHeight,
        flat: [r * (1 - a) + R * a, g * (1 - a) + G * a, b * (1 - a) + B * a].map(Math.round),
      });
      window.shellBandsFrame = requestAnimationFrame(sample);
    };
    window.shellPhase = 'before';
    sample();
  });
  try {
    await run((phase) => page.evaluate((value) => { window.shellPhase = value; }, phase));
  } finally {
    await page.evaluate(() => cancelAnimationFrame(window.shellBandsFrame));
  }
  return page.evaluate(() => window.shellBands);
}
function assertShellBands(frames, label) {
  const near = (color, target, tolerance = 12) => color.every((channel, i) => Math.abs(channel - target[i]) <= tolerance);
  const rest = frames.find((frame) => frame.phase === 'before').flat;
  const ink = [24, 24, 27];
  // The shrunk page is clipped (a browser that dropped the clip would show a strip
  // of the whole document).
  const unclipped = frames.filter((frame) => frame.shrunk && !frame.clipPath.startsWith('inset('));
  assert.deepEqual(unclipped.slice(0, 2), [], `${label}: the shrunk page is clipped`);
  // While the page still fills the screen, both bands show what they showed
  // before the tap: the page wherever the document reaches under a bar, and the
  // page's own flat colour past its ends.
  // The page's own shrink moves its edges by up to (1 - scale) of the viewport.
  const full = frames.filter((frame) => frame.shrunk && frame.scale > 0.997);
  for (const phase of ['opening', 'closing']) {
    if (full.some((frame) => frame.phase === phase)) continue;
    // That window is the first or last ~0.27 s of the 0.92 s shell. Only a runner
    // that skipped it in one long frame may miss it; then say so and go on.
    const times = frames.filter((frame) => frame.phase === phase).map((frame) => frame.time);
    const gap = Math.max(0, ...times.slice(1).map((time, i) => time - times[i]));
    assert.ok(gap > 150, `${label}: sample the full-size page while ${phase} (longest frame ${Math.round(gap)} ms)`);
    console.log(`NOTE ${label}: no full-size frame sampled while ${phase}; the runner skipped ${Math.round(gap)} ms in one frame`);
  }
  const cut = full.filter((frame) => {
    const shrink = (1 - frame.scale) * frame.viewport + 1;
    return frame.cardBottom < Math.min(frame.documentBottom, frame.viewport + TOOLBAR) - shrink ||
      frame.cardTop > Math.max(frame.documentTop, -STATUS_BAR) + shrink;
  });
  assert.deepEqual(cut.slice(0, 4), [], `${label}: the full-size page continues under both bars`);
  const tinted = full.filter((frame) => !near(frame.flat, rest, 8));
  assert.deepEqual(tinted.slice(0, 4), [], `${label}: the colour past the page's ends stays the page's while it fills the screen (${rest})`);
  // Open: the card sits inside the layout viewport, and Safari's flat colour is the panel's ink.
  const open = frames.filter((frame) => frame.phase === 'open');
  assert.ok(open.length, `${label}: sample the open panel`);
  assert.ok(open.every((frame) => frame.shrunk && frame.cardTop > -1 && frame.cardBottom < frame.viewport + 1 && near(frame.flat, ink, 2)),
    `${label}: the open card lies between the bars, on the ink: ${JSON.stringify(open.at(-1))}`);
  // Closed: back to the page's own colour.
  const after = frames.filter((frame) => frame.phase === 'closing' && !frame.shrunk);
  assert.ok(after.length && after.every((frame) => near(frame.flat, rest, 0)), `${label}: the closed page is back on its own colour`);
  return { rest, frames: frames.length, fullSize: full.length, clipResolved: frames.filter((frame) => frame.shrunk).every((frame) => frame.resolved) };
}

const ready = async (page) => {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return main && getComputedStyle(main).opacity === '1' &&
      !document.querySelector('.lenis-stopped') &&
      !document.querySelector('#layout[inert]') &&
      getComputedStyle(document.querySelector('#loader')).display === 'none';
  });
  await page.evaluate(() => document.fonts.ready);
};
const settled = (page) => page.waitForFunction(() => {
  const content = document.querySelector('#course-content');
  const results = document.querySelector('[data-work-results]');
  return content && !content.inert && getComputedStyle(content).opacity === '1' &&
    (!results || (!results.inert && getComputedStyle(results).opacity === '1'));
});

// Samples every frame of a page change: how much of the dark artwork behind the pages
// shows through (the page fades into the paper layer, never into the artwork), and the
// arriving page's geometry. The owner's iPhone showed the dark artwork full screen.
const startRouteFrames = (page) => page.evaluate(() => {
  window.routeFrames = [];
  window.routeDocument = true;
  const shown = (element) => {
    if (!element) return 0;
    const style = getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' ? 0 : Number(style.opacity);
  };
  const sample = () => {
    const main = document.querySelector('main');
    const rect = main.getBoundingClientRect();
    const heading = main.querySelector('h1');
    const paper = document.querySelector('#routePaper');
    const area = paper.getBoundingClientRect();
    const covers = area.top <= 0 && area.left <= 0 && area.bottom >= innerHeight && area.right >= innerWidth;
    const opacity = shown(main);
    const paperOpacity = shown(paper);
    const layout = Number(getComputedStyle(document.querySelector('#layout')).opacity);
    window.routeFrames.push({
      time: performance.now(), title: heading?.textContent, left: rect.left, width: rect.width,
      headingTop: heading?.getBoundingClientRect().top, opacity, paper: paperOpacity, paperCovers: covers,
      exposure: 1 - layout * (1 - (1 - opacity) * (1 - (covers ? paperOpacity : 0))),
      menu: Number(getComputedStyle(document.querySelector('#menu')).opacity), viewport: innerWidth,
      // The menu's rows as shown (the hand-off fades them inside the panel).
      rows: shown(document.querySelector('#menu')) * shown(document.querySelector('#menu > nav')),
      // The page as a card behind a panel, clipped to one screen (iPhone and iPad).
      shrunk: 'pageShrunk' in document.documentElement.dataset, clipped: getComputedStyle(main).clipPath.startsWith('inset('),
      loader: getComputedStyle(document.querySelector('#loader')).display,
    });
    window.routeFrame = requestAnimationFrame(sample);
  };
  sample();
});
// The page can be ready before the next animation frame. Let the sampler record the
// arrived page (two frames) before stopping it; a busy runner otherwise had none.
const stopRouteFrames = (page) => page.evaluate(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  cancelAnimationFrame(window.routeFrame);
  return window.routeFrames;
});
const MAX_EXPOSURE = 0.1;
// From an open panel the change starts on the dark artwork that the shell
// uncovered (Giats's menu): from the first frame the paper (or the arriving
// page) covers it, the artwork must not show through again.
function assertPaperFade(frames, label, { fromPanel = false } = {}) {
  const start = fromPanel ? frames.findIndex((frame) => frame.exposure <= MAX_EXPOSURE) : 0;
  assert.ok(start !== -1, `${label}: the page change covers the artwork`);
  const exposed = frames.slice(start).filter((frame) => frame.exposure > MAX_EXPOSURE);
  assert.deepEqual(exposed.slice(0, 4), [], `${label}: the dark artwork must not show through a changing page`);
  assert.ok(frames.every((frame) => !frame.paper || frame.paperCovers), `${label}: the paper covers the screen whenever it is shown`);
}

async function check(browser, options, name, run) {
  const context = await browser.newContext({ ...options, recordVideo: { dir: path.join(report, 'videos'), size: { width: 834, height: 1024 } } });
  const errors = [];
  context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  try {
    const detail = await run(page);
    assert.deepEqual(errors, [], 'no page errors');
    results.push({ name, pass: true, detail });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, pass: false, error: error.stack || error.message, errors });
    console.error(`::error::${name}: ${error.message}`);
    await page.screenshot({ path: path.join(report, `${name}-failure.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
}

async function checkMobileMenu(page, name) {
  const opener = page.getByRole('button', { name: 'Open menu', exact: true });
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  const firstControl = page.locator('#menu button[aria-controls="search"]');
  // A small real scroll keeps the header reachable while making scroll
  // preservation meaningful on both document and contained scroll layouts.
  // Reduced-motion entry can queue its final native scroll reset after the
  // page becomes visible. Establish the test's small scroll across two frames
  // before measuring menu preservation, rather than racing that initial reset.
  await page.evaluate(() => { window.menuScrollReadyFrames = 0; });
  await page.waitForFunction(() => {
    const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
    const top = scroller === window ? scrollY : scroller.scrollTop;
    window.menuScrollReadyFrames = top > 0 ? window.menuScrollReadyFrames + 1 : 0;
    if (!top) scroller.scrollTo(0, 12);
    return window.menuScrollReadyFrames >= 2;
  });
  await opener.focus();
  const before = await page.evaluate(() => {
    window.menuFrames = [];
    window.menuPhase = 'before';
    const sample = () => {
      const main = document.querySelector('main');
      const page = main.getBoundingClientRect();
      const panel = document.querySelector('#menu');
      const menu = panel.getBoundingClientRect();
      window.menuFrames.push({
        time: performance.now(), phase: window.menuPhase,
        page: { left: page.left, top: page.top, width: page.width },
        menu: { left: menu.left, top: menu.top, width: menu.width, height: menu.height },
        viewport: { width: innerWidth, height: innerHeight },
        opacity: Number(getComputedStyle(panel).opacity), scrollY, scrollTop: main.scrollTop,
      });
      window.menuFrame = requestAnimationFrame(sample);
    };
    sample();
    return window.menuFrames[0];
  });
  assert.ok(before.scrollY > 0 || before.scrollTop > 0, 'the menu exercise starts from a scrolled page');
  let frames;
  try {
    for (const closeWithEscape of [false, true]) {
      await page.evaluate((reopened) => { window.menuPhase = reopened ? 'reopening' : 'opening'; }, closeWithEscape);
      // Safari taps do not necessarily focus their button. Reopen from body
      // focus as well as from the keyboard-focused opener used in the first pass.
      if (closeWithEscape) await opener.evaluate((button) => button.blur());
      await opener.click();
      // Open: the panel is shown and every list and row has slid in from the left.
      await page.waitForFunction(() => {
        const menu = document.querySelector('#menu');
        const settled = (item) => getComputedStyle(item).opacity === '1' && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(item).transform);
        return getComputedStyle(menu).opacity === '1' && Array.from(menu.querySelectorAll('[data-menu-anim]')).every(settled);
      }, null, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({
          open: document.querySelector('#menu').getAttribute('aria-hidden'),
          opacity: getComputedStyle(document.querySelector('#menu')).opacity,
          incomplete: Array.from(document.querySelectorAll('#menu [data-menu-anim]'))
            .filter((item) => getComputedStyle(item).opacity !== '1' || !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(item).transform))
            .slice(0, 6)
            .map((item) => ({ text: item.textContent.trim().slice(0, 40), opacity: getComputedStyle(item).opacity, transform: getComputedStyle(item).transform })),
        }));
        throw new Error(`Menu did not finish opening: ${JSON.stringify(diagnostic)}`);
      });
      // Giats's shell: the page shrinks to 90% and slides 40vw to the left, dimmed to 5%.
      await page.waitForFunction(({ width }) => {
        const rect = document.querySelector('main').getBoundingClientRect();
        return Math.abs(rect.width - width * 0.9) < 2 && Math.abs(rect.left + innerWidth * 0.35) < 2 &&
          Math.abs(Number(getComputedStyle(document.querySelector('#layout')).opacity) - 0.05) < 0.01;
      }, before.page, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({
          page: document.querySelector('main').getBoundingClientRect().toJSON(),
          layout: getComputedStyle(document.querySelector('#layout')).opacity,
          viewport: innerWidth,
        }));
        throw new Error(`The page did not shrink aside behind the open menu: ${JSON.stringify(diagnostic)}`);
      });
      // Reduced-motion iPhone Safari can leave focus on body after a touch
      // gesture. Keyboard entry must still move directly into the modal.
      await page.waitForTimeout(220);
      if (!(await firstControl.evaluate((link) => link === document.activeElement))) await page.keyboard.press('Tab');
      assert.equal(await firstControl.evaluate((link) => link === document.activeElement), true, 'phone menu receives focus automatically or on first Tab');
      const coverage = await page.evaluate(() => {
        const panel = document.querySelector('#menu');
        // Resolve any CSS color syntax through the browser; the regression is
        // transparency, so this intentionally does not pin a palette RGB value.
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = getComputedStyle(panel).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return {
          backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3],
          coversCorners: [[1, 1], [innerWidth - 1, 1], [1, innerHeight - 1], [innerWidth - 1, innerHeight - 1]]
            .every(([x, y]) => panel.contains(document.elementFromPoint(x, y))),
        };
      });
      assert.equal(coverage.backgroundAlpha, 0, 'the open phone menu has no surface of its own: the artwork shows through it');
      assert.equal(coverage.coversCorners, true, 'the phone menu covers and receives input at every viewport corner');
      if (!closeWithEscape) {
        await page.screenshot({ path: path.join(report, `${name}-open.png`) });
        await close.focus();
        await page.keyboard.press('Tab');
        assert.equal(await firstControl.evaluate((link) => link === document.activeElement), true, 'Tab from the final control wraps to the first menu action');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await close.evaluate((button) => button === document.activeElement), true, 'Shift+Tab from the first action wraps to Close menu');
      }
      await page.evaluate((escape) => { window.menuPhase = escape ? 'closing-with-escape' : 'closing-with-button'; }, closeWithEscape);
      if (closeWithEscape) await page.keyboard.press('Escape');
      else await close.click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#menu')).visibility === 'hidden');
      // Closing plays the shell backwards: the page returns exactly where it was.
      await page.waitForFunction(({ left, top, width }) => {
        const rect = document.querySelector('main').getBoundingClientRect();
        return Math.abs(rect.left - left) < 2 && Math.abs(rect.top - top) < 2 && Math.abs(rect.width - width) < 2 &&
          getComputedStyle(document.querySelector('#layout')).opacity === '1';
      }, before.page, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({ page: document.querySelector('main').getBoundingClientRect().toJSON(), layout: getComputedStyle(document.querySelector('#layout')).opacity }));
        throw new Error(`The page did not return after the menu closed: ${JSON.stringify(diagnostic)}`);
      });
      await page.waitForFunction(() => document.querySelector('#menu-button') === document.activeElement, null, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({
          active: document.activeElement?.outerHTML.slice(0, 200),
          openerInert: document.querySelector('#menu-button').inert,
          headerInert: document.querySelector('header').inert,
          headerVisibility: getComputedStyle(document.querySelector('header')).visibility,
        }));
        throw new Error(`Menu did not restore focus: ${JSON.stringify(diagnostic)}`);
      });
      assert.equal(await opener.evaluate((button) => button === document.activeElement), true, 'closing the phone menu returns focus to its opener');
    }
  } finally {
    frames = await page.evaluate(() => { cancelAnimationFrame(window.menuFrame); return window.menuFrames; });
    await writeFile(path.join(report, `${name}-frames.json`), JSON.stringify(frames, null, 2));
  }
  const moved = frames.filter((frame) => frame.phase === 'before' && ['left', 'top', 'width'].some((key) => Math.abs(frame.page[key] - before.page[key]) >= 2));
  assert.deepEqual(moved.slice(0, 4), [], 'the page stays put until the menu opens');
  // The page only ever shrinks towards Giats's card and slides left: never wider, never to the right.
  const stray = frames.filter((frame) => frame.page.width > before.page.width + 2 || frame.page.left > before.page.left + 2);
  assert.deepEqual(stray.slice(0, 4), [], 'the shrinking page never grows or moves right');
  assert.ok(frames.every((frame) => frame.scrollY === before.scrollY && frame.scrollTop === before.scrollTop), 'the phone menu preserves the page scroll throughout both open/close cycles');
  const visible = frames.filter((frame) => frame.opacity > 0);
  assert.ok(visible.length, 'sample the phone menu while visible');
  const uncovered = visible.filter(({ menu, viewport }) => Math.abs(menu.left) >= 2 || Math.abs(menu.top) >= 2 ||
    Math.abs(menu.width - viewport.width) >= 2 || Math.abs(menu.height - viewport.height) >= 2);
  assert.deepEqual(uncovered.slice(0, 4), [], 'the phone menu remains aligned with the complete viewport throughout its animation');
  return { frames: frames.length, openCloseCycles: 2, scrollY: before.scrollY, scrollTop: before.scrollTop };
}

try {
  const safari = await webkit.launch({ headless: true });
  try {
    await check(safari, devices['iPhone 13'], 'iphone-badge-first-return-frame', async (page) => {
      await observeCanvasStores(page);
      await page.goto(base);
      await ready(page);
      await page.locator('[data-course-badge]').first().scrollIntoViewIfNeeded();
      await page.locator('[data-badge-rendered="true"]').first().waitFor();
      const evidence = await page.evaluate(async () => {
        const element = document.querySelector('[data-course-badge]');
        const store = [...window.canvasStores].find(item => item.getState().gl?.domElement.closest('#viewCanvas'));
        if (!store) throw new Error('Find the shared badge renderer');
        const state = store.getState();
        const render = state.gl.render;
        let draws = 0;
        state.gl.render = function (scene, camera) {
          if (scene !== store.getState().scene) draws++;
          return render.call(this, scene, camera);
        };
        const documentMode = document.documentElement.dataset.scrollMode === 'document';
        const scroller = documentMode ? window : document.querySelector('main');
        const viewport = documentMode ? innerHeight : scroller.clientHeight;
        const top = documentMode ? scrollY : scroller.scrollTop;
        const centre = top + element.getBoundingClientRect().top - (viewport - element.offsetHeight) / 2;
        const frame = () => store.getState().advance(store.getState().clock.elapsedTime + 1 / 60, false);
        state.setFrameloop('never');
        try {
          scroller.scrollTo(0, centre + viewport * 2);
          frame();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          frame();
          const outside = element.getBoundingClientRect().bottom < 0;
          scroller.scrollTo(0, centre);
          const bounds = element.getBoundingClientRect();
          draws = 0;
          // One real renderer frame after re-entry. Waiting for another React
          // visibility commit is precisely the blank-frame regression.
          frame();
          return { outside, returned: bounds.top >= 0 && bounds.bottom <= viewport + 1, draws };
        } finally {
          state.gl.render = render;
          state.setFrameloop('always');
        }
      });
      await writeFile(path.join(report, 'iphone-badge-first-return-frame.json'), JSON.stringify(evidence, null, 2));
      assert.equal(evidence.outside, true, 'the badge really left the screen');
      assert.equal(evidence.returned, true, 'the badge really returned');
      assert.ok(evidence.draws > 0, `the first returning frame draws the badge: ${JSON.stringify(evidence)}`);
      return evidence;
    });
    // Fail fast on this drawing regression; avoid spending the entire browser
    // run checking physics poses when the viewport is visibly empty.
    assert.ok(results.at(-1).pass, 'the badge must draw on its first returning frame');
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-desk-menu-${reducedMotion}`, async (page) => {
        await page.goto(base);
        await ready(page);
        return checkMobileMenu(page, `iphone-desk-menu-${reducedMotion}`);
      });
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-menu-route-${reducedMotion}`, async (page) => {
        await page.goto(`${base}mth140/`);
        await ready(page);
        const menu = await checkMobileMenu(page, `iphone-course-menu-${reducedMotion}`);
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        // Sample from the settled open shell: the panel shown and the page dimmed behind it.
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#menu')).opacity === '1' &&
          Math.abs(Number(getComputedStyle(document.querySelector('#layout')).opacity) - 0.05) < 0.01);
        await startRouteFrames(page);
        await page.locator('#menu').getByRole('link', { name: 'CEN100', exact: true }).click();
        await page.waitForURL(`${base}cen100/`);
        await ready(page);
        const frames = await stopRouteFrames(page);
        await writeFile(path.join(report, `route-${reducedMotion}.json`), JSON.stringify(frames, null, 2));
        assertPaperFade(frames, 'from the menu', { fromPanel: true });
        const incoming = frames.filter((frame) => frame.title === 'Intro to Engineering' && frame.opacity > 0.05);
        assert.ok(incoming.length, 'sample the visible destination');
        // The hand-off: the course comes forward out of the card the menu made, the way a
        // close brings a page back. It only grows, and ends full width.
        const shrinking = incoming.slice(1).filter((frame, i) => frame.width < incoming[i].width - 1 || frame.left < incoming[i].left - 1);
        assert.deepEqual(shrinking.slice(0, 4), [], 'the arriving course only grows toward full width');
        const last = incoming.at(-1);
        assert.ok(Math.abs(last.left) < 2 && Math.abs(last.width - last.viewport) < 2, `the arriving course ends full width: ${JSON.stringify(last)}`);
        // Smaller than the screen it is one clipped card, never the document-height page scaled
        // beside a loading card (the owner's recording before the paper fade).
        const card = incoming.filter((frame) => frame.width < frame.viewport - 2);
        assert.ok(card.every((frame) => frame.shrunk && frame.clipped), `the growing course is one clipped card: ${JSON.stringify(card.find((frame) => !frame.shrunk || !frame.clipped))}`);
        // The menu's rows have gone before the course shows; nothing of the old page comes back.
        assert.ok(incoming.every((frame) => frame.rows < 0.05), `the menu's rows never sit over the arriving course: ${JSON.stringify(incoming.find((frame) => frame.rows >= 0.05))}`);
        const first = frames.indexOf(incoming[0]);
        assert.ok(frames.slice(first).every((frame) => frame.title === 'Intro to Engineering'), 'the old page never shows again once the course is in');
        assert.ok(incoming.every((frame) => frame.loader === 'none'), 'no second loading card beside the arriving course');
        assert.equal(await page.evaluate(() => window.routeDocument), true, 'client-side navigation');
        await page.getByRole('button', { name: /Guide tools/ }).click();
        await page.getByRole('dialog', { name: 'Guide tools' }).waitFor();
        await page.keyboard.press('Escape');
        await page.screenshot({ path: path.join(report, `route-${reducedMotion}.png`) });
        return { menu, incomingFrames: incoming.length, final: incoming.at(-1) };
      });
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-page-routes-${reducedMotion}`, async (page) => {
        await page.goto(base);
        await ready(page);
        const safariTop = await assertSafariDocumentShell(page);
        const routes = [];
        const follow = async (label, destination, title, navigate) => {
          await startRouteFrames(page);
          await navigate();
          await page.waitForURL(`${base}${destination}`);
          // Next changes the address before it renders the page: wait for the page itself.
          await page.waitForFunction((heading) => document.querySelector('main h1')?.textContent?.startsWith(heading), title);
          await ready(page);
          const frames = await stopRouteFrames(page);
          await writeFile(path.join(report, `page-route-${label}-${reducedMotion}.json`), JSON.stringify(frames, null, 2));
          assertPaperFade(frames, label);
          const incoming = frames.filter((frame) => frame.title?.startsWith(title) && frame.opacity > 0.05);
          assert.ok(incoming.length, `${label}: sample the visible destination: ${JSON.stringify([...new Set(frames.map((frame) => `${frame.title}@${frame.opacity}`))].slice(-6))}`);
          assert.ok(incoming.every((frame) => Math.abs(frame.left) < 2 && Math.abs(frame.width - frame.viewport) < 2 && frame.loader === 'none'), `${label}: the arriving page stays full width with no loading card`);
          // A slow runner can sample only the end of a fade. Any intermediate
          // opacity proves it ran; a 5% cutoff discarded real transition frames.
          const fading = frames.filter((frame) => frame.opacity > 0.001 && frame.opacity < 0.999);
          if (reducedMotion === 'reduce') {
            assert.deepEqual(fading.slice(0, 4), [], `${label}: with reduced motion the page changes without a fade`);
            assert.ok(frames.every((frame) => !frame.paper), `${label}: with reduced motion the paper never shows`);
          } else assert.ok(fading.length, `${label}: the page change fades`);
          assert.equal(await page.evaluate(() => window.routeDocument), true, `${label}: client-side navigation`);
          routes.push({ label, frames: frames.length, worstExposure: Math.max(...frames.map((frame) => frame.exposure)) });
        };
        // A link on the Desk, at the top of the page.
        await follow('desk-to-course', 'cen100/', 'Intro to Engineering', () => page.evaluate(() => document.querySelector('main a[href$="/cen100/"]').click()));
        // Between courses (the quick fade).
        await follow('course-to-course', 'mth140/', 'Calculus I', () => page.evaluate(() => window.next.router.push('/mth140/', undefined, { scroll: false })));
        // The footer's Desk link at the end of the page, header scrolled away.
        await page.evaluate(() => {
          const documentMode = document.documentElement.dataset.scrollMode === 'document';
          const scroller = documentMode ? window : document.querySelector('main');
          scroller.scrollTo(0, documentMode ? document.scrollingElement.scrollHeight : scroller.scrollHeight);
        });
        await page.waitForFunction(() => (document.documentElement.dataset.scrollMode === 'document' ? scrollY : document.querySelector('main').scrollTop) > 200);
        await follow('footer-to-desk', '', 'TMU Course Guides', () => page.evaluate((desk) => [...document.querySelectorAll('main a[href]')].filter((link) => new URL(link.href).pathname === desk).at(-1).click(), new URL(base).pathname));
        const top = await page.evaluate(() => ({ scrollTop: document.documentElement.dataset.scrollMode === 'document' ? scrollY : document.querySelector('main').scrollTop, header: getComputedStyle(document.querySelector('header')).opacity }));
        assert.ok(top.scrollTop <= 8, 'the Desk opens at its top');
        assert.equal(top.header, '1', 'the header is back after the change');
        // The reported box is at the dark Desk footer. Check the actual end
        // state, where Claude's root fallback and end-only fade must activate.
        await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
        await page.waitForFunction(() => document.documentElement.dataset.browserBottom === 'dark' && document.documentElement.dataset.edgeEnd === 'dark');
        const safariEnd = await assertSafariDocumentShell(page, true);
        await page.screenshot({ path: path.join(report, `safari-dark-footer-${reducedMotion}.png`) });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => document.documentElement.dataset.browserBottom === 'light' && document.documentElement.dataset.edgeEnd === 'none');
        await assertSafariDocumentShell(page);
        return { routes, safariTop, safariEnd };
      });
    }
    await check(safari, devices['iPhone 13'], 'iphone-shell-under-bars', async (page) => {
      const cycle = async (label, open, close) => {
        const frames = await recordShellBands(page, async (phase) => {
          await phase('opening');
          await open();
          await page.waitForFunction(() => {
            const transform = getComputedStyle(document.querySelector('main')).transform;
            return transform !== 'none' && Math.abs(new DOMMatrix(transform).a - 0.9) < 0.0005 &&
              Math.abs(Number(getComputedStyle(document.querySelector('#layout')).opacity) - 0.05) < 0.002;
          }, null, { timeout: 8000 });
          await phase('open');
          await page.waitForFunction(() => window.shellBands.filter((frame) => frame.phase === 'open').length >= 3);
          await phase('closing');
          await close();
          await page.waitForFunction(() => window.shellBands.filter((frame) => frame.phase === 'closing' && !frame.shrunk).length >= 3, null, { timeout: 8000 });
        });
        await writeFile(path.join(report, `shell-under-bars-${label.replace(/\W+/g, '-')}.json`), JSON.stringify(frames, null, 2));
        return assertShellBands(frames, label);
      };
      // The Desk at its top: the page reaches under the toolbar, and past its start
      // the status bar shows the flat colour.
      await page.goto(base);
      await ready(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => scrollY === 0);
      const desk = await cycle('desk-top-menu', () => page.getByRole('button', { name: 'Open menu', exact: true }).click(),
        () => page.getByRole('button', { name: 'Close menu', exact: true }).click());
      // A course at its end, where it ends light: the page reaches under the status
      // bar, and past its end the toolbar shows the flat colour. The header has
      // scrolled away, so Search opens the same shell.
      await page.goto(`${base}cen100/`);
      await ready(page);
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
      await page.waitForFunction(() => scrollY > 200 && document.documentElement.dataset.edgeBottom === 'closed');
      const course = await cycle('course-end-search', () => page.keyboard.press('Control+k'), () => page.keyboard.press('Escape'));
      // The Desk ends in the dark footer: at its end, and short of it while the
      // footer is under the toolbar, the colour past the end is the ink before the
      // tap and must stay so. (The shell's page border lengthens the document by a
      // few pixels, so "at the end" alone cannot decide it.)
      const darkEnds = {};
      for (const [label, short] of [['desk-end-search', 0], ['desk-near-end-search', 40]]) {
        await page.goto(base);
        await ready(page);
        await page.evaluate((offset) => window.scrollTo(0, document.scrollingElement.scrollHeight - innerHeight - offset), short);
        await page.waitForFunction(() => document.documentElement.dataset.browserBottom === 'dark');
        darkEnds[label] = await cycle(label, () => page.keyboard.press('Control+k'), () => page.keyboard.press('Escape'));
        assert.deepEqual(darkEnds[label].rest, [24, 24, 27], `${label}: the colour past the end is the ink before the tap`);
      }
      return { desk, course, ...darkEnds };
    });
  } finally { await safari.close(); }

  const chromePhone = await chromium.launch({ headless: true });
  try {
    await check(chromePhone, devices['Pixel 5'], 'android-desk-menu-paused', async (page) => {
      await page.goto(`${base}?motion=off`);
      await ready(page);
      return checkMobileMenu(page, 'android-desk-menu-paused');
    });
  } finally { await chromePhone.close(); }

  for (const [engine, options, label] of [
    [webkit, devices['iPhone 13'], 'iphone'],
    [webkit, { ...devices['iPhone 13'], reducedMotion: 'reduce' }, 'iphone-still'],
    [chromium, { viewport: { width: 834, height: 1024 }, hasTouch: true }, 'tablet'],
    [chromium, { viewport: { width: 1440, height: 900 } }, 'desktop'],
  ]) {
    const browser = await engine.launch({ headless: true });
    try {
      if (label === 'iphone') await check(browser, options, 'iphone-scroll-resize-continuity', async (page) => {
        // Observe the real renderers through React's instrumentation hook. No
        // production debug globals or replacement animation/physics objects.
        await observeCanvasStores(page);
        await page.goto(base);
        await ready(page);
        await page.locator('[data-companion-statement]').scrollIntoViewIfNeeded();
        await page.locator('[data-companion-game] canvas').waitFor();
        await page.waitForFunction(() => [...window.canvasStores].some(store => store.getState().gl?.domElement.closest('[data-companion-game]')));
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          window.resizeEvidence = { footerResets: 0, gamePositionUpdates: 0 };
          const footer = document.querySelector('footer > [data-surface="dark"]');
          if (!footer?.matches('[data-surface="dark"]')) throw new Error('Find the actual footer');
          window.footerResizeObserver = new MutationObserver(records => {
            window.resizeEvidence.footerResets += records.filter(record => /height:\s*auto/.test(record.oldValue || '')).length;
          });
          window.footerResizeObserver.observe(footer, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
          const backgroundMaterial = () => {
            let found;
            for (const store of window.canvasStores) store.getState().scene.traverse(object => {
              if (object.material?.uniforms?.uOffsetX) found = object.material;
            });
            return found;
          };
          window.backgroundMaterial = backgroundMaterial;
          window.backgroundBeforeResize = backgroundMaterial();
          if (!window.backgroundBeforeResize) throw new Error('Find the actual animated background');
        });
        // Real viewport changes exercise dvh and ResizeObserver too. Playwright
        // also changes svh; pin the footer's 100svh probe at its original size to
        // model a Safari toolbar change. In contained mode main is another svh
        // stage; document mode main stays auto-height and must not be pinned.
        const originalViewport = page.viewportSize();
        await page.evaluate(() => {
          const probe = document.querySelector('[data-footer-viewport]');
          if (!probe) throw new Error('Find the stable footer viewport measurement');
          const stages = [probe];
          if (document.documentElement.dataset.scrollMode !== 'document') stages.push(document.querySelector('main'));
          window.stableViewportPins = stages.map(node => {
            const saved = { node, height: node.style.getPropertyValue('height'), priority: node.style.getPropertyPriority('height') };
            node.style.setProperty('height', `${node.getBoundingClientRect().height}px`, 'important');
            return saved;
          });
        });
        try {
          for (const height of [originalViewport.height + 70, originalViewport.height, originalViewport.height + 70, originalViewport.height]) {
            await page.setViewportSize({ ...originalViewport, height });
            await page.waitForTimeout(240);
          }
        } finally {
          await page.setViewportSize(originalViewport);
          await page.evaluate(async () => {
            for (const { node, height, priority } of window.stableViewportPins) {
              if (height) node.style.setProperty('height', height, priority);
              else node.style.removeProperty('height');
            }
            delete window.stableViewportPins;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
        }
        await page.evaluate(() => {
          window.footerResizeObserver.disconnect();
          window.resizeEvidence.backgroundRetained = window.backgroundMaterial() === window.backgroundBeforeResize;
          const store = [...window.canvasStores].find(item => item.getState().gl?.domElement.closest('[data-companion-game]'));
          window.gameSizeUpdates = [];
          window.stopGameSizeWatch = store.subscribe((state, previous) => {
            if (state.size.width === previous.size.width && state.size.height === previous.size.height &&
              (state.size.top !== previous.size.top || state.size.left !== previous.size.left)) {
              window.resizeEvidence.gamePositionUpdates++;
              window.gameSizeUpdates.push({ previous: previous.size, current: state.size, viewport: innerHeight, time: performance.now() });
            }
          });
        });
        for (let step = 0; step < 6; step++) {
          await page.evaluate(offset => {
            const section = document.querySelector('[data-companion-statement]');
            const documentMode = document.documentElement.dataset.scrollMode === 'document';
            const scroller = documentMode ? window : document.querySelector('main');
            const top = documentMode ? scrollY : scroller.scrollTop;
            scroller.scrollTo(0, top + section.getBoundingClientRect().top + offset);
          }, step % 2 ? 230 : 110);
          await page.waitForTimeout(110);
        }
        await page.waitForTimeout(150);
        const evidence = await page.evaluate(() => {
          window.stopGameSizeWatch();
          return window.resizeEvidence;
        });
        await writeFile(path.join(report, 'iphone-scroll-resize-continuity.json'), JSON.stringify(evidence, null, 2));
        await writeFile(path.join(report, 'iphone-game-size-updates.json'), JSON.stringify(await page.evaluate(() => window.gameSizeUpdates), null, 2));
        await page.screenshot({ path: path.join(report, 'iphone-scroll-resize-continuity.png') });
        assert.deepEqual(evidence, { footerResets: 0, gamePositionUpdates: 0, backgroundRetained: true },
          'scrolling and toolbar resizing retain animation state without position-only canvas updates');
        return evidence;
      });
      if (label === 'iphone' || label === 'desktop') await check(browser, options, `${label}-directory-continuous-swing`, async (page) => {
        await page.goto(base + 'courses/');
        await ready(page);
        await page.locator('[data-badge-rendered="true"]').first().waitFor();
        const samples = await page.evaluate(async () => {
          const element = document.querySelector('[data-badge-instance="directory-cen100"]');
          let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
          while (fiber && !fiber.memoizedProps?.value?.register) fiber = fiber.return;
          const registry = fiber.memoizedProps.value;
          const entries = registry.getState().entries.filter(entry => entry.id.startsWith('directory-'));
          const keys = ['fixed', 'j1', 'j2', 'j3', 'card'];
          const bodies = keys.map(key => entries[0].body[key].current);
          const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
          const scrollTop = scroller === window ? scrollY : scroller.scrollTop;
          const centres = entries.map(entry => {
            const clip = entry.element.closest('[data-badge-clip]').getBoundingClientRect();
            return Math.max(0, scrollTop + clip.top + clip.height / 2 - innerHeight / 2);
          });
          const records = [];
          for (let frame = 0; frame <= 120; frame++) {
            const progress = frame <= 60 ? frame / 60 : (120 - frame) / 60;
            scroller.scrollTo(0, centres[0] + (centres.at(-1) - centres[0]) * progress);
            await new Promise(requestAnimationFrame);
            const current = registry.getState().entries.filter(entry => entry.id.startsWith('directory-'));
            const anchor = bodies[0].translation();
            const card = bodies[4].translation();
            const velocity = bodies[4].linvel();
            records.push({ frame, x: card.x - anchor.x, velocity: [velocity.x, velocity.y, velocity.z],
              same: current.every(entry => keys.every((key, i) => entry.body[key].current === bodies[i] && bodies[i].isValid())),
              shown: current.filter(entry => {
                const clip = entry.element.closest('[data-badge-clip]').getBoundingClientRect();
                return clip.top < innerHeight / 2 && clip.bottom > innerHeight / 2;
              }).map(entry => entry.courseId) });
          }
          return records;
        });
        await writeFile(path.join(report, `${label}-directory-continuous-swing.json`), JSON.stringify(samples));
        assert.ok(samples.every(sample => sample.same), 'every directory window reads the same live bodies through both scroll directions');
        assert.ok(samples.every(sample => [sample.x, ...sample.velocity].every(Number.isFinite)), 'the shared pose and momentum remain finite');
        for (const frames of [samples.slice(0, 61), samples.slice(60)]) {
          assert.deepEqual([...new Set(frames.flatMap(sample => sample.shown))].sort(), ['chy102', 'cen100', 'mth140', 'mth141', 'pcs211'], 'cross every course in each direction');
        }
        assert.ok(Math.max(...samples.map(sample => sample.x)) - Math.min(...samples.map(sample => sample.x)) > 0.01, 'the continuous rig is swinging');
        await assertPageWidth(page);
        return { frames: samples.length, courses: 5, directions: 2 };
      });
      if (label === 'iphone' || label === 'desktop') await check(browser, options, `${label}-badge-rapid-scroll`, async (page) => {
        const routes = [];
        for (const route of ['', 'cen100/', 'mth140/', 'mth141/', 'chy102/', 'pcs211/', 'courses/']) {
          await page.goto(base + route);
          await ready(page);
          const badge = page.locator('[data-course-badge]').first();
          await badge.scrollIntoViewIfNeeded();
          await page.locator('[data-course-badge][data-badge-rendered="true"]').first().waitFor();
          // Read the existing world through its provider. This check does not
          // inject forces or expose a production debug API.
          const samples = await page.evaluate(async () => {
            const element = document.querySelector('[data-course-badge]');
            let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
            while (fiber && !fiber.memoizedProps?.value?.register) fiber = fiber.return;
            const registry = fiber.memoizedProps.value;
            const entry = registry.getState().entries.find(item => item.element === element);
            const keys = ['fixed', 'j1', 'j2', 'j3', 'card'];
            const bodies = keys.map(key => entry.body[key].current);
            const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
            const scrollTop = () => scroller === window ? scrollY : scroller.scrollTop;
            const centre = Math.max(0, scrollTop() + element.getBoundingClientRect().top - (innerHeight - element.offsetHeight) / 2);
            const records = [];
            // Alternate small visible nudges with full exits/re-entries. The
            // world must keep its original motion rather than remount or jump apart.
            for (let step = 0; step < 120; step++) {
              if (step % 3 === 0) {
                const excursion = step >= 48 && step < 84 ? innerHeight * 1.2 : 44;
                scroller.scrollTo(0, Math.max(0, centre + (step % 6 === 0 ? excursion : 0)));
              }
              await new Promise(requestAnimationFrame);
              const current = registry.getState().entries.find(item => item.id === entry.id);
              const anchor = bodies[0].translation();
              const card = bodies[4].translation();
              const rotation = bodies[4].rotation();
              records.push({ x: card.x - anchor.x, y: card.y - anchor.y, z: card.z - anchor.z,
                rotation: [rotation.x, rotation.y, rotation.z, rotation.w], visible: current.visible,
                same: keys.every((key, i) => current.body[key].current === bodies[i] && bodies[i].isValid()) });
            }
            scroller.scrollTo(0, centre);
            return records;
          });
          assert.ok(samples.every(sample => sample.same && [sample.x, sample.y, sample.z, ...sample.rotation].every(Number.isFinite)), 'rapid scrolling retains the same live, finite bodies');
          assert.ok(samples.some(sample => !sample.visible) && samples.some(sample => sample.visible), 'the stress scroll crosses the visibility boundary');
          const span = Math.max(...samples.map(sample => sample.x)) - Math.min(...samples.map(sample => sample.x));
          assert.ok(span > 0.01, `the badge responds to the original scroll force: ${span}`);
          const name = `${label}-${route.replaceAll('/', '') || 'desk'}-rapid-scroll`;
          await writeFile(path.join(report, `${name}.json`), JSON.stringify(samples));
          // These deliberate instant full-screen jumps can inject enough of
          // Giats's uncapped force to stretch Rapier's soft rope constraints.
          // A fixed sway limit would retest the removed heavier-card tuning.
          // Require the same live rig to recover after real input stops.
          await page.waitForFunction(() => {
            const element = document.querySelector('[data-course-badge]');
            let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
            while (fiber && !fiber.memoizedProps?.value?.register) fiber = fiber.return;
            const entry = fiber.memoizedProps.value.getState().entries.find(item => item.element === element);
            const card = entry.body.card.current;
            const anchor = entry.body.fixed.current.translation();
            const position = card.translation();
            const velocity = card.linvel();
            return Math.abs(position.x - anchor.x) < 0.9 && position.y - anchor.y < -3
              && Math.hypot(velocity.x, velocity.y, velocity.z) < 0.5;
          }, null, { timeout: 15000 });
          await assertPageWidth(page);
          await page.screenshot({ path: path.join(report, `${name}.png`) });
          if (!route) {
            // Model a delayed visibility observer after re-entry. Keeping the
            // observer behind must not blank the already mounted View. The
            // regression was visible in the rapid-scroll recording even though
            // the body identity/finite-pose checks passed.
            await badge.evaluate(element => {
              let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
              while (fiber && !fiber.memoizedProps?.value?.register) fiber = fiber.return;
              window.delayedBadgeRegistry = fiber.memoizedProps.value;
              window.delayedBadgeEntry = window.delayedBadgeRegistry.getState().entries.find(item => item.element === element);
              window.delayedBadgeRegistry.update(window.delayedBadgeEntry.id, { visible: false, swing: false });
            });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const png = await badge.screenshot({ path: path.join(report, `${label}-badge-delayed-observer.png`) });
            const printedPixels = await page.evaluate(async base64 => {
              const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
              const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
              const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
              const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let count = 0;
              for (let y = Math.ceil(canvas.height * 0.1); y < canvas.height * 0.9; y++) {
                for (let x = Math.ceil(canvas.width * 0.1); x < canvas.width * 0.9; x++) {
                  const i = (y * canvas.width + x) * 4;
                  if (Math.min(data[i], data[i + 1], data[i + 2]) > 150) count++;
                }
              }
              bitmap.close(); return count;
            }, png.toString('base64'));
            assert.ok(printedPixels > 30, `the badge face remains drawn while visibility is delayed: ${printedPixels} printed pixels`);
            assert.equal(await page.evaluate(() => window.delayedBadgeEntry.body.card.current.isEnabled()), true, 'visibility does not disable the original simulation');
            assert.equal(await page.evaluate(() => window.delayedBadgeRegistry.getState().entries.find(item => item.id === window.delayedBadgeEntry.id).visible), false);
            await page.evaluate(() => window.delayedBadgeRegistry.update(window.delayedBadgeEntry.id, { visible: true, swing: true }));
          }
          routes.push({ route, span, samples: samples.length });
        }
        return routes;
      });
      if (label !== 'tablet') await check(browser, options, `${label}-companion-scene`, async (page) => {
        await observeCanvasStores(page);
        await page.addInitScript(() => { Math.random = () => 0.5; });
        await page.goto(base);
        await ready(page);
        assert.equal(await page.locator('[data-companion-statement]').count(), 1);
        assert.equal(await page.locator('[data-companion-statement] [data-companion-progress]').count(), 0);
        const intro = page.locator('[data-desk-introduction]:visible');
        assert.equal(await intro.count(), 1);
        const introLines = await intro.evaluate(element => {
          const text = element.firstChild;
          const copy = text.textContent;
          const split = copy.indexOf('Progress stays in this browser.');
          const previous = document.createRange();
          previous.setStart(text, copy.indexOf('course.') + 'course.'.length - 1);
          previous.setEnd(text, copy.indexOf('course.') + 'course.'.length);
          const progress = document.createRange();
          progress.setStart(text, split);
          progress.setEnd(text, split + 'Progress'.length);
          return { previousTop: previous.getBoundingClientRect().top, progressTop: progress.getBoundingClientRect().top, progressLeft: progress.getBoundingClientRect().left, left: element.getBoundingClientRect().left };
        });
        assert.ok(introLines.progressTop > introLines.previousTop + 1, 'the storage sentence starts after the course sentence');
        assert.ok(Math.abs(introLines.progressLeft - introLines.left) < 1, 'the storage sentence starts at the left of its new line');
        await intro.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(report, `${label}-desk-progress-line.png`) });
        assert.equal(await page.getByText('Open a course guide below', { exact: true }).count(), 0);
        const position = async (fraction) => page.evaluate((fraction) => {
          const section = document.querySelector('[data-companion-statement]');
          const documentMode = document.documentElement.dataset.scrollMode === 'document';
          const scroller = documentMode ? window : document.querySelector('main');
          const top = documentMode ? scrollY : scroller.scrollTop;
          scroller.scrollTo(0, section.getBoundingClientRect().top + top + (section.offsetHeight - innerHeight) * fraction);
        }, fraction);
        const entry = async fraction => page.evaluate(fraction => {
          const section = document.querySelector('[data-companion-statement]');
          const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
          const top = scroller === window ? scrollY : scroller.scrollTop;
          scroller.scrollTo(0, top + section.getBoundingClientRect().top - innerHeight * (1 - fraction));
        }, fraction);
        if (label === 'iphone-still') {
          await position(0);
          await page.waitForFunction(() => document.documentElement.dataset.motion === 'off' && document.querySelector('[data-companion-statement]')?.offsetHeight < innerHeight);
          assert.equal(await page.locator('[data-companion-game] canvas').count(), 0);
          assert.equal(await page.locator('[data-companion-statement] .word').count(), 0);
          await page.screenshot({ path: path.join(report, `${label}-companion.png`) });
          return { reducedMotion: true };
        }
        // Reproduce the blank panel in the reported screenshots: the scene is
        // half way into view while the preceding Desk controls are still above.
        await entry(0.5);
        await page.waitForFunction(() => {
          const words = [...document.querySelectorAll('[data-companion-statement] .word')];
          return words.length > 15 && words.filter(word => {
            const box = word.getBoundingClientRect();
            return Number(getComputedStyle(word).opacity) > 0.3 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
          }).length >= 3;
        }, null, { timeout: 8000 });
        await page.screenshot({ path: path.join(report, `${label}-companion-entry.png`) });
        await assertPageWidth(page);
        const sceneRatio = await page.locator('[data-companion-statement]').evaluate(el => el.offsetHeight / innerHeight);
        assert.ok(sceneRatio <= (label === 'iphone' ? 1.3 : 1.55), `the closing scene reserves ${sceneRatio} viewport heights`);
        await entry(0.1);
        await page.waitForFunction(() => {
          const words = [...document.querySelectorAll('[data-companion-statement] .word')];
          return words.reduce((sum, word) => sum + Number(getComputedStyle(word).opacity), 0) / words.length < 0.8;
        });
        await page.locator('[data-companion-game] canvas').waitFor();
        assert.equal(await page.locator('[data-companion-game] canvas').count(), 1);
        const beforeStorage = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([key]) => key !== 'tmu-guide:disc-game:v1').sort()));
        const words = await page.locator('[data-companion-statement] .word').count();
        assert.ok(words > 15);
        const before = await page.locator('[data-companion-statement] .word').evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(getComputedStyle(node).opacity), 0) / nodes.length);
        const frames = await page.evaluate(async () => {
          const documentMode = document.documentElement.dataset.scrollMode === 'document';
          const scroller = documentMode ? window : document.querySelector('main');
          const initial = documentMode ? scrollY : scroller.scrollTop;
          const travel = innerHeight;
          const records = [];
          let previous = performance.now();
          for (let step = 1; step <= 24; step += 1) {
            await new Promise(requestAnimationFrame);
            const now = performance.now();
            scroller.scrollTo(0, initial + travel * 0.4 * step / 24);
            records.push(now - previous); previous = now;
          }
          return records;
        });
        await page.waitForFunction(before => {
          const words = [...document.querySelectorAll('[data-companion-statement] .word')];
          return words.reduce((sum, word) => sum + Number(getComputedStyle(word).opacity), 0) / words.length > before + 0.05;
        }, before);
        const after = await page.locator('[data-companion-statement] .word').evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(getComputedStyle(node).opacity), 0) / nodes.length);
        assert.ok(after > before, `word reveal follows scrolling: ${before} -> ${after}`);
        // The scene must still be visibly assembling once its stage reaches
        // the viewport top; an opacity-only entry check missed this regression.
        await position(0);
        await page.waitForTimeout(450);
        const assembling = await page.locator('[data-companion-statement] .word').evaluateAll(nodes => nodes.map(node => {
          const css = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return { z: new DOMMatrixReadOnly(css.transform).m43, opacity: Number(css.opacity), visible: box.bottom > 0 && box.top < innerHeight };
        }));
        await page.screenshot({ path: path.join(report, `${label}-companion-mid-reveal.png`) });
        assert.ok(assembling.filter(word => word.visible && word.opacity > 0.3 && word.z > 10).length >= 3,
          `the visible statement retains its 3D reveal: ${JSON.stringify(assembling)}`);
        // Cross the endpoint by a few pixels: native scroll coordinates can
        // round down a fractional section top before its final transform is 0.
        await position(1.02);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-companion-statement] .word')].every(word => {
          const css = getComputedStyle(word);
          return Number(css.opacity) > 0.99 && (css.transform === 'none' || new DOMMatrixReadOnly(css.transform).isIdentity);
        }));
        await page.waitForFunction(() => Number(document.querySelector('[data-game-discs]')?.dataset.gameDiscs) > 0);
        assert.equal(await page.locator('[data-game-score]').isVisible(), false, 'the scoreboard does not reveal the easter egg');
        const flight = await page.evaluate(async () => {
          const state = [...window.canvasStores].map(store => store.getState()).find(item => item.gl.domElement.closest('[data-companion-game]'));
          // Discs launched during the scroll can have a lower ceiling. Measure a fresh throw.
          const alreadyAirborne = new WeakSet();
          state.scene.traverse(mesh => {
            if (mesh.userData.slice) alreadyAirborne.add(mesh);
          });
          // The fixed random value in this check gives Three.js meshes identical UUIDs.
          const tracks = new WeakMap();
          const deadline = performance.now() + 18000;
          while (performance.now() < deadline) {
            await new Promise(requestAnimationFrame);
            let completed;
            state.scene.traverse(mesh => {
              if (!mesh.userData.slice || alreadyAirborne.has(mesh)) return;
              const point = mesh.getWorldPosition(mesh.position.clone());
              const track = tracks.get(mesh) || { previous: point.y, rose: false, fell: false, peak: -Infinity };
              track.rose ||= point.y > track.previous + 0.01;
              track.fell ||= track.rose && point.y < track.previous - 0.01;
              track.previous = point.y;
              track.peak = Math.max(track.peak, point.clone().project(state.camera).y);
              tracks.set(mesh, track);
              if (track.rose && track.fell) completed = track;
            });
            if (completed) return completed;
          }
          throw new Error('No disc completed a visible upward and downward arc');
        });
        assert.ok(flight.peak > 0 && flight.peak < 0.9, `disc turns around inside the stage: ${JSON.stringify(flight)}`);
        await page.screenshot({ path: path.join(report, `${label}-companion-and-game.png`) });
        // Record score commits in the browser: a missed disc can reset the score
        // between Playwright calls, so lifetime slices are not the current score.
        await page.evaluate(() => {
          const stage = document.querySelector('[data-game-discs]');
          const score = document.querySelector('[data-game-score]');
          window.gameCelebrations = 0;
          window.gameDiscoveries = 0;
          window.gameRecordCelebrations = 0;
          window.addEventListener('tmu-guide:disc-game-new-best', () => {
            window.gameRecordCelebrations += 1;
          });
          window.addEventListener('tmu-guide:disc-game-first-slice', (event) => {
            window.gameCelebrations += 1;
            if (event.detail?.discovery) window.gameDiscoveries += 1;
          });
          window.gameScoreHistory = [];
          const record = () => {
            window.gameScoreHistory.push({
              score: score.querySelector('[data-game-current]').textContent,
              best: score.querySelector('[data-game-best]').textContent,
              slices: Number(stage.dataset.gameSlices || 0),
              visible: !score.hidden && getComputedStyle(score).display !== 'none',
            });
          };
          window.gameScoreObserver = new MutationObserver(record);
          window.gameScoreObserver.observe(score, { childList: true, characterData: true, subtree: true, attributes: true });
          record();
        });
        // Aim at actual visible discs within a painted frame. On a slow runner,
        // separate mouse calls can span an entire flight. Dispatch DOM input;
        // the real scene raycaster and slice guards must still handle every hit.
        const sliceVisibleDisc = async (touchInput) => {
          const stage = document.querySelector('[data-game-discs]');
          const state = [...window.canvasStores].map(store => store.getState()).find(item => item.gl.domElement.closest('[data-companion-game]'));
          const deadline = performance.now() + 18000;
          const nativeTouch = touchInput && document.documentElement.dataset.scrollMode === 'document';
          const dispatch = (type, point) => {
            if (nativeTouch) {
              // Linux WebKit cannot construct Touch/TouchEvent.
              const touch = { identifier: 1, target: stage, ...point, pageX: point.clientX + scrollX, pageY: point.clientY + scrollY };
              const event = new Event(type, { bubbles: true, cancelable: true });
              const touches = type === 'touchend' ? [] : [touch];
              Object.assign(event, { touches, targetTouches: touches, changedTouches: [touch] });
              stage.dispatchEvent(event);
            } else {
              stage.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: touchInput ? 'touch' : 'mouse', pointerId: 1, isPrimary: true, ...point }));
            }
          };
          while (performance.now() < deadline) {
            await new Promise(requestAnimationFrame);
            const bounds = state.gl.domElement.getBoundingClientRect();
            const points = [];
            state.scene.traverse(mesh => {
              if (!mesh.userData.slice) return;
              const point = mesh.getWorldPosition(mesh.position.clone()).project(state.camera);
              const clientX = bounds.left + (point.x + 1) * bounds.width / 2;
              const clientY = bounds.top + (1 - point.y) * bounds.height / 2;
              if (Math.abs(point.x) < 0.9 && Math.abs(point.y) < 0.8 && clientX > 1 && clientX < innerWidth - 1 && clientY > 1 && clientY < innerHeight - 1) points.push({ clientX, clientY });
            });
            const before = Number(stage.dataset.gameSlices || 0);
            const sample = () => points.forEach(point => {
              dispatch(nativeTouch ? 'touchstart' : 'pointerdown', point);
              dispatch(nativeTouch ? 'touchmove' : 'pointermove', point);
              if (nativeTouch) dispatch('touchend', point);
            });
            sample();
            const first = Number(stage.dataset.gameSlices || 0);
            if (first > before) {
              sample();
              sample();
              return { before, first, repeated: Number(stage.dataset.gameSlices || 0) };
            }
          }
          throw new Error('Visible discs did not respond to shared-surface input');
        };
        const hit = await page.evaluate(sliceVisibleDisc, label === 'iphone');
        assert.ok(hit.first > hit.before, 'visible discs respond to shared-surface input');
        assert.equal(hit.repeated, hit.first, 'repeated input on the same discs cannot score twice');
        await page.waitForFunction(() => window.gameScoreHistory.some(entry => entry.visible && entry.score === `Score ${entry.slices}` && entry.slices > 0));
        assert.equal(await page.evaluate(() => window.gameRecordCelebrations), 1, 'the first record celebrates once even when a swipe slices a group');
        await page.waitForFunction(() => {
          const state = [...window.canvasStores].map(store => store.getState()).find(item => item.gl.domElement.closest('#fluidCanvas'));
          let ready = false;
          state?.scene.traverse(object => {
            ready ||= object.__r3f?.objects?.some(effect => effect.name === 'FluidEffect' && effect.uniforms.get('tRecord')?.value?.isCanvasTexture);
          });
          return ready;
        });
        const recordRendering = await page.evaluate(() => {
          const state = [...window.canvasStores].map(store => store.getState()).find(item => item.gl.domElement.closest('#fluidCanvas'));
          let effect;
          state.scene.traverse(object => {
            effect ||= object.__r3f?.objects?.find(item => item.name === 'FluidEffect');
          });
          const canvas = effect.uniforms.get('tRecord').value.image;
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let ink = 0;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 128) ink++;
          return { ink, shaders: state.gl.info.programs.every(program => program.diagnostics?.runnable !== false) };
        });
        assert.ok(recordRendering.ink > 5000 && recordRendering.shaders, 'New Best lettering reaches the working touch-fluid shader');
        await page.screenshot({ path: path.join(report, `${label}-new-best.png`) });
        const score = page.locator('[data-game-score]');
        assert.equal(await score.isVisible(), true);
        assert.equal(await score.getAttribute('role'), 'status');
        const scoreLayout = await score.evaluate(el => {
          const box = el.getBoundingClientRect();
          const stage = el.parentElement.getBoundingClientRect();
          const css = getComputedStyle(el);
          return { center: box.left + box.width / 2 - stage.left - stage.width / 2, top: box.top - stage.top, bottom: stage.bottom - box.bottom, height: stage.height, position: css.position, fontSize: parseFloat(css.fontSize) };
        });
        assert.ok(Math.abs(scoreLayout.center) < 2, 'score sits at the bottom centre of the stage for either hand');
        assert.ok(scoreLayout.top > scoreLayout.height / 2 && scoreLayout.bottom >= 96, 'score sits near the bottom with room for the menu');
        assert.equal(scoreLayout.position, 'absolute', 'the score moves with the stage instead of being fixed or sticky');
        assert.ok(scoreLayout.fontSize >= 24, 'score text is larger');
        const rendering = await page.evaluate(() => {
          const state = [...window.canvasStores].map(store => store.getState()).find(item => item.gl.domElement.closest('[data-companion-game]'));
          const canvas = state.gl.domElement.getBoundingClientRect();
          const anchor = document.querySelector('[data-game-ceiling]').getBoundingClientRect();
          const score = document.querySelector('[data-game-score]').getBoundingClientRect();
          return { dpr: state.gl.getPixelRatio(), expectedDpr: Math.min(2, Math.max(1, devicePixelRatio)), inset: parseFloat(state.gl.domElement.style.clipPath.slice(6)), expectedInset: Math.max(0, Math.min(canvas.height, anchor.top + score.height + 8 - canvas.top)) };
        });
        assert.equal(rendering.dpr, rendering.expectedDpr, 'existing emoji artwork renders at up to twice the pixel density');
        assert.ok(Math.abs(rendering.inset - rendering.expectedInset) < 1, 'moving the badge preserves the original flight ceiling');
        const slices = hit.first;
        await page.screenshot({ path: path.join(report, `${label}-game-score.png`) });
        // Stop slicing. Require a recorded positive score followed by zero,
        // even if a legitimate miss already happened during the screenshot.
        await page.mouse.move(0, 0);
        await page.waitForFunction(() => {
          const first = window.gameScoreHistory.findIndex(entry => entry.visible && entry.slices > 0 && entry.score === `Score ${entry.slices}`);
          return first >= 0 && window.gameScoreHistory.slice(first + 1).some(entry => entry.visible && entry.score === 'Score 0');
        }, null, { timeout: 18000 });
        const scoreHistory = await page.evaluate(() => {
          window.gameScoreObserver.disconnect();
          return window.gameScoreHistory;
        });
        assert.equal(await score.isVisible(), true, 'a miss resets the value without hiding the score');
        await page.screenshot({ path: path.join(report, `${label}-game-missed.png`) });
        const count = Number(await page.locator('[data-game-discs]').getAttribute('data-game-discs'));
        assert.ok(count <= (label === 'iphone' ? 6 : 10));
        assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([key]) => key !== 'tmu-guide:disc-game:v1').sort())), beforeStorage, 'slicing does not change saved course progress');
        const savedRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('tmu-guide:disc-game:v1')));
        assert.equal(savedRecord.best, Math.max(...scoreHistory.map(entry => Number(entry.score.replace('Score ', '')))));
        assert.equal(savedRecord.celebrated, true);
        assert.equal(await page.evaluate(() => window.gameCelebrations), 1, 'the first successful slice celebrates once');
        assert.equal(await page.evaluate(() => window.gameDiscoveries), 1, 'first discovery includes the huge full-screen burst');
        assert.equal(await page.locator('[data-game-best]').textContent(), `Best ${savedRecord.best}`, 'a miss preserves the displayed best');
        for (let repeat = 0; repeat < 2; repeat += 1) {
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForFunction(() => document.documentElement.dataset.motion === 'off');
          assert.equal(await page.locator('[data-companion-statement] .word').count(), 0, 'SplitType restores plain text');
          assert.equal(await page.locator('[data-companion-game]').getAttribute('data-active'), 'false');
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await page.waitForFunction(() => document.documentElement.dataset.motion === 'on');
          assert.equal(await page.locator('[data-companion-statement] .word').count(), words);
          assert.equal(await page.locator('[data-companion-statement] .word .word').count(), 0);
        }
        frames.sort((a, b) => a - b);
        await page.reload();
        await ready(page);
        await position(1.02);
        await page.waitForFunction(() => Number(document.querySelector('[data-game-discs]')?.dataset.gameDiscs) > 0);
        assert.equal(await page.locator('[data-game-score]').isVisible(), false, 'a saved best does not reveal the game early');
        await page.evaluate(() => {
          window.gameCelebrations = 0;
          window.gameDiscoveries = 0;
          window.addEventListener('tmu-guide:disc-game-first-slice', (event) => {
            window.gameCelebrations += 1;
            if (event.detail?.discovery) window.gameDiscoveries += 1;
          });
        });
        const reloadedHit = await page.evaluate(sliceVisibleDisc, label === 'iphone');
        const expectedBest = Math.max(savedRecord.best, reloadedHit.first);
        await page.waitForFunction(best => document.querySelector('[data-game-best]')?.textContent === `Best ${best}`, expectedBest);
        assert.equal(await page.evaluate(() => window.gameCelebrations), 1, 'the first slice after reload replays the regular score-one bloom');
        assert.equal(await page.evaluate(() => window.gameDiscoveries), 0, 'reload never repeats the huge discovery burst');
        await page.mouse.move(0, 0);
        await page.waitForFunction(() => document.querySelector('[data-game-current]')?.textContent === 'Score 0', null, { timeout: 18000 });
        await page.evaluate(sliceVisibleDisc, label === 'iphone');
        assert.equal(await page.evaluate(() => window.gameCelebrations), 2, 'a new streak after a miss replays the regular bloom');
        assert.equal(await page.evaluate(() => window.gameDiscoveries), 0, 'a new streak never repeats the huge discovery burst');
        return { words, discs: count, flight, slices, scoreHistory, reveal: { before, after }, frameP95Ms: frames[Math.floor(frames.length * 0.95)], note: 'CI diagnostics; not physical-device performance.' };
      });
      if (label === 'iphone' || label === 'desktop') await check(browser, options, `${label}-game-screen-edge`, async (page) => {
        await observeCanvasStores(page);
        const evidence = [];
        for (const route of ['', 'courses/', 'privacy/', 'updates/']) {
          await page.goto(base + route);
          await ready(page);
          for (const offset of [-0.15, 0.7, 0.25, 1.1, 0.6, 0.95]) {
            await page.evaluate(offset => {
              const section = document.querySelector('[data-companion-statement]');
              const documentMode = document.documentElement.dataset.scrollMode === 'document';
              const scroller = documentMode ? window : document.querySelector('main');
              const top = documentMode ? scrollY : scroller.scrollTop;
              scroller.scrollTo(0, top + section.getBoundingClientRect().top + innerHeight * offset);
            }, offset);
            await page.locator('[data-companion-game][data-active="true"] canvas').waitFor();
            await page.waitForFunction(() => {
              const canvas = document.querySelector('[data-companion-game] canvas');
              const box = canvas?.getBoundingClientRect();
              // Canvas mounts before the lazy physics scene. Check a rendered
              // game frame, not the empty loading canvas with clip-path:none.
              return box && Math.abs(box.top) < 1 && Math.abs(box.bottom - innerHeight) < 1 && getComputedStyle(canvas).clipPath.startsWith('inset(');
            });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const geometry = await page.evaluate(() => {
              const game = document.querySelector('[data-companion-game]');
              const canvas = game.querySelector('canvas');
              const box = canvas.getBoundingClientRect();
              const section = document.querySelector('[data-companion-statement]');
              const stage = section.firstElementChild.getBoundingClientRect();
              const clip = getComputedStyle(canvas).clipPath.slice(6, -1).split(/\s+/).map(parseFloat);
              return { top: box.top, bottom: box.bottom, stageBottom: stage.bottom, paperBottom: section.getBoundingClientRect().bottom, paintedBottom: box.bottom - (clip[2] ?? clip[0]), viewport: innerHeight, left: box.left, stageLeft: stage.left, width: box.width, stageWidth: stage.width, clippedByPage: !!game.closest('main') };
            });
            assert.equal(geometry.clippedByPage, false, 'scrolling does not move the fixed game canvas');
            assert.ok(Math.abs(geometry.left - geometry.stageLeft) < 1 && Math.abs(geometry.width - geometry.stageWidth) < 1, 'the existing horizontal game area is preserved');
            if (offset === 0.7) assert.ok(geometry.stageBottom < geometry.bottom - 20, 'the canvas continues to the screen edge after the statement starts leaving');
            assert.ok(Math.abs(geometry.paintedBottom - Math.min(geometry.bottom, geometry.paperBottom)) < 1,
              `the visible game ends exactly at the white/dark boundary: ${JSON.stringify(geometry)}`);
            // Reverse scroll while a real disc is airborne, not just while an
            // empty canvas is mounted.
            if (!route && offset === 0.7) await page.waitForFunction(() => {
              const state = [...window.canvasStores].map(store => store.getState()).find(item => item.gl.domElement.closest('[data-companion-game]'));
              let airborne = false;
              state?.scene.traverse(mesh => {
                if (!mesh.userData.slice) return;
                const point = mesh.getWorldPosition(mesh.position.clone()).project(state.camera);
                airborne ||= Math.abs(point.y) < 0.8;
              });
              return airborne;
            });
            if (!route && offset === 1.1) {
              const hiddenHit = await page.evaluate(async touchInput => {
                const stage = document.querySelector('[data-game-discs]');
                const state = [...window.canvasStores].map(store => store.getState()).find(item => item.gl.domElement.closest('[data-companion-game]'));
                const deadline = performance.now() + 18000;
                while (performance.now() < deadline) {
                  await new Promise(requestAnimationFrame);
                  const box = state.gl.domElement.getBoundingClientRect();
                  const edge = document.querySelector('[data-companion-statement]').getBoundingClientRect().bottom;
                  let target;
                  state.scene.traverse(mesh => {
                    if (!mesh.userData.slice) return;
                    const point = mesh.getWorldPosition(mesh.position.clone()).project(state.camera);
                    const clientX = box.left + (point.x + 1) * box.width / 2;
                    const clientY = box.top + (1 - point.y) * box.height / 2;
                    if (Math.abs(point.x) < 0.8 && clientY > edge + 10 && clientY < innerHeight - 10) target = { clientX, clientY };
                  });
                  if (!target) continue;
                  const before = Number(stage.dataset.gameSlices || 0);
                  if (touchInput) {
                    const touch = { identifier: 1, target: stage, ...target };
                    for (const type of ['touchstart', 'touchend']) {
                      const event = new Event(type, { bubbles: true, cancelable: true });
                      const touches = type === 'touchend' ? [] : [touch];
                      Object.assign(event, { touches, targetTouches: touches, changedTouches: [touch] });
                      stage.dispatchEvent(event);
                    }
                  } else stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', ...target }));
                  return { before, after: Number(stage.dataset.gameSlices || 0) };
                }
                throw new Error('No airborne disc crossed behind the footer mask');
              }, label === 'iphone');
              assert.equal(hiddenHit.after, hiddenHit.before, 'discs masked by the dark footer cannot score or capture a touch');
            }
            evidence.push({ route, offset, ...geometry });
          }
          await page.evaluate(() => (document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main')).scrollTo(0, 0));
          await page.locator('[data-companion-game][data-active="false"]').waitFor({ state: 'attached' });
          assert.equal(await page.locator('[data-companion-game]').isVisible(), false, 'the fixed game is hidden when its section is offscreen');
        }
        return evidence;
      });
      await check(browser, options, `${label}-work-filters`, async (page) => {
        // Install before application timers, then advance animation frames explicitly.
        // This tests intermediate geometry without relying on a loaded CI runner's FPS.
        await page.clock.install({ time: new Date('2026-10-23T16:00:00Z') });
        await page.goto(`${base}cen100/`);
        await ready(page);
        await page.locator('#course-section:not(:disabled)').waitFor();
        const rows = await page.locator('[data-assignment-link]').count();
        await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
        assert.equal(await page.locator('[data-filter-selection]').count(), 1, 'the selected Work filter has a visible moving indicator');
        const before = await page.locator('[data-filter-selection]').boundingBox();
        assert.ok(before, 'the selected Work filter has a visible moving indicator');
        const all = page.getByRole('button', { name: /^All \(/ });
        const allBox = await all.boundingBox();
        await all.evaluate((button) => button.click());
        await page.clock.runFor(48);
        assert.equal(await all.getAttribute('aria-pressed'), 'true', 'selection acknowledges the click immediately');
        const during = await page.locator('[data-filter-selection]').boundingBox();
        if (options.reducedMotion === 'reduce') assert.ok(Math.abs(during.x - allBox.x) < 2, 'reduced motion selects immediately');
        else assert.ok(during.x > before.x + 1 && during.x < allBox.x - 1, `the selection moves between filters: ${JSON.stringify({ before, during, allBox })}`);
        await page.clock.runFor(400);
        assert.equal(await page.locator('[data-assignment-link]').count(), rows, 'All and Open correctly match before anything is marked done');
        assert.match(await page.locator('[data-work-summary]').innerText(), /all|total/i, 'a visible summary identifies the chosen result set');
        await page.getByRole('button', { name: /^Done \(/ }).evaluate((button) => button.click());
        await page.clock.runFor(48);
        if (options.reducedMotion !== 'reduce') {
          const opacity = await page.locator('[data-work-results]').evaluate((node) => Number(getComputedStyle(node).opacity));
          assert.ok(opacity > 0 && opacity < 1, 'changed results fade out before replacement');
        }
        await page.clock.runFor(500);
        assert.equal(await page.locator('[data-assignment-link]').count(), 0);
        const empty = page.locator('[data-work-empty]');
        assert.match(await empty.innerText(), /mark|completion/i, 'empty Done explains how assignments arrive here');
        await page.screenshot({ path: path.join(report, `${label}-done-empty.png`), fullPage: true });
        const backToWork = empty.getByRole('button', { name: /open|work/i });
        await backToWork.evaluate((button) => button.click());
        await page.clock.runFor(500);
        assert.equal(await page.locator('[data-assignment-link]').count(), rows);
        await page.getByRole('button', { name: /^Done \(/ }).evaluate((button) => button.click());
        await page.clock.runFor(32);
        await all.evaluate((button) => button.click());
        await page.clock.runFor(500);
        assert.equal(await page.locator('[data-assignment-link]').count(), rows, 'a newer filter cancels an outgoing result transition');
        await page.getByRole('button', { name: /^Open \(/ }).evaluate((button) => button.click());
        await page.clock.runFor(400);
        await page.clock.resume();
        await page.getByRole('button', { name: /^All \(/ }).focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => location.hash === '#work/all');
        await settled(page);
        assert.equal(await all.evaluate((button) => button === document.activeElement), true, 'keyboard focus stays on the selected filter');
        // A non-focusing link activation must still focus the new view after
        // its filter controls unmount (Safari taps can retain the old focus).
        await page.getByRole('navigation', { name: 'Course views' }).getByRole('link', { name: 'Schedule', exact: true }).evaluate((link) => link.click());
        await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
        await settled(page);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'course-content', 'leaving Work moves focus into the destination view');
        await page.goBack();
        await page.waitForFunction(() => location.hash === '#work/all');
        await settled(page);
        await page.goBack();
        await page.waitForFunction(() => !location.hash || location.hash === '#work');
        await settled(page);
        await page.waitForFunction(() => {
          const selected = document.querySelector('[data-work-filters] [aria-pressed="true"]').getBoundingClientRect();
          const indicator = document.querySelector('[data-filter-selection]').getBoundingClientRect();
          return Math.abs(selected.x - indicator.x) < 2 && Math.abs(selected.width - indicator.width) < 2;
        });
        await page.screenshot({ path: path.join(report, `${label}-work-filters.png`) });
        if (label === 'iphone') {
          await page.locator('#open-assignment-y1').click();
          await page.locator('#course-view-assignment-y1[data-assignment-detail]').waitFor();
          await settled(page);
          const records = page.locator('[data-assignment-detail] fieldset input[type="checkbox"]');
          assert.equal(await records.count(), 4, 'September items has four separate submission records');
          // The visible label is the touch target; the accessible input is
          // intentionally 1px with pointer-events:none in the existing design.
          await page.locator('[data-assignment-detail] input[type="checkbox"]').first().locator('..').click();
          await records.first().locator('..').click();
          assert.equal(await records.first().isChecked(), true);
          await page.getByRole('button', { name: /Back to Work/ }).first().click();
          await settled(page);
          assert.match(await page.locator('#open-assignment-y1').innerText(), /1\/4 recorded/);
          assert.equal(await page.getByRole('button', { name: 'Done (0)', exact: true }).count(), 1, 'preparation ticks and one record do not finish an assignment');
          await page.locator('#open-assignment-y1').click();
          await page.locator('#course-view-assignment-y1[data-assignment-detail]').waitFor();
          await settled(page);
          for (let i = 1; i < 4; i += 1) await records.nth(i).locator('..').click();
          await page.getByRole('button', { name: /Back to Work/ }).first().click();
          await settled(page);
          await page.getByRole('button', { name: 'Done (1)', exact: true }).click();
          await page.locator('#open-assignment-y1').waitFor();
          assert.equal(await page.locator('[data-assignment-link]').count(), 1);
          // Read storage in a fresh document. Reusing a WebKit page for a full
          // navigation cancels Next's in-flight CSS prefetches (also avoided by
          // check-ios-document). Leave the first tab alive until the assertions.
          const reopened = await page.context().newPage();
          await reopened.goto(page.url());
          await ready(reopened);
          await reopened.locator('#open-assignment-y1').waitFor();
          assert.equal(await reopened.getByRole('button', { name: 'Done (1)', exact: true }).getAttribute('aria-pressed'), 'true');
          await reopened.locator('[data-work-results]').scrollIntoViewIfNeeded();
          await reopened.screenshot({ path: path.join(report, 'iphone-done-recorded.png') });
        }
        return { rows, keyboardAndHistory: true };
      });
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
  await new Promise((resolve) => server.close(resolve));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
