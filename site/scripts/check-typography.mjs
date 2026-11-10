/** Typography layout checks against the production export; not physical-device testing. */
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
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-typography-qa';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
const routes = [
  ['desk', ''], ['work', 'cen100/'], ['detail', 'cen100/#assignment-m2'], ['math', 'mth140/'],
];

async function ready(page, route) {
  await page.goto(url + route);
  await page.locator('main h1').first().waitFor();
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return getComputedStyle(main).pointerEvents === 'auto' && !main.classList.contains('lenis-stopped');
  });
  if (route) await page.locator('#course-section:not(:disabled)').waitFor();
  if (route.includes('#assignment')) await page.locator('[data-assignment-detail]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Course input becomes ready before the shell's entrance has finished.
  // Capture settled type, including the header, in the slower WebKit runner.
  await page.waitForFunction(() => {
    const header = document.querySelector('header');
    return header && Number(getComputedStyle(header).opacity) > 0.99;
  });
}

try {
  for (const engine of ['chromium', 'webkit']) {
    const browser = await playwright[engine].launch(engine === 'chromium'
      ? { executablePath: process.env.QA_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }
      : {});
    try {
      const widths = engine === 'chromium' ? [320, 390, 430, 820, 1440] : [390, 820];
      for (const width of widths) {
        for (const scheme of ['light', 'dark']) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          await page.clock.setFixedTime(new Date('2026-10-23T16:00:00Z'));
          try {
            for (const [name, route] of routes) {
              const label = `${engine}-${width}-${scheme}-${name}`;
              try {
                await ready(page, route);
                const metrics = await page.evaluate(() => {
                  const main = document.querySelector('main');
                  const heading = main.querySelector('h1');
                  const title = heading.querySelector('[class*="deskTitle"]') || heading;
                  const read = (e) => {
                    const s = getComputedStyle(e);
                    return { size: parseFloat(s.fontSize), leading: parseFloat(s.lineHeight), wordSpacing: s.wordSpacing, family: s.fontFamily };
                  };
                  const links = [...document.querySelectorAll('nav[aria-label="Course views"] a')];
                  return {
                    overflow: main.scrollWidth > main.clientWidth + 1,
                    heading: read(title),
                    nav: links.map((e) => {
                      const b = e.getBoundingClientRect();
                      return { ...read(e), text: e.textContent, x: b.x, y: b.y, right: b.right, height: b.height };
                    }),
                    // Context labels and date metadata have their own smaller roles.
                    // The 16px floor belongs to the assignment's reading body.
                    body: [...document.querySelectorAll('[data-assignment-detail] [class*="workspace_detailBody"] p')].filter((e) => e.getBoundingClientRect().height).map(read),
                  };
                });
                assert.equal(metrics.overflow, false, 'no horizontal page overflow');
                assert.ok(metrics.heading.size >= 32, 'course titles retain a readable display size');
                assert.ok(metrics.heading.leading >= metrics.heading.size, 'heading line boxes allow ascenders and descenders');
                for (const link of metrics.nav) {
                  assert.ok(link.size >= 16 && link.height >= 43.5, `readable touch tab: ${link.text}`);
                  assert.ok(link.x >= -1 && link.right <= width + 1, `visible touch tab: ${link.text}`);
                }
                if (name === 'math' && width >= 390) {
                  assert.ok(Math.max(...metrics.nav.map((e) => e.y)) - Math.min(...metrics.nav.map((e) => e.y)) < 2, 'five course tabs fit on one row');
                }
                if (name === 'detail') {
                  assert.ok(metrics.body.length > 0, 'assignment reading copy is present');
                  assert.ok(metrics.body.every((e) => e.size >= 16 && e.leading >= e.size * 1.4), 'assignment copy remains readable');
                }
                const fonts = await page.evaluate(async () => {
                  const specs = ['400 16px Inter', '500 18px Inter', '600 16px Inter', '400 40px "Inter Display"', '500 40px "Inter Display"'];
                  return Promise.all(specs.map(async (spec) => ({ spec, count: (await document.fonts.load(spec, 'Agjp I1lO0 Δπ∑×÷')).length, ready: document.fonts.check(spec) })));
                });
                assert.ok(fonts.every((e) => e.count > 0 && e.ready), 'self-hosted text and display faces load');
                await page.screenshot({ path: path.join(report, `${label}.png`) });
                if (name === 'detail') {
                  await page.locator('[data-assignment-detail]').scrollIntoViewIfNeeded();
                  await page.screenshot({ path: path.join(report, `${label}-reading.png`) });
                }
                results.push({ label, pass: true, metrics, fonts });
                console.log(`PASS ${label}`);
              } catch (error) {
                results.push({ label, pass: false, error: error.message });
                await page.screenshot({ path: path.join(report, `${label}-failure.png`) }).catch(() => {});
                console.error(`FAIL ${label}: ${error.message}`);
              }
            }
          } finally { await context.close(); }
        }
      }
      // A failed font request must leave usable text and controls, with no blank copy.
      const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        await page.route('**/fonts/**', (route) => route.abort());
        await ready(page, 'cen100/');
        assert.ok(await page.locator('main h1').isVisible());
        assert.equal(await page.locator('main').evaluate((e) => e.scrollWidth > e.clientWidth + 1), false);
        await page.screenshot({ path: path.join(report, `${engine}-font-fallback.png`) });
        results.push({ label: `${engine}-font-fallback`, pass: true });
      } catch (error) {
        results.push({ label: `${engine}-font-fallback`, pass: false, error: error.message });
      } finally { await context.close(); }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
}
assert.equal(results.filter((r) => !r.pass).length, 0, 'typography checks failed; inspect results.json and screenshots');
