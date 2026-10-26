// Production-export regressions. Run in GitHub CI, not on a physical device.
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
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-delayed-feedback';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
const ready = (page) => page.waitForFunction(() => {
  const main = document.querySelector('main');
  return main && getComputedStyle(main).opacity === '1' && !document.querySelector('.lenis-stopped') &&
    !document.querySelector('#layout[inert]') && document.querySelector('#course-section:not(:disabled)');
});
// Network/React tasks must be allowed to finish while animation time is paused.
async function realTasks(page, predicate) {
  const deadline = Date.now() + 15000;
  while (!(await page.evaluate(predicate))) {
    assert.ok(Date.now() < deadline, 'real network/React tasks did not settle with the clock paused');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
async function boot(page) {
  await page.clock.install({ time: new Date('2026-10-23T16:00:00Z') });
  await page.goto(`${base}cen100/`);
  await ready(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  await page.evaluate(() => {
    if (!window.next?.router?.events || typeof window.next.router.change !== 'function') throw new Error('Next Pages Router test boundary is unavailable');
    window.qaFeedback = () => [...document.querySelectorAll('[data-view-status], [data-navigation-status]')]
      .filter((el) => !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => ({ type: el.hasAttribute('data-view-status') ? 'view' : 'route', text: el.textContent }));
    window.qaFeedbackLog = [];
    window.qaFeedbackObserver = new MutationObserver(() => window.qaFeedbackLog.push(...window.qaFeedback()));
    window.qaFeedbackObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  });
}
const feedback = (page, type) => page.evaluate((kind) => window.qaFeedback().filter((entry) => !kind || entry.type === kind), type);
const tab = (page, hash) => page.locator(`nav[aria-label="Course views"] a[href$="#${hash}"]`);
const clickTab = (page, hash) => tab(page, hash).evaluate((link) => link.click());
async function holdCourseChanges(page) {
  await page.evaluate(() => {
    const router = window.next.router;
    const original = router.change;
    const queued = [];
    // Hold only Next's hash commit. The real Link onClick, React state, delay,
    // portal and subsequent Next hash/history/animation lifecycle still run.
    router.change = function (...args) {
      const hash = new URL(args[2] || args[1], location.href).hash;
      if (/^#(work|schedule|course-info)$/.test(hash)) return new Promise((resolve) => queued.push({ args, resolve }));
      return original.apply(this, args);
    };
    window.qaReleaseCourse = () => {
      const last = queued.pop();
      queued.splice(0).forEach(({ resolve }) => resolve(false));
      if (last) original.apply(router, last.args).then(last.resolve, (error) => { window.qaCourseError = error.message; last.resolve(false); });
    };
    window.qaRestoreCourse = () => { router.change = original; queued.splice(0).forEach(({ resolve }) => resolve(false)); };
  });
}
async function startRoute(page, target) {
  await page.evaluate((href) => {
    window.qaRouteDone = false;
    window.qaRouteError = null;
    window.next.router.push(href).then(() => { window.qaRouteDone = true; }, (error) => { window.qaRouteError = error.message; });
  }, target);
}
async function routeDone(page) {
  await realTasks(page, () => window.qaRouteDone || window.qaRouteError);
  assert.equal(await page.evaluate(() => window.qaRouteError), null);
}
async function check(browser, options, label, name, run) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const detail = await run(page);
    assert.deepEqual(errors, [], 'no unhandled page errors');
    results.push({ name: `${label}: ${name}`, pass: true, detail });
    console.log(`PASS ${label}: ${name}`);
  } catch (error) {
    results.push({ name: `${label}: ${name}`, pass: false, error: error.message, errors });
    console.error(`FAIL ${label}: ${name}: ${error.message}`);
    await page.screenshot({ path: path.join(report, `${label}-${results.length}-failure.png`) }).catch(() => {});
  } finally {
    await page.evaluate(() => { window.qaRestoreCourse?.(); window.qaFeedbackObserver?.disconnect(); }).catch(() => {});
    await context.close();
  }
}
try {
  for (const [engine, options, label] of [
    [chromium, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'chromium-phone'],
    [webkit, { ...devices['iPhone 13'] }, 'webkit-iphone'],
    [webkit, { ...devices['iPhone 13'], reducedMotion: 'reduce' }, 'webkit-reduced'],
  ]) {
    const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: process.env.QA_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] } : {}) });
    try {
      await check(browser, options, label, 'fast tabs select immediately and never flash feedback', async (page) => {
        await boot(page);
        for (const [hash, heading] of [['schedule', 'Schedule'], ['course-info', 'Course info'], ['work', 'Work']]) {
          await clickTab(page, hash);
          await page.clock.runFor(32);
          assert.equal(await tab(page, hash).getAttribute('aria-current'), 'page');
          assert.deepEqual(await feedback(page), [], 'selection must not wait for or flash a loading label');
          await page.clock.runFor(600);
          assert.equal(await page.getByRole('heading', { name: heading, exact: true }).isVisible(), true);
          assert.equal(await page.locator('#course-content').evaluate((el) => el.inert), false);
        }
        assert.deepEqual(await page.evaluate(() => window.qaFeedbackLog), [], 'no transient or stale feedback between observations');
      });
      await check(browser, options, label, 'slow tabs respect the delay, latest target, repeat taps and cancellation', async (page) => {
        await boot(page);
        await holdCourseChanges(page);
        await clickTab(page, 'schedule');
        await page.clock.runFor(200);
        assert.deepEqual(await feedback(page, 'view'), [], 'a 200ms pending view is still silent');
        await clickTab(page, 'schedule');
        await page.clock.runFor(75);
        assert.match((await feedback(page, 'view'))[0]?.text || '', /Opening Schedule/, 'repeat taps must not restart an already pending request');
        await clickTab(page, 'course-info');
        await page.clock.runFor(32);
        assert.equal(await tab(page, 'course-info').getAttribute('aria-current'), 'page');
        assert.deepEqual(await feedback(page, 'view'), [], 'a newer target clears the old status immediately');
        await page.clock.runFor(200);
        assert.deepEqual(await feedback(page, 'view'), [], 'the newer target gets its own delay');
        await page.clock.runFor(50);
        assert.match((await feedback(page, 'view'))[0]?.text || '', /Opening Course info/);
        await page.evaluate(() => { window.qaFeedbackLog = []; });
        await clickTab(page, 'work'); // Return to the still-mounted current view.
        await page.evaluate(() => { window.qaReleaseCourse(); });
        await page.clock.runFor(600);
        assert.deepEqual(await feedback(page, 'view'), []);
        assert.deepEqual(await page.evaluate(() => window.qaFeedbackLog), [], 'cancelled timers cannot announce the old target later');
        await clickTab(page, 'schedule');
        await page.clock.runFor(275);
        assert.match((await feedback(page, 'view'))[0]?.text || '', /Opening Schedule/);
        await page.evaluate(() => { window.qaReleaseCourse(); });
        await page.clock.runFor(600);
        assert.equal(await page.getByRole('heading', { name: 'Schedule', exact: true }).isVisible(), true);
        assert.deepEqual(await feedback(page, 'view'), [], 'ready content removes the slow-view status');
        assert.equal(await page.evaluate(() => window.qaCourseError || null), null);
      });
      await check(browser, options, label, 'held route data delays feedback and completion ends it before cosmetics', async (page) => {
        let release;
        const held = new Promise((resolve) => { release = resolve; });
        const requested = page.waitForRequest((request) => /\/_next\/data\/.*\/mth141\.json(?:\?|$)/.test(request.url()));
        requested.catch(() => {}); // Retain the rejection for await, even if boot fails first.
        await page.route('**/_next/data/**/mth141.json*', async (route) => { await held; await route.continue().catch(() => {}); });
        try {
          await boot(page);
          await startRoute(page, '/mth141/');
          await requested;
          await page.clock.runFor(200);
          assert.deepEqual(await feedback(page, 'route'), []);
          await page.clock.runFor(100);
          assert.match((await feedback(page, 'route'))[0]?.text || '', /Opening/);
          assert.equal(await page.locator('main h1').first().innerText(), 'Intro to Engineering');
          release();
          await routeDone(page);
          await page.clock.runFor(16);
          assert.deepEqual(await feedback(page, 'route'), [], 'download completion, not decorative entrance completion, ends loading');
          await page.clock.runFor(1600);
          await page.clock.resume();
          await ready(page);
          assert.equal(await page.locator('main h1').first().innerText(), 'Linear Algebra');
          return { realDataRequestHeld: true };
        } finally { release(); }
      });
      await check(browser, options, label, 'fast cached routes stay silent and unmounted view feedback cannot return', async (page) => {
        await boot(page);
        await page.evaluate((target) => {
          window.qaPrefetched = false;
          window.qaPrefetchError = null;
          window.next.router.prefetch(target).then(() => { window.qaPrefetched = true; }, (error) => { window.qaPrefetchError = error.message; });
        }, '/mth141/');
        await realTasks(page, () => window.qaPrefetched || window.qaPrefetchError);
        assert.equal(await page.evaluate(() => window.qaPrefetchError), null);
        await startRoute(page, '/mth141/');
        await routeDone(page); // No virtual time elapsed during the cached route.
        await page.clock.runFor(1600);
        assert.deepEqual(await page.evaluate(() => window.qaFeedbackLog), [], 'the route animation alone is not loading');
        assert.equal(await page.locator('main h1').first().innerText(), 'Linear Algebra');
        await holdCourseChanges(page);
        await clickTab(page, 'schedule');
        await page.clock.runFor(100);
        await page.evaluate(() => { window.qaFeedbackLog = []; });
        await startRoute(page, '/cen100/');
        await routeDone(page);
        await page.clock.runFor(1600);
        assert.deepEqual(await page.evaluate(() => window.qaFeedbackLog.filter((entry) => entry.type === 'view')), [], 'route handoff cancels local feedback before the outgoing workspace unmounts');
        await page.evaluate(() => { window.qaRestoreCourse(); window.qaFeedbackLog = []; });
        await page.clock.runFor(600);
        assert.equal(await page.locator('main h1').first().innerText(), 'Intro to Engineering');
        assert.deepEqual(await feedback(page), []);
        assert.deepEqual(await page.evaluate(() => window.qaFeedbackLog), [], 'unmounted workspace feedback must not reappear');
      });
      await check(browser, options, label, 'route errors remain useful and stale cancellations cannot affect a newer request', async (page) => {
        await boot(page);
        // Event-level integration: Next can hard-reload on a failed data fetch.
        // Emit its real public events to exercise our mounted error/retry UI,
        // without pretending that an aborted download always stays client-side.
        const first = `${basePath}/mth140/`, second = `${basePath}/mth141/`;
        const emit = (event, target, cancelled = false) => page.evaluate(({ name, href, cancel }) => {
          const events = window.next.router.events;
          if (name === 'routeChangeError') events.emit(name, Object.assign(new Error('simulated route failure'), { cancelled: cancel }), href, { shallow: false });
          else events.emit(name, href, { shallow: false });
        }, { name: event, href: target, cancel: cancelled });
        await emit('routeChangeStart', first);
        await page.clock.runFor(200);
        await emit('routeChangeStart', second);
        await emit('routeChangeError', first, true);
        await page.clock.runFor(200);
        assert.deepEqual(await feedback(page, 'route'), []);
        await page.clock.runFor(100);
        assert.match((await feedback(page, 'route'))[0]?.text || '', /Opening/);
        await emit('routeChangeComplete', first);
        await page.clock.runFor(16);
        assert.equal((await feedback(page, 'route')).length, 1, 'stale completion cannot hide the current request');
        await emit('routeChangeError', second);
        await page.clock.runFor(16);
        assert.match((await feedback(page, 'route'))[0]?.text || '', /could not open/i);
        assert.equal(await page.locator('[data-navigation-status] a').getAttribute('href'), second);
        await emit('routeChangeStart', first);
        await page.clock.runFor(100);
        await emit('routeChangeError', first, true);
        await page.clock.runFor(500);
        assert.deepEqual(await feedback(page, 'route'), [], 'cancellation is silent and clears its pending timer');
        await emit('routeChangeStart', second);
        await emit('routeChangeError', second);
        await page.clock.runFor(16);
        assert.match((await feedback(page, 'route'))[0]?.text || '', /could not open/i, 'real errors are useful immediately, without the loading delay');
      });
      if (label === 'chromium-phone') await check(browser, options, label, 'slow calendar code waits before feedback and never blocks the deadline list', async (page) => {
        const manifest = JSON.parse(await readFile(path.join(site, '.next/react-loadable-manifest.json'), 'utf8'));
        const entry = Object.entries(manifest).find(([key]) => key.endsWith('workspace/Schedule.jsx -> ./Calendar'));
        assert.ok(entry, 'the calendar dynamic import exists in the production manifest');
        const files = entry[1].files.filter((file) => file.endsWith('.js'));
        let release;
        const held = new Promise((resolve) => { release = resolve; });
        const isCalendar = (request) => files.some((file) => request.url().endsWith(file));
        const requested = page.waitForRequest(isCalendar);
        requested.catch(() => {});
        await page.route('**/*', async (route) => {
          if (isCalendar(route.request())) await held;
          await route.continue().catch(() => {});
        });
        try {
          await boot(page);
          await clickTab(page, 'schedule');
          await page.clock.runFor(600);
          await page.getByRole('button', { name: 'Calendar', exact: true }).evaluate((button) => button.click());
          await requested;
          const status = page.getByRole('status').filter({ hasText: /^Loading calendar/ });
          await page.clock.runFor(200);
          assert.equal(await status.isVisible(), false);
          await page.clock.runFor(100);
          assert.equal(await status.isVisible(), true);
          assert.ok(await page.locator('[data-schedule-link]').count(), 'dates remain usable while code downloads');
          await page.getByRole('button', { name: 'Agenda', exact: true }).evaluate((button) => button.click());
          await page.clock.runFor(600);
          assert.equal(await status.isVisible(), false, 'returning to Agenda cancels calendar feedback');
          return { realCalendarChunksHeld: true };
        } finally { release(); }
      });
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
  await new Promise((resolve) => server.close(resolve));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
