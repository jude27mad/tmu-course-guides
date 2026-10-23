import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || path.join(site, '.ios-scroll-qa');
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
let browser;
async function ready(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const loader = document.querySelector('#loader');
    return main && getComputedStyle(main).opacity === '1'
      && !document.querySelector('#layout')?.hasAttribute('inert')
      && (!loader || getComputedStyle(loader).display === 'none');
  }, null, { timeout: 25000 });
}
try {
  browser = await webkit.launch({ headless: true });
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: motion });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      for (const route of ['', 'courses/', 'cen100/', 'mth140/', 'mth141/', 'privacy/']) {
        await page.goto(base + route);
        await ready(page);
        const initial = await page.evaluate(() => {
          const main = document.querySelector('main');
          return { mode: document.documentElement.dataset.scrollMode, position: getComputedStyle(main).position,
            overflow: getComputedStyle(main).overflowY, layoutOverflow: getComputedStyle(document.querySelector('#layout')).overflowY,
            docHeight: document.scrollingElement.scrollHeight, viewport: innerHeight };
        });
        assert.equal(initial.mode, 'document', route);
        assert.notEqual(initial.position, 'fixed', route);
        assert.ok(!['hidden', 'scroll', 'auto'].includes(initial.overflow), JSON.stringify(initial));
        assert.ok(!['hidden', 'scroll', 'auto'].includes(initial.layoutOverflow), JSON.stringify(initial));
        assert.ok(initial.docHeight > initial.viewport + 100, JSON.stringify(initial));
        await page.evaluate(() => window.scrollTo(0, 300));
        await page.waitForFunction(() => scrollY > 150, null, { timeout: 3000 });
        await page.screenshot({ path: path.join(report, `${motion}-${route.replaceAll('/', '') || 'desk'}.png`) });
        assert.deepEqual(errors, []);
        results.push({ route, motion, pass: true, initial });
        console.log('PASS', motion, route || 'desk');
      }
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
}
