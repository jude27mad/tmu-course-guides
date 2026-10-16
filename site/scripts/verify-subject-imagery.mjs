/** Focused exported-preview check after the subject-photography-only revision.
 * Run: node site/scripts/verify-subject-imagery.mjs EXPECTED_BUILD_ID
 * Keeps the earlier full lifecycle QA untouched. Does not build/edit product files.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/codex/cua_node/lib/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const buildId = (await readFile(path.join(root, 'site/.next/BUILD_ID'), 'utf8')).trim();
if (!process.argv[2] || process.argv[2] !== buildId) throw new Error(`Explicit expected build required; current build is ${buildId}`);
const out = path.join(root, 'docs/qa/giats-artwork/subject-imagery');
await mkdir(path.join(out, 'screenshots'), { recursive: true });
const server = createPreview({ root, base: '/tmu-course-guides/' });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = '/tmu-course-guides/next/';
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = { buildId, date: new Date().toISOString(), browser: await browser.version(), emulation: 'Chromium headless with software rendering; browser-emulated viewports, not physical iPhone testing', scope: 'Focused subject-image revision; preceding complete lifecycle run is retained separately at ../results.json', checks: [], errors: [], screenshots: [], images: [] };
const subjects = { cen100: 'engineering-bridge', mth140: 'calculus-integral', mth141: 'linear-equations', fallback: 'engineering-bridge' };
const check = (name, pass, detail = null) => { results.checks.push({ name, pass: Boolean(pass), detail }); if (!pass) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`); };
async function shot(page, name) {
  const filename = `screenshots/${name}.jpg`;
  await page.screenshot({ path: path.join(out, filename), type: 'jpeg', quality: 87 });
  results.screenshots.push(filename);
}
async function ready(page, route = '') {
  await page.goto(origin + base + route);
  await page.locator('main h1').first().waitFor();
  await page.waitForFunction(() => {
    const main = document.querySelector('main'), loader = document.querySelector('#loader'), header = document.querySelector('header');
    if (!main || !header) return false;
    const rect = main.getBoundingClientRect(), cover = loader?.getBoundingClientRect();
    return getComputedStyle(main).pointerEvents !== 'none' && Math.abs(rect.x) < 1 && Math.abs(rect.width - innerWidth) < 1 && (!cover || cover.right <= 1 || cover.left >= innerWidth - 1 || getComputedStyle(loader).visibility === 'hidden') && getComputedStyle(header).visibility === 'visible' && Number(getComputedStyle(header).opacity) > 0.99;
  }, null, { timeout: 25000 });
  await page.waitForTimeout(400);
}
async function scrollTo(page, selector, offset) {
  await page.locator(selector).first().evaluate((el, offset) => { document.querySelector('main').scrollTop += el.getBoundingClientRect().top - offset; }, offset);
  await page.waitForTimeout(900);
}
async function finished(page, selector) {
  await page.waitForFunction(selector => { const root = document.querySelector(selector), image = root?.querySelector('img'), canvas = root?.querySelector('canvas'); return image?.naturalWidth > 0 && canvas && getComputedStyle(canvas).visibility === 'hidden'; }, selector, { timeout: 10000 });
  await page.waitForTimeout(250);
}
async function inspect(page, label, selector, titleSelector) {
  const data = await page.locator(selector).first().evaluate(el => {
    const image = el.querySelector('img'), canvas = el.querySelector('canvas'), r = el.getBoundingClientRect();
    return { key: el.getAttribute('data-course-artwork'), width: r.width, height: r.height, imageWidth: image?.naturalWidth, imageHeight: image?.naturalHeight, src: image?.getAttribute('src'), currentSrc: image?.currentSrc, alt: image?.alt, ariaHidden: el.getAttribute('aria-hidden'), canvasVisibility: canvas ? getComputedStyle(canvas).visibility : null, objectFit: image ? getComputedStyle(image).objectFit : null, objectPosition: image ? getComputedStyle(image).objectPosition : null };
  });
  results.images.push({ label, ...data });
  check(`${label}: correct local subject photo and stable frame`, data.imageWidth > 0 && data.imageHeight > 0 && data.width > 0 && data.height > 0 && data.src === `${base}images/courses/${subjects[data.key]}.webp` && data.currentSrc.startsWith(origin + base) && data.objectFit === 'cover', data);
  check(`${label}: finished image without decorative canvas or duplicate accessible text`, data.canvasVisibility === 'hidden' && data.alt === '' && data.ariaHidden === 'true', { canvasVisibility: data.canvasVisibility, alt: data.alt, ariaHidden: data.ariaHidden });
  const layout = await page.locator(titleSelector).first().evaluate(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, x: r.x, y: r.y, right: r.right, bottom: r.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth, mainWidth: document.querySelector('main').scrollWidth, visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity }; });
  check(`${label}: HTML heading visible and no horizontal overflow`, layout.text.trim().length > 0 && layout.x >= -1 && layout.right <= layout.viewportWidth + 1 && layout.y >= 50 && layout.bottom <= layout.viewportHeight + 1 && layout.visibility === 'visible' && Number(layout.opacity) > 0.9 && layout.documentWidth <= layout.viewportWidth + 1 && layout.mainWidth <= layout.viewportWidth + 1, layout);
}
const viewports = [['phone390', 390, 844, true], ['phone430', 430, 932, true], ['tablet', 820, 1180, true], ['desktop', 1440, 900, false]];
try {
  for (const mode of ['normal', 'saved-pause', 'reduced', 'canvas-failure', 'no-js']) {
    for (const [name, width, height, touch] of viewports.filter(v => mode === 'normal' || ['phone390', 'desktop'].includes(v[0]))) {
      const label = `${name}-${mode}`;
      console.log(`Inspecting ${label}`);
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference', javaScriptEnabled: mode !== 'no-js' });
      if (mode === 'saved-pause') await ctx.addInitScript(() => localStorage.setItem('guide-motion-paused', 'true'));
      if (mode === 'canvas-failure') await ctx.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === '2d' && (this.hasAttribute('data-signal-field') || this.closest('[data-course-artwork]')) ? null : original.call(this, kind, ...args); }; });
      const page = await ctx.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => results.errors.push({ label, kind: 'pageerror', url: page.url(), message: error.message }));
      page.on('console', message => { if (message.type() === 'error') results.errors.push({ label, kind: 'console', url: page.url(), message: message.text() }); });
      page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') results.errors.push({ label, kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }); });
      page.on('response', response => { if (response.status() >= 400) results.errors.push({ label, kind: 'http', url: response.url(), status: response.status() }); });
      page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin)) results.errors.push({ label, kind: 'external-request', url: request.url() }); });
      try {
        await ready(page);
        const servedBuild = await page.locator('#__NEXT_DATA__').textContent().then(JSON.parse).then(data => data.buildId);
        check(`${label}: actual export matches expected build`, servedBuild === buildId, servedBuild);
        if (mode === 'normal') await shot(page, `${label}-home`);
        await scrollTo(page, '#desk-next-heading', 110);
        if (await page.locator('[data-course-artwork]').first().evaluate(el => el.getBoundingClientRect().top > innerHeight * 0.45)) await scrollTo(page, '[data-course-artwork]', 220);
        await finished(page, '[data-course-artwork]');
        await scrollTo(page, '#desk-next-heading', 110);
        await inspect(page, `${label} Next Up`, '[data-course-artwork]', '#desk-next-heading');
        if (mode === 'no-js') check(`${label}: unresolved Next Up uses engineering fallback`, await page.locator('[data-course-artwork="fallback"] img').getAttribute('src') === `${base}images/courses/engineering-bridge.webp`);
        await shot(page, `${label}-next-up`);
        for (const course of ['cen100', 'mth140', 'mth141']) {
          await ready(page, `${course}/`);
          await finished(page, `[data-course-artwork="${course}"]`);
          await inspect(page, `${label} ${course}`, `[data-course-artwork="${course}"]`, 'main h1');
          await shot(page, `${label}-${course}`);
        }
      } catch (error) {
        check(`${label}: focused route checks completed`, false, error.stack);
        await shot(page, `${label}-failure`);
      } finally { await ctx.close(); }
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  check('no browser errors or third-party runtime requests', results.errors.length === 0, results.errors);
  const passed = results.checks.filter(item => item.pass).length;
  results.summary = { passed, failed: results.checks.length - passed, total: results.checks.length };
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  await writeFile(path.join(out, 'results.md'), `# Subject-photography browser verification\n\n${results.date}\n\nExport build \`${buildId}\`. Chromium ${results.browser}. ${results.emulation}.\n\n${passed}/${results.checks.length} assertions passed.\n\n` + results.checks.map(item => `- ${item.pass ? 'PASS' : 'FAIL'}: ${item.name}${!item.pass ? ` — ${JSON.stringify(item.detail)}` : ''}`).join('\n') + '\n\n## Screenshots\n\n' + results.screenshots.map(file => `- [${path.basename(file)}](${file})`).join('\n') + '\n\nScope: normal motion at 390 × 844, 430 × 932, 820 × 1180 and 1440 × 900; saved Pause, reduced motion, scoped Canvas2D failure and no JavaScript at 390 × 844 and 1440 × 900. Direct route loads keep crop/fallback inspection independent of the known pre-existing saved-Pause menu offset documented in the preceding full QA. No invented dates or completion data, no physical-device/Safari claim, no production deployment. Lifecycle/progress/navigation were not exhaustively repeated for this image-only revision; preceding full results remain separately labelled.\n');
  console.log(JSON.stringify(results.summary));
  if (results.summary.failed) process.exitCode = 1;
}
