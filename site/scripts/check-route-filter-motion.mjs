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
  const errors = [];
  context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
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

async function checkMobileMenu(page, name) {
  const opener = page.getByRole('button', { name: 'Open menu', exact: true });
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  const firstLink = page.locator('#menu').getByRole('link', { name: 'Desk', exact: true });
  // A small real scroll keeps the header reachable while making scroll
  // preservation meaningful on both document and contained scroll layouts.
  await page.evaluate(() => {
    const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
    scroller.scrollTo(0, 12);
  });
  await page.waitForFunction(() => (document.documentElement.dataset.scrollMode === 'document' ? scrollY : document.querySelector('main').scrollTop) > 0);
  await opener.focus();
  const before = await page.evaluate(() => {
    window.menuFrames = [];
    window.menuPhase = 'before';
    const sample = () => {
      const main = document.querySelector('main');
      const page = main.getBoundingClientRect();
      const panel = document.querySelector('#menu');
      const menu = panel.getBoundingClientRect();
      window.menuFrames.push({
        time: performance.now(), phase: window.menuPhase,
        page: { left: page.left, top: page.top, width: page.width },
        menu: { left: menu.left, top: menu.top, width: menu.width, height: menu.height },
        viewport: { width: innerWidth, height: innerHeight },
        opacity: Number(getComputedStyle(panel).opacity), scrollY, scrollTop: main.scrollTop,
      });
      window.menuFrame = requestAnimationFrame(sample);
    };
    sample();
    return window.menuFrames[0];
  });
  assert.ok(before.scrollY > 0 || before.scrollTop > 0, 'the menu exercise starts from a scrolled page');
  let frames;
  try {
    for (const closeWithEscape of [false, true]) {
      await page.evaluate((reopened) => { window.menuPhase = reopened ? 'reopening' : 'opening'; }, closeWithEscape);
      // Safari taps do not necessarily focus their button. Reopen from body
      // focus as well as from the keyboard-focused opener used in the first pass.
      if (closeWithEscape) await opener.evaluate((button) => button.blur());
      await opener.click();
      await page.waitForFunction(() => {
        const menu = document.querySelector('#menu');
        return getComputedStyle(menu).opacity === '1' &&
          Array.from(menu.querySelectorAll('[data-menu-anim]')).every((item) => getComputedStyle(item).opacity === '1');
      }, null, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({
          open: document.querySelector('#menu').getAttribute('aria-hidden'),
          opacity: getComputedStyle(document.querySelector('#menu')).opacity,
          incomplete: Array.from(document.querySelectorAll('#menu [data-menu-anim]'))
            .filter((item) => getComputedStyle(item).opacity !== '1')
            .slice(0, 6)
            .map((item) => ({ text: item.textContent.trim().slice(0, 40), opacity: getComputedStyle(item).opacity })),
        }));
        throw new Error(`Menu did not finish opening: ${JSON.stringify(diagnostic)}`);
      });
      // Reduced-motion iPhone Safari can leave focus on body after a touch
      // gesture. Keyboard entry must still move directly into the modal.
      await page.waitForTimeout(220);
      if (!(await firstLink.evaluate((link) => link === document.activeElement))) await page.keyboard.press('Tab');
      assert.equal(await firstLink.evaluate((link) => link === document.activeElement), true, 'phone menu receives focus automatically or on first Tab');
      const coverage = await page.evaluate(() => {
        const panel = document.querySelector('#menu');
        // Resolve any CSS color syntax through the browser; the regression is
        // transparency, so this intentionally does not pin a palette RGB value.
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = getComputedStyle(panel).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return {
          backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3],
          coversCorners: [[1, 1], [innerWidth - 1, 1], [1, innerHeight - 1], [innerWidth - 1, innerHeight - 1]]
            .every(([x, y]) => panel.contains(document.elementFromPoint(x, y))),
        };
      });
      assert.equal(coverage.backgroundAlpha, 255, 'the open phone menu has an opaque background');
      assert.equal(coverage.coversCorners, true, 'the phone menu covers and receives input at every viewport corner');
      if (!closeWithEscape) {
        await page.screenshot({ path: path.join(report, `${name}-open.png`) });
        await close.focus();
        await page.keyboard.press('Tab');
        assert.equal(await firstLink.evaluate((link) => link === document.activeElement), true, 'Tab from the final control wraps to the first menu link');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await close.evaluate((button) => button === document.activeElement), true, 'Shift+Tab from the first link wraps to Close menu');
      }
      await page.evaluate((escape) => { window.menuPhase = escape ? 'closing-with-escape' : 'closing-with-button'; }, closeWithEscape);
      if (closeWithEscape) await page.keyboard.press('Escape');
      else await close.click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#menu')).visibility === 'hidden');
      await page.waitForFunction(() => document.querySelector('#menu-button') === document.activeElement, null, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({
          active: document.activeElement?.outerHTML.slice(0, 200),
          openerInert: document.querySelector('#menu-button').inert,
          headerInert: document.querySelector('header').inert,
          headerVisibility: getComputedStyle(document.querySelector('header')).visibility,
        }));
        throw new Error(`Menu did not restore focus: ${JSON.stringify(diagnostic)}`);
      });
      assert.equal(await opener.evaluate((button) => button === document.activeElement), true, 'closing the phone menu returns focus to its opener');
    }
  } finally {
    frames = await page.evaluate(() => { cancelAnimationFrame(window.menuFrame); return window.menuFrames; });
    await writeFile(path.join(report, `${name}-frames.json`), JSON.stringify(frames, null, 2));
  }
  const moved = frames.filter((frame) => ['left', 'top', 'width'].some((key) => Math.abs(frame.page[key] - before.page[key]) >= 2));
  assert.deepEqual(moved.slice(0, 4), [], 'opening, closing and reopening the phone menu never shifts or shrinks the page');
  assert.ok(frames.every((frame) => frame.scrollY === before.scrollY && frame.scrollTop === before.scrollTop), 'the phone menu preserves the page scroll throughout both open/close cycles');
  const visible = frames.filter((frame) => frame.opacity > 0);
  assert.ok(visible.length, 'sample the phone menu while visible');
  const uncovered = visible.filter(({ menu, viewport }) => Math.abs(menu.left) >= 2 || Math.abs(menu.top) >= 2 ||
    Math.abs(menu.width - viewport.width) >= 2 || Math.abs(menu.height - viewport.height) >= 2);
  assert.deepEqual(uncovered.slice(0, 4), [], 'the phone menu remains aligned with the complete viewport throughout its animation');
  return { frames: frames.length, openCloseCycles: 2, scrollY: before.scrollY, scrollTop: before.scrollTop };
}

try {
  const safari = await webkit.launch({ headless: true });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-desk-menu-${reducedMotion}`, async (page) => {
        await page.goto(base);
        await ready(page);
        return checkMobileMenu(page, `iphone-desk-menu-${reducedMotion}`);
      });
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-menu-route-${reducedMotion}`, async (page) => {
        await page.goto(`${base}mth140/`);
        await ready(page);
        const menu = await checkMobileMenu(page, `iphone-course-menu-${reducedMotion}`);
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
        return { menu, incomingFrames: incoming.length, final: incoming.at(-1) };
      });
    }
  } finally { await safari.close(); }

  const chromePhone = await chromium.launch({ headless: true });
  try {
    await check(chromePhone, devices['Pixel 5'], 'android-desk-menu-paused', async (page) => {
      await page.goto(`${base}?motion=off`);
      await ready(page);
      return checkMobileMenu(page, 'android-desk-menu-paused');
    });
  } finally { await chromePhone.close(); }

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
        // A non-focusing link activation must still focus the new view after
        // its filter controls unmount (Safari taps can retain the old focus).
        await page.getByRole('navigation', { name: 'Course views' }).getByRole('link', { name: 'Schedule', exact: true }).evaluate((link) => link.click());
        await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
        await settled(page);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'course-content', 'leaving Work moves focus into the destination view');
        await page.goBack();
        await page.waitForFunction(() => location.hash === '#work/all');
        await settled(page);
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
          await page.locator('#course-view-assignment-y1[data-assignment-detail]').waitFor();
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
          await page.locator('#course-view-assignment-y1[data-assignment-detail]').waitFor();
          await settled(page);
          for (let i = 1; i < 4; i += 1) await records.nth(i).locator('..').click();
          await page.getByRole('button', { name: /Back to Work/ }).first().click();
          await settled(page);
          await page.getByRole('button', { name: 'Done (1)', exact: true }).click();
          await page.locator('#open-assignment-y1').waitFor();
          assert.equal(await page.locator('[data-assignment-link]').count(), 1);
          // Read storage in a fresh document. Reusing a WebKit page for a full
          // navigation cancels Next's in-flight CSS prefetches (also avoided by
          // check-ios-document). Leave the first tab alive until the assertions.
          const reopened = await page.context().newPage();
          await reopened.goto(page.url());
          await ready(reopened);
          await reopened.locator('#open-assignment-y1').waitFor();
          assert.equal(await reopened.getByRole('button', { name: 'Done (1)', exact: true }).getAttribute('aria-pressed'), 'true');
          await reopened.locator('[data-work-results]').scrollIntoViewIfNeeded();
          await reopened.screenshot({ path: path.join(report, 'iphone-done-recorded.png') });
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
