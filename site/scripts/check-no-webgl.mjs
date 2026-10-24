// CI browser check: the website still works where WebGL does not. Run after the production export.
//
// three.js throws "Error creating WebGL context." when a browser has WebGL turned off, and the site's 3D layer
// (background, pointer fluid, course badges, pre-footer stickers) is built on it. Each canvas is therefore mounted
// only where WebGL works, inside an error boundary (src/components/canvas/WebGLGate.jsx); this check proves the
// pages load, read and navigate without it, and that a browser with WebGL still gets the whole 3D layer.
//
//   disabled     Chromium started with --disable-webgl --disable-3d-apis --disable-gpu (what the setting does)
//   blocked      getContext('webgl'|'webgl2') returns null: the same answer in any engine (QA_BROWSER=webkit works)
//   late-failure the capability probe succeeds but building the renderer fails, so the error boundary has to
//                catch it (three passes context attributes, the probe does not)
//   control      WebGL works: every three.js canvas and the fluid are there and no stand-in is drawn
//
// Usage: PLAYWRIGHT_PATH=/path/to/node_modules/playwright QA_REPORT_DIR=<dir> node scripts/check-no-webgl.mjs
// QA_BROWSER=chromium (default) | webkit | firefox. disabled, late-failure and control need Chromium.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const engine = process.env.QA_BROWSER || 'chromium';
const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = path.join(process.env.QA_REPORT_DIR || '/tmp/tmu-no-webgl', engine);
await mkdir(report, { recursive: true });

const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = (route) => `${origin}${basePath}${route}`;

const SOFTWARE_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const WEBGL_OFF = ['--disable-webgl', '--disable-3d-apis', '--disable-gpu'];
const blockWebGL = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(kind, ...rest) {
    if (/webgl/i.test(kind)) return null;
    return original.call(this, kind, ...rest);
  };
};
// three.js always passes context attributes; the site's own probe never does.
// It counts what was granted (the probe) and refused (renderers), so the scenario can prove it reached the error boundary.
const failRenderer = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  window.__webglContexts = { granted: 0, refused: 0 };
  HTMLCanvasElement.prototype.getContext = function getContext(kind, attributes, ...rest) {
    const webgl = /webgl/i.test(kind);
    if (webgl && attributes !== undefined) {
      window.__webglContexts.refused += 1;
      return null;
    }
    const context = original.call(this, kind, attributes, ...rest);
    if (webgl && context) window.__webglContexts.granted += 1;
    return context;
  };
};

const SCENARIOS = [
  { name: 'disabled', engines: ['chromium'], args: WEBGL_OFF, webgl: false },
  { name: 'blocked', engines: ['chromium', 'webkit', 'firefox'], args: [], init: blockWebGL, webgl: false },
  { name: 'late-failure', engines: ['chromium'], args: SOFTWARE_GL, init: failRenderer, webgl: false, expectConsoleErrors: true, lateFailure: true },
  { name: 'control', engines: ['chromium'], args: SOFTWARE_GL, webgl: true },
];
const ROUTES = ['/', '/courses/', '/cen100/', '/mth140/', '/mth141/', '/privacy/', '/updates/'];
// the routes that end in the pre-footer, whose own canvas (the stickers) mounts only when the end of the page is near
const PREFOOTER_ROUTES = ['/', '/courses/', '/privacy/', '/updates/'];
const COURSE_CODES = ['CEN100', 'MTH140', 'MTH141'];

// The page is ready, or Next.js has replaced it with its error screen (reported by the caller, not timed out on).
const ready = (page) =>
  page.waitForFunction(() => {
    if (/Application error: a client-side exception/i.test(document.body.innerText)) return true;
    const main = document.querySelector('main');
    const loader = document.querySelector('#loader');
    return main && getComputedStyle(main).opacity === '1' && document.documentElement.dataset.motion && (!loader || getComputedStyle(loader).display === 'none');
  });

async function inspect(page, route, scenario, tracker, motion) {
  const label = `${scenario.name} ${route}${motion === 'reduce' ? ' (reduced motion)' : ''}`;
  await page.goto(url(route), { waitUntil: 'load' });
  await ready(page);
  // the three.js layer mounts right after hydration; give a failing canvas time to fail
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => ({
    text: document.body.innerText,
    heading: !!document.querySelector('main h1, main h2'),
    threeCanvases: document.querySelectorAll('canvas[data-engine]').length,
    fluid: !!document.getElementById('fluidCanvas'),
    standIns: [...document.querySelectorAll('[data-badge-fallback]')].map((element) => element.textContent),
  }));
  assert.ok(!/Application error: a client-side exception/i.test(state.text), `${label}: Next.js application error screen`);
  assert.ok(state.heading, `${label}: the page has its heading`);
  assert.deepEqual(tracker.pageErrors, [], `${label}: uncaught errors`);
  if (!scenario.expectConsoleErrors) assert.deepEqual(tracker.consoleErrors, [], `${label}: console errors`);
  if (scenario.webgl) {
    // reduced motion draws the shared and background canvases and leaves the pointer fluid out
    const reduced = motion === 'reduce';
    assert.ok(state.threeCanvases >= (reduced ? 2 : 3), `${label}: the three.js canvases are drawn (${state.threeCanvases})`);
    assert.equal(state.fluid, !reduced, `${label}: the pointer fluid is ${reduced ? 'left out' : 'there'}`);
    assert.deepEqual(state.standIns, [], `${label}: no stand-in badges where WebGL works`);
  } else {
    assert.equal(state.threeCanvases, 0, `${label}: no three.js canvas without WebGL`);
    assert.ok(!state.fluid, `${label}: no pointer fluid without WebGL`);
    if (route === '/') {
      assert.equal(state.standIns.length, COURSE_CODES.length, `${label}: a stand-in badge for each course`);
      COURSE_CODES.forEach((code, index) => assert.ok(state.standIns[index].includes(code), `${label}: stand-in ${index + 1} shows ${code}`));
    } else {
      assert.deepEqual(state.standIns, [], `${label}: no stand-in outside the Desk`);
    }
  }

  if (scenario.lateFailure) {
    const contexts = await page.evaluate(() => window.__webglContexts);
    assert.ok(contexts.granted >= 1, `${label}: the capability probe got a context (${JSON.stringify(contexts)})`);
    assert.ok(contexts.refused >= 1, `${label}: a renderer was refused, so the error boundary was reached (${JSON.stringify(contexts)})`);
    assert.ok(tracker.consoleErrors.length > 0 && tracker.consoleErrors.every((text) => /webgl/i.test(text)), `${label}: only the expected WebGL errors are logged: ${tracker.consoleErrors.join(' | ')}`);
  }

  // The pre-footer's canvas (the stickers) mounts only near the end of the page: go there and look again.
  // (it counts as near only while really on screen: the scroller clips it, so scrolling past it is not enough)
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('main h2')].find((element) => /Open a course guide below/.test(element.textContent));
    if (heading) heading.scrollIntoView({ block: 'center' });
    else document.querySelector('main').scrollTop = document.querySelector('main').scrollHeight;
  });
  if (scenario.webgl && motion !== 'reduce' && PREFOOTER_ROUTES.includes(route)) {
    await page.waitForFunction(() => document.querySelectorAll('canvas[data-engine]').length >= 4, null, { timeout: 15000 }).catch(() => {});
  } else {
    await page.waitForTimeout(2000);
  }
  const end = await page.evaluate(() => ({ text: document.body.innerText, threeCanvases: document.querySelectorAll('canvas[data-engine]').length }));
  assert.ok(!/Application error: a client-side exception/i.test(end.text), `${label}: Next.js application error screen at the end of the page`);
  assert.deepEqual(tracker.pageErrors, [], `${label}: uncaught errors at the end of the page`);
  if (!scenario.expectConsoleErrors) assert.deepEqual(tracker.consoleErrors, [], `${label}: console errors at the end of the page`);
  if (scenario.webgl) {
    const expected = motion !== 'reduce' && PREFOOTER_ROUTES.includes(route) ? 4 : 0;
    if (expected) assert.ok(end.threeCanvases >= expected, `${label}: the pre-footer canvas joins the others (${end.threeCanvases})`);
  } else {
    assert.equal(end.threeCanvases, 0, `${label}: no three.js canvas at the end of the page either`);
  }
  return state;
}

const results = [];
let failed = false;
const browsers = {};
try {
  for (const scenario of SCENARIOS) {
    if (!scenario.engines.includes(engine)) continue;
    const key = scenario.args.join(' ');
    browsers[key] ||= await playwright[engine].launch({ headless: true, args: scenario.args });
    const browser = browsers[key];
    for (const motion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: motion });
      if (scenario.init) await context.addInitScript(scenario.init);
      try {
        for (const route of motion === 'reduce' ? ['/'] : ROUTES) {
          const page = await context.newPage();
          const tracker = { pageErrors: [], consoleErrors: [] };
          page.on('pageerror', (error) => tracker.pageErrors.push(String(error.message || error)));
          page.on('console', (message) => {
            if (message.type() === 'error') tracker.consoleErrors.push(message.text().slice(0, 200));
          });
          const name = `${scenario.name}-${motion === 'reduce' ? 'reduced-' : ''}${route === '/' ? 'desk' : route.replaceAll('/', '')}`;
          try {
            await inspect(page, route, scenario, tracker, motion);
            results.push({ name, ok: true });
          } catch (error) {
            failed = true;
            results.push({ name, ok: false, error: error.message });
          }
          await page.screenshot({ path: path.join(report, `${name}.png`) }).catch(() => {});
          await page.close();
        }

        if (motion === 'no-preference') {
          // client-side navigation, in and out of the Desk, and scrolling, with nothing from the 3D layer
          const page = await context.newPage();
          const tracker = { pageErrors: [] };
          page.on('pageerror', (error) => tracker.pageErrors.push(String(error.message || error)));
          const name = `${scenario.name}-navigation`;
          try {
            await page.goto(url('/'), { waitUntil: 'load' });
            await ready(page);
            await page.mouse.move(640, 400);
            await page.mouse.wheel(0, 900);
            // Lenis is still easing after the wheel, and the course text moves with the scroll: click once it has settled
            await page.waitForFunction(
              () => {
                const top = document.querySelector('main').scrollTop;
                const settled = top > 100 && top === window.__lastScrollTop;
                window.__lastScrollTop = top;
                return settled;
              },
              null,
              { polling: 300, timeout: 10000 },
            );
            await page.locator('a', { hasText: /open guide/i }).first().click();
            await page.waitForURL(/\/(cen100|mth140|mth141)\/$/);
            await ready(page);
            await page.waitForSelector('main h1');
            await page.goBack();
            await page.waitForURL(new RegExp(`${basePath}/$`));
            await ready(page);
            await page.waitForSelector('main h1');
            assert.deepEqual(tracker.pageErrors, [], `${name}: uncaught errors`);
            assert.ok(!/Application error: a client-side exception/i.test(await page.evaluate(() => document.body.innerText)), `${name}: application error screen`);
            results.push({ name, ok: true });
          } catch (error) {
            failed = true;
            results.push({ name, ok: false, error: error.message });
          }
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await Promise.all(Object.values(browsers).map((browser) => browser.close()));
  server.close();
}

const lines = [`# Website without WebGL (${engine})`, '', ...results.map((result) => (result.ok ? `- pass ${result.name}` : `- FAIL ${result.name}: ${result.error}`))];
await writeFile(path.join(report, 'summary.md'), `${lines.join('\n')}\n`);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
console.log(lines.join('\n'));
if (failed || !results.length) {
  console.error(results.length ? 'The website fails without WebGL.' : `No scenario runs on ${engine}.`);
  process.exit(1);
}
