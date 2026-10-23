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
const ready = async (page) => {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return main && getComputedStyle(main).opacity === '1' &&
      !document.querySelector('[data-navigation-status]:not([hidden])') &&
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

async function check(browser, options, name, run) {
  const context = await browser.newContext({ ...options, recordVideo: { dir: path.join(report, 'videos'), size: { width: 834, height: 1024 } } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const detail = await run(page);
    assert.deepEqual(errors, [], 'no page errors');
    results.push({ name, pass: true, detail });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message, errors });
    console.error(`::error::${name}: ${error.message}`);
    await page.screenshot({ path: path.join(report, `${name}-failure.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
}

try {
  const safari = await webkit.launch({ headless: true });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-menu-route-${reducedMotion}`, async (page) => {
        await page.goto(`${base}mth140/`);
        await ready(page);
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#menu')).opacity === '1');
        await page.evaluate(() => {
          window.routeFrames = [];
          window.routeDocument = true;
          const sample = () => {
            const main = document.querySelector('main');
            const rect = main.getBoundingClientRect();
            const style = getComputedStyle(main);
            const heading = main.querySelector('h1');
            window.routeFrames.push({
              time: performance.now(), title: heading?.textContent, left: rect.left, width: rect.width,
              headingTop: heading?.getBoundingClientRect().top, opacity: Number(style.opacity),
              menu: Number(getComputedStyle(document.querySelector('#menu')).opacity), viewport: innerWidth,
              loader: getComputedStyle(document.querySelector('#loader')).display,
            });
            window.routeFrame = requestAnimationFrame(sample);
          };
          sample();
        });
        await page.locator('#menu').getByRole('link', { name: 'CEN100', exact: true }).click();
        await page.waitForURL(`${base}cen100/`);
        await ready(page);
        const frames = await page.evaluate(() => { cancelAnimationFrame(window.routeFrame); return window.routeFrames; });
        await writeFile(path.join(report, `route-${reducedMotion}.json`), JSON.stringify(frames, null, 2));
        const incoming = frames.filter((frame) => frame.title === 'Intro to Engineering' && frame.opacity > 0.05);
        assert.ok(incoming.length, 'sample the visible destination');
        assert.ok(incoming.every((frame) => Math.abs(frame.left) < 2 && Math.abs(frame.width - frame.viewport) < 2),
          `the incoming document must stay full width: ${JSON.stringify(incoming.filter((frame) => Math.abs(frame.left) >= 2 || Math.abs(frame.width - frame.viewport) >= 2).slice(0, 4))}`);
        assert.ok(incoming.every((frame) => frame.loader === 'none'), 'no second loading card beside the arriving course');
        assert.equal(await page.evaluate(() => window.routeDocument), true, 'client-side navigation');
        await page.getByRole('button', { name: /Guide tools/ }).click();
        await page.getByRole('dialog', { name: 'Guide tools' }).waitFor();
        await page.keyboard.press('Escape');
        await page.screenshot({ path: path.join(report, `route-${reducedMotion}.png`) });
        return { incomingFrames: incoming.length, final: incoming.at(-1) };
      });
    }
  } finally { await safari.close(); }

  for (const [engine, options, label] of [
    [webkit, devices['iPhone 13'], 'iphone'],
    [webkit, { ...devices['iPhone 13'], reducedMotion: 'reduce' }, 'iphone-still'],
    [chromium, { viewport: { width: 834, height: 1024 }, hasTouch: true }, 'tablet'],
    [chromium, { viewport: { width: 1440, height: 900 } }, 'desktop'],
  ]) {
    const browser = await engine.launch({ headless: true });
    try {
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
          await settled(page);
          for (let i = 1; i < 4; i += 1) await records.nth(i).locator('..').click();
          await page.getByRole('button', { name: /Back to Work/ }).first().click();
          await settled(page);
          await page.getByRole('button', { name: 'Done (1)', exact: true }).click();
          await page.locator('#open-assignment-y1').waitFor();
          assert.equal(await page.locator('[data-assignment-link]').count(), 1);
          await page.reload();
          await ready(page);
          await page.locator('#open-assignment-y1').waitFor();
          assert.equal(await page.getByRole('button', { name: 'Done (1)', exact: true }).getAttribute('aria-pressed'), 'true');
          await page.screenshot({ path: path.join(report, 'iphone-done-recorded.png') });
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
