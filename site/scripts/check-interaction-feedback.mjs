// Production browser regressions for accepted taps, startup and slow navigation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-interaction-feedback';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${basePath}/`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = [];
const ready = (page) => page.waitForFunction(() => {
  const main = document.querySelector('main');
  return main && getComputedStyle(main).opacity === '1' && !main.classList.contains('lenis-stopped') && document.querySelector('#course-section:not(:disabled)');
});
async function check(name, run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    const detail = await run(page, context);
    results.push({ name, pass: true, detail });
    console.log(`PASS ${name}`, detail || '');
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    await page.screenshot({ path: path.join(report, `${results.length}-failure.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
}
try {
  await check('top-level course tabs keep the page and shared header in place', async (page) => {
    const snapshots = [];
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion });
      await page.goto(`${url}mth140/`);
      await ready(page);
      await page.locator('main').evaluate((main, top) => { main.scrollTop = top; }, reducedMotion === 'reduce' ? 80 : 0);
      await page.waitForTimeout(100);
      for (const [hash, title] of [['study', 'Study'], ['course-info', 'Course info'], ['schedule', 'Schedule'], ['work', 'Work']]) {
        const before = await page.evaluate(() => {
          window.tabPositions = [];
          const sample = () => {
            window.tabPositions.push({ scroll: document.querySelector('main').scrollTop, nav: document.querySelector('nav[aria-label="Course views"]').getBoundingClientRect().top });
            window.tabFrame = requestAnimationFrame(sample);
          };
          sample();
          return window.tabPositions[0];
        });
        await page.locator(`nav[aria-label="Course views"] a[href$="#${hash}"]`).tap();
        await page.getByRole('heading', { name: title, exact: true }).waitFor();
        await page.waitForFunction(() => {
          const content = document.getElementById('course-content');
          return !content.inert && getComputedStyle(content).opacity === '1' && getComputedStyle(content).transform === 'none';
        });
        // Also catch the shell's delayed hash-scroll notification.
        await page.waitForTimeout(550);
        const positions = await page.evaluate(() => { cancelAnimationFrame(window.tabFrame); return window.tabPositions; });
        assert.ok(positions.every((position) => Math.abs(position.scroll - before.scroll) < 2 && Math.abs(position.nav - before.nav) < 2), `${title} moved the page: ${JSON.stringify({ before, after: positions.at(-1) })}`);
        snapshots.push({ reducedMotion, title, scroll: positions.at(-1).scroll });
      }
    }
    await page.screenshot({ path: path.join(report, 'tabs-stay-put-390.png') });
    return snapshots;
  });
  await check('the menu scrolls away with the page and works again at the top', async (page) => {
    for (const route of ['', 'cen100/', 'mth140/', 'mth141/']) {
      await page.goto(url + route);
      await page.waitForFunction(() => {
        const main = document.querySelector('main');
        return getComputedStyle(main).opacity === '1' && !main.classList.contains('lenis-stopped');
      });
      const button = page.getByRole('button', { name: 'Open menu', exact: true });
      const start = await button.boundingBox();
      await page.locator('main').evaluate((main) => { main.scrollTop = 20; });
      await page.waitForTimeout(150);
      const moved = await button.boundingBox();
      assert.ok(moved && moved.y < start.y - 15, `menu floats over ${route || 'Desk'} instead of scrolling away`);
      await page.locator('main').evaluate((main) => { main.scrollTop = 500; });
      await button.waitFor({ state: 'hidden', timeout: 2000 });
      assert.equal(await page.evaluate(() => document.querySelector('#menu-button').closest('[inert]') !== null), true, 'offscreen header must not keep keyboard focus targets');
      await page.locator('main').evaluate((main) => { main.scrollTop = 0; });
      await button.tap();
      await page.getByRole('button', { name: 'Close menu', exact: true }).tap();
    }
  });
  await check('scrolling does not continuously rewrite browser history', async (page) => {
    await page.goto(`${url}cen100/`);
    await ready(page);
    const writes = await page.evaluate(async () => {
      const original = history.replaceState;
      let count = 0;
      history.replaceState = function (...args) { count += 1; return original.apply(this, args); };
      try {
        const main = document.querySelector('main');
        for (let i = 0; i < 80; i += 1) {
          main.scrollTop = 100 + i * 3;
          await new Promise(requestAnimationFrame);
        }
        return count;
      } finally { history.replaceState = original; }
    });
    assert.ok(writes <= 2, `scrolling rewrote browser history ${writes} times`);
    return { historyWritesDuringScroll: writes };
  });
  await check('course controls become usable while decorative images are still downloading', async (page) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    let requested = 0;
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() === 'image') { requested += 1; await held; }
      await route.continue().catch(() => {});
    });
    try {
      await page.goto(`${url}cen100/`, { waitUntil: 'domcontentloaded' });
      const start = Date.now();
      await page.locator('#course-section:not(:disabled)').waitFor();
      await ready(page).catch((error) => { throw error; });
      const elapsed = Date.now() - start;
      assert.ok(requested > 0, 'the test must actually hold an image');
      assert.ok(elapsed < 2500, `controls blocked for ${elapsed} ms after DOMContentLoaded`);
      await page.getByRole('button', { name: /Guide tools/ }).tap();
      await page.getByRole('dialog', { name: 'Guide tools' }).waitFor();
      return { elapsed, heldImages: requested };
    } finally { release(); }
  });
  await check('a tab acknowledges the tap immediately without flashing loading feedback', async (page) => {
    await page.goto(`${url}cen100/`);
    await ready(page);
    const response = await page.evaluate(() => new Promise((resolve) => {
      const link = document.querySelector('nav[aria-label="Course views"] a[href$="#schedule"]');
      link.click();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({
        selected: link.getAttribute('aria-current'),
        feedback: document.querySelector('[data-view-status]')?.textContent,
      })));
    }));
    assert.equal(response.selected, 'page');
    assert.equal(response.feedback || '', '', 'fast tab selection must not flash loading feedback');
    return response;
  });
  await check('the first visible frame of the new view accepts one tap', async (page) => {
    await page.goto(`${url}cen100/`);
    await ready(page);
    const response = await page.evaluate(() => new Promise((resolve) => {
      const sample = () => {
        const content = document.getElementById('course-content');
        const button = [...content.querySelectorAll('button')].find((el) => el.textContent === 'Calendar');
        if (!button || Number(getComputedStyle(content).opacity) < 0.1) { requestAnimationFrame(sample); return; }
        const result = { inert: content.inert, pointerEvents: getComputedStyle(content).pointerEvents };
        if (!content.inert) button.click();
        resolve(result);
      };
      document.querySelector('nav[aria-label="Course views"] a[href$="#schedule"]').click();
      sample();
    }));
    assert.equal(response.inert, false, 'new view is still inert while visible');
    assert.notEqual(response.pointerEvents, 'none');
    await page.getByRole('button', { name: 'Calendar', exact: true, pressed: true }).waitFor();
    return response;
  });
  await check('slow page navigation shows feedback while keeping the current page visible', async (page) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route('**/_next/data/**/mth141.json*', async (route) => { await held; await route.continue().catch(() => {}); });
    try {
      await page.goto(`${url}cen100/`);
      await ready(page);
      await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
      await page.locator('#menu').getByRole('link', { name: 'MTH141', exact: true }).tap();
      const status = page.locator('[data-navigation-status]');
      await status.waitFor({ state: 'visible', timeout: 2000 });
      assert.match(await status.innerText(), /Opening/);
      assert.equal(await page.locator('main h1').first().innerText(), 'Intro to Engineering');
      const start = Date.now();
      release();
      await page.waitForURL('**/mth141/');
      await ready(page);
      await status.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('main h1').first().innerText(), 'Linear Algebra');
      return { feedbackDuringNetworkWait: true, transitionAfterDownloadMs: Date.now() - start };
    } finally { release(); }
  });
  await check('clearing ticks confirms success and preserves completion records and notes', async (page) => {
    await page.goto(`${url}cen100/#assignment-m2`);
    await ready(page);
    await page.locator('[data-assignment-detail]').waitFor();
    await page.locator('textarea').fill('Keep this note.');
    const tick = page.locator('[data-assignment-detail] input[type=checkbox]').first();
    await tick.check({ force: true });
    const record = page.locator('[data-assignment-detail] fieldset input[type=checkbox]').first();
    await record.check({ force: true });
    const saved = await page.evaluate(() => localStorage.getItem('cen100-personal-plan-v1'));
    await page.getByRole('button', { name: /Guide tools/ }).tap();
    const clear = page.getByRole('button', { name: 'Clear my ticks', exact: true });
    page.once('dialog', (dialog) => dialog.dismiss());
    await clear.tap();
    assert.ok(await tick.isChecked(), 'cancelling must keep ticks');
    page.once('dialog', (dialog) => dialog.accept());
    await clear.tap();
    assert.equal(await tick.isChecked(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('cen100-personal-plan-v1')), saved);
    await page.getByRole('status').filter({ hasText: 'Checklist ticks cleared.' }).waitFor({ timeout: 2000 });
    await page.screenshot({ path: path.join(report, 'ticks-cleared-390.png') });
  });
} finally {
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;

