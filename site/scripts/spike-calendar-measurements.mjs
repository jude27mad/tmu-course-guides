// QA only. Build first; install Playwright outside the site and set PLAYWRIGHT_PATH.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './spike-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(site, '../docs/codex/remove-repetition/reports/r4-evidence');
await mkdir(evidence, { recursive: true });
const service = await startServer();
const url = `${service.origin}${service.base}/spike/`;
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = { browser: browser.version(), date: new Date().toISOString(), widths: [], rendering: {}, touch: [], health: [], failure: {} };

async function open(query = '', options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  const health = { query, pageErrors: [], csp: [], requests: [], externalRequests: [], consoleErrors: [] };
  await page.exposeFunction('recordSpikeCsp', (event) => health.csp.push(event));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      window.recordSpikeCsp({ directive: event.violatedDirective, blockedURI: event.blockedURI, sourceFile: event.sourceFile, lineNumber: event.lineNumber });
    });
  });
  page.on('pageerror', (error) => health.pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') health.consoleErrors.push(message.text()); });
  page.on('request', (request) => {
    const requestUrl = request.url();
    health.requests.push(requestUrl.replace(service.origin, 'ORIGIN'));
    if (/^https?:/.test(requestUrl) && new URL(requestUrl).origin !== service.origin) health.externalRequests.push(requestUrl);
  });
  await page.goto(`${url}?motion=off&${query}`, { waitUntil: 'networkidle' });
  await page.locator('.sx__calendar-wrapper').waitFor();
  await page.waitForFunction(() => window.spikeCalendar?.controls?.$app?.elements?.calendarWrapper);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).opacity === '1');
  results.health.push(health);
  return { context, page, health };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const { controls } = window.spikeCalendar;
    const root = document.querySelector('.sx__calendar-wrapper');
    return {
      containerWidth: document.querySelector('[data-spike-calendar-container]').clientWidth,
      calendarWidth: root.clientWidth,
      calendarHeight: root.clientHeight,
      windowWidth: window.innerWidth,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      view: controls.getView(),
      isSmall: controls.$app.calendarState.isCalendarSmall.value,
      configuredViews: controls.getViews().map((view) => ({ name: view.name, small: view.hasSmallScreenCompat, wide: view.hasWideScreenCompat })),
      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
    };
  });
}

async function picker(page) {
  await page.getByRole('button', { name: 'Select View', exact: true }).click();
  const labels = await page.locator('[data-testid="view-selection-items"] button').allTextContents();
  await page.getByRole('button', { name: 'Select View', exact: true }).click();
  return labels;
}

async function select(page, view, date) {
  await page.evaluate(({ viewName, selectedDate }) => {
    const { controls } = window.spikeCalendar;
    if (selectedDate) controls.setDate(Temporal.PlainDate.from(selectedDate));
    if (viewName) controls.setView(viewName);
  }, { viewName: view, selectedDate: date });
  await page.waitForTimeout(350);
}

async function swipe(page, x, fromY, toY) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: fromY }] });
  for (let index = 1; index <= 12; index += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: fromY + (toY - fromY) * index / 12 }] });
    await page.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(450);
  await cdp.detach();
}

try {
  for (const responsive of [true, false]) {
    for (const width of [360, 420, 480, 520, 600, 700, 800, 1000]) {
      const { context, page } = await open(`width=${width}&responsive=${responsive}`);
      results.widths.push({ responsive, requestedWidth: width, ...await snapshot(page), pickerViews: await picker(page) });
      await context.close();
    }
  }

  const resize = await open('width=1000&responsive=true');
  results.containerResize = { before: await snapshot(resize.page) };
  await resize.page.locator('[data-spike-calendar-container]').evaluate((element) => { element.style.width = '420px'; });
  await resize.page.waitForTimeout(400);
  results.containerResize.afterContainerOnly = await snapshot(resize.page);
  await resize.page.setViewportSize({ width: 1439, height: 1100 });
  await resize.page.waitForTimeout(400);
  results.containerResize.afterWindowResize = await snapshot(resize.page);
  await select(resize.page, 'month-grid');
  results.containerResize.programmaticNarrowGrid = await snapshot(resize.page);
  await resize.context.close();

  const desktop = await open('width=1000&responsive=true');
  results.rendering.grid = await desktop.page.locator('[data-event-id="quiz-week"]').evaluateAll((elements) => elements.map((element) => ({
    title: element.textContent, width: element.getBoundingClientRect().width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
    whiteSpace: getComputedStyle(element).whiteSpace, overflow: getComputedStyle(element).overflow,
    style: element.getAttribute('style'), parent: element.parentElement.getAttribute('data-date'),
  })));
  const plusControl = desktop.page.locator('.sx__month-grid-day__events-more').first();
  results.rendering.moreBefore = await snapshot(desktop.page);
  results.rendering.moreText = await plusControl.innerText();
  await plusControl.click();
  await desktop.page.waitForTimeout(400);
  results.rendering.moreAfter = await snapshot(desktop.page);
  await select(desktop.page, 'month-grid', '2026-10-19');
  await desktop.page.screenshot({ path: resolve(evidence, 'spike-1440.png') });
  await desktop.context.close();

  const narrowGrid = await open('width=520&responsive=false');
  results.rendering.narrowGrid = await narrowGrid.page.locator('[data-event-id="quiz-week"]').evaluateAll((elements) => elements.map((element) => ({
    title: element.textContent, width: element.getBoundingClientRect().width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
    whiteSpace: getComputedStyle(element).whiteSpace, overflow: getComputedStyle(element).overflow,
  })));
  await narrowGrid.context.close();

  const override = await open('width=1000&more=override');
  await override.page.locator('.sx__month-grid-day__events-more').first().click();
  await override.page.waitForTimeout(400);
  results.rendering.moreOverride = { ...await snapshot(override.page), clicks: await override.page.evaluate(() => window.spikeMoreClicks) };
  await override.context.close();

  const mobile = await open('width=360&view=month-agenda', { viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
  results.rendering.agenda = [];
  for (const day of ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']) {
    await select(mobile.page, 'month-agenda', day);
    results.rendering.agenda.push({ date: day, text: await mobile.page.locator('.sx__month-agenda-events').innerText() });
  }
  await select(mobile.page, 'month-agenda', '2026-10-22');
  results.rendering.agendaTitle = await mobile.page.locator('.sx__month-agenda-event__title').evaluateAll((elements) => elements.map((element) => ({
    text: element.textContent, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, height: element.getBoundingClientRect().height,
    whiteSpace: getComputedStyle(element).whiteSpace, lineHeight: getComputedStyle(element).lineHeight,
  })));
  await mobile.page.screenshot({ path: resolve(evidence, 'spike-390.png') });
  await mobile.context.close();

  for (const prevent of [true, false]) {
    const touch = await open(`width=360&view=month-agenda&prevent=${prevent}`, { viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    await select(touch.page, 'month-agenda', '2026-10-22');
    // More synthetic events only to make the unstyled agenda overflow reliably.
    await touch.page.evaluate(() => {
      const day = Temporal.PlainDate.from('2026-10-22');
      const existing = window.spikeCalendar.events.getAll();
      window.spikeCalendar.events.set([...existing, ...Array.from({ length: 20 }, (_, index) => ({ id: `scroll-${index}`, title: `Scroll sample ${index}`, start: day, end: day }))]);
      document.querySelector('main').scrollTop = 120;
    });
    await touch.page.waitForTimeout(400);
    const scrollState = () => touch.page.evaluate(() => ({
      main: document.querySelector('main').scrollTop,
      containers: [...document.querySelectorAll('[data-spike-calendar-container] *')].filter((element) => element.scrollHeight > element.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(element).overflowY)).map((element) => ({ className: element.className, scrollTop: element.scrollTop, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY })),
      lenis: { wrapperClasses: document.querySelector('main').className },
    }));
    const before = await scrollState();
    const box = await touch.page.locator('.sx__month-agenda-events').boundingBox();
    const fromY = Math.min(box.y + 190, 780);
    await swipe(touch.page, 180, fromY, Math.max(140, fromY - 180));
    const after = await scrollState();
    results.touch.push({ prevent, hasTouch: true, method: 'Chromium CDP native Input.dispatchTouchEvent swipe', before, after });
    await touch.context.close();
  }

  const manifest = JSON.parse(await readFile(resolve(site, '.next/react-loadable-manifest.json'), 'utf8'));
  const calendarFiles = Object.entries(manifest).find(([key]) => key.includes('CalendarProbe'))[1].files;
  const chunk = calendarFiles.find((file) => file.endsWith('.js') && file.includes('/239.')) || calendarFiles.filter((file) => file.endsWith('.js')).at(-1);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(`**/_next/${chunk}`, (route) => route.abort('failed'));
  await page.goto(`${url}?motion=off`, { waitUntil: 'networkidle' });
  await page.getByRole('status').filter({ hasText: 'Calendar unavailable' }).waitFor({ timeout: 15000 });
  await page.locator('[data-spike-counter]').click();
  await page.locator('[data-spike-expand-all]').click();
  results.failure = {
    blockedChunk: chunk, caught: await page.evaluate(() => window.spikeCalendarError), pageErrors: errors,
    fallback: await page.getByRole('status').filter({ hasText: 'Calendar unavailable' }).innerText(),
    counter: await page.locator('[data-spike-counter]').innerText(),
    staticDates: await page.locator('[data-spike-static-dates]').innerText(),
    expandedPanels: await page.locator('[data-spike-panel][data-state="open"]').count(),
  };
  await page.screenshot({ path: resolve(evidence, 'calendar-failure-1440.png') });
  await context.close();
} finally {
  // Partial data survives if a selector or browser behavior differs.
  await writeFile(resolve(evidence, 'calendar.json'), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
  await new Promise((done) => service.server.close(done));
}
console.log(`Calendar evidence: ${evidence}/calendar.json`);
