/**
 * Regression checks for Giats's fluid trail and touch scrolling.
 * Build site/ first, then run from site/: npm run test:touch
 * PLAYWRIGHT_PATH and QA_CHROMIUM_PATH may select a QA-only browser installation.
 * Uses real Chromium touch input, not synthetic PointerEvents. This is browser
 * emulation, not a physical iPhone Safari or hardware-performance test.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(siteRoot, '.next/routes-manifest.json'), 'utf8'));
const reports = process.env.QA_REPORT_DIR || await mkdtemp(path.join(tmpdir(), 'touch-fluid-'));
await mkdir(reports, { recursive: true });
const server = createPreview({ root: path.join(siteRoot, 'out'), base: basePath });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
let browser;

function instrumentTouch() {
  const draws = new WeakMap();
  const locations = new WeakMap();
  const colours = new WeakMap();
  for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Context) continue;
    const getUniformLocation = Context.prototype.getUniformLocation;
    Context.prototype.getUniformLocation = function (program, name) {
      const location = getUniformLocation.call(this, program, name);
      if (location) locations.set(location, name);
      return location;
    };
    for (const method of ['uniform3f', 'uniform3fv']) {
      const original = Context.prototype[method];
      Context.prototype[method] = function (location, ...args) {
        const name = locations.get(location);
        if (name && /u(?:Background)?Color$/i.test(name)) {
          const values = colours.get(this.canvas) || {};
          values[name] = method === 'uniform3f' ? args : Array.from(args[0]);
          colours.set(this.canvas, values);
        }
        return original.call(this, location, ...args);
      };
    }
    for (const method of ['drawArrays', 'drawElements']) {
      const original = Context.prototype[method];
      Context.prototype[method] = function (...args) {
        draws.set(this.canvas, (draws.get(this.canvas) || 0) + 1);
        return original.apply(this, args);
      };
    }
  }
  const events = [];
  const touches = [];
  for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup']) {
    document.addEventListener(type, event => {
      if (event.target instanceof Element && event.target.closest('main')) {
        events.push({ type, x: event.clientX, y: event.clientY });
      }
    }, { capture: true, passive: true });
  }
  for (const type of ['touchstart', 'touchmove', 'touchend']) {
    document.addEventListener(type, event => {
      touches.push({ type, count: event.touches.length, prevented: event.defaultPrevented });
    }, { passive: true });
  }
  window.__touchFluidQA = {
    reset: () => { events.length = 0; touches.length = 0; },
    snapshot: () => {
      const wrapper = document.querySelector('#fluidCanvas');
      const canvas = wrapper?.querySelector('canvas');
      return {
        events: [...events],
        touches: [...touches],
        draws: canvas ? draws.get(canvas) || 0 : 0,
        fluid: Boolean(canvas),
        colours: canvas ? colours.get(canvas) || {} : {},
        visibility: wrapper ? getComputedStyle(wrapper).visibility : null,
        scrollTop: document.querySelector('main')?.scrollTop || 0,
      };
    },
  };
}

async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, pass: true, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function open({ reducedMotion = 'no-preference', paused = false, mobile = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 900 },
    hasTouch: mobile,
    isMobile: mobile,
    deviceScaleFactor: 1,
    reducedMotion,
  });
  await context.addInitScript(instrumentTouch);
  if (paused) await context.addInitScript(() => localStorage.setItem('guide-motion-paused', 'true'));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

async function ready(page, route = '') {
  await page.goto(url + route);
  await page.locator('main h1').first().waitFor();
  await waitForMain(page);
}

async function waitForMain(page) {
  await waitOnPage(page, () => {
    const main = document.querySelector('main');
    const overlay = document.querySelector('#loader');
    const loader = overlay?.getBoundingClientRect();
    return main && getComputedStyle(main).pointerEvents !== 'none'
      && !document.querySelector('#layout')?.hasAttribute('inert')
      && Number(getComputedStyle(main).opacity) > 0.99
      && Math.abs(main.getBoundingClientRect().x) < 1
      && (!loader || getComputedStyle(overlay).visibility === 'hidden'
        || loader.right <= 1 || loader.left >= innerWidth - 1);
  });
}

// Poll from Node instead of page.waitForFunction, whose in-page eval is blocked
// by this site's CSP in older Chromium. Keep the production CSP enabled.
async function waitOnPage(page, predicate, argument) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate, argument)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Page condition timed out: ${predicate.toString()}`);
}

const snapshot = page => page.evaluate(() => window.__touchFluidQA.snapshot());

async function assertDeskPalette(page) {
  const expected = { '--black': '#18181b', '--white': '#f4f4f5', '--accentColor': '#ffffff', '--fillColor': '#ffffff', '--menuColor': '#18181b', '--menuFontColor': '#fafafa', '--accent': '#004c9b' };
  const shown = await page.evaluate(names => {
    const root = getComputedStyle(document.documentElement);
    const menu = getComputedStyle(document.querySelector('#menu-button'));
    const fluid = getComputedStyle(document.querySelector('#fluidCanvas'));
    return {
      palette: Object.fromEntries(names.map(name => [name, root.getPropertyValue(name).trim().toLowerCase()])),
      ink: getComputedStyle(document.querySelector('main')).color,
      menu: menu.backgroundColor,
      menuInk: getComputedStyle(document.querySelector('#menu-button p:not([aria-hidden])')).color,
      theme: document.querySelector('meta[name="theme-color"]').content,
      browserSurface: document.documentElement.dataset.browserSurface,
      footerReachesBottom: (() => {
        const main = document.querySelector("main");
        const footer = main?.querySelector("footer");
        if (!main || !footer) return false;
        const mainRect = main.getBoundingClientRect();
        const footerRect = footer.getBoundingClientRect();
        return footerRect.top < mainRect.bottom - 1 && footerRect.bottom >= mainRect.bottom - 1;
      })(),
      blend: fluid.mixBlendMode,
      fluidBackground: fluid.backgroundColor,
      panels: Array.from(document.querySelectorAll('[style*="--card-menu"], [style*="--cardMenu"]'), node => {
        const style = getComputedStyle(node);
        const value = (a, b) => (style.getPropertyValue(a) || style.getPropertyValue(b)).trim().toLowerCase();
        return { ink: value('--card-ink', '--cardInk'), menu: value('--card-menu', '--cardMenu'), fill: value('--card-fill', '--cardFill') };
      }),
    };
  }, Object.keys(expected));
  // The CSS minifier writes #ffffff as #fff; inline values set by usePalette keep six digits.
  const longHex = (value) => (/^#[0-9a-f]{3}$/.test(value) ? `#${[...value.slice(1)].map((digit) => digit + digit).join('')}` : value);
  shown.palette = Object.fromEntries(Object.entries(shown.palette).map(([name, value]) => [name, longHex(value)]));
  assert.deepEqual(shown.palette, expected, 'the route must not replace the Desk palette');
  assert.equal(shown.ink, 'rgb(24, 24, 27)');
  assert.equal(shown.menu, 'rgb(24, 24, 27)');
  assert.equal(shown.menuInk, 'rgb(250, 250, 250)');
  assert.equal(shown.theme.toLowerCase(), shown.footerReachesBottom ? '#18181b' : '#f4f4f5');
  assert.equal(shown.browserSurface, shown.footerReachesBottom ? 'dark' : 'light');
  for (const panel of shown.panels) assert.deepEqual(panel, { ink: '#18181b', menu: '#18181b', fill: '#ffffff' });
  assert.equal(shown.blend, 'difference');
  assert.equal(shown.fluidBackground, 'rgb(0, 0, 0)');
  // The palette's #E4E4E7 dye over a black base (the difference blend leaves the page as it is),
  // converted from sRGB to linear RGB by Three.Color before upload to the shader.
  const linear = bytes => bytes.map(byte => {
    const channel = byte / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  await waitOnPage(page, () => Object.keys(window.__touchFluidQA.snapshot().colours).some(name => /uColor$/i.test(name)));
  const { colours } = await snapshot(page);
  for (const [suffix, bytes] of [['uColor', [228, 228, 231]], ['uBackgroundColor', [0, 0, 0]]]) {
    const value = Object.entries(colours).find(([name]) => name.toLowerCase().endsWith(suffix.toLowerCase()))?.[1];
    assert.ok(value, `missing fluid shader uniform: ${suffix}`);
    linear(bytes).forEach((channel, i) => assert.ok(Math.abs(channel - value[i]) < 0.000001, `${suffix}[${i}] differs from the palette: ${value[i]} vs ${channel}`));
  }
  return { ...shown, colours };
}

function assertFluidSwipe(trace) {
  const moves = trace.after.events.filter(event => event.type === 'pointermove');
  assert.ok(moves.length >= 8, `too few movement samples: ${JSON.stringify(trace)}`);
  assert.equal(trace.after.events.some(event => event.type === 'pointercancel'), false, JSON.stringify(trace));
  assert.ok(trace.after.events.some(event => event.type === 'pointerup'), 'gesture did not finish normally');
  assert.ok(trace.after.draws > trace.before.draws, 'fluid did not render during the swipe');
}

async function toggleMotion(page, label) {
  // Menu belongs to the header and leaves with the page instead of covering it.
  await page.locator('main').evaluate(main => { main.scrollTop = 0; });
  await waitOnPage(page, () => getComputedStyle(document.querySelector('#menu-button')).visibility === 'visible');
  await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
  await page.getByRole('button', { name: label, exact: true }).tap();
  await page.getByRole('button', { name: 'Close menu', exact: true }).tap();
  await waitForMain(page);
}

async function swipe(context, page, screenshotName) {
  // The motion-off reveal can update main before the compositor stops hitting
  // the loader. Start on course content so its pointer-cancel is observable.
  await waitOnPage(page, () => Boolean(document.elementFromPoint(195, 650)?.closest('main')));
  await page.evaluate(() => window.__touchFluidQA.reset());
  const start = await snapshot(page);
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 650, radiusX: 5, radiusY: 5 }] });
    for (let step = 1; step <= 15; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 650 - step * 20, radiusX: 5, radiusY: 5 }] });
      await page.waitForTimeout(25);
    }
    if (screenshotName) await page.screenshot({ path: path.join(reports, screenshotName) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await waitOnPage(page, top => document.querySelector('main').scrollTop > top + 30, start.scrollTop);
    return { before: start, after: await snapshot(page) };
  } finally {
    await cdp.detach();
  }
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  for (const route of ['', 'cen100/', 'mth140/', 'mth141/', 'courses/', 'privacy/']) {
    const { context, page, errors } = await open();
    const label = route || 'home';
    try {
      await ready(page, route);
      await check(`${label}: Desk palette and fluid colours`, () => assertDeskPalette(page));
      // Deliberately cross the former 2.2 s cutoff: this is the behaviour under test.
      await page.waitForTimeout(2500);
      await check(`${label}: fluid remains visible and renders after idle`, async () => {
        const before = await snapshot(page);
        await page.waitForTimeout(350);
        const after = await snapshot(page);
        assert.equal(after.visibility, 'visible', JSON.stringify(after));
        assert.ok(after.draws > before.draws, 'fluid canvas stopped drawing while motion is enabled');
        return { before, after };
      });
      await check(`${label}: a scrolling swipe keeps feeding the fluid trail`, async () => {
        const trace = await swipe(context, page, `${label.replace('/', '')}-touch.png`);
        assertFluidSwipe(trace);
        return trace;
      });
      if (route === 'cen100/') {
        await check('Pause / Play Motion changes touch mode without a reload', async () => {
          await toggleMotion(page, 'Pause motion');
          assert.equal(await page.locator('html').getAttribute('data-motion'), 'off');
          assert.equal(await page.locator('#fluidCanvas').count(), 0);
          const paused = await swipe(context, page);
          assert.ok(paused.after.events.some(event => event.type === 'pointercancel'), 'Pause Motion should restore native panning');
          await toggleMotion(page, 'Play motion');
          assert.equal(await page.locator('html').getAttribute('data-motion'), 'on');
          const resumed = await swipe(context, page);
          assertFluidSwipe(resumed);
          return { paused, resumed };
        });
        await check('two-finger pinch input is left to the browser', async () => {
          // A tap stops any prior swipe's inertia before starting a fresh gesture.
          await page.touchscreen.tap(195, 480);
          await page.evaluate(() => window.__touchFluidQA.reset());
          const cdp = await context.newCDPSession(page);
          try {
            const points = spread => [
              { id: 0, x: 195 - spread, y: 480 - spread, radiusX: 5, radiusY: 5 },
              { id: 1, x: 195 + spread, y: 480 + spread, radiusX: 5, radiusY: 5 },
            ];
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(40) });
            for (let step = 1; step <= 5; step += 1) {
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(40 + step * 10) });
              await page.waitForTimeout(25);
            }
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(92) });
            const beforeRelease = await snapshot(page);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [points(90)[0]] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await page.waitForTimeout(200);
            const trace = await snapshot(page);
            const pinches = trace.touches.filter(event => event.count === 2);
            assert.ok(pinches.length > 0, 'browser did not deliver any two-finger movement');
            assert.equal(trace.touches.some(event => event.prevented), false, `page intercepted part of a native pinch: ${JSON.stringify(trace.touches)}`);
            assert.ok(Math.abs(trace.scrollTop - beforeRelease.scrollTop) <= 1, `pinch release scrolled the page: ${beforeRelease.scrollTop} → ${trace.scrollTop}`);
            await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
            const nextSwipe = await swipe(context, page);
            assertFluidSwipe(nextSwipe);
            return { pinch: trace, nextSwipe };
          } finally {
            await cdp.detach();
          }
        });
      }
      await check(`${label}: no application errors`, () => assert.deepEqual(errors, []));
    } finally {
      await context.close();
    }
  }

  for (const options of [{ reducedMotion: 'reduce' }, { paused: true }]) {
    const { context, page, errors } = await open(options);
    const label = options.paused ? 'saved Pause Motion' : 'system reduced motion';
    try {
      await ready(page, 'cen100/');
      await check(`${label}: no fluid, normal touch scrolling remains usable`, async () => {
        assert.equal(await page.locator('html').getAttribute('data-motion'), 'off');
        assert.equal(await page.locator('#fluidCanvas').count(), 0);
        const trace = await swipe(context, page);
        assert.ok(trace.after.scrollTop > trace.before.scrollTop);
        assert.equal(trace.after.events.some(event => event.type === 'pointercancel'), true, `paused motion should retain native touch panning: ${JSON.stringify(trace)}`);
        assert.deepEqual(errors, []);
        return trace;
      });
    } finally {
      await context.close();
    }
  }

  const { context, page, errors } = await open({ mobile: false });
  try {
    await ready(page, 'cen100/');
    await check('keyboard PageDown still scrolls the course', async () => {
      await page.locator('main').focus();
      const before = await snapshot(page);
      await page.keyboard.press('PageDown');
      await waitOnPage(page, top => document.querySelector('main').scrollTop > top + 30, before.scrollTop);
      assert.deepEqual(errors, []);
      return { before, after: await snapshot(page) };
    });
  } finally {
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(reports, 'results.json'), JSON.stringify({
    emulation: 'Chromium touch emulation with SwiftShader; not physical iPhone Safari',
    results,
  }, null, 2));
  console.log(`Reports: ${reports}`);
}

if (results.some(result => !result.pass)) process.exitCode = 1;
