// Exercise Search against the production export in CI; no physical-device claim.
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
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-search-qa';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
const routes = ['', 'courses/', 'cen100/', 'mth140/', 'mth141/', 'privacy/', 'updates/'];
const configurations = [
  { name: 'desktop-chromium', engine: chromium, options: { viewport: { width: 1440, height: 1000 } } },
  { name: 'android-chromium', engine: chromium, options: devices['Pixel 5'] },
  { name: 'iphone-webkit', engine: webkit, options: devices['iPhone 13'] },
];

async function ready(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const loader = document.querySelector('#loader');
    return main && loader && getComputedStyle(loader).display === 'none'
      && getComputedStyle(main).pointerEvents === 'auto'
      && !document.querySelector('.lenis-stopped')
      && !document.querySelector('#layout[inert]');
  });
  await page.evaluate(() => document.fonts.ready);
}
async function focused(page, selector) {
  await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), selector);
}
async function check(name, page, run) {
  try {
    await run();
    results.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({
      name, pass: false, error: error.stack || error.message,
      diagnostics: await page.evaluate(() => ({
        active: window.__describeSearchNode?.(document.activeElement),
        nodes: ['#menu', '#search', '#search-input', '#menu-button', 'header'].map(selector => window.__describeSearchNode?.(document.querySelector(selector))),
        events: window.__searchEvents,
      })).catch(() => null),
    });
    console.error(`FAIL ${name}: ${error.stack || error.message}`);
    await page.screenshot({ path: path.join(report, `${name}.png`) }).catch(() => {});
  }
}
const activate = (locator, touch) => touch ? locator.tap() : locator.click();

async function openMenu(page, touch) {
  await activate(page.locator('#menu-button'), touch);
  await page.waitForFunction(() => {
    const menu = document.querySelector('#menu');
    return menu && menu.getAttribute('aria-hidden') === 'false' && getComputedStyle(menu).opacity === '1';
  });
}
async function openSearch(page, touch) {
  await openMenu(page, touch);
  await activate(page.locator('#menu button[aria-controls="search"]'), touch);
  await focused(page, '#search-input');
  await page.locator('#search[aria-hidden="false"]').waitFor();
  assert.equal(await page.locator('#menu').getAttribute('aria-hidden'), 'true');
}
async function searchVisible(page) {
  const box = await page.locator('#search-input').boundingBox();
  const height = await page.evaluate(() => innerHeight);
  assert.ok(box && box.y >= 0 && box.y + box.height <= height, 'Search input stays in view');
}

try {
  for (const config of configurations) {
    const browser = await config.engine.launch(config.engine === chromium
      ? { args: ['--no-sandbox', '--enable-unsafe-swiftshader'] } : {});
    try {
      const context = await browser.newContext({ ...config.options, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        const describe = (node) => {
          if (!node) return null;
          const style = getComputedStyle(node);
          return {
            tag: node.tagName, id: node.id, label: node.getAttribute('aria-label'),
            hidden: node.getAttribute('aria-hidden'), inert: node.closest('[inert]')?.id,
            visibility: style.visibility, display: style.display, opacity: style.opacity,
          };
        };
        window.__describeSearchNode = describe;
        window.__searchEvents = [];
        const record = (type, target) => {
          window.__searchEvents.push({ type, time: performance.now(), target: describe(target), active: describe(document.activeElement) });
          if (window.__searchEvents.length > 100) window.__searchEvents.shift();
        };
        for (const type of ['focusin', 'focusout', 'pointerdown', 'pointerup', 'click']) {
          document.addEventListener(type, event => record(type, event.target), true);
        }
        const focus = HTMLElement.prototype.focus;
        HTMLElement.prototype.focus = function (...args) {
          record('focus-before', this);
          const result = focus.apply(this, args);
          record('focus-after', this);
          return result;
        };
      });
      const page = await context.newPage();
      const touch = !!config.options.hasTouch;
      const errors = [];
      page.setDefaultTimeout(12000);
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-26T16:00:00Z'));
      try {
        for (const route of routes) {
          await check(`${config.name}-${route.replace('/', '') || 'desk'}`, page, async () => {
            await page.goto(base + route);
            await ready(page);
            await openMenu(page, touch);
            const menu = page.locator('#menu');
            const search = menu.locator('button[aria-controls="search"]');
            assert.equal(await search.count(), 1, 'only one menu Search entry');
            assert.equal(await page.locator('header [aria-controls="search"]').count(), 0);
            const searchBox = await search.boundingBox();
            const headingBox = await menu.getByRole('heading', { name: 'Sitemap', exact: true }).boundingBox();
            assert.ok(searchBox.y >= 0 && searchBox.y + searchBox.height <= headingBox.y, 'Search is above Sitemap');
            // Reopening a scrolled menu must still expose its first action.
            await menu.locator('nav').evaluate(el => { el.scrollTop = el.scrollHeight; });
            await activate(menu.getByRole('button', { name: 'Close menu', exact: true }), touch);
            await ready(page);
            await openMenu(page, touch);
            assert.equal(await menu.locator('nav').evaluate(el => el.scrollTop), 0);
            await activate(search, touch);
            await focused(page, '#search-input');
            await searchVisible(page);
            const input = page.locator('#search-input');
            await input.fill('Website updates');
            await page.locator('#search').getByRole('option').filter({ hasText: /^Website updates$/ }).waitFor();
            await input.fill('Calculus');
            await activate(page.locator('#search').getByRole('option').filter({ hasText: 'MTH140 · Calculus I' }).first(), touch);
            await page.waitForURL(url => url.pathname === basePath + '/mth140/');
            await ready(page);
            await page.locator('#search').waitFor({ state: 'hidden' });
            assert.match(await page.locator('main h1').first().innerText(), /Calculus/);
            assert.deepEqual(errors, []);
          });
        }

        await check(`${config.name}-query-keyboard-and-reopen`, page, async () => {
          await page.goto(base + 'cen100/');
          await ready(page);
          await openSearch(page, touch);
          const panel = page.locator('#search');
          const input = page.locator('#search-input');
          await input.fill('zzzz-no-match-987654321');
          await page.waitForFunction(() => /No results/.test(document.querySelector('#search [aria-live]').textContent));
          await activate(panel.getByRole('button', { name: 'Clear search', exact: true }), touch);
          assert.equal(await input.inputValue(), '');
          await focused(page, '#search-input');
          await input.fill('fishbone');
          await activate(panel.getByRole('option', { name: 'Search the guide for fishbone', exact: true }), touch);
          await activate(panel.getByRole('option').filter({ hasText: 'Failure Analysis Labs' }).first(), touch);
          await page.waitForURL(url => url.hash === '#assignment-m3');
          await page.locator('[data-assignment-detail]').waitFor();
          await ready(page);

          await page.keyboard.press('Control+k');
          await focused(page, '#search-input');
          await input.fill('regrade');
          await panel.getByRole('option').filter({ hasText: /MTH140/ }).first().waitFor();
          await input.press('Home');
          const first = await input.getAttribute('aria-activedescendant');
          await input.press('ArrowDown');
          await page.waitForFunction(first => document.querySelector('#search-input').getAttribute('aria-activedescendant') !== first, first);
          await input.press('ArrowUp');
          await page.waitForFunction(first => document.querySelector('#search-input').getAttribute('aria-activedescendant') === first, first);
          await input.press('Enter');
          await page.waitForURL(url => url.hash === '#policy-regrade');
          await page.locator('#course-view-policy-regrade[data-info-detail]').waitFor();
          await ready(page);

          // Reset to the header before checking close/focus and menu shortcuts.
          await page.goto(base + 'privacy/');
          await ready(page);
          await openSearch(page, touch);
          for (let i = 0; i < 5; i += 1) {
            await page.keyboard.press('Tab');
            assert.equal(await panel.evaluate(el => el.contains(document.activeElement)), true, 'Tab remains inside Search');
          }
          await page.keyboard.press('Escape');
          await ready(page);
          await focused(page, '#menu-button');
          await openMenu(page, touch);
          await page.keyboard.press('Control+k');
          await focused(page, '#search-input');
          assert.equal(await page.locator('#menu').getAttribute('aria-hidden'), 'true');
          await input.fill('Website updates');
          await input.press('Home');
          await input.press('Enter');
          await page.waitForURL(url => url.pathname === basePath + '/updates/');
          await ready(page);

          await openSearch(page, touch);
          await panel.locator('[data-lenis-prevent]').evaluate(el => { el.scrollTop = el.scrollHeight; });
          await activate(panel.getByRole('button', { name: 'Close search', exact: true }), touch);
          await ready(page);
          await openSearch(page, touch);
          assert.equal(await input.inputValue(), '');
          await searchVisible(page);
          await page.screenshot({ path: path.join(report, `${config.name}-search.png`) });
          await activate(panel.getByRole('button', { name: 'Close search', exact: true }), touch);
          await ready(page);
          assert.deepEqual(errors, []);
        });

        // Reuse the same checks with the normal opening/closing animations.
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await check(`${config.name}-animated-handoff`, page, async () => {
          await page.goto(base + 'updates/');
          await ready(page);
          for (let attempt = 0; attempt < 2; attempt += 1) {
            await openSearch(page, touch);
            await searchVisible(page);
            await page.locator('#search-input').fill('Privacy');
            await activate(page.locator('#search').getByRole('option').filter({ hasText: /^Privacy$/ }), touch);
            await page.waitForURL(url => url.pathname === basePath + '/privacy/');
            await ready(page);
          }
          assert.deepEqual(errors, []);
        });
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
}
assert.ok(results.length && results.every(result => result.pass), JSON.stringify(results.filter(result => !result.pass), null, 2));
