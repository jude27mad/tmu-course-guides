/** Shared UI contracts against the production export. Browser emulation, not physical-device testing. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-consistency-qa';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${basePath}/`;
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = [];
const errors = [];
async function check(name, run) {
  if (process.env.QA_MATCH && !name.includes(process.env.QA_MATCH)) return;
  try { results.push({ name, pass: true, detail: await run() }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function open(width = 390, motion = 'reduce', javaScriptEnabled = true) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion, javaScriptEnabled });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  if (javaScriptEnabled) await page.clock.setFixedTime(new Date('2026-10-23T16:00:00Z'));
  return { context, page };
}
async function ready(page, route) {
  await page.goto(url + route);
  await page.locator('main h1').first().waitFor();
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return getComputedStyle(main).pointerEvents === 'auto' && !main.classList.contains('lenis-stopped');
  });
  if (route.startsWith('mth') || route.startsWith('cen')) await page.locator('#course-section:not(:disabled)').waitFor();
}

try {
  for (const width of [390, 834, 1440]) {
    await check(`shared text and actions remain readable at ${width}px`, async () => {
      const { context, page } = await open(width);
      try {
        await ready(page, '');
        const text = await page.locator('main .p-l').evaluateAll((nodes) => nodes.filter((e) => e.textContent.trim() && e.getClientRects().length).map((e) => ({ text: e.textContent.trim().slice(0, 70), size: parseFloat(getComputedStyle(e).fontSize) })));
        assert.ok(text.length > 5, 'inspect the actual Desk deadline and course text');
        assert.deepEqual(text.filter((e) => e.size < 16), [], 'body copy must not shrink on tablets');
        const actions = await page.locator('main a, main button').evaluateAll((nodes) => nodes.filter((e) => /^(MARK DONE|VIEW IN|OPEN GUIDE|ALL COURSES)/.test(e.textContent.trim())).map((e) => ({ label: e.textContent.trim(), height: e.getBoundingClientRect().height, size: parseFloat(getComputedStyle(e.querySelector('span') || e).fontSize) })));
        assert.ok(actions.length >= 3);
        assert.deepEqual(actions.filter((e) => e.height < 43.5 || e.size < 16), [], 'readable action labels and 44px touch targets');
        assert.equal(await page.locator('main').evaluate((e) => e.scrollWidth > e.clientWidth + 1), false);
        await page.screenshot({ path: path.join(report, `desk-${width}.png`) });
        return { textCount: text.length, actions };
      } finally { await context.close(); }
    });
  }
  for (const width of [320, 390, 834, 1440]) {
    await check(`course navigation stays reachable at ${width}px`, async () => {
      const { context, page } = await open(width);
      try {
        await ready(page, 'mth140/');
        const nav = page.getByRole('navigation', { name: 'Course views' });
        await nav.getByRole('link', { name: 'Study', exact: true }).click();
        await page.getByRole('heading', { name: 'Study', exact: true }).waitFor();
        await page.waitForTimeout(180);
        const box = await nav.boundingBox();
        assert.ok(box.y >= 0 && box.y + box.height < 250, `navigation bounds ${JSON.stringify(box)}`);
        await nav.getByRole('link', { name: 'Work', exact: true }).click();
        await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
        assert.equal(await page.locator('main').evaluate((e) => e.scrollWidth > e.clientWidth + 1), false);
        await page.screenshot({ path: path.join(report, `course-navigation-${width}.png`) });
      } finally { await context.close(); }
    });
  }
  await check('Guide tools enters and exits smoothly while retaining modal focus', async () => {
    const { context, page } = await open(390, 'no-preference');
    try {
      await ready(page, 'mth140/');
      const button = page.getByRole('button', { name: /^Guide tools/ });
      await button.focus();
      await button.evaluate((e) => e.click());
      await page.waitForFunction(() => { const d = document.getElementById('guide-tools'); const o = Number(getComputedStyle(d).opacity); return d.open && o > 0 && o < 1; });
      await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('guide-tools')).opacity) === 1);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => { const d = document.getElementById('guide-tools'); const o = Number(getComputedStyle(d).opacity); return d.open && o > 0 && o < 1; });
      await page.locator('#guide-tools').waitFor({ state: 'hidden' });
      assert.equal(await button.evaluate((e) => document.activeElement === e), true);
      assert.equal(await page.locator('main').evaluate((e) => e.classList.contains('lenis-stopped')), false);
    } finally { await context.close(); }
  });
  await check('backup guidance is presented once per course', async () => {
    const { context, page } = await open();
    try {
      for (const course of ['cen100', 'mth140', 'mth141']) {
        await ready(page, `${course}/`);
        await page.getByRole('button', { name: /^Guide tools/ }).click();
        const descriptions = await page.locator('#guide-tools p').allTextContents();
        const nonempty = descriptions.map((x) => x.trim()).filter(Boolean);
        assert.equal(new Set(nonempty).size, nonempty.length, `${course} duplicates a tools explanation`);
      }
    } finally { await context.close(); }
  });
  await check('tools honours reduced motion even when the preference changes during exit', async () => {
    const { context, page } = await open(390, 'no-preference');
    try {
      await ready(page, 'mth141/');
      const button = page.getByRole('button', { name: /^Guide tools/ });
      await button.click();
      await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('guide-tools')).opacity) === 1);
      await page.keyboard.press('Escape');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('#guide-tools').waitFor({ state: 'hidden' });
      await button.click();
      assert.equal(await page.locator('#guide-tools').evaluate((e) => getComputedStyle(e).opacity), '1');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.getElementById('guide-tools').contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
      await page.locator('#guide-tools').waitFor({ state: 'hidden' });
      assert.equal(await button.evaluate((e) => document.activeElement === e), true);
      assert.equal(await page.locator('main').evaluate((e) => e.classList.contains('lenis-stopped')), false);
    } finally { await context.close(); }
  });
  for (const width of [390, 834, 1440]) {
    await check(`menu and search controls stay readable at ${width}px`, async () => {
      const { context, page } = await open(width);
      try {
        await ready(page, 'mth140/');
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.locator('#menu[aria-hidden="false"]').waitFor();
        await page.locator('#menu').getByRole('link', { name: 'Desk', exact: true }).waitFor();
        const controls = await page.locator('#menu a, #menu button').evaluateAll((nodes) => nodes.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => ({ text: e.textContent.trim(), height: e.getBoundingClientRect().height, font: parseFloat(getComputedStyle(e.querySelector('span') || e).fontSize) })));
        assert.ok(controls.length > 3);
        assert.deepEqual(controls.filter((e) => e.height < 43.5 || e.font < 16), []);
        await page.getByRole('heading', { name: 'Coming up', exact: true }).waitFor();
        await page.screenshot({ path: path.join(report, `menu-${width}.png`) });
        await page.getByRole('button', { name: 'Close menu', exact: true }).click();
        await page.keyboard.press('Control+k');
        await page.locator('#search-input').fill('regrade');
        const option = page.getByRole('option').filter({ hasText: 'MTH140' }).first();
        await option.waitFor();
        assert.ok(await option.evaluate((e) => e.getBoundingClientRect().height >= 44));
        await option.click();
        await page.locator('#course-view-policy-regrade[data-info-detail]').waitFor();
      } finally { await context.close(); }
    });
  }
  await check('Study starts with exercises and retains the existing skill checks', async () => {
    const { context, page } = await open();
    try {
      for (const course of ['mth140', 'mth141']) {
        await ready(page, `${course}/#study`);
        await page.locator('a[href*="#topic-"]').first().click();
        const detail = page.locator('[data-assignment-detail]');
        await detail.waitFor();
        const positions = await detail.evaluate((e) => {
          const headings = [...e.querySelectorAll('h3,h4')];
          return { practice: headings.find((h) => /recommended practice/i.test(h.textContent))?.getBoundingClientRect().top, skills: e.querySelector('input[type=checkbox]')?.getBoundingClientRect().top };
        });
        assert.ok(positions.practice < positions.skills, JSON.stringify(positions));
        assert.ok(await detail.getByRole('link', { name: /textbook/i }).count());
      }
    } finally { await context.close(); }
  });
  await check('a policy question opens one answer, preserves qualifications, and returns to Course info', async () => {
    const { context, page } = await open();
    try {
      await ready(page, 'mth140/#course-info');
      await page.getByRole('link', { name: /Request a regrade/i }).click();
      const detail = page.locator('[data-info-detail]');
      await detail.waitFor();
      assert.match(await detail.innerText(), /10 working days/);
      assert.match(await detail.innerText(), /increase or decrease/);
      assert.doesNotMatch(await detail.innerText(), /Your first missed lab quiz/);
      await page.screenshot({ path: path.join(report, 'policy-answer-390.png') });
      await detail.getByRole('button', { name: /Back to Course info/ }).first().click();
      await page.getByRole('link', { name: /Request a regrade/i }).waitFor();
      await page.goForward();
      await detail.waitFor();
    } finally { await context.close(); }
  });
  await check('Course info groups use compact spacing on phones', async () => {
    const { context, page } = await open();
    try {
      await ready(page, 'mth140/#course-info');
      await page.getByRole('link', { name: 'Assessment rules', exact: true }).waitFor();
      const gaps = await page.locator('#course-content section').evaluateAll((sections) => sections.filter((e) => e.getClientRects().length).slice(1).map((section) => {
        const previous = section.previousElementSibling.querySelector('ul');
        return section.querySelector('h3').getBoundingClientRect().top - previous.getBoundingClientRect().bottom;
      }));
      assert.ok(gaps.length >= 2);
      assert.ok(gaps.every((gap) => gap <= 48), `group gaps: ${gaps.join(', ')}`);
      await page.screenshot({ path: path.join(report, 'course-info-390.png') });
      return { gaps };
    } finally { await context.close(); }
  });
  await check('without JavaScript every policy fact remains readable', async () => {
    const { context, page } = await open(390, 'reduce', false);
    try {
      await page.goto(url + 'mth141/');
      assert.match(await page.locator('body').innerText(), /within 3 business days/);
      assert.match(await page.locator('body').innerText(), /increase or decrease/);
      await page.goto(url + 'cen100/');
      assert.match(await page.locator('body').innerText(), /Real people, real data/);
    } finally { await context.close(); }
  });
  await check('information answers use the course motion and keep direct links usable', async () => {
    const { context, page } = await open(834, 'no-preference');
    try {
      await ready(page, 'mth141/#course-info');
      await page.getByRole('link', { name: /Missed an assessment/ }).evaluate((e) => e.click());
      await page.waitForFunction(() => {
        const content = document.getElementById('course-content');
        const opacity = Number(getComputedStyle(content).opacity);
        return content.inert && opacity > 0 && opacity < 1;
      });
      await page.locator('#course-view-policy-missed-assessment[data-info-detail]').waitFor();
      await page.waitForFunction(() => !document.getElementById('course-content').inert);
      assert.match(await page.locator('[data-info-detail]').innerText(), /within 3 business days/);
      await page.reload();
      await page.locator('#course-view-policy-missed-assessment[data-info-detail]').waitFor();
      await page.getByRole('button', { name: /Back to Course info/ }).first().click();
      await page.getByRole('link', { name: /Missed an assessment/ }).waitFor();
      await ready(page, 'mth141/#sources');
      await page.locator('#course-view-sources[data-info-detail]').waitFor();
      assert.match(await page.locator('[data-info-detail]').innerText(), /Reviewed October 12, 2026/);
      await page.screenshot({ path: path.join(report, 'sources-834.png') });
    } finally { await context.close(); }
  });
} finally {
  await browser.close(); server.close();
  await writeFile(path.join(report, 'results.json'), JSON.stringify({ results, errors }, null, 2));
}
process.exitCode = results.some((r) => !r.pass) || errors.length ? 1 : 0;
