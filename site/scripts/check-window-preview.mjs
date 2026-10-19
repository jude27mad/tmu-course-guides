// QA-only fixed date/section fixtures. They never ship in the course application.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = resolve(process.env.QA_SITE_ROOT || join(dirname(fileURLToPath(import.meta.url)), '../out'));
const reports = process.env.QA_REPORT_DIR || '/tmp/mth140-window-qa';
const base = '/tmu-course-guides/next';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(`${base}/`)) return res.writeHead(404).end();
    let path = resolve(root, `.${pathname.slice(base.length)}`);
    if (path !== root && !path.startsWith(`${root}${sep}`)) return res.writeHead(403).end();
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}${base}`;
await mkdir(reports, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let activePage;
const results = [],
  errors = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  results.push(name);
};
const capture = async (page, selector, name) => {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const main = document.querySelector('main');
      main.scrollTop += el.getBoundingClientRect().top - main.getBoundingClientRect().top - 95;
    });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(reports, `${name}.png`) });
};
const layouts = process.env.QA_QUICK
  ? [{ name: 'phone390', width: 390, height: 844 }]
  : [
      { name: 'phone320', width: 320, height: 740 },
      { name: 'phone390', width: 390, height: 844 },
      { name: 'phone430', width: 430, height: 932 },
      { name: 'split600', width: 600, height: 1024 },
      { name: 'tablet820', width: 820, height: 1180 },
      { name: 'tablet1024', width: 1024, height: 768 },
      { name: 'landscape1180', width: 1180, height: 820 },
      { name: 'laptop1440', width: 1440, height: 900 },
      { name: 'desktop1920', width: 1920, height: 1080 },
    ];
try {
  for (const layout of layouts) {
    const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, reducedMotion: 'reduce', hasTouch: layout.width < 1200, acceptDownloads: true });
    await context.addInitScript(() => localStorage.setItem('mth140-section-v1', '31'));
    const page = await context.newPage();
    activePage = page;
    page.on('pageerror', (error) => errors.push(`${layout.name}: ${error.message}`));
    await page.clock.setFixedTime(new Date('2026-10-16T09:17:00-04:00'));
    await page.goto(`${origin}/mth140/`, { waitUntil: 'networkidle' });
    await page.locator('[data-window-kind="deadline"]').first().waitFor();
    await page.waitForTimeout(600);
    check(`${layout.name}: three deadline windows`, (await page.locator('[data-window-kind="deadline"]').count()) === 3);
    check(
      `${layout.name}: assignment photos replaced, hero retained`,
      (await page.locator('#assignments [data-course-artwork]').count()) === 0 && (await page.locator('[data-course-artwork="mth140"]').count()) === 1,
    );
    check(`${layout.name}: no controls hidden in decorative windows`, (await page.locator('[data-window-kind] button,[data-window-kind] a,[data-window-kind] input').count()) === 0);
    check(`${layout.name}: no document horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(`${layout.name}: main has no horizontal overflow`, await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    const boxes = await page
      .locator('[data-window-kind="deadline"]')
      .evaluateAll((els) => els.map((el) => ({ w: el.getBoundingClientRect().width, scroll: el.scrollWidth, client: el.clientWidth, height: el.clientHeight, sh: el.scrollHeight })));
    check(
      `${layout.name}: summary text fits its windows`,
      boxes.every((x) => x.scroll <= x.client + 2 && x.sh <= x.height + 2 && x.w > 220),
    );
    check(
      `${layout.name}: assessment headings readable`,
      await page.locator('[data-assessment-id="midterm"] > span').evaluateAll((els) => els.some((el) => parseFloat(getComputedStyle(el).fontSize) >= 23)),
    );
    check(`${layout.name}: date visible in collapsed row`, (await page.locator('[data-assessment-id="midterm"]').innerText()).includes('Oct 23'));
    await capture(page, '#assignments', `${layout.name}-assignments`);
    const final = page.locator('[data-assessment-id="final"]');
    await final.scrollIntoViewIfNeeded();
    await final.click();
    check(`${layout.name}: selecting final updates window`, (await page.locator('[data-window-kind="deadline"][data-selected-assessment="final"]').count()) === 1);
    check(`${layout.name}: final remains Date pending`, (await page.locator('[data-window-kind="deadline"][data-selected-assessment="final"]').innerText()).includes('Date pending'));
    await final.click();
    check(`${layout.name}: row collapses`, (await final.getAttribute('aria-expanded')) === 'false');
    const prep = page.locator('[data-preparation-item]').first();
    const box = prep.locator('input[type="checkbox"]').first();
    await prep.locator('label').first().scrollIntoViewIfNeeded();
    await prep.locator('label').first().click();
    check(`${layout.name}: checklist updates artwork`, (await page.locator('[data-window-kind="preparation"][data-prepared="1"]').count()) >= 1);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mth140-progress-v1')));
    check(`${layout.name}: preparation is not completion`, !saved.completed?.['quiz-2']);
    await capture(page, '[data-preparation-item]', `${layout.name}-preparation`);
    if (layout.width === 390 || layout.width === 1440) {
      const mark = prep.getByRole('button', { name: /^Mark .* done$/i });
      await mark.click();
      check(`${layout.name}: completion saves separately`, await page.evaluate(() => !!JSON.parse(localStorage.getItem('mth140-progress-v1')).completed['quiz-2']));
      await prep.getByRole('button', { name: 'UNDO', exact: true }).click();
      check(`${layout.name}: Undo retains preparation ticks`, (await box.isChecked()) && (await page.evaluate(() => !JSON.parse(localStorage.getItem('mth140-progress-v1')).completed['quiz-2'])));
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    check(`${layout.name}: preparation survives reload`, await page.locator('[data-preparation-item] input[type="checkbox"]').first().isChecked());
    const help = page.locator('#rules-help details');
    check(`${layout.name}: three help disclosures`, (await help.count()) === 3);
    check(`${layout.name}: secondary help starts closed`, await help.evaluateAll((els) => els.every((el) => !el.open)));
    const missed = page.locator('#rules-help details').filter({ hasText: 'What happens if I miss an assessment?' });
    await missed.locator('summary').scrollIntoViewIfNeeded();
    await missed.locator('summary').focus();
    await page.keyboard.press('Enter');
    check(`${layout.name}: keyboard opens help`, await missed.evaluate((el) => el.open));
    check(`${layout.name}: original explanation preserved`, (await missed.innerText()).includes('Academic Consideration'));
    check(`${layout.name}: unconfirmed dates not hidden`, await page.locator('#rules-help').getByText('Dates that still need confirmation', { exact: true }).isVisible());
    await capture(page, '#rules-help', `${layout.name}-help`);
    const tools = page.getByRole('button', { name: 'GUIDE TOOLS', exact: true });
    await tools.scrollIntoViewIfNeeded();
    await tools.click();
    await page.locator('dialog#guide-tools').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    check(`${layout.name}: existing Guide Tools still works`, !(await page.locator('dialog#guide-tools').isVisible()));
    await context.close();
    console.log(`PASS ${layout.name}`);
  }
  if (!process.env.QA_QUICK) {
    for (const course of ['cen100', 'mth141']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      activePage = page;
      await page.goto(`${origin}/${course}/`, { waitUntil: 'networkidle' });
      check(`${course}: preview disabled`, (await page.locator('[data-window-preview],[data-window-kind]').count()) === 0);
      check(`${course}: original assignment images remain`, (await page.locator('#assignments [data-course-artwork]').count()) === 3);
      check(`${course}: Help unchanged`, (await page.locator('#rules-help details').count()) === 0);
      await context.close();
    }
  }
  check('No browser runtime errors', errors.length === 0);
} catch (error) {
  await activePage?.screenshot({ path: join(reports, 'failure.png') }).catch(() => {});
  await writeFile(join(reports, 'failure.txt'), String(error.stack));
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    join(reports, 'results.json'),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        scope: 'Chromium browser-emulated viewports, not physical devices or Safari. October 16 clock and section 31 are QA-only fixtures.',
        passed: results.length,
        checks: results,
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await new Promise((done) => server.close(done));
}
