// CI browser check: the website still works where WebGL does not. Run after the production export.
//
// three.js throws "Error creating WebGL context." when a browser has WebGL turned off, and the site's 3D layer
// (background, pointer fluid, course badges, pre-footer stickers) is built on it. Each canvas is therefore mounted
// only where WebGL works, inside an error boundary (src/components/canvas/WebGLGate.jsx); this check proves the
// pages load, read and navigate without it, and that a browser with WebGL still gets the whole 3D layer.
//
//   disabled        Chromium started with --disable-webgl --disable-3d-apis --disable-gpu (what the setting does)
//   blocked         getContext('webgl'|'webgl2') returns null: the same answer in any engine (QA_BROWSER=webkit works)
//   late-failure    the capability probe succeeds but building the renderer fails, so the error boundary has to
//                   catch it (three passes context attributes, the probe does not)
//   second-failure  the first renderer is built and a later one fails: the canvases already drawing are taken down
//                   with it and the badges swap to their stand-ins
//   control         WebGL works: every three.js canvas and the fluid are there, no stand-in is drawn, and the 3D
//                   badges really paint their windows
//   gpu-lost        the GPU goes away after load and never comes back: the layer turns itself off
//   gpu-reset       every context is lost and then restored: the layer stays on
//
// Usage: PLAYWRIGHT_PATH=/path/to/node_modules/playwright QA_REPORT_DIR=<dir> node scripts/check-no-webgl.mjs
// QA_BROWSER=chromium (default) | webkit | firefox; QA_CHROMIUM_PATH selects a Chromium binary; QA_ONLY=gpu,control
// runs only the scenarios whose names start with those prefixes. Only `blocked`
// runs outside Chromium (it needs no GPU flags), and the scroll-and-click navigation step is Chromium's alone.
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
await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const url = (route) => `${origin}${basePath}${route}`;

const SOFTWARE_GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const WEBGL_OFF = ['--disable-webgl', '--disable-3d-apis', '--disable-gpu'];
const ERROR_SCREEN = /Application error: a client-side exception/i;

const blockWebGL = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(kind, ...rest) {
    if (/webgl/i.test(kind)) return null;
    return original.call(this, kind, ...rest);
  };
};
// three.js always passes context attributes; the site's own probe (and its context-loss check) never does. Renderer
// contexts beyond the first `allow` are refused, and the counts let a scenario prove it reached the error boundary.
const failRenderers = (allow) => {
  const original = HTMLCanvasElement.prototype.getContext;
  window.__webglContexts = { probes: 0, renderers: 0, refused: 0 };
  HTMLCanvasElement.prototype.getContext = function getContext(kind, attributes, ...rest) {
    const webgl = /webgl/i.test(kind);
    if (webgl && attributes !== undefined) {
      if (window.__webglContexts.renderers >= allow) {
        window.__webglContexts.refused += 1;
        return null;
      }
      window.__webglContexts.renderers += 1;
    } else if (webgl) {
      window.__webglContexts.probes += 1;
    }
    return original.call(this, kind, attributes, ...rest);
  };
};

const SCENARIOS = [
  { name: 'disabled', engines: ['chromium'], args: WEBGL_OFF, webgl: false },
  { name: 'blocked', engines: ['chromium', 'webkit', 'firefox'], args: [], init: blockWebGL, webgl: false },
  { name: 'late-failure', engines: ['chromium'], args: SOFTWARE_GL, init: failRenderers, initArg: 0, webgl: false, expectConsoleErrors: true, rendererFailure: true },
  { name: 'second-failure', engines: ['chromium'], args: SOFTWARE_GL, init: failRenderers, initArg: 1, webgl: false, expectConsoleErrors: true, rendererFailure: true },
  { name: 'control', engines: ['chromium'], args: SOFTWARE_GL, webgl: true },
];
// QA_ONLY=gpu,control runs only the scenarios whose names start with one of these (debugging aid)
const only = (process.env.QA_ONLY || '').split(',').filter(Boolean);
const wanted = (name) => !only.length || only.some((prefix) => name.startsWith(prefix));
const ROUTES = ['/', '/courses/', '/cen100/', '/mth140/', '/mth141/', '/privacy/', '/updates/', '/404.html'];
// the routes that end in the pre-footer, whose own canvas (the stickers) mounts only when the end of the page is near
const PREFOOTER_ROUTES = ['/', '/courses/', '/privacy/', '/updates/'];
const COURSE_CODES = ['CEN100', 'MTH140', 'MTH141'];
const BADGE_WINDOW = 'section[aria-labelledby="desk-courses-heading"] [data-surface="dark"]';

// The page is ready, or Next.js has replaced it with its error screen (reported by the caller, not timed out on).
const ready = (page) =>
  page.waitForFunction(() => {
    if (/Application error: a client-side exception/i.test(document.body.innerText)) return true;
    const main = document.querySelector('main');
    const loader = document.querySelector('#loader');
    return main && getComputedStyle(main).opacity === '1' && document.documentElement.dataset.motion && (!loader || getComputedStyle(loader).display === 'none');
  });

const pageState = (page) =>
  page.evaluate(() => ({
    text: document.body.innerText,
    heading: !!document.querySelector('main h1, main h2'),
    threeCanvases: document.querySelectorAll('canvas[data-engine]').length,
    fluid: !!document.getElementById('fluidCanvas'),
    standIns: [...document.querySelectorAll('[data-badge-fallback]')].map((element) => element.textContent),
  }));

// How many light pixels the first badge window holds: the 3D card and band print light text on the dark panel.
async function lightPixels(page) {
  const frame = page.locator(BADGE_WINDOW).first();
  await frame.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const png = await frame.screenshot();
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let light = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 450) light += 1;
    return light;
  }, png.toString('base64'));
}

async function inspect(page, route, scenario, tracker, motion) {
  const reduced = motion === 'reduce';
  const label = `${scenario.name} ${route}${reduced ? ' (reduced motion)' : ''}`;
  await page.goto(url(route), { waitUntil: 'load' });
  // the 404 page sends the reader to the Desk once it has hydrated
  if (route === '/404.html') await page.waitForURL((address) => !address.pathname.endsWith('/404.html'), { timeout: 15000 });
  await ready(page);
  // the three.js layer mounts right after hydration; give a failing canvas time to fail
  await page.waitForTimeout(1500);
  const where = route === '/404.html' ? '/' : route;
  const state = await pageState(page);
  assert.ok(!ERROR_SCREEN.test(state.text), `${label}: Next.js application error screen`);
  assert.ok(state.heading, `${label}: the page has its heading`);
  assert.deepEqual(tracker.pageErrors, [], `${label}: uncaught errors`);
  if (!scenario.expectConsoleErrors) assert.deepEqual(tracker.consoleErrors, [], `${label}: console errors`);
  if (scenario.webgl) {
    // reduced motion draws the shared and background canvases and leaves the pointer fluid out
    assert.ok(state.threeCanvases >= (reduced ? 2 : 3), `${label}: the three.js canvases are drawn (${state.threeCanvases})`);
    assert.equal(state.fluid, !reduced, `${label}: the pointer fluid is ${reduced ? 'left out' : 'there'}`);
    assert.deepEqual(state.standIns, [], `${label}: no stand-in badges where WebGL works`);
    if (where === '/' && !reduced) {
      // the 3D badges really paint their windows (the stand-ins are not there to do it)
      let light = 0;
      for (let attempt = 0; attempt < 40 && light < 150; attempt += 1) {
        light = await lightPixels(page);
        if (light < 150) await page.waitForTimeout(750);
      }
      assert.ok(light >= 150, `${label}: the 3D badge paints its window (${light} light pixels)`);
    }
  } else {
    assert.equal(state.threeCanvases, 0, `${label}: no three.js canvas without WebGL`);
    assert.ok(!state.fluid, `${label}: no pointer fluid without WebGL`);
    if (where === '/') {
      assert.equal(state.standIns.length, COURSE_CODES.length, `${label}: a stand-in badge for each course`);
      COURSE_CODES.forEach((code, index) => assert.ok(state.standIns[index].includes(code), `${label}: stand-in ${index + 1} shows ${code}`));
    } else {
      assert.deepEqual(state.standIns, [], `${label}: no stand-in outside the Desk`);
    }
  }

  if (scenario.rendererFailure) {
    const contexts = await page.evaluate(() => window.__webglContexts);
    assert.ok(contexts.probes >= 1, `${label}: the capability probe got a context (${JSON.stringify(contexts)})`);
    assert.ok(contexts.refused >= 1, `${label}: a renderer was refused, so the error boundary was reached (${JSON.stringify(contexts)})`);
    assert.equal(contexts.renderers, scenario.initArg, `${label}: renderers built before the failure (${JSON.stringify(contexts)})`);
    assert.ok(tracker.consoleErrors.length > 0 && tracker.consoleErrors.every((text) => /webgl/i.test(text)), `${label}: only the expected WebGL errors are logged: ${tracker.consoleErrors.join(' | ')}`);
  }

  // The pre-footer's canvas (the stickers) mounts only near the end of the page: go there and look again.
  // (it counts as near only while really on screen: the scroller clips it, so scrolling past it is not enough)
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('main h2')].find((element) => /Open a course guide below/.test(element.textContent));
    if (heading) heading.scrollIntoView({ block: 'center' });
    else document.querySelector('main').scrollTop = document.querySelector('main').scrollHeight;
  });
  if (scenario.webgl && !reduced && PREFOOTER_ROUTES.includes(where)) {
    await page.waitForFunction(() => document.querySelectorAll('canvas[data-engine]').length >= 4, null, { timeout: 15000 }).catch(() => {});
  } else {
    await page.waitForTimeout(2000);
  }
  const end = await pageState(page);
  assert.ok(!ERROR_SCREEN.test(end.text), `${label}: Next.js application error screen at the end of the page`);
  assert.deepEqual(tracker.pageErrors, [], `${label}: uncaught errors at the end of the page`);
  if (!scenario.expectConsoleErrors) assert.deepEqual(tracker.consoleErrors, [], `${label}: console errors at the end of the page`);
  if (scenario.webgl) {
    if (!reduced && PREFOOTER_ROUTES.includes(where)) assert.ok(end.threeCanvases >= 4, `${label}: the pre-footer canvas joins the others (${end.threeCanvases})`);
  } else {
    assert.equal(end.threeCanvases, 0, `${label}: no three.js canvas at the end of the page either`);
  }
}

// WebGL goes away after the page has loaded. `restore`: the contexts come back (a GPU reset) instead of staying lost.
async function inspectGpuLoss(page, tracker, { restore }) {
  const label = restore ? 'gpu-reset /' : 'gpu-lost /';
  await page.goto(url('/'), { waitUntil: 'load' });
  await ready(page);
  await page.waitForFunction(() => document.querySelectorAll('canvas[data-engine]').length >= 3, null, { timeout: 15000 });
  const before = await pageState(page);
  assert.equal(before.standIns.length, 0, `${label}: starts with the 3D layer`);
  // A lost context hands out no extensions, so keep each canvas's WEBGL_lose_context before losing it.
  await page.evaluate(() => {
    window.__gpu = [...document.querySelectorAll('canvas[data-engine]')].map((canvas) => canvas.getContext('webgl2').getExtension('WEBGL_lose_context'));
  });
  const lose = (action) =>
    page.evaluate((what) => {
      window.__gpu.forEach((extension) => (what === 'lose' ? extension.loseContext() : extension.restoreContext()));
    }, action);
  await lose('lose');
  if (restore) {
    await page.waitForTimeout(1000);
    await lose('restore');
    // longer than the layer's grace period for a loss that lasts
    await page.waitForTimeout(7500);
    const after = await pageState(page);
    assert.ok(!ERROR_SCREEN.test(after.text), `${label}: Next.js application error screen`);
    assert.ok(after.threeCanvases >= 3, `${label}: the 3D layer is still there after the contexts came back (${after.threeCanvases})`);
    assert.deepEqual(after.standIns, [], `${label}: no stand-in after a reset`);
  } else {
    await page.waitForFunction(() => document.querySelectorAll('[data-badge-fallback]').length === 3, null, { timeout: 15000 });
    const after = await pageState(page);
    assert.ok(!ERROR_SCREEN.test(after.text), `${label}: Next.js application error screen`);
    assert.equal(after.threeCanvases, 0, `${label}: the 3D layer is taken down`);
    assert.ok(!after.fluid, `${label}: no pointer fluid`);
    assert.ok(after.heading, `${label}: the page still reads`);
  }
  // (uncaught errors are not asserted here: three.js itself throws from its shader-log reading at the instant of
  // a loss, outside React; what matters is that Next.js never shows its error screen, checked above)
  assert.ok(tracker.pageErrors.every((error) => !/Application error/i.test(error)), `${label}: ${tracker.pageErrors.join(' | ')}`);
}

const results = [];
let failed = false;
const record = (name, error) => {
  if (error) failed = true;
  results.push(error ? { name, ok: false, error: error.message } : { name, ok: true });
};
const browsers = {};
const launch = (args) => {
  const key = args.join(' ');
  browsers[key] ||= playwright[engine].launch({ headless: true, args, ...(engine === 'chromium' && process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}) });
  return browsers[key];
};
const track = (page) => {
  const tracker = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (error) => tracker.pageErrors.push(String(error.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') tracker.consoleErrors.push(message.text().slice(0, 200));
  });
  return tracker;
};
const screenshot = (page, name) => page.screenshot({ path: path.join(report, `${name}.png`) }).catch(() => {});

try {
  for (const scenario of SCENARIOS.filter((candidate) => candidate.engines.includes(engine) && wanted(candidate.name))) {
    const browser = await launch(scenario.args);
    for (const motion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: motion });
      if (scenario.init) await context.addInitScript(scenario.init, scenario.initArg);
      try {
        for (const route of motion === 'reduce' ? ['/'] : ROUTES) {
          const page = await context.newPage();
          const tracker = track(page);
          const name = `${scenario.name}-${motion === 'reduce' ? 'reduced-' : ''}${route === '/' ? 'desk' : route.replaceAll('/', '').replace('.html', '')}`;
          try {
            await inspect(page, route, scenario, tracker, motion);
            record(name);
          } catch (error) {
            record(name, error);
          }
          await screenshot(page, name);
          await page.close();
        }

        // Client-side navigation out of and back to the Desk, with wheel scrolling, with nothing from the 3D layer.
        // Chromium only: the wheel-and-click sequence is not worth a flake in the other engines.
        if (motion === 'no-preference' && engine === 'chromium') {
          const page = await context.newPage();
          const tracker = track(page);
          const name = `${scenario.name}-navigation`;
          try {
            await page.goto(url('/'), { waitUntil: 'load' });
            await ready(page);
            assert.ok(!ERROR_SCREEN.test(await page.evaluate(() => document.body.innerText)), `${name}: application error screen before navigating`);
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
            await page
              .locator('a', { hasText: /open guide/i })
              .first()
              .click();
            await page.waitForURL(/\/(cen100|mth140|mth141)\/$/);
            await ready(page);
            await page.waitForSelector('main h1');
            await page.goBack();
            await page.waitForURL(new RegExp(`${basePath}/$`));
            await ready(page);
            await page.waitForSelector('main h1');
            assert.deepEqual(tracker.pageErrors, [], `${name}: uncaught errors`);
            assert.ok(!ERROR_SCREEN.test(await page.evaluate(() => document.body.innerText)), `${name}: application error screen`);
            record(name);
          } catch (error) {
            record(name, error);
          }
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  }

  // WebGL going away after the page has loaded (Chromium with software GL, like the control)
  if (engine === 'chromium') {
    const browser = await launch(SOFTWARE_GL);
    for (const restore of [false, true].filter((value) => wanted(value ? 'gpu-reset' : 'gpu-lost'))) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const tracker = track(page);
      const name = restore ? 'gpu-reset' : 'gpu-lost';
      try {
        await inspectGpuLoss(page, tracker, { restore });
        record(name);
      } catch (error) {
        record(name, error);
      }
      await screenshot(page, name);
      await context.close();
    }
  }
} finally {
  await Promise.all(Object.values(browsers).map(async (browser) => (await browser).close()));
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
