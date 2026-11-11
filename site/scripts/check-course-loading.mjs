// Capture the FIRST frames, before hydration: settled screenshots missed the
// intro slide expanding iPhone's viewport and exposing the dark bottom layer.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-course-loading';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];

try {
  for (const engine of (process.env.QA_BROWSERS || 'chromium,webkit').split(',')) {
    const browser = await playwright[engine].launch(engine === 'chromium'
      ? { executablePath: process.env.QA_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }
      : {});
    try {
      const cases = [
        ['iphone', playwright.devices['iPhone 13 Pro Max']],
        ['iphone-dark', { ...playwright.devices['iPhone 13 Pro Max'], colorScheme: 'dark' }],
        ['ipad', playwright.devices['iPad (gen 7)']],
        ['android', playwright.devices['Pixel 7']],
        ['iphone-still', { ...playwright.devices['iPhone 13 Pro Max'], reducedMotion: 'reduce' }],
        ['desktop', { viewport: { width: 1440, height: 900 } }],
      ];
      for (const [device, options] of cases) {
        for (const course of ['cen100', 'mth140', 'mth141', 'chy102', 'pcs211']) {
          const label = `${engine}-${device}-${course}`;
          const context = await browser.newContext({ reducedMotion: 'no-preference', colorScheme: 'light', ...options });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          // Slow CPU work in Chromium makes brief startup states observable.
          // WebKit checks the same geometry without Chromium-only emulation.
          if (engine === 'chromium') await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 });
          await page.addInitScript(() => {
            window.loadingFrames = [];
            const sample = () => {
              const main = document.querySelector('main');
              const loader = document.querySelector('#loader');
              if (main && loader) {
                const rect = main.getBoundingClientRect();
                const cover = loader.getBoundingClientRect();
                const style = getComputedStyle(loader);
                window.loadingFrames.push({
                  time: performance.now(), width: innerWidth, height: innerHeight,
                  documentWidth: document.documentElement.scrollWidth,
                  left: rect.left, right: rect.right, mainOpacity: Number(getComputedStyle(main).opacity),
                  loader: style.display !== 'none' && style.visibility !== 'hidden' ? Number(style.opacity) : 0,
                  loaderBottom: cover.bottom,
                  stopped: !!document.querySelector('.lenis-stopped'),
                });
              }
              window.loadingFrame = requestAnimationFrame(sample);
            };
            sample();
          });
          try {
            await page.goto(`${base}${course}/`, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => {
              const main = document.querySelector('main');
              const loader = document.querySelector('#loader');
              return main && loader && getComputedStyle(main).opacity === '1' &&
                getComputedStyle(loader).display === 'none' && !document.querySelector('.lenis-stopped');
            });
            const frames = await page.evaluate(async () => {
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              cancelAnimationFrame(window.loadingFrame);
              return window.loadingFrames;
            });
            await writeFile(path.join(report, `${label}.json`), JSON.stringify(frames, null, 2));
            assert.ok(frames.length > 1, 'sample both startup and the settled page');
            if (device !== 'desktop') {
              for (const frame of frames) {
                assert.ok(frame.width <= options.viewport.width + 1, `viewport expanded: ${JSON.stringify(frame)}`);
                assert.ok(frame.height <= options.viewport.height + 1, `viewport grew below the loader: ${JSON.stringify(frame)}`);
                assert.ok(frame.documentWidth <= options.viewport.width + 1, `sideways document overflow: ${JSON.stringify(frame)}`);
                assert.ok(Math.abs(frame.left) <= 1 && Math.abs(frame.right - options.viewport.width) <= 1, `page left its full-width position: ${JSON.stringify(frame)}`);
                // At least one complete paper layer always covers the scene.
                assert.ok(frame.mainOpacity >= 0.99 || (frame.loader >= 0.99 && frame.loaderBottom >= frame.height - 1), `dark scene exposed during entry: ${JSON.stringify(frame)}`);
              }
            }
            assert.deepEqual(errors, []);
            await page.screenshot({ path: path.join(report, `${label}.png`) });
            results.push({ label, ok: true, frames: frames.length });
            console.log(`PASS ${label}: ${frames.length} startup frames`);
          } catch (error) {
            results.push({ label, ok: false, error: error.message });
            console.error(`FAIL ${label}: ${error.message}`);
          } finally {
            await context.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
}
assert.ok(results.length && results.every(result => result.ok), 'course loading checks failed');
