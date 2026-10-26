// Checks the site GitHub Pages publishes (.github/workflows/pages.yml) the way visitors reach it.
//   --local <folder>   after `pages-site.mjs build`: serves the folder as GitHub Pages would, under
//                      /tmu-course-guides/, and checks it in Chromium. Playwright is QA-only, not a site
//                      dependency: PLAYWRIGHT_PATH=/path/to/node_modules/playwright.
//   --live <url>       after a deploy: waits until <url> serves --build-id, then checks the published
//                      addresses with plain requests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { servePages } from './pages-server.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const PAGES = [
  ['', 'TMU Course Guides | Fall 2026'],
  ['courses/', 'Courses | TMU Course Guides'],
  ['cen100/', 'CEN100 | TMU Course Guides'],
  ['mth140/', 'MTH140: Calculus I | TMU Course Guides'],
  ['mth141/', 'MTH141: Linear Algebra | TMU Course Guides'],
  ['privacy/', 'Privacy | TMU Course Guides'],
  ['updates/', 'Website updates | TMU Course Guides'],
];

// Old address -> where a visitor must land (path, query and hash).
const FORWARDS = [
  ['next/', ''],
  ['next/cen100/?motion=off#assignment-m2', 'cen100/?motion=off#assignment-m2'],
  ['next/mth140', 'mth140/'],
  ['next/mth141/#course-info', 'mth141/#course-info'],
  ['next/courses/', 'courses/'],
  ['next/privacy/', 'privacy/'],
  ['privacy.html#stored', 'privacy/#stored'],
  ['colour-preview.html', 'cen100/'],
  // The Desk's own forward of the old root CEN100 hashes (src/pages/index.page.jsx).
  ['#assignment-m2', 'cen100/#assignment-m2'],
];

// Repository files that were public before and must not be any more.
const UNPUBLISHED = ['assets/hub.js', 'assets/legacy-route.js', 'tests/header-preview.html', 'site/package.json', 'docs/README.md', 'next/_next/'];

// Saved progress in the formats both designs use (src/lib/README.md).
const PROGRESS = {
  'cen100-g9-ticks': '{"m2-1-3":1}',
  'cen100-personal-plan-v1': '{"completed":{"integrity":1},"notes":{},"targets":{}}',
  'mth140-progress-v1': '{"completed":{"quiz-1":1},"checks":{"quiz-1-0":true}}',
  'mth141-section-v1': '3',
  'guide-motion-paused': 'true',
};

// Text each page shows only when it has read the saved progress above.
const SHOWN = [
  ['', null],
  ['cen100/', /\b1\/\d+ records done/],
  ['mth140/', /\b1\/\d+ records done/],
  ['mth141/', null],
];

async function checkLocal(folder) {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const reports = process.env.QA_REPORT_DIR || '/tmp/pages-site-qa';
  await mkdir(reports, { recursive: true });
  const { server, site } = await servePages(folder);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM_PATH || undefined });
  const failures = [];
  const check = async (name, run) => {
    try {
      await run();
      console.log(`ok   ${name}`);
    } catch (error) {
      failures.push(name);
      console.log(`FAIL ${name}\n     ${String(error.message).split('\n').join('\n     ')}`);
    }
  };
  const open = async (options = {}) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...options });
    const page = await context.newPage();
    const errors = [];
    const strays = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      if (!url.startsWith(site) || url.startsWith(`${site}next/`)) strays.push(url);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) strays.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => strays.push(`failed ${request.url()}`));
    return { context, page, errors, strays };
  };
  const landed = async (page, expected) => {
    await page.waitForURL((url) => url.href === `${site}${expected}`, { timeout: 15000 });
  };

  try {

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      for (const route of ['', 'updates/']) {
        await check(`${viewport.width}px /${route} Design credit keeps the desktop page still`, async () => {
          const { context, page, errors } = await open({ viewport, reducedMotion: 'no-preference' });
          try {
            await page.goto(`${site}${route}`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => {
              const main = document.querySelector('main');
              return main && getComputedStyle(main).opacity === '1' &&
                !document.querySelector('.lenis-stopped') &&
                getComputedStyle(document.querySelector('#loader')).display === 'none';
            });
            await page.evaluate(() => document.fonts.ready);
            await page.locator('main').evaluate((main) => main.scrollTo(0, main.scrollHeight));
            await page.waitForTimeout(500);
            const credit = page.locator('footer [data-design-credit]');
            const summary = credit.locator('summary');
            const before = await page.evaluate(() => ({
              scroll: document.querySelector('main').scrollTop,
              footer: document.querySelector('footer > [data-surface="dark"]').getBoundingClientRect().top,
            }));
            assert.ok(before.scroll > 0, 'exercise the bottom of the page');
            for (const [index, open] of [true, false, true, false].entries()) {
              await page.evaluate(() => {
                window.creditFrames = [];
                const sample = () => {
                  window.creditFrames.push({
                    scroll: document.querySelector('main').scrollTop,
                    footer: document.querySelector('footer > [data-surface="dark"]').getBoundingClientRect().top,
                  });
                  window.creditFrameRequest = requestAnimationFrame(sample);
                };
                sample();
              });
              if (index === 1) {
                // The first click has focused the native summary.
                await page.keyboard.press('Enter');
              } else {
                const box = await summary.boundingBox();
                assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height, 'credit is already visible');
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
              }
              await page.waitForFunction((expected) => document.querySelector('footer [data-design-credit]').open === expected, open);
              await page.waitForTimeout(350);
              const frames = await page.evaluate(() => {
                cancelAnimationFrame(window.creditFrameRequest);
                return window.creditFrames;
              });
              assert.ok(frames.every((frame) => Math.abs(frame.scroll - before.scroll) <= 2),
                `scroll stays put when credit is ${open ? 'opened' : 'closed'}: ${JSON.stringify({ before, frames })}`);
              assert.ok(frames.every((frame) => Math.abs(frame.footer - before.footer) <= 2),
                'the footer reveal stays put throughout the toggle');
              if (open) await page.screenshot({ path: join(reports, `design-credit-${route ? 'updates' : 'desk'}-${viewport.width}.png`) });
            }
            assert.deepEqual(errors, [], 'page errors');
          } finally {
            await context.close();
          }
        });
      }
    }

    for (const width of [390, 1440]) {
      for (const [path, title] of PAGES) {
        await check(`${width}px /${path} renders the new design`, async () => {
          const { context, page, errors, strays } = await open({ viewport: { width, height: width > 800 ? 900 : 844 } });
          const response = await page.goto(`${site}${path}`, { waitUntil: 'networkidle' });
          assert.equal(response.status(), 200);
          assert.equal(await page.title(), title);
          assert.equal(await page.locator('#__next').count(), 1, 'Next root');
          assert.equal(await page.locator('meta[name="color-scheme"]').getAttribute('content'), 'only light', 'opts out of automatic dark modes');
          assert.equal(await page.locator('script[src*="legacy-route"], script[src*="/assets/"]').count(), 0, 'no previous-design scripts');
          assert.deepEqual(errors, [], 'page errors');
          assert.deepEqual(strays, [], 'requests outside the site, or failed');
          await page.screenshot({ path: join(reports, `${(path || 'desk/').replace(/\/$/, '')}-${width}.png`) });
          await context.close();
        });
      }
    }

    for (const [from, to] of FORWARDS) {
      await check(`/${from} -> /${to}`, async () => {
        const { context, page, errors } = await open();
        await page.goto(`${site}${from}`);
        await landed(page, to);
        await page.waitForLoadState('networkidle');
        assert.deepEqual(errors, [], 'page errors');
        await context.close();
      });
    }

    for (const [from, to] of [
      ['privacy.html', 'privacy/'],
      ['next/mth141/', 'mth141/'],
      ['colour-preview.html', 'cen100/'],
    ]) {
      await check(`/${from} -> /${to} without JavaScript`, async () => {
        const { context, page } = await open({ javaScriptEnabled: false });
        await page.goto(`${site}${from}`);
        await landed(page, to);
        await context.close();
      });
    }

    for (const path of UNPUBLISHED) {
      await check(`/${path} is not published`, async () => {
        const response = await fetch(`${site}${path}`, { redirect: 'manual' });
        assert.equal(response.status, 404);
      });
    }

    await check('an unknown address ends on the Desk', async () => {
      const { context, page } = await open();
      const response = await page.goto(`${site}tests/header-preview.html`);
      assert.equal(response.status(), 404);
      await landed(page, '');
      await context.close();
    });

    for (const path of ['index.html', 'cen100/index.html']) {
      await check(`/${path} still renders`, async () => {
        const { context, page, errors } = await open();
        const response = await page.goto(`${site}${path}`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        assert.equal(await page.locator('#__next').count(), 1);
        assert.deepEqual(errors, [], 'page errors');
        await context.close();
      });
    }

    await check('saved progress is read and left unchanged', async () => {
      // No reduced-motion preference here, so data-motion="off" can only come from the saved Pause motion.
      const { context, page, errors } = await open({ reducedMotion: 'no-preference' });
      await page.goto(`${site}privacy/`, { waitUntil: 'networkidle' });
      await page.evaluate((entries) => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
      }, PROGRESS);
      for (const [path, shown] of SHOWN) {
        await page.goto(`${site}${path}`, { waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-motion')), 'off', `Pause motion kept on /${path}`);
        if (shown) await page.waitForFunction((source) => new RegExp(source).test(document.body.innerText), shown.source, { timeout: 15000 });
        if (path === 'mth141/') await page.waitForFunction(() => document.querySelector('#course-section')?.value === '3');
      }
      const after = await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(PROGRESS));
      assert.deepEqual(after, PROGRESS);
      assert.deepEqual(errors, [], 'page errors');
      await context.close();
    });
  } finally {
    await browser.close();
    server.close();
  }
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll local checks passed.');
}

async function checkLive(url, buildId) {
  const site = url.endsWith('/') ? url : `${url}/`;
  assert.ok(buildId, '--build-id is required with --live');
  const fresh = (path) => `${site}${path}${path.includes('?') ? '&' : '?'}check=${Date.now()}`;
  const deadline = Date.now() + 10 * 60 * 1000;
  for (;;) {
    const html = await fetch(fresh('')).then(
      (response) => response.text(),
      () => '',
    );
    if (html.includes(`"buildId":"${buildId}"`)) break;
    if (Date.now() > deadline) throw new Error(`${site} did not serve build ${buildId} within 10 minutes.`);
    await new Promise((done) => setTimeout(done, 15000));
  }
  console.log(`ok   ${site} serves build ${buildId}`);
  const failures = [];
  const expect = async (name, run) => {
    try {
      await run();
      console.log(`ok   ${name}`);
    } catch (error) {
      failures.push(name);
      console.log(`FAIL ${name}\n     ${error.message}`);
    }
  };
  const path = new URL(site).pathname;
  for (const [page] of PAGES) {
    await expect(`/${page} is the new design`, async () => {
      const response = await fetch(fresh(page));
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(`"buildId":"${buildId}"`), 'current build');
      assert.ok(!html.includes('legacy-route.js'), 'no previous-design script');
    });
  }
  for (const [from, to] of [
    ['privacy.html', 'privacy/'],
    ['colour-preview.html', 'cen100/'],
    ['next/', ''],
    ['next/cen100/', 'cen100/'],
  ]) {
    await expect(`/${from} forwards to /${to}`, async () => {
      const response = await fetch(fresh(from));
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes(`location.replace(${JSON.stringify(`${path}${to}`)}`));
    });
  }
  for (const page of UNPUBLISHED) {
    await expect(`/${page} is not published`, async () => {
      const response = await fetch(fresh(page), { redirect: 'manual' });
      assert.equal(response.status, 404);
    });
  }
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll live checks passed.');
}

if (option('local')) await checkLocal(option('local'));
else if (option('live')) await checkLive(option('live'), option('build-id'));
else {
  console.error('Usage: node scripts/check-pages-site.mjs --local <folder> | --live <url> --build-id <id>');
  process.exit(2);
}
