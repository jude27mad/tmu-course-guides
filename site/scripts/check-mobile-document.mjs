// Verifies native document scrolling, not Safari's proprietary toolbar UI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';
const require = createRequire(import.meta.url);
const engines = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const reports = process.env.QA_REPORT_DIR || path.join(site, '.mobile-document-qa');
await mkdir(reports, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
async function check(name, run) {
  try { const detail = await run(); results.push({ name, pass: true, detail }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function wait(page, predicate) {
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    if (await page.evaluate(predicate)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${predicate}`);
}
async function ready(page) {
  await wait(page, () => {
    const main = document.querySelector('main');
    return main && Number(getComputedStyle(main).opacity) > .99
      && getComputedStyle(main).pointerEvents !== 'none'
      && !document.querySelector('#layout')?.hasAttribute('inert')
      && Math.abs(main.getBoundingClientRect().x) < 1;
  });
}
function geometry() {
  const main = document.querySelector('main');
  const layout = document.querySelector('#layout');
  const loader = document.querySelector('#loader');
  return {
    windowScroll: window.scrollY,
    mainScroll: main.scrollTop,
    mainHeight: main.getBoundingClientRect().height,
    viewport: innerHeight,
    rootHeight: document.scrollingElement.scrollHeight,
    mainPosition: getComputedStyle(main).position,
    mainOverflow: getComputedStyle(main).overflowY,
    layoutOverflow: getComputedStyle(layout).overflowY,
    loaderDisplay: loader && getComputedStyle(loader).display,
  };
}
try {
  for (const engine of ['chromium', 'webkit']) {
    const browser = await engines[engine].launch(engine === 'chromium' ? {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    } : {});
    try {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, reducedMotion });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          for (const route of ['', 'courses/', 'cen100/', 'mth140/', 'mth141/', 'privacy/']) {
            await check(`${engine} ${reducedMotion} ${route || 'home'}: document scrolls, not a clipped main`, async () => {
              await page.goto(base + route);
              await ready(page);
              await wait(page, () => !document.querySelector('#loader') || getComputedStyle(document.querySelector('#loader')).display === 'none');
              const before = await page.evaluate(geometry);
              assert.notEqual(before.mainPosition, 'fixed', JSON.stringify(before));
              assert.ok(!['auto', 'scroll', 'hidden'].includes(before.mainOverflow), JSON.stringify(before));
              assert.ok(!['auto', 'scroll', 'hidden'].includes(before.layoutOverflow), JSON.stringify(before));
              assert.ok(before.rootHeight > before.viewport + 100, JSON.stringify(before));
              await page.evaluate(() => window.scrollTo(0, 300));
              await wait(page, () => window.scrollY > 150);
              const after = await page.evaluate(geometry);
              assert.equal(after.mainScroll, 0);
              const preserved = after.windowScroll;
              await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
              await page.getByRole('button', { name: 'Close menu', exact: true }).tap();
              await ready(page);
              await page.waitForTimeout(1000);
              assert.ok(Math.abs((await page.evaluate(() => scrollY)) - preserved) <= 2, 'menu changed the reading position');
              await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
              await page.screenshot({ path: path.join(reports, `${engine}-${reducedMotion}-${route.replace('/', '') || 'home'}.png`) });
              assert.deepEqual(errors, []);
              return { before, after };
            });
          }
          await check(`${engine} ${reducedMotion}: menu navigation resets the document`, async () => {
            await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
            await page.locator('#menu a[href$="/cen100/"]').first().tap();
            await page.waitForURL('**/cen100/');
            await ready(page);
            await wait(page, () => scrollY < 2);
            assert.deepEqual(errors, []);
          });
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(reports, 'results.json'), JSON.stringify({
    limitation: 'Desktop WebKit/Chromium emulate mobile pages, not actual iPhone Safari toolbar painting.', results,
  }, null, 2));
}
if (results.some(result => !result.pass)) process.exitCode = 1;
