import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || path.join(site, '.ios-scroll-qa');
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
let browser;
async function ready(page) {
  await page.waitForFunction(
    () => {
      const main = document.querySelector('main');
      const loader = document.querySelector('#loader');
      return main && getComputedStyle(main).opacity === '1' && !document.querySelector('#layout')?.hasAttribute('inert') && (!loader || getComputedStyle(loader).display === 'none');
    },
    null,
    { timeout: 25000 },
  );
}

// Tests actual exported CSS and geometry, not proprietary Safari toolbar UI.
async function verifyTransparencyGuards(page) {
  const state = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-safari-blend]')];
    const main = document.querySelector('main');
    const before = { height: document.scrollingElement.scrollHeight, top: main.getBoundingClientRect().top };
    const guards = nodes.map((node) => {
      const css = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        side: node.dataset.safariBlend,
        position: css.position,
        background: css.backgroundColor,
        image: css.backgroundImage,
        clip: css.backgroundClip,
        pointerEvents: css.pointerEvents,
        border: css.borderTopWidth,
        shadow: css.boxShadow,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        empty: node.childNodes.length === 0,
        hidden: node.getAttribute('aria-hidden'),
      };
    });
    // Transparent guards must not introduce extra scrolling or move page text.
    nodes.forEach((node) => { node.style.display = 'none'; });
    const without = { height: document.scrollingElement.scrollHeight, top: main.getBoundingClientRect().top };
    nodes.forEach((node) => { node.style.removeProperty('display'); });
    return { guards, before, without, viewport: { width: innerWidth, height: innerHeight }, oldSamples: document.querySelectorAll('[data-safari-edge]').length };
  });
  assert.equal(state.oldSamples, 0, 'opaque edge samplers must not return');
  assert.deepEqual(state.guards.map((guard) => guard.side), ['top', 'bottom']);
  for (const guard of state.guards) {
    assert.equal(guard.position, 'sticky', JSON.stringify(state));
    assert.equal(guard.background, 'rgba(0, 0, 0, 0)', JSON.stringify(state));
    assert.equal(guard.image, 'none');
    assert.notEqual(guard.clip, 'text', 'opaque backgrounds must not be disguised with text clipping');
    assert.equal(guard.pointerEvents, 'none');
    assert.equal(guard.border, '0px');
    assert.equal(guard.shadow, 'none');
    assert.equal(guard.empty, true);
    assert.equal(guard.hidden, 'true');
    assert.ok(Math.abs(guard.width - state.viewport.width) < 2, JSON.stringify(state));
  }
  assert.ok(Math.abs(state.before.height - state.without.height) < 2, JSON.stringify(state));
  assert.ok(Math.abs(state.before.top - state.without.top) < 2, JSON.stringify(state));
  assert.ok(state.guards[0].top >= -3 && state.guards[0].top <= 1, JSON.stringify(state));
  assert.ok(state.guards[1].bottom >= state.viewport.height - 7 && state.guards[1].bottom <= state.viewport.height + 3, JSON.stringify(state));
  return state;
}

try {
  browser = await webkit.launch({ headless: true });
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: motion });
    try {
      for (const route of ['', 'courses/', 'cen100/', 'mth140/', 'mth141/', 'privacy/']) {
        // Each direct-entry check owns its page. Full-document navigations on a
        // reused page can cancel the preceding route's Next CSS prefetch in WebKit.
        const page = await context.newPage();
        const errors = [];
        const failedRequests = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure() }));
        try {
          await page.goto(base + route);
          await ready(page);
          const initial = await page.evaluate(() => {
            const main = document.querySelector('main');
            return {
              mode: document.documentElement.dataset.scrollMode,
              position: getComputedStyle(main).position,
              overflow: getComputedStyle(main).overflowY,
              layoutOverflow: getComputedStyle(document.querySelector('#layout')).overflowY,
              docHeight: document.scrollingElement.scrollHeight,
              viewport: innerHeight,
            };
          });
          assert.equal(initial.mode, 'document', route);
          assert.notEqual(initial.position, 'fixed', route);
          assert.ok(!['hidden', 'scroll', 'auto'].includes(initial.overflow), JSON.stringify(initial));
          assert.ok(!['hidden', 'scroll', 'auto'].includes(initial.layoutOverflow), JSON.stringify(initial));
          assert.ok(initial.docHeight > initial.viewport + 100, JSON.stringify(initial));
          const edgesAtTop = await verifyTransparencyGuards(page);
          await page.evaluate(() => window.scrollTo(0, 300));
          await page.waitForFunction(() => scrollY > 150, null, { timeout: 3000 });
          await page.waitForFunction(
            () => {
              const button = document.querySelector('#menu-button');
              return button.closest('[inert]') && (getComputedStyle(button).visibility === 'hidden' || button.getBoundingClientRect().bottom <= 0);
            },
            null,
            { timeout: 3000 },
          );
          const edgesAfterScroll = await verifyTransparencyGuards(page);
          if (route === 'courses/') {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
            await page.getByRole('button', { name: 'Close menu', exact: true }).waitFor();
            await verifyTransparencyGuards(page);
            await page.getByRole('button', { name: 'Close menu', exact: true }).tap();
            await ready(page);
            await verifyTransparencyGuards(page);
          }
          await page.screenshot({ path: path.join(report, `${motion}-${route.replaceAll('/', '') || 'desk'}.png`) });
          assert.deepEqual(errors, [], JSON.stringify({ route, motion, failedRequests }));
          results.push({ route, motion, pass: true, initial, edgesAtTop, edgesAfterScroll });
          console.log('PASS', motion, route || 'desk');
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(report, 'results.json'), JSON.stringify({ limitation: 'Linux WebKit does not render iPhone Safari browser chrome. These results verify CSS, layout and page interaction only.', results }, null, 2));
}
