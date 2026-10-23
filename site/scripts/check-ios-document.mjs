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
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
const navigationFailures = [];
let browser;
async function ready(page) {
  await page.waitForFunction(
    () => {
      const main = document.querySelector('main');
      const loader = document.querySelector('#loader');
      return main && getComputedStyle(main).opacity === '1' && !document.querySelector('#layout')?.hasAttribute('inert') && (!loader || getComputedStyle(loader).display === 'none');
    },
    null,
    { timeout: 25000 },
  );
}

async function navigationState(page) {
  return page.evaluate(() => {
    const describe = (element) => {
      if (!element) return null;
      const { x, y, width, height, top, bottom } = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        rect: { x, y, width, height, top, bottom },
        transform: style.transform,
        height: style.height,
        opacity: style.opacity,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
      };
    };
    const main = document.querySelector('main');
    const heading = main?.querySelector('h1');
    return {
      url: location.href,
      mode: document.documentElement.dataset.scrollMode,
      scrollY: window.scrollY,
      mainScrollTop: main?.scrollTop,
      documentHeight: document.scrollingElement.scrollHeight,
      viewport: { width: innerWidth, height: innerHeight },
      main: describe(main),
      layout: describe(document.querySelector('#layout')),
      heading: { text: heading?.textContent, ...describe(heading) },
      sameDocument: window.__allCoursesNavigation === true,
    };
  });
}

async function checkAllCoursesNavigation(context, motion, scenario = 'stable') {
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  const documentRequests = [];
  const entry = { route: 'desk -> courses', motion, scenario, pass: false };
  const screenshotName = `${motion}-all-courses-${scenario}`;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure() }));
  try {
    await page.goto(base);
    await ready(page);
    await page.evaluate(() => { window.__allCoursesNavigation = true; });
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests.push(request.url());
    });

    // This is the pill below the last stacked card, not a menu link or direct entry.
    const allCourses = page.getByRole('link', { name: 'ALL COURSES', exact: true });
    if (scenario === 'revisit-viewport') {
      await allCourses.scrollIntoViewIfNeeded();
      await allCourses.tap();
      await page.waitForURL(`${base}courses/`);
      await page.getByRole('heading', { level: 1, name: 'All Courses', exact: true }).waitFor();
      await ready(page);
      await page.goBack();
      await page.waitForURL(base);
      await allCourses.waitFor();
      await ready(page);
    }
    await allCourses.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.scrollY > innerHeight);
    entry.before = await navigationState(page);

    if (scenario !== 'stable') {
      if (scenario === 'revisit-viewport') {
        const viewport = page.viewportSize();
        await page.exposeFunction('__changeCourseViewport', () => page.setViewportSize({ width: viewport.width, height: viewport.height - 100 }));
      }
      await page.evaluate((kind) => {
        // Observe the real incoming route. No Lenis or production helper is invoked.
        // The injected native scroll models a late browser adjustment; it is a
        // resilience check, not a reproduction of Safari's physical browser chrome.
        const loaderVisible = () => getComputedStyle(document.querySelector('#loader')).display !== 'none';
        const observer = new MutationObserver(() => {
          if (document.querySelector('main h1')?.textContent !== 'All Courses' || !loaderVisible()) return;
          observer.disconnect();
          const adjustment = { kind, triggered: true, before: { scrollY, height: innerHeight, duringEntry: loaderVisible() } };
          window.__allCoursesEntryAdjustment = adjustment;
          const complete = () => {
            adjustment.after = { scrollY, height: innerHeight, duringEntry: loaderVisible() };
            adjustment.completed = true;
          };
          if (kind === 'revisit-viewport') window.__changeCourseViewport().then(complete);
          else {
            window.scrollTo({ top: Math.min(innerHeight, document.scrollingElement.scrollHeight - innerHeight), behavior: 'instant' });
            complete();
          }
        });
        observer.observe(document.querySelector('main'), { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
      }, scenario);
    }

    await allCourses.tap();
    await page.waitForURL(`${base}courses/`);
    await page.getByRole('heading', { level: 1, name: 'All Courses', exact: true }).waitFor();
    if (scenario !== 'stable') {
      await page.waitForFunction(() => window.__allCoursesEntryAdjustment?.completed, null, { timeout: 5000 });
      entry.adjustment = await page.evaluate(() => window.__allCoursesEntryAdjustment);
      assert.equal(entry.adjustment.before.duringEntry, true, 'the adjustment must begin during route entry');
      assert.equal(entry.adjustment.after.duringEntry, true, 'the adjustment must complete before route entry finishes');
      if (scenario === 'revisit-viewport') {
        assert.notEqual(entry.adjustment.after.height, entry.adjustment.before.height, 'the viewport must really change during entry');
      } else {
        assert.ok(entry.adjustment.after.scrollY > 100, 'the injected native scroll must really move the document');
      }
    }
    await ready(page);
    // Let the browser commit geometry after the curtain and its transforms clear.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    entry.after = await navigationState(page);

    assert.equal(entry.after.sameDocument, true, 'All courses must use the client-side route transition');
    assert.deepEqual(documentRequests, [], 'All courses must not reload the document');
    assert.equal(entry.after.mode, 'document');
    assert.ok(entry.after.scrollY <= 8, `All courses must start at the top: ${JSON.stringify(entry.after)}`);
    assert.equal(entry.after.mainScrollTop, 0, 'the native document remains the only scroll owner');
    assert.ok(entry.after.heading.rect.top >= -1 && entry.after.heading.rect.bottom <= entry.after.viewport.height,
      `the All Courses heading must be visible on arrival: ${JSON.stringify(entry.after)}`);

    const firstCourse = page.locator(`main a[href="${basePath}/cen100/"]`).first();
    const card = await firstCourse.boundingBox();
    assert.ok(card && card.y >= 0 && card.y < entry.after.viewport.height,
      `the first course must be visible on arrival: ${JSON.stringify({ card, after: entry.after })}`);
    await page.screenshot({ path: path.join(report, `${screenshotName}.png`) });
    await firstCourse.click({ trial: true });
    assert.deepEqual(errors, [], JSON.stringify({ motion, failedRequests }));
    entry.pass = true;
    console.log('PASS', motion, scenario, 'All courses from the bottom of the Desk');
  } catch (error) {
    entry.error = error.message;
    if (scenario !== 'stable') entry.adjustment = await page.evaluate(() => window.__allCoursesEntryAdjustment).catch(() => null);
    entry.failureState = await navigationState(page).catch((captureError) => ({ error: captureError.message }));
    await page.screenshot({ path: path.join(report, `${screenshotName}-failure.png`) }).catch(() => {});
    navigationFailures.push(`${motion} ${scenario}: ${error.message}`);
    console.error('FAIL', motion, scenario, 'All courses from the bottom of the Desk', JSON.stringify(entry));
  } finally {
    results.push({ ...entry, errors, failedRequests, documentRequests });
    await page.close();
  }
}

try {
  browser = await webkit.launch({ headless: true });
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: motion });
    try {
      await checkAllCoursesNavigation(context, motion);
      if (motion === 'no-preference') {
        await checkAllCoursesNavigation(context, motion, 'revisit-viewport');
        await checkAllCoursesNavigation(context, motion, 'late-native-scroll-fault-injection');
      }
      for (const route of ['', 'courses/', 'cen100/', 'mth140/', 'mth141/', 'privacy/']) {
        // Each direct-entry check owns its page. Full-document navigations on a
        // reused page can cancel the preceding route's Next CSS prefetch in WebKit.
        const page = await context.newPage();
        const errors = [];
        const failedRequests = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure() }));
        try {
          await page.goto(base + route);
          await ready(page);
          const initial = await page.evaluate(() => {
            const main = document.querySelector('main');
            return {
              mode: document.documentElement.dataset.scrollMode,
              position: getComputedStyle(main).position,
              overflow: getComputedStyle(main).overflowY,
              layoutOverflow: getComputedStyle(document.querySelector('#layout')).overflowY,
              docHeight: document.scrollingElement.scrollHeight,
              viewport: innerHeight,
            };
          });
          assert.equal(initial.mode, 'document', route);
          assert.notEqual(initial.position, 'fixed', route);
          assert.ok(!['hidden', 'scroll', 'auto'].includes(initial.overflow), JSON.stringify(initial));
          assert.ok(!['hidden', 'scroll', 'auto'].includes(initial.layoutOverflow), JSON.stringify(initial));
          assert.ok(initial.docHeight > initial.viewport + 100, JSON.stringify(initial));
          await page.evaluate(() => window.scrollTo(0, 300));
          await page.waitForFunction(() => scrollY > 150, null, { timeout: 3000 });
          await page.waitForFunction(
            () => {
              const button = document.querySelector('#menu-button');
              return button.closest('[inert]') && (getComputedStyle(button).visibility === 'hidden' || button.getBoundingClientRect().bottom <= 0);
            },
            null,
            { timeout: 3000 },
          );
          await page.screenshot({ path: path.join(report, `${motion}-${route.replaceAll('/', '') || 'desk'}.png`) });
          assert.deepEqual(errors, [], JSON.stringify({ route, motion, failedRequests }));
          results.push({ route, motion, pass: true, initial });
          console.log('PASS', motion, route || 'desk');
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
}
assert.equal(navigationFailures.length, 0, navigationFailures.join('\n'));
