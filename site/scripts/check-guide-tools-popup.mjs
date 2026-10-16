// Run after npm run build. Playwright is QA-only, not a site dependency:
// PLAYWRIGHT_PATH=/path/to/node_modules/playwright node scripts/check-guide-tools-popup.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../out');
const reports = process.env.QA_REPORT_DIR || '/tmp/guide-tools-qa';
const base = '/tmu-course-guides/next';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(`${base}/`)) { res.writeHead(404).end(); return; }
    let path = resolve(root, `.${pathname.slice(base.length)}`);
    if (path !== root && !path.startsWith(`${root}${sep}`)) { res.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}${base}`;
await mkdir(reports, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1440]) {
    for (const course of ['cen100', 'mth140', 'mth141']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
      const page = await context.newPage();
      await page.goto(`${origin}/${course}/`, { waitUntil: 'networkidle' });
      const trigger = page.getByRole('button', { name: 'GUIDE TOOLS', exact: true });
      await trigger.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      const scrollBefore = await page.locator('main').evaluate((el) => el.scrollTop);
      await trigger.click();
      const dialog = page.locator('dialog#guide-tools');
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.evaluate((el) => el.matches(':modal')), true);
      assert.equal(await dialog.getByRole('button', { name: 'Close guide tools' }).evaluate((el) => el === document.activeElement), true);
      assert.ok(Math.abs((await page.locator('main').evaluate((el) => el.scrollTop)) - scrollBefore) < 2, 'opening tools must not move the page');
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 901, 'modal fits the viewport');
      assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true, 'no horizontal overflow');
      await page.screenshot({ path: join(reports, `${course}-${width}.png`) });

      // The actual course actions still create their original file formats.
      const backupPending = page.waitForEvent('download');
      await dialog.getByRole('button', { name: /Export my progress/i }).click();
      const backup = await backupPending;
      const backupBytes = await readFile(await backup.path());
      assert.ok(JSON.parse(backupBytes.toString()), 'valid JSON backup');
      const importButton = dialog.getByRole('button', { name: /^Import .*backup/i });
      await dialog.locator('input[type="file"]').setInputFiles({ name: backup.suggestedFilename(), mimeType: 'application/json', buffer: backupBytes });
      await importButton.locator('..').getByRole('status').filter({ hasText: /\S/ }).waitFor();
      const calendarPending = page.waitForEvent('download');
      await dialog.getByRole('button', { name: /Download calendar/i }).click();
      const calendar = await calendarPending;
      assert.match(await readFile(await calendar.path(), 'utf8'), /BEGIN:VCALENDAR/);

      const updates = dialog.getByRole('button', { name: /what.s changed/i });
      await updates.click();
      assert.equal(await updates.getAttribute('aria-expanded'), 'true');
      await dialog.locator('#tools-updates').waitFor({ state: 'visible' });
      await updates.click();
      assert.equal(await updates.getAttribute('aria-expanded'), 'false');
      await dialog.getByRole('button', { name: 'Close guide tools' }).focus();
      for (let i = 0; i < 8; i += 1) {
        await page.keyboard.press('Tab');
        assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true, 'focus stays in modal');
      }
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate((el) => document.activeElement === el), true);
      assert.ok(Math.abs((await page.locator('main').evaluate((el) => el.scrollTop)) - scrollBefore) < 2);
      await trigger.click();
      await dialog.getByRole('button', { name: 'Close guide tools' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await trigger.click();
      await page.mouse.click(4, 4);
      await dialog.waitFor({ state: 'hidden' });
      await page.goto(`${origin}/${course}/#guide-tools`, { waitUntil: 'networkidle' });
      await page.locator('dialog#guide-tools').waitFor({ state: 'visible', timeout: 15000 });
      console.log(`PASS ${course} at ${width}px: popup, focus, scroll, backdrop, calendar, backup, updates and deep link`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
