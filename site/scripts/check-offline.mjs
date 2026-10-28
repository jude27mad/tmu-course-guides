// Browser check for the offline copy (public/sw.js) and the start-up failsafe, after `pages-site.mjs build`:
//   PLAYWRIGHT_PATH=/path/to/node_modules/playwright node scripts/check-offline.mjs <folder>
// Serves the folder as GitHub Pages would, visits the Desk once with ?offline-check (browser automation
// otherwise skips the registration), waits until every route is saved, then goes offline and opens each
// course, an assignment detail, a link between courses and an unknown address. Online, a changed page must
// win over the saved one, and the saved copy must follow it.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { pagesServer, BASE } from './pages-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const folder = resolve(process.argv[2] || '');

// The Pages server, except that /cen100/ can be swapped for a marked copy to prove online freshness.
let marker = '';
const pages = pagesServer(folder);
const server = createServer(async (req, res) => {
  if (marker && new URL(req.url, 'http://x').pathname === `${BASE}/cen100/`) {
    const html = (await readFile(join(folder, 'cen100/index.html'), 'utf8')).replace('<body>', `<body data-offline-marker="${marker}">`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  return pages.emit('request', req, res);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const site = `http://127.0.0.1:${server.address().port}${BASE}/`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const results = [];
async function check(name, run) {
  try {
    await run();
    results.push(['ok', name]);
    console.log(`ok   ${name}`);
  } catch (error) {
    results.push(['FAIL', name]);
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  }
}
const heading = () => page.locator('h1').first().innerText();
const saved = () =>
  page.evaluate(async (base) => {
    const cache = await caches.open('guides-pages-v1');
    return (await cache.keys()).map((request) => new URL(request.url).pathname.slice(base.length));
  }, BASE + '/');

await check('registers and saves every route after the first visit', async () => {
  await page.goto(`${site}?offline-check`, { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  // waitForFunction treats a returned promise as truthy, so poll the Cache API from here.
  const stamped = () => page.evaluate(async (base) => !!(await (await caches.open('guides-pages-v1')).match(`${base}__offline-saved`)), BASE + '/');
  for (let waited = 0; !(await stamped()); waited += 500) {
    if (waited > 30000) throw new Error('the offline copy was not saved within 30 s');
    await page.waitForTimeout(500);
  }
  const keys = await saved();
  for (const route of ['', 'courses/', 'cen100/', 'mth140/', 'mth141/', 'privacy/', 'updates/']) assert.ok(keys.includes(route), `missing ${route || 'Desk'} in ${JSON.stringify(keys)}`);
});

await context.setOffline(true);

await check('offline: each course opens with its work list', async () => {
  for (const [route, title] of [
    ['mth140/', 'Calculus I'],
    ['mth141/', 'Linear Algebra'],
    ['cen100/', 'Intro to Engineering'],
  ]) {
    await page.goto(`${site}${route}`, { waitUntil: 'load' });
    assert.equal(await heading(), title);
    await page.locator('[data-assignment-link]').first().waitFor({ timeout: 15000 });
  }
});

await check('offline: an assignment detail opens from its address', async () => {
  await page.goto(`${site}cen100/#assignment-m2`, { waitUntil: 'load' });
  await page.locator('[data-assignment-detail]').waitFor({ timeout: 15000 });
});

await check('offline: a link to another course opens it', async () => {
  await page.goto(`${site}mth140/`, { waitUntil: 'load' });
  await page.locator('[data-assignment-link]').first().waitFor({ timeout: 15000 });
  await page.evaluate((base) => document.querySelector(`a[href="${base}mth141/"]`).click(), BASE + '/');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Linear Algebra', null, { timeout: 15000 });
});

await check('offline: the Desk and a folder address without its slash open', async () => {
  await page.goto(site, { waitUntil: 'load' });
  await page.locator('#desk-next-heading, [data-desk-deadline]').first().waitFor({ timeout: 15000 });
  await page.goto(`${site}privacy`, { waitUntil: 'load' });
  assert.equal(await heading(), 'Privacy');
});

await check('offline: an address never saved explains itself', async () => {
  const response = await page.goto(`${site}not-a-page/`, { waitUntil: 'load' });
  assert.equal(response.status(), 503);
  assert.match(await page.locator('h1').innerText(), /You're offline/);
});

await context.setOffline(false);

await check('online: a changed page wins over the saved copy, and the copy follows it', async () => {
  marker = 'fresh';
  await page.goto(`${site}cen100/`, { waitUntil: 'load' });
  assert.equal(await page.locator('body').getAttribute('data-offline-marker'), 'fresh');
  await context.setOffline(true);
  await page.goto(`${site}cen100/`, { waitUntil: 'load' });
  assert.equal(await page.locator('body').getAttribute('data-offline-marker'), 'fresh');
  await context.setOffline(false);
  marker = '';
});

await check('no page errors', async () => {
  assert.deepEqual(errors, []);
});

// Start-up failsafe (_document BOOT): a start-up script that fails shows the readable page, not the curtain.
await check('a failed app script shows the readable page instead of the curtain', async () => {
  const failed = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tab = await failed.newPage();
  await tab.route(/\/_next\/static\/chunks\/pages\/_app-[^/]+\.js$/, (route) => route.abort());
  await tab.goto(`${site}cen100/`, { waitUntil: 'load' });
  await tab.waitForFunction(() => document.documentElement.hasAttribute('data-failsafe'), null, { timeout: 5000 });
  assert.equal(await tab.locator('#loader').isVisible(), false);
  assert.equal(await tab.locator('h1').first().innerText(), 'Intro to Engineering');
  assert.equal(await tab.evaluate(() => getComputedStyle(document.querySelector('main')).opacity), '1');
  await failed.close();
});

await check('a slow app script still gets the normal arrival', async () => {
  const slow = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tab = await slow.newPage();
  await tab.route(/\/_next\/static\/chunks\/pages\/_app-[^/]+\.js$/, async (route) => {
    await new Promise((done) => setTimeout(done, 3000));
    await route.continue();
  });
  await tab.goto(`${site}cen100/`, { waitUntil: 'load' });
  await tab.locator('[data-assignment-link]').first().waitFor({ timeout: 20000 });
  assert.equal(await tab.evaluate(() => document.documentElement.hasAttribute('data-failsafe')), false);
  assert.equal(await tab.evaluate(() => document.documentElement.classList.contains('js')), true);
  await slow.close();
});

await browser.close();
server.close();
const failed = results.filter(([state]) => state === 'FAIL').length;
console.log(failed ? `${failed} offline check(s) failed.` : 'All offline checks passed.');
process.exit(failed ? 1 : 0);
