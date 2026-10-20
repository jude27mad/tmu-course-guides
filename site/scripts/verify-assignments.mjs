// QA-only. Run after npm run build; no application or dependency changes.
// PLAYWRIGHT_PATH=/path/to/playwright QA_REPORT_DIR=/tmp/assignments-qa node scripts/verify-assignments.mjs
// PLAYWRIGHT_CHROMIUM overrides /opt/pw-browsers/chromium.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../out');
const reports = resolve(process.env.QA_REPORT_DIR || '/tmp/assignments-qa');
const base = '/tmu-course-guides/next';
const widths = [360, 390, 430, 600, 768, 813, 834, 1024, 1180, 1280, 1440, 1920];
const pages = ['/', '/courses/', '/cen100/', '/mth140/', '/mth141/', '/privacy/'];
const courses = ['/cen100/', '/mth140/', '/mth141/'];
const cardToggleSelector = 'main li:is([id^="assignment-"], [id^="assessment-"], [id^="topic-"]) > button[aria-expanded]';
const minimums = { 'p-l': 16, p: 15, 'p-x': 14, 'p-xs': 13, h6: 18 };
// A reproducible in-term baseline; Date advances normally from this instant so animations keep ticking.
const referenceTime = '2026-10-20T16:00:00Z';
const anchorPattern = /^(?:(?:assignment|assessment|topic)-.+|p-rules|rules-help|textbooks|contacts|guide-tools)$/;
const result = {
  date: new Date().toISOString(), referenceTime, widths, pages, minimums,
  browser: null, buildId: null,
  emulation: 'Headless Chromium; touch, mobile and scale factor 3 below 812px; 900px height. Browser emulation, not physical-device testing.',
  checks: [], typography: [], repetition: [], deepLinks: [], storage: [],
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(`${base}/`)) return void res.writeHead(404).end();
    let path = resolve(root, `.${pathname.slice(base.length)}`);
    if (path !== root && !path.startsWith(`${root}${sep}`)) return void res.writeHead(403).end();
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const bytes = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
function check(name, status, detail = null) {
  result.checks.push({ name, status, detail });
  if (status === 'fail') console.error(`FAIL ${name}: ${JSON.stringify(detail)}`);
}
function checkAssignmentListAndUniqueChecklists() {
  check('Stage 5: one assignment list per page; each checklist rendered once', 'pending', 'Enabled by Stage 5');
}
function checkCalendar() {
  for (const feature of ['list steering', 'manual-navigation priority', '+N more', 'section changes', 'quiz-week labels', 'second-hour labels', 'failure fallback']) {
    check(`Stage 6 calendar: ${feature}`, 'pending', 'Enabled by Stage 6');
  }
}
function checkAccordion() {
  for (const feature of ['keyboard use', 'focus', 'Expand all', 'no-JS text', 'opening from links', 'opening from search']) {
    check(`Stage 7 accordion: ${feature}`, 'pending', 'Enabled by Stage 7');
  }
}
async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? htmlFiles(join(directory, entry.name)) : entry.name.endsWith('.html') ? [join(directory, entry.name)] : []));
  return nested.flat().sort();
}
await mkdir(reports, { recursive: true });
let browser;
let host;
const targets = new Map();
function addTarget(url, source) {
  if (url.origin !== host || !url.hash) return;
  const id = decodeURIComponent(url.hash.slice(1));
  if (!anchorPattern.test(id)) return;
  const key = `${url.pathname}#${id}`;
  if (!targets.has(key)) targets.set(key, { pathname: url.pathname, id, sources: [] });
  const sources = targets.get(key).sources;
  if (!sources.includes(source)) sources.push(source);
}
function collectTargets(inventory, url, source) {
  for (const id of inventory.ids) addTarget(new URL(`#${encodeURIComponent(id)}`, url), source);
  for (const href of inventory.hrefs) addTarget(new URL(href, url), source);
}
async function newPage(width, mode = 'normal', seeds) {
  const context = await browser.newContext({
    viewport: { width, height: 900 }, hasTouch: width < 812, isMobile: width < 812,
    deviceScaleFactor: width < 812 ? 3 : 1, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
  });
  const errors = [];
  await context.exposeBinding('__qaCsp', (_, violation) => errors.push({ kind: 'csp', ...violation }));
  await context.addInitScript(({ referenceTime, mode }) => {
    const NativeDate = Date;
    const fixed = NativeDate.parse(referenceTime);
    const started = NativeDate.now();
    const now = () => fixed + NativeDate.now() - started;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [now()])); }
      static now() { return now(); }
    };
    if (mode === 'saved-pause') localStorage.setItem('guide-motion-paused', 'true');
    document.addEventListener('securitypolicyviolation', event => window.__qaCsp({ directive: event.violatedDirective, blockedURI: event.blockedURI }));
  }, { referenceTime, mode });
  // Seed a real origin once, before loading the app. No init script resets mutations on reload.
  if (seeds) await context.addInitScript(seeds => {
    if (!sessionStorage.getItem('r5-seeded')) {
      for (const [key, value] of Object.entries(seeds)) localStorage.setItem(key, value);
      sessionStorage.setItem('r5-seeded', 'true');
    }
    window.__qaStorageWrites = [];
    for (const method of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        if (this === localStorage && (method === 'clear' || Object.hasOwn(seeds, args[0]))) window.__qaStorageWrites.push({ method, args });
        return original.apply(this, args);
      };
    }
  }, seeds);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (/^https?:$/.test(url.protocol) && url.origin !== host) {
      errors.push({ kind: 'external-request', url: url.href });
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push({ kind: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (/content security policy|violates.*directive|refused to/i.test(message.text())) errors.push({ kind: 'csp-console', message: message.text() });
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push({ kind: 'http', status: response.status(), url: response.url() });
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText });
  });
  page.on('websocket', socket => {
    if (new URL(socket.url()).host !== new URL(host).host) errors.push({ kind: 'external-websocket', url: socket.url() });
  });
  return { context, page, errors };
}
async function ready(page, path) {
  const response = await page.goto(`${host}${path}`, { waitUntil: 'networkidle' });
  assert.ok(response === null || response.status() === 200, `HTTP 200 for ${path}`);
  assert.equal(new URL(page.url()).pathname, new URL(path, host).pathname, 'requested route loaded');
  await page.locator('main h1').first().waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const loader = document.querySelector('#loader');
    if (!main) return false;
    const rect = main.getBoundingClientRect();
    const cover = loader?.getBoundingClientRect();
    return getComputedStyle(main).pointerEvents !== 'none' && Math.abs(rect.x) < 1 &&
      (!cover || cover.right <= 1 || cover.left >= innerWidth - 1 || getComputedStyle(loader).visibility === 'hidden');
  }, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  // Wait for persisted-state hydration, which supplies the live next tile and week.
  if (/\/(cen100|mth140|mth141)\//.test(path)) {
    await page.getByRole('region', { name: 'Course overview', exact: true }).getByRole('link', { name: /^View requirements for / }).waitFor({ state: 'attached' });
  }
}
async function inventory(page) {
  return page.evaluate(() => ({ ids: [...document.querySelectorAll('[id]')].map(el => el.id), hrefs: [...document.querySelectorAll('a[href]')].map(el => el.getAttribute('href')) }));
}
async function typography(page, route, width) {
  const measured = await page.evaluate(minimums => Object.fromEntries(Object.keys(minimums).map(name => {
    const elements = [...document.getElementsByClassName(name)];
    // Some type classes (currently .p) have no mounted instances. Measure their CSS too.
    const probe = elements.length ? null : document.createElement('span');
    if (probe) {
      probe.className = name;
      probe.hidden = true;
      probe.textContent = 'QA font sample';
      document.querySelector('main').append(probe);
    }
    const sizes = [...new Set((probe ? [probe] : elements).map(el => Number.parseFloat(getComputedStyle(el).fontSize)))].sort((a, b) => a - b);
    probe?.remove();
    return [name, { count: elements.length, source: probe ? 'hidden class probe' : 'page elements', sizes, minimum: minimums[name], belowMinimum: sizes.some(size => size < minimums[name] - 0.01) }];
  })), minimums);
  result.typography.push({ route, width, measured });
  check(`${route} ${width}px text sizes`, Object.values(measured).some(item => item.belowMinimum) ? 'expected-fail' : 'pass', { expectation: 'expected to fail until Stage 2', measured });
}
async function repetition(page, route, width) {
  const counts = await page.evaluate(() => {
    const main = document.querySelector('main');
    const normalize = text => text.replace(/\s+/g, ' ').trim().toLowerCase();
    const copy = main.cloneNode(true);
    copy.querySelectorAll('script,style,noscript,template').forEach(el => el.remove());
    const corpus = normalize(copy.textContent);
    const assignments = [...main.querySelectorAll('li[id^="assignment-"], li[id^="assessment-"], li[id^="topic-"]')].map(el => {
      const title = el.querySelector(':scope > button .h6, :scope > button h3, :scope > h3')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      return { anchor: el.id, title, occurrences: title ? corpus.split(normalize(title)).length - 1 : null };
    });
    return {
      photos: document.querySelectorAll('[data-course-artwork]').length,
      markDone: [...document.querySelectorAll('button')].filter(el => /\bMARK\s+DONE\b/i.test(el.textContent)).length,
      assignments,
    };
  });
  result.repetition.push({ route, width, ...counts });
  check(`${route} ${width}px repetition baseline`, 'info', counts);
}
async function health(page, label, errors) {
  const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, main: document.querySelector('main')?.scrollWidth }));
  check(`${label} page health`, errors.length === 0 && [overflow.document, overflow.body, overflow.main].every(size => size <= overflow.viewport + 1) ? 'pass' : 'fail', { overflow, errors: [...errors] });
}
async function motion(page, label, mode) {
  assert.equal(await page.locator('html').getAttribute('data-motion'), 'off', `${mode} disables motion`);
  if (mode === 'saved-pause') assert.equal(await page.evaluate(() => localStorage.getItem('guide-motion-paused')), 'true');
  const headingLocator = page.locator('main h1, main h2');
  const headingIndexes = await headingLocator.evaluateAll(elements => elements.flatMap((el, index) => {
    if (el.closest('dialog:not([open]), [hidden], .sr-only')) return [];
    for (let node = el; node; node = node.parentElement) if (getComputedStyle(node).display === 'none') return [];
    return [index];
  }));
  assert.ok(headingIndexes.length > 0, 'page has content headings');
  const candidates = await page.locator('main p').evaluateAll(elements => elements.flatMap((el, index) => {
    if (!el.textContent.trim() || el.closest('dialog:not([open]), [hidden], .sr-only')) return [];
    for (let node = el; node; node = node.parentElement) if (getComputedStyle(node).display === 'none') return [];
    return [index];
  }));
  const samples = [...new Set([candidates[0], candidates[Math.floor(candidates.length / 2)], candidates.at(-1)].filter(index => index !== undefined))];
  const content = [...headingIndexes.map(index => headingLocator.nth(index)), ...samples.map(index => page.locator('main p').nth(index))];
  // Visit all section headings and first/middle/last body paragraphs, including privacy body copy.
  for (let i = 0; i < content.length; i += 1) {
    const element = content[i];
    await element.evaluate(el => {
      const main = document.querySelector('main');
      const footerSection = el.closest('footer')?.querySelector('section');
      // Short footers uncover as a whole; tall footers use ordinary document scrolling.
      if (footerSection && footerSection.getBoundingClientRect().height <= innerHeight * 1.01) main.scrollTop = main.scrollHeight;
      else el.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    try { await page.waitForFunction(el => {
      const visible = node => {
        for (let parent = node; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        }
        const rect = node.getBoundingClientRect();
        let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
        let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
        // A translated reveal can sit inside an overflow:hidden wrapper with opacity 1.
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent), clip = parent.getBoundingClientRect();
          if (/hidden|clip|auto|scroll/.test(style.overflowX)) {
            left = Math.max(left, clip.left); right = Math.min(right, clip.right);
          }
          if (/hidden|clip|auto|scroll/.test(style.overflowY)) {
            top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
          }
        }
        return right - left > 0.1 && bottom - top > 0.1;
      };
      if (!visible(el)) return false;
      // Reveal animations can hide descendant characters while the heading itself remains visible.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let found = false;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim() || node.parentElement.closest('.sr-only')) continue;
        found = true;
        if (!visible(node.parentElement)) return false;
      }
      return found;
    }, await element.elementHandle(), { timeout: 5000 }); }
    catch { throw new Error(`content sample ${i + 1} hidden: ${(await element.textContent()).trim().slice(0, 120)} (including reveal descendants and clipping)`); }
  }
  check(`${label} content visible`, 'pass');
}
const legacySeeds = {
  'cen100-g9-ticks': '{"m2-1-3":1}',
  'cen100-personal-plan-v1': '{"completed":{"integrity":1},"notes":{"m2":"Legacy CEN note"},"targets":{"m7":"2026-11-30"}}',
  'cen100-contact-choice-v1': '{"section":29,"group":9}',
  'mth140-progress-v1': '{"checks":{"quiz-1-0":true},"completed":{"quiz-1":true},"notes":{"midterm":"Legacy math note"},"targets":{"final":"2026-12-01"},"topics":{"limits-0":true}}',
  'mth140-section-v1': '3',
  'mth141-progress-v1': '{"checks":{},"completed":{},"notes":{},"targets":{},"topics":{}}',
  'mth141-section-v1': '1',
};
async function snapshot(page) {
  return page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(legacySeeds));
}
async function exactStorage(page, expected, label) {
  await page.waitForFunction(expected => Object.entries(expected).every(([key, value]) => localStorage.getItem(key) === value), expected);
  const actual = await snapshot(page);
  assert.deepEqual(actual, expected, label);
  result.storage.push({ label, values: actual });
}
async function savedProgress(width, route) {
  const label = `${route} ${width}px saved progress`;
  const { context, page, errors } = await newPage(width, 'reduced', legacySeeds);
  try {
    await ready(page, base + route);
    const expected = { ...legacySeeds };
    await exactStorage(page, expected, `${label}: no rewrite on read`);
    assert.deepEqual(await page.evaluate(() => window.__qaStorageWrites), [], 'no writes on initial read');
    const cen = route === '/cen100/';
    const course = route.slice(1, -1);
    const anchor = cen ? 'assignment-m2' : 'assessment-midterm';
    await page.locator(`#${anchor} > button[aria-expanded]`).click();
    await page.locator(`#${anchor} label`).first().click();
    assert.equal(await page.locator(`#${anchor} input[type="checkbox"]`).first().isChecked(), true);
    if (cen) expected['cen100-g9-ticks'] = '{"m2-1-3":1,"m2-0-0":1}';
    else {
      const record = JSON.parse(expected[`${course}-progress-v1`]);
      record.checks['midterm-0'] = true;
      expected[`${course}-progress-v1`] = JSON.stringify(record);
    }
    await exactStorage(page, expected, `${label}: checklist old bytes`);
    const tile = page.getByRole('region', { name: 'Course overview', exact: true });
    const mark = tile.getByRole('button', { name: /^Mark .+ done$/ }).first();
    const markedTitle = await mark.getAttribute('aria-label');
    const recordAnchor = cen ? 'assignment-m3' : course === 'mth140' ? 'assessment-midterm' : 'assessment-quiz-3';
    const recordToggle = page.locator(`#${recordAnchor} > button[aria-expanded]`);
    if (await recordToggle.getAttribute('aria-expanded') === 'false') await recordToggle.click();
    const completion = cen ? page.locator(`#${recordAnchor} fieldset input[type="checkbox"]`).first() : page.locator(`#${recordAnchor} input[type="checkbox"]`).last();
    assert.equal(await completion.isChecked(), false, 'completion starts unchecked');
    await mark.click();
    const key = cen ? 'cen100-personal-plan-v1' : `${course}-progress-v1`;
    const record = JSON.parse(expected[key]);
    // Reference-time next records; kept explicit so changed scheduling cannot silently bless new bytes.
    record.completed[cen ? 'failure' : course === 'mth140' ? 'midterm' : 'quiz-3'] = cen ? 1 : true;
    const marked = { ...expected, [key]: JSON.stringify(record) };
    await exactStorage(page, marked, `${label}: next tile Mark done old bytes (${markedTitle})`);
    assert.equal(await completion.isChecked(), true, 'Mark done updates record checkbox');
    await tile.getByRole('button', { name: 'UNDO', exact: true }).click();
    await exactStorage(page, expected, `${label}: Undo restores old bytes`);
    assert.equal(await completion.isChecked(), false, 'Undo updates record checkbox');
    await ready(page, base + route);
    await exactStorage(page, expected, `${label}: reload preserves tick and bytes`);
    assert.deepEqual(await page.evaluate(() => window.__qaStorageWrites), [], 'no writes on reload');
    check(label, errors.length ? 'fail' : 'pass', errors);
  } catch (error) { check(label, 'fail', { message: error.message, actual: await snapshot(page).catch(() => null), errors }); }
  finally { await context.close(); }
}
async function verifyDeepLinks(width) {
  const { context, page, errors } = await newPage(width, 'reduced');
  try {
    for (const pathname of [...new Set([...targets.values()].map(item => item.pathname))].sort()) {
      const entries = [...targets.values()].filter(item => item.pathname === pathname);
      try {
        await ready(page, pathname);
        for (const entry of entries) {
          const count = await page.evaluate(id => [...document.querySelectorAll('[id]')].filter(el => el.id === id).length, entry.id);
          let modal = null;
          if (entry.id === 'guide-tools' && count) {
            await page.goto('about:blank'); // Exercise a cold address-bar deep link.
            await ready(page, `${pathname}#guide-tools`);
            await page.locator('dialog#guide-tools').waitFor({ state: 'visible' });
            modal = await page.locator('dialog#guide-tools').evaluate(el => el.matches(':modal'));
            await page.keyboard.press('Escape');
          }
          const passed = count === 1 && (entry.id !== 'guide-tools' || modal === true);
          result.deepLinks.push({ ...entry, width, count, modal, status: passed ? 'pass' : 'fail' });
          check(`deep link ${pathname}#${entry.id} ${width}px`, passed ? 'pass' : 'fail', { count, modal });
        }
      } catch (error) { check(`deep links on ${pathname} ${width}px`, 'fail', error.message); }
    }
    check(`deep-link navigation health ${width}px`, errors.length ? 'fail' : 'pass', errors);
    assert.ok(targets.size > 0, 'export must contain anchors to test');
  } finally { await context.close(); }
}
const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
function table(headers, rows) {
  return `| ${headers.map(cell).join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')}\n`;
}
function markdown() {
  return `# Assignment browser verification\n\n${result.date}\n\nBuild: ${result.buildId}. Chromium: ${result.browser}. Reference Date: ${referenceTime}.\n\n${result.emulation}\n\n${JSON.stringify(result.summary)}\n\n## Real failures\n\n` +
    (result.checks.filter(item => item.status === 'fail').map(item => `- ${item.name}: ${JSON.stringify(item.detail)}`).join('\n') || 'None.') +
    '\n\n## Text sizes — expected to fail until Stage 2\n\nAll matching DOM elements, with course cards expanded to mount their bodies (including hidden menu/dialog UI); unused classes are measured with temporary hidden probes (count 0 in JSON). Distinct computed pixel sizes are listed; minimums: .p-l 16, .p 15, .p-x 14, .p-xs 13, .h6 18.\n\n' +
    table(['Page', 'Width', ...Object.keys(minimums)], result.typography.map(row => [row.route, row.width, ...Object.keys(minimums).map(name => row.measured[name].sizes.join(', ') || 'N/A')])) +
    '\n## Repetition before Stage 5 (informational)\n\nInitial hydrated DOM, before opening cards. Title occurrences are case-insensitive normalized substrings across main text nodes, excluding scripts/styles; includes text in hidden UI but excludes attributes. Short titles may also occur in explanatory prose.\n\n' +
    table(['Page', 'Width', 'Photos', 'Mark done controls'], result.repetition.map(row => [row.route, row.width, row.photos, row.markDone])) +
    '\n' + table(['Page', 'Width', 'Anchor', 'Title', 'Occurrences'], result.repetition.flatMap(row => row.assignments.map(item => [row.route, row.width, item.anchor, item.title, item.occurrences ?? 'N/A']))) +
    '\n## Pending stages\n\n' + result.checks.filter(item => item.status === 'pending').map(item => `- PENDING ${item.name}`).join('\n') +
    '\n\nFull checks, anchor sources and exact storage snapshots are in results.json. Exit 1 means real failures; expected text-size failures and pending checks never cause exit 1.\n';
}
try {
  await stat(join(root, 'index.html'));
  result.buildId = (await readFile(resolve(root, '../.next/BUILD_ID'), 'utf8')).trim();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  host = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  result.browser = await browser.version();
  // DOMParser reads every exported HTML file inertly: no asset requests or application execution.
  const scan = await browser.newPage();
  for (const file of await htmlFiles(root)) {
    const relative = file.slice(root.length).split(sep).join('/');
    const publicPath = `${base}${relative.replace(/index\.html$/, '')}`;
    const documentInventory = await scan.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return { ids: [...doc.querySelectorAll('[id]')].map(el => el.id), hrefs: [...doc.querySelectorAll('a[href]')].map(el => el.getAttribute('href')) };
    }, await readFile(file, 'utf8'));
    collectTargets(documentInventory, new URL(publicPath, host), relative);
  }
  await scan.close();
  async function verifyWidth(width) {
    for (const route of pages) {
      for (const mode of ['normal', 'reduced', 'saved-pause']) {
        const label = `${route} ${width}px ${mode}`;
        console.log(`Checking ${label}`);
        const { context, page, errors } = await newPage(width, mode);
        try {
          await ready(page, base + route);
          if (mode === 'normal') {
            collectTargets(await inventory(page), new URL(base + route, host), `${route} hydrated ${width}px`);
            await repetition(page, route, width);
            // Card bodies are unmounted while closed. Mount them before measuring text sizes.
            for (const button of await page.locator(cardToggleSelector).all()) {
              if (await button.getAttribute('aria-expanded') === 'false') await button.evaluate(el => el.click());
            }
            await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(button => button.getAttribute('aria-expanded') === 'true'), cardToggleSelector);
            collectTargets(await inventory(page), new URL(base + route, host), `${route} expanded ${width}px`);
            await typography(page, route, width);
          } else await motion(page, label, mode);
        } catch (error) { check(`${label} completed`, 'fail', error.message); }
        finally {
          await health(page, label, errors).catch(error => check(`${label} page health`, 'fail', error.message));
          await context.close();
        }
      }
      console.log(`Checked ${route} at ${width}px (normal, reduced, saved pause)`);
    }
  }
  // Bound concurrency: each worker owns a disposable context; no browser state is shared.
  for (let index = 0; index < widths.length; index += 2) {
    await Promise.all(widths.slice(index, index + 2).map(async width => {
      await verifyWidth(width);
      for (const route of courses) await savedProgress(width, route);
    }));
  }
  for (let index = 0; index < widths.length; index += 2) {
    await Promise.all(widths.slice(index, index + 2).map(width => verifyDeepLinks(width)));
  }
} catch (error) { check('browser harness completed', 'fail', error.stack); }
finally {
  checkAssignmentListAndUniqueChecklists();
  checkCalendar();
  checkAccordion();
  if (browser) await browser.close();
  if (server.listening) await new Promise(done => server.close(done));
  for (const rows of [result.typography, result.repetition]) rows.sort((a, b) => a.width - b.width || pages.indexOf(a.route) - pages.indexOf(b.route));
  result.summary = Object.fromEntries(['pass', 'fail', 'expected-fail', 'pending', 'info'].map(status => [status, result.checks.filter(item => item.status === status).length]));
  await writeFile(join(reports, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(join(reports, 'results.md'), markdown());
  console.log(`Reports: ${reports}\n${JSON.stringify(result.summary)}`);
  if (result.summary.fail) process.exitCode = 1;
}
