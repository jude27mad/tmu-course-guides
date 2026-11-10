// Production-export regression for footer jumps. Browser lifecycle/viewport
// events are simulated; this does not claim to operate iOS Control Center.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-footer-qa';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];

async function ready(page, route) {
  await page.goto(url + route);
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const loader = document.querySelector('#loader');
    return main && loader && getComputedStyle(main).opacity === '1' &&
      getComputedStyle(loader).display === 'none' && !document.querySelector('.lenis-stopped');
  });
  await page.evaluate(() => document.fonts.ready);
  // Use the site's own scroll input, then require the end as a precondition;
  // assigning scrollTop can race Lenis's pending native-scroll event in WebKit.
  await page.keyboard.press('End');
  await page.waitForFunction(() => {
    const root = document.documentElement.dataset.scrollMode === 'document'
      ? document.scrollingElement : document.querySelector('main');
    return root.scrollHeight - root.clientHeight - root.scrollTop <= 2;
  });
  await page.waitForTimeout(400);
}

async function monitor(page) {
  await page.evaluate(() => {
    window.footerFrames = [];
    window.readFooter = () => {
      const documentMode = document.documentElement.dataset.scrollMode === 'document';
      const root = documentMode ? document.scrollingElement : document.querySelector('main');
      const footer = document.querySelector('footer > [data-surface="dark"]');
      const bounds = footer.getBoundingClientRect();
      return {
        scroll: root.scrollTop,
        top: bounds.top,
        height: footer.offsetHeight,
        width: bounds.width,
        wrapperTop: footer.parentElement.getBoundingClientRect().top,
        max: root.scrollHeight - root.clientHeight,
        viewport: window.innerHeight,
        transform: getComputedStyle(footer).transform,
      };
    };
    const sample = () => {
      window.footerFrames.push(window.readFooter());
      window.footerFrame = requestAnimationFrame(sample);
    };
    sample();
  });
  return page.evaluate(() => window.readFooter());
}

async function stable(page, before, label, contentMayGrow = false) {
  await page.waitForTimeout(400);
  const frames = await page.evaluate(() => {
    cancelAnimationFrame(window.footerFrame);
    return window.footerFrames;
  });
  const final = frames.at(-1);
  for (const frame of frames) {
    assert.ok(Math.abs(frame.scroll - before.scroll) <= 2, `${label}: scroll jumped ${frame.scroll - before.scroll}px`);
    assert.ok(Math.abs(frame.top - before.top) <= 2, `${label}: footer moved ${frame.top - before.top}px`);
    // An expanded native credit can genuinely need more than one screen. The
    // regression is an intermediate collapse, not that legitimate content size.
    if (contentMayGrow) assert.ok(frame.height >= Math.min(before.height, final.height) - 2, `${label}: footer temporarily collapsed`);
    else assert.ok(Math.abs(frame.height - before.height) <= 2, `${label}: footer height changed ${frame.height - before.height}px`);
    assert.ok(Math.abs(frame.width - before.width) <= 2, `${label}: footer width changed`);
  }
  return { label, before, after: frames.at(-1), frames: frames.length };
}

try {
  for (const engine of (process.env.QA_BROWSERS || 'chromium,webkit').split(',')) {
    const browser = await playwright[engine].launch(engine === 'chromium'
      ? { executablePath: process.env.QA_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }
      : {});
    try {
      const cases = [
        ['desktop', { viewport: { width: 1440, height: 900 } }],
        ['iphone', { ...playwright.devices['iPhone 13 Pro Max'] }],
        ['android', { ...playwright.devices['Pixel 7'] }],
        ['iphone-still', { ...playwright.devices['iPhone 13 Pro Max'], reducedMotion: 'reduce' }],
      ];
      for (const [device, options] of cases) {
        for (const route of ['', 'updates/']) {
          const label = `${engine}-${device}-${route ? 'updates' : 'desk'}`;
          const context = await browser.newContext({ reducedMotion: 'no-preference', ...options });
          const page = await context.newPage();
          page.setDefaultTimeout(30000);
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const evidence = [];
          try {
            await ready(page, route);
            const moving = options.reducedMotion !== 'reduce';
            if (moving) {
              const before = await monitor(page);
              evidence.push({ label: 'initial', before });
              assert.ok(before.scroll > 0, 'exercise the end of the page');
              assert.ok(Math.abs(before.top - before.wrapperTop) <= 2, `footer is fully uncovered at the reachable end: ${JSON.stringify(before)}`);
              evidence.push(await stable(page, before, 'idle'));
            }
            for (const [index, open] of [true, false, true, false].entries()) {
              const before = await monitor(page);
              const summary = page.locator('footer [data-design-credit] summary');
              const box = await summary.boundingBox();
              assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height, 'credit is already visible');
              if (index === 1) {
                await summary.evaluate(el => el.focus({ preventScroll: true }));
                await page.keyboard.press('Enter');
              }
              else if (options.hasTouch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
              else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
              await page.waitForFunction(expected => document.querySelector('footer [data-design-credit]').open === expected, open);
              if (moving) evidence.push(await stable(page, before, `credit-${open}`, true));
              else {
                // A natural-height reduced-motion footer is allowed to grow.
                await page.evaluate(() => cancelAnimationFrame(window.footerFrame));
                assert.equal(await page.locator('footer > section').evaluate(el => getComputedStyle(el).transform), 'none');
              }
            }
            if (moving) {
              // Model browser bars changing the reported viewport without
              // changing the stable small viewport or the user's scroll input.
              // Returning from a system overlay also dispatches lifecycle events.
              for (const delta of [80, 0, 80, 0]) {
                const before = await monitor(page);
                await page.evaluate(delta => {
                  window.originalFooterHeight ??= window.innerHeight;
                  Object.defineProperty(window, 'innerHeight', { configurable: true, value: window.originalFooterHeight + delta });
                  window.dispatchEvent(new Event('blur'));
                  document.dispatchEvent(new Event('visibilitychange'));
                  window.dispatchEvent(new Event('resize'));
                  window.visualViewport?.dispatchEvent(new Event('resize'));
                  window.dispatchEvent(new Event('focus'));
                  window.dispatchEvent(new Event('pageshow'));
                }, delta);
                evidence.push(await stable(page, before, `overlay-${delta}`));
              }
              await page.evaluate(() => { delete window.innerHeight; });
            }
            await page.screenshot({ path: path.join(report, `${label}.png`) });
            // Rotation/short screens must retain every link and the open credit.
            await page.setViewportSize({ width: 844, height: 390 });
            await page.locator('footer summary').evaluate(el => { el.parentElement.open = true; });
            await page.waitForTimeout(300);
            await page.locator('footer a[href="https://giats.me"]').scrollIntoViewIfNeeded();
            assert.ok(await page.locator('footer a[href="https://giats.me"]').isVisible());
            assert.equal(await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth + 1), false, 'no horizontal overflow after rotation');
            assert.deepEqual(errors, [], 'no page errors');
            results.push({ label, pass: true, evidence });
            console.log(`PASS ${label}`);
          } catch (error) {
            const metrics = await page.evaluate(() => window.readFooter?.()).catch(() => null);
            results.push({ label, pass: false, error: error.message, evidence, metrics });
            await page.screenshot({ path: path.join(report, `${label}-failure.png`) }).catch(() => {});
            console.error(`FAIL ${label}: ${error.message}; ${JSON.stringify(metrics)}`);
          } finally { await context.close(); }
        }
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
}
assert.equal(results.filter(result => !result.pass).length, 0, 'footer layout regressions; inspect results.json and screenshots');
