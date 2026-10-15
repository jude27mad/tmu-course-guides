/** Browser checks for the exported Giats application, independent of the legacy Night Shift suite.
 * Run from site/: PLAYWRIGHT_PATH=/path/to/playwright node scripts/verify-artwork.mjs
 * --baseline checks the old export without asserting the new artwork exists.
 * --functional continues after a completed viewport matrix; --remaining keeps
 * completed checks and runs isolated lifecycle/failure cases. Prior errors stay
 * in the report and different known build IDs cannot be combined.
 * No build or product files are modified. All persistence changes belong to disposable browser contexts.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';
import { instrument } from '../../tools/qa/instrument.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/codex/cua_node/lib/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = process.argv.includes('--baseline');
const remainingOnly = process.argv.includes('--remaining');
const functionalOnly = process.argv.includes('--functional') || remainingOnly;
const out = path.join(root, 'docs/qa/giats-artwork');
const prefix = baseline ? 'baseline-' : '';
await mkdir(path.join(out, 'screenshots'), { recursive: true });
const server = createPreview({ root, base: '/tmu-course-guides/' });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = '/tmu-course-guides/next/';
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] });
const buildId = (await readFile(path.join(root, 'site/.next/BUILD_ID'), 'utf8')).trim();
const results = { buildId, baseline, date: new Date().toISOString(), browser: await browser.version(), emulation: 'Chromium headless; software rendering; browser viewport/touch emulation, not physical iPhone testing', checks: [], errors: [], screenshots: [], observations: {} };
if (functionalOnly) {
  const prior = JSON.parse(await readFile(path.join(out, 'results.json'), 'utf8'));
  if (prior.buildId && prior.buildId !== buildId) throw new Error('Cannot combine browser runs from different exports');
  results.errors.push(...prior.errors);
  results.checks.push(...prior.checks.filter(item => remainingOnly ? !['browser harness completed', 'no new browser errors or third-party runtime requests'].includes(item.name) : /^(phone390|phone430|tablet|desktop)(:| )/.test(item.name)));
  if (remainingOnly && prior.observations.failureState?.header?.visibility === 'hidden' && !results.checks.some(item => item.name === 'motion enabled: menu return restores navbar')) results.checks.push({ name: 'motion enabled: menu return restores navbar', pass: false, detail: { observation: prior.observations.failureState, baseline: 'Comparison recorded separately in baseline-active-navigation.json' } });
  results.screenshots.push(...prior.screenshots.filter(file => remainingOnly || !/paused|reduced|saved-pause|canvas-failure|no-js|no-upcoming/.test(file)));
  results.observations = { ...prior.observations };
  results.observations.continuationOf = { date: prior.date, buildId: prior.buildId || buildId };
  results.observations.viewportRun = prior.observations.viewportRun || { date: prior.date, browser: prior.browser, buildId: prior.buildId || buildId, note: 'Source and export remained unchanged between viewport and functional runs; prior browser errors are retained.' };
}
const check = (name, pass, detail = null) => { results.checks.push({ name, pass: Boolean(pass), detail }); if (!pass) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`); };

function artworkInstrumentation() {
  const calls = new WeakMap();
  for (const name of ['fillRect', 'clearRect', 'drawImage', 'fill', 'stroke', 'putImageData']) {
    const original = CanvasRenderingContext2D.prototype[name];
    CanvasRenderingContext2D.prototype[name] = function (...args) { calls.set(this.canvas, (calls.get(this.canvas) || 0) + 1); return original.apply(this, args); };
  }
  window.__artworkDraws = () => [...document.querySelectorAll('[data-signal-field], [data-course-artwork] canvas')].map(canvas => ({ kind: canvas.hasAttribute('data-signal-field') ? 'signal' : 'photo', calls: calls.get(canvas) || 0, width: canvas.width, height: canvas.height, visible: getComputedStyle(canvas).visibility }));
}
async function context(options = {}, init) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  await context.addInitScript(instrument);
  await context.addInitScript(artworkInstrumentation);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => results.errors.push({ kind: 'pageerror', url: page.url(), message: error.message }));
  page.on('console', message => { if (message.type() === 'error') results.errors.push({ kind: 'console', url: page.url(), message: message.text() }); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') results.errors.push({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }); });
  page.on('response', response => { if (response.status() >= 400) results.errors.push({ kind: 'http', url: response.url(), status: response.status() }); });
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin)) results.errors.push({ kind: 'external-request', url: request.url() }); });
  return { context, page };
}
async function settled(page) {
  await page.waitForFunction(() => { const main = document.querySelector('main'); const loader = document.querySelector('#loader'); if (!main) return false; const rect = main.getBoundingClientRect(); const cover = loader?.getBoundingClientRect(); return getComputedStyle(main).pointerEvents !== 'none' && Math.abs(rect.x) < 1 && Math.abs(rect.width - innerWidth) < 1 && (!cover || cover.right <= 1 || cover.left >= innerWidth - 1 || getComputedStyle(loader).visibility === 'hidden'); }, null, { timeout: 25000 });
  await page.waitForTimeout(350);
}
async function ready(page, route = '') {
  await page.goto(origin + base + route);
  await page.locator('main h1').first().waitFor();
  await settled(page);
  if (!route) await page.waitForFunction(() => { const header = document.querySelector('header'); return header && getComputedStyle(header).visibility === 'visible' && Number(getComputedStyle(header).opacity) > 0.99; }, null, { timeout: 20000 });
}
async function screenshot(page, name) {
  const filename = `${prefix}${name}.jpg`;
  await page.screenshot({ path: path.join(out, 'screenshots', filename), type: 'jpeg', quality: 84 });
  results.screenshots.push(`screenshots/${filename}`);
}
async function scrollTo(page, selector, offset = 110) {
  await page.locator(selector).first().evaluate((el, offset) => { const main = document.querySelector('main'); main.scrollTop += el.getBoundingClientRect().top - offset; }, offset);
  await page.waitForTimeout(1100);
}
async function overflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('main').scrollWidth }));
  check(`${label}: no horizontal overflow`, size.document <= size.viewport + 1 && size.main <= size.viewport + 1, size);
}
async function media(page, label, course) {
  if (baseline) return;
  const selector = course ? `[data-course-artwork="${course}"]` : '[data-course-artwork]';
  const frames = await page.locator(selector).first().evaluateAll(els => els.map(el => { const img = el.querySelector('img'); const rect = el.getBoundingClientRect(); return { key: el.getAttribute('data-course-artwork'), width: rect.width, height: rect.height, loaded: !!img?.naturalWidth, src: img?.getAttribute('src'), alt: img?.alt }; }));
  check(`${label}: locally loaded photo and stable dimensions`, frames.length > 0 && frames.every(f => f.loaded && f.width > 0 && f.height > 0 && f.src.startsWith(base)), frames);
}
async function menu(page) {
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#menu').getAttribute('aria-hidden') === 'false');
  await page.waitForTimeout(650);
}
async function navigate(page, route) {
  await menu(page);
  await page.locator(`#menu a[href="${base}${route}"]`).click();
  await page.waitForURL(origin + base + route);
  const expected = ({ 'cen100/': 'Introduction to Engineering', 'mth140/': 'Calculus I', 'mth141/': 'Linear Algebra' })[route] || 'TMU Course Guides';
  await page.waitForFunction(expected => document.querySelector('main h1')?.textContent.includes(expected), expected);
  if (await page.locator('html').getAttribute('data-motion') === 'off') {
    await page.waitForTimeout(600);
    const open = await page.locator('#menu').getAttribute('aria-hidden') === 'false';
    const mainX = await page.locator('main').evaluate(el => el.getBoundingClientRect().x);
    check('saved Pause motion: menu navigation restores the page', !open && Math.abs(mainX) < 1, { route, menuRemainsOpen: open, mainX, baseline: 'Also reproduced in original committed export; see baseline-paused-navigation.json' });
    if (open || Math.abs(mainX) >= 1) {
      await screenshot(page, 'desktop-paused-menu-known-issue');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      if (Math.abs(await page.locator('main').evaluate(el => el.getBoundingClientRect().x)) >= 1) {
        results.observations.pausedNavigationRecovery = 'Escape did not restore the pre-existing shifted shell; browser reload used to continue independent artwork and persistence checks.';
        await page.reload();
      }
    }
  }
  await settled(page);
}
async function snapshot(page) {
  await page.evaluate(() => window.gc?.());
  await page.waitForTimeout(350);
  return page.evaluate(() => window.__qaMetrics.snapshot());
}

try {
  for (const [name, width, height, touch] of (functionalOnly ? [] : [['phone390', 390, 844, true], ['phone430', 430, 932, true], ['tablet', 820, 1180, true], ['desktop', 1440, 900, false]])) {
    console.log(`Inspecting ${name}`);
    const { context: ctx, page } = await context({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    await ready(page);
    const navbar = await page.locator('header').first().evaluate(el => ({ visibility: getComputedStyle(el).visibility, opacity: Number(getComputedStyle(el).opacity) }));
    check(`${name}: homepage navbar visible`, navbar.visibility === 'visible' && navbar.opacity > 0.99, navbar);
    await overflow(page, `${name} home`);
    if (!baseline) check(`${name}: one continuous signal canvas and original window mask`, await page.locator('canvas[data-signal-field]').count() === 1 && await page.locator('mask#mask rect').count() > 1);
    await screenshot(page, `${name}-home`);
    if (!baseline && touch) {
      const cdp = await ctx.newCDPSession(page);
      const x = Math.round(width / 2), y = Math.min(height - 150, 650);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, radiusX: 5, radiusY: 5 }] });
      for (let dy = 20; dy <= 300; dy += 20) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy, radiusX: 5, radiusY: 5 }] }); await page.waitForTimeout(25); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(500);
      check(`${name}: touch scroll passes through artwork`, await page.locator('main').evaluate(el => el.scrollTop > 0));
      await page.locator('main').evaluate(el => { el.scrollTop = 0; });
      await cdp.detach();
    }
    await scrollTo(page, '#desk-next-heading');
    await media(page, `${name} Next Up`);
    if (!baseline && await page.locator('[data-course-artwork]').first().evaluate(el => el.getBoundingClientRect().top > innerHeight * 0.45)) await scrollTo(page, '[data-course-artwork]', 220);
    if (!baseline) await page.waitForFunction(() => { const canvas = document.querySelector('[data-course-artwork] canvas'); return canvas && getComputedStyle(canvas).visibility === 'hidden'; }, null, { timeout: 8000 });
    if (!baseline) await scrollTo(page, '#desk-next-heading', 110);
    await screenshot(page, `${name}-next-up`);
    await menu(page);
    check(`${name}: menu opens`, await page.locator('#menu').getAttribute('aria-hidden') === 'false');
    await screenshot(page, `${name}-menu`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    await page.keyboard.press('Control+k');
    await page.locator('#search[aria-hidden="false"]').waitFor();
    const search = page.locator('#search input');
    await search.fill('midterm');
    await page.waitForTimeout(500);
    check(`${name}: search returns course results`, await page.locator('#search [role="option"]').count() > 0 && /midterm/i.test(await page.locator('#search-results').innerText()));
    await screenshot(page, `${name}-search`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    for (const course of ['cen100', 'mth140', 'mth141']) {
      await navigate(page, `${course}/`);
      check(`${name}: ${course} navigation heading`, (await page.locator('main h1').innerText()).length > 4);
      await overflow(page, `${name} ${course}`);
      await media(page, `${name} ${course} hero`, course);
      if (!baseline) {
        await page.waitForFunction(course => { const canvas = document.querySelector(`[data-course-artwork="${course}"] canvas`); return canvas && getComputedStyle(canvas).visibility === 'hidden'; }, course, { timeout: 8000 });
        const hidden = await page.locator(`[data-course-artwork="${course}"] canvas`).first().evaluate(el => getComputedStyle(el).visibility === 'hidden');
        check(`${name}: ${course} reveal finishes at initial scroll position`, hidden);
      }
      await screenshot(page, `${name}-${course}`);
      if (!baseline && course === 'cen100' && ['phone390', 'desktop'].includes(name)) {
        const secondary = page.locator('[data-course-artwork]').nth(1);
        await secondary.evaluate(el => { const main = document.querySelector('main'); main.scrollTop += el.getBoundingClientRect().top - 150; });
        await page.waitForTimeout(2500);
        await screenshot(page, `${name}-checklist`);
        await overflow(page, `${name} checklist`);
      }
    }
    await page.goBack(); await settled(page);
    check(`${name}: browser Back`, page.url().includes('/mth140/'));
    await page.goForward(); await settled(page);
    check(`${name}: browser Forward`, page.url().includes('/mth141/'));
    await ctx.close();
  }

  if (!baseline) {
    console.log('Inspecting motion, fallback, lifecycle and persistence');
    if (!remainingOnly) {
    const { context: ctx, page } = await context();
    await ready(page);
    let before = await page.evaluate(() => window.__artworkDraws());
    await page.waitForTimeout(300);
    let after = await page.evaluate(() => window.__artworkDraws());
    check('motion enabled: signal field draws', after.find(x => x.kind === 'signal')?.calls > before.find(x => x.kind === 'signal')?.calls, { before, after });
    check('canvas resolution capped', after.every(x => x.width * x.height <= 4_200_000), after);
    await scrollTo(page, '#desk-next-heading');
    before = await page.evaluate(() => window.__artworkDraws()); await page.waitForTimeout(400); after = await page.evaluate(() => window.__artworkDraws());
    check('offscreen signal pauses', before.find(x => x.kind === 'signal')?.calls === after.find(x => x.kind === 'signal')?.calls, { before, after });
    await page.locator('main').evaluate(el => { el.scrollTop = 0; }); await page.waitForTimeout(500);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    before = await page.evaluate(() => window.__artworkDraws()); await page.waitForTimeout(350); after = await page.evaluate(() => window.__artworkDraws());
    check('hidden document pauses artwork', JSON.stringify(before) === JSON.stringify(after), { before, after });
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await menu(page);
    await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
    check('Pause motion saves existing key', await page.evaluate(() => localStorage.getItem('guide-motion-paused')) === 'true');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    before = await page.evaluate(() => window.__artworkDraws()); await page.waitForTimeout(350); after = await page.evaluate(() => window.__artworkDraws());
    check('Pause motion stops signal field', before.find(x => x.kind === 'signal')?.calls === after.find(x => x.kind === 'signal')?.calls, { before, after });
    await screenshot(page, 'desktop-paused');
    await page.reload(); await page.waitForTimeout(2000);
    before = await page.evaluate(() => window.__artworkDraws()); await page.waitForTimeout(350); after = await page.evaluate(() => window.__artworkDraws());
    check('saved Pause motion survives reload with static field', JSON.stringify(before) === JSON.stringify(after) && before.some(x => x.kind === 'signal' && x.calls > 0), { before, after });
    await navigate(page, 'mth140/');
    await scrollTo(page, '#section-picker');
    await page.locator('#section-picker button').first().click();
    check('section selection persists', await page.evaluate(() => !!localStorage.getItem('mth140-section-v1')));
    // Open an actual assessment and use existing controls; no dates or completion fixtures are written.
    const card = page.locator('li[id^="assessment-"]').first();
    const cardId = await card.getAttribute('id');
    await card.locator('button[aria-expanded]').click();
    const checkbox = card.locator('input[type="checkbox"]').first();
    await checkbox.check({ force: true });

    const stored = await page.evaluate(() => localStorage.getItem('mth140-progress-v1'));
    check('checklist saves existing progress format', !!stored && await checkbox.isChecked(), stored);
    await page.reload(); await settled(page);
    await page.locator(`li[id="${cardId}"] button[aria-expanded]`).click();
    check('saved checklist survives reload', await page.locator(`li[id="${cardId}"] input[type="checkbox"]`).first().isChecked());
    const mark = page.getByRole('button', { name: /^Mark .* done$/ }).first();
    if (await mark.count()) {
      await mark.click({ force: true }); await page.waitForTimeout(200);
      const undo = page.getByRole('button', { name: 'UNDO', exact: true }).first();
      check('Mark done exposes Undo', await undo.count() > 0);
      await undo.click({ force: true });
      check('Undo restores mark action', await page.getByRole('button', { name: /^Mark .* done$/ }).count() > 0);
    } else check('completion action present', false);
    await ctx.close();
    }
    // Keep rapid menu re-entry as an explicit independent navigation check. It must
    // not prevent the unrelated artwork lifecycle and failure-mode checks below.
    if (!results.checks.some(item => item.name === 'motion enabled: menu return restores navbar')) {
      const { context: navCtx, page: navPage } = await context();
      await ready(navPage);
      let navigationError = null;
      try {
        await navigate(navPage, 'cen100/'); await navigate(navPage, '');
        await snapshot(navPage);
      } catch (error) { navigationError = error.message; }
      const header = await navPage.locator('header').first().evaluate(el => ({ visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity, inert: el.inert }));
      check('motion enabled: menu return restores navbar', !navigationError && header.visibility === 'visible' && Number(header.opacity) > 0.99 && !header.inert, { url: navPage.url(), header, navigationError, comparison: 'baseline-active-navigation.json and baseline-rapid-navigation.json' });
      if (navigationError || header.visibility !== 'visible') await screenshot(navPage, 'desktop-rapid-menu-return');
      await navCtx.close();
    }
    // Isolate artwork lifecycle from the confirmed pre-existing paused-menu shell defect.
    {
    const { context: ctx, page } = await context();
    await ready(page);
    const roundTrip = async () => {
      await page.locator(`main a[href="${base}cen100/"]`).first().click();
      await page.waitForURL(origin + base + 'cen100/');
      await page.waitForFunction(() => document.querySelector('main h1')?.textContent.includes('Introduction to Engineering'));
      await settled(page);
      await page.goBack();
      await page.waitForFunction(() => document.querySelector('main h1')?.textContent.includes('TMU Course Guides'));
      await settled(page);
    };
    await roundTrip();
    const first = await snapshot(page);
    for (let i = 0; i < 5; i++) await roundTrip();
    const last = await snapshot(page);
    results.observations.lifecycle = { before: first, after: last };
    check('route round trips do not accumulate live listeners', last.listeners.live <= first.listeners.live, { before: first.listeners.live, after: last.listeners.live });
    check('route round trips do not accumulate active observers', last.observers.total <= first.observers.total, { before: first.observers, after: last.observers });
    check('route round trips do not accumulate animation loops', last.raf.recurring <= first.raf.recurring && last.raf.pending <= first.raf.pending + 1, { before: first.raf, after: last.raf });
    check('route round trips do not accumulate canvases', last.canvases.connected === first.canvases.connected, { before: first.canvases.connected, after: last.canvases.connected });
    await ctx.close();
    }

    for (const mode of ['saved-pause', 'reduced', 'canvas-failure', 'no-js']) {
      const init = mode === 'saved-pause' ? () => localStorage.setItem('guide-motion-paused', 'true') : mode === 'canvas-failure' ? () => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === '2d' && (this.hasAttribute('data-signal-field') || this.closest('[data-course-artwork]')) ? null : original.call(this, kind, ...args); }; } : undefined;
      const { context: modeCtx, page: p } = await context({ reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference', javaScriptEnabled: mode !== 'no-js' }, init);
      await ready(p);
      if (mode === 'no-js') check('unresolved SSR Next Up uses fallback artwork', await p.locator('[data-course-artwork="fallback"]').count() === 1);
      await scrollTo(p, '#desk-next-heading');
      await media(p, `${mode} Next Up`);
      await screenshot(p, `desktop-${mode}-next-up`);
      for (const course of ['cen100', 'mth140', 'mth141']) {
        await ready(p, `${course}/`);
        await media(p, `${mode} ${course}`, course);
        const visibility = await p.locator('[data-course-artwork] canvas').evaluateAll(els => els.map(el => getComputedStyle(el).visibility));
        check(`${mode} ${course}: finished image without decorative overlay`, visibility.every(v => v === 'hidden'));
      }
      if (mode === 'reduced') {
        await ready(p); const a = await p.evaluate(() => window.__artworkDraws()); await p.waitForTimeout(350); const b = await p.evaluate(() => window.__artworkDraws());
        check('reduced motion uses static signal frame', JSON.stringify(a) === JSON.stringify(b) && a.some(x => x.kind === 'signal' && x.calls > 0), { before: a, after: b });
        await screenshot(p, 'desktop-reduced');
      }
      await modeCtx.close();
    }
  }
} catch (error) {
  check('browser harness completed', false, error.stack);
  const lastPage = browser.contexts().flatMap(ctx => ctx.pages()).at(-1);
  if (lastPage) {
    results.observations.failureState = await lastPage.evaluate(() => ({ url: location.href, main: document.querySelector('main')?.getBoundingClientRect().toJSON(), menu: document.querySelector('#menu')?.getAttribute('aria-hidden'), header: document.querySelector('header') ? { visibility: getComputedStyle(document.querySelector('header')).visibility, opacity: getComputedStyle(document.querySelector('header')).opacity, inert: document.querySelector('header').inert } : null }));
    await screenshot(lastPage, 'harness-failure-state');
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  check('no new browser errors or third-party runtime requests', results.errors.length === 0, results.errors);
  const passed = results.checks.filter(item => item.pass).length;
  results.summary = { passed, failed: results.checks.length - passed, total: results.checks.length };
  await writeFile(path.join(out, `${prefix}results.json`), JSON.stringify(results, null, 2) + '\n');
  await writeFile(path.join(out, `${prefix}results.md`), `# Giats artwork browser verification${baseline ? ' — baseline' : ''}\n\n${results.date}\n\n${results.emulation}. Chromium ${results.browser}. Export build ${buildId}.\n\n${passed}/${results.checks.length} assertions passed.\n\n` + results.checks.map(item => `- ${item.pass ? 'PASS' : 'FAIL'}: ${item.name}${!item.pass ? ` — ${JSON.stringify(item.detail)}` : ''}`).join('\n') + '\n\n## Screenshots\n\n' + results.screenshots.map(file => `- [${path.basename(file)}](${file})`).join('\n') + '\n\nLimitations: no physical iPhone/Safari/GPU-performance claims. Hidden-document pause uses a synthetic visibilitychange event. No production deployment was performed. Fallback is checked in the unresolved server-rendered/no-JavaScript state and component tests. An empty-coursework state was not fabricated: undated final assessments legitimately remain pending after the term. No dates or saved completion data were fabricated for screenshots.\n');
  console.log(JSON.stringify(results.summary));
  if (results.summary.failed) process.exitCode = 1;
}
