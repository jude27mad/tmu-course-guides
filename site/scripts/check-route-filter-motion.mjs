// Run against the production export in GitHub CI. The owner's recording showed
// a document-height page being scaled/slid beside the route loader on iPhone.
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
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-route-filter-motion';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${basePath}/`;
const results = [];
const ready = async (page) => {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return main && getComputedStyle(main).opacity === '1' &&
      !document.querySelector('.lenis-stopped') &&
      !document.querySelector('#layout[inert]') &&
      getComputedStyle(document.querySelector('#loader')).display === 'none';
  });
  await page.evaluate(() => document.fonts.ready);
};
const settled = (page) => page.waitForFunction(() => {
  const content = document.querySelector('#course-content');
  const results = document.querySelector('[data-work-results]');
  return content && !content.inert && getComputedStyle(content).opacity === '1' &&
    (!results || (!results.inert && getComputedStyle(results).opacity === '1'));
});

// Samples every frame of a page change: how much of the dark artwork behind the pages
// shows through (the page fades into the paper layer, never into the artwork), and the
// arriving page's geometry. The owner's iPhone showed the dark artwork full screen.
const startRouteFrames = (page) => page.evaluate(() => {
  window.routeFrames = [];
  window.routeDocument = true;
  const shown = (element) => {
    if (!element) return 0;
    const style = getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' ? 0 : Number(style.opacity);
  };
  const sample = () => {
    const main = document.querySelector('main');
    const rect = main.getBoundingClientRect();
    const heading = main.querySelector('h1');
    const paper = document.querySelector('#routePaper');
    const area = paper.getBoundingClientRect();
    const covers = area.top <= 0 && area.left <= 0 && area.bottom >= innerHeight && area.right >= innerWidth;
    const opacity = shown(main);
    const paperOpacity = shown(paper);
    const layout = Number(getComputedStyle(document.querySelector('#layout')).opacity);
    window.routeFrames.push({
      time: performance.now(), title: heading?.textContent, left: rect.left, width: rect.width,
      headingTop: heading?.getBoundingClientRect().top, opacity, paper: paperOpacity, paperCovers: covers,
      exposure: 1 - layout * (1 - (1 - opacity) * (1 - (covers ? paperOpacity : 0))),
      menu: Number(getComputedStyle(document.querySelector('#menu')).opacity), viewport: innerWidth,
      loader: getComputedStyle(document.querySelector('#loader')).display,
    });
    window.routeFrame = requestAnimationFrame(sample);
  };
  sample();
});
// The page can be ready before the next animation frame. Let the sampler record the
// arrived page (two frames) before stopping it; a busy runner otherwise had none.
const stopRouteFrames = (page) => page.evaluate(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  cancelAnimationFrame(window.routeFrame);
  return window.routeFrames;
});
const MAX_EXPOSURE = 0.1;
function assertPaperFade(frames, label) {
  const exposed = frames.filter((frame) => frame.exposure > MAX_EXPOSURE);
  assert.deepEqual(exposed.slice(0, 4), [], `${label}: the dark artwork must not show through a changing page`);
  assert.ok(frames.every((frame) => !frame.paper || frame.paperCovers), `${label}: the paper covers the screen whenever it is shown`);
}

async function check(browser, options, name, run) {
  const context = await browser.newContext({ ...options, recordVideo: { dir: path.join(report, 'videos'), size: { width: 834, height: 1024 } } });
  const errors = [];
  context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  try {
    const detail = await run(page);
    assert.deepEqual(errors, [], 'no page errors');
    results.push({ name, pass: true, detail });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message, errors });
    console.error(`::error::${name}: ${error.message}`);
    await page.screenshot({ path: path.join(report, `${name}-failure.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
}

async function checkMobileMenu(page, name) {
  const opener = page.getByRole('button', { name: 'Open menu', exact: true });
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  const firstLink = page.locator('#menu').getByRole('link', { name: 'Desk', exact: true });
  // A small real scroll keeps the header reachable while making scroll
  // preservation meaningful on both document and contained scroll layouts.
  await page.evaluate(() => {
    const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
    scroller.scrollTo(0, 12);
  });
  await page.waitForFunction(() => (document.documentElement.dataset.scrollMode === 'document' ? scrollY : document.querySelector('main').scrollTop) > 0);
  await opener.focus();
  const before = await page.evaluate(() => {
    window.menuFrames = [];
    window.menuPhase = 'before';
    const sample = () => {
      const main = document.querySelector('main');
      const page = main.getBoundingClientRect();
      const panel = document.querySelector('#menu');
      const menu = panel.getBoundingClientRect();
      window.menuFrames.push({
        time: performance.now(), phase: window.menuPhase,
        page: { left: page.left, top: page.top, width: page.width },
        menu: { left: menu.left, top: menu.top, width: menu.width, height: menu.height },
        viewport: { width: innerWidth, height: innerHeight },
        opacity: Number(getComputedStyle(panel).opacity), scrollY, scrollTop: main.scrollTop,
      });
      window.menuFrame = requestAnimationFrame(sample);
    };
    sample();
    return window.menuFrames[0];
  });
  assert.ok(before.scrollY > 0 || before.scrollTop > 0, 'the menu exercise starts from a scrolled page');
  let frames;
  try {
    for (const closeWithEscape of [false, true]) {
      await page.evaluate((reopened) => { window.menuPhase = reopened ? 'reopening' : 'opening'; }, closeWithEscape);
      // Safari taps do not necessarily focus their button. Reopen from body
      // focus as well as from the keyboard-focused opener used in the first pass.
      if (closeWithEscape) await opener.evaluate((button) => button.blur());
      await opener.click();
      await page.waitForFunction(() => {
        const menu = document.querySelector('#menu');
        return getComputedStyle(menu).opacity === '1' &&
          Array.from(menu.querySelectorAll('[data-menu-anim]')).every((item) => getComputedStyle(item).opacity === '1');
      }, null, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({
          open: document.querySelector('#menu').getAttribute('aria-hidden'),
          opacity: getComputedStyle(document.querySelector('#menu')).opacity,
          incomplete: Array.from(document.querySelectorAll('#menu [data-menu-anim]'))
            .filter((item) => getComputedStyle(item).opacity !== '1')
            .slice(0, 6)
            .map((item) => ({ text: item.textContent.trim().slice(0, 40), opacity: getComputedStyle(item).opacity })),
        }));
        throw new Error(`Menu did not finish opening: ${JSON.stringify(diagnostic)}`);
      });
      // Reduced-motion iPhone Safari can leave focus on body after a touch
      // gesture. Keyboard entry must still move directly into the modal.
      await page.waitForTimeout(220);
      if (!(await firstLink.evaluate((link) => link === document.activeElement))) await page.keyboard.press('Tab');
      assert.equal(await firstLink.evaluate((link) => link === document.activeElement), true, 'phone menu receives focus automatically or on first Tab');
      const coverage = await page.evaluate(() => {
        const panel = document.querySelector('#menu');
        // Resolve any CSS color syntax through the browser; the regression is
        // transparency, so this intentionally does not pin a palette RGB value.
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = getComputedStyle(panel).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return {
          backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3],
          coversCorners: [[1, 1], [innerWidth - 1, 1], [1, innerHeight - 1], [innerWidth - 1, innerHeight - 1]]
            .every(([x, y]) => panel.contains(document.elementFromPoint(x, y))),
        };
      });
      assert.equal(coverage.backgroundAlpha, 255, 'the open phone menu has an opaque background');
      assert.equal(coverage.coversCorners, true, 'the phone menu covers and receives input at every viewport corner');
      if (!closeWithEscape) {
        await page.screenshot({ path: path.join(report, `${name}-open.png`) });
        await close.focus();
        await page.keyboard.press('Tab');
        assert.equal(await firstLink.evaluate((link) => link === document.activeElement), true, 'Tab from the final control wraps to the first menu link');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await close.evaluate((button) => button === document.activeElement), true, 'Shift+Tab from the first link wraps to Close menu');
      }
      await page.evaluate((escape) => { window.menuPhase = escape ? 'closing-with-escape' : 'closing-with-button'; }, closeWithEscape);
      if (closeWithEscape) await page.keyboard.press('Escape');
      else await close.click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#menu')).visibility === 'hidden');
      await page.waitForFunction(() => document.querySelector('#menu-button') === document.activeElement, null, { timeout: 8000 }).catch(async () => {
        const diagnostic = await page.evaluate(() => ({
          active: document.activeElement?.outerHTML.slice(0, 200),
          openerInert: document.querySelector('#menu-button').inert,
          headerInert: document.querySelector('header').inert,
          headerVisibility: getComputedStyle(document.querySelector('header')).visibility,
        }));
        throw new Error(`Menu did not restore focus: ${JSON.stringify(diagnostic)}`);
      });
      assert.equal(await opener.evaluate((button) => button === document.activeElement), true, 'closing the phone menu returns focus to its opener');
    }
  } finally {
    frames = await page.evaluate(() => { cancelAnimationFrame(window.menuFrame); return window.menuFrames; });
    await writeFile(path.join(report, `${name}-frames.json`), JSON.stringify(frames, null, 2));
  }
  const moved = frames.filter((frame) => ['left', 'top', 'width'].some((key) => Math.abs(frame.page[key] - before.page[key]) >= 2));
  assert.deepEqual(moved.slice(0, 4), [], 'opening, closing and reopening the phone menu never shifts or shrinks the page');
  assert.ok(frames.every((frame) => frame.scrollY === before.scrollY && frame.scrollTop === before.scrollTop), 'the phone menu preserves the page scroll throughout both open/close cycles');
  const visible = frames.filter((frame) => frame.opacity > 0);
  assert.ok(visible.length, 'sample the phone menu while visible');
  const uncovered = visible.filter(({ menu, viewport }) => Math.abs(menu.left) >= 2 || Math.abs(menu.top) >= 2 ||
    Math.abs(menu.width - viewport.width) >= 2 || Math.abs(menu.height - viewport.height) >= 2);
  assert.deepEqual(uncovered.slice(0, 4), [], 'the phone menu remains aligned with the complete viewport throughout its animation');
  return { frames: frames.length, openCloseCycles: 2, scrollY: before.scrollY, scrollTop: before.scrollTop };
}

try {
  const safari = await webkit.launch({ headless: true });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-desk-menu-${reducedMotion}`, async (page) => {
        await page.goto(base);
        await ready(page);
        return checkMobileMenu(page, `iphone-desk-menu-${reducedMotion}`);
      });
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-menu-route-${reducedMotion}`, async (page) => {
        await page.goto(`${base}mth140/`);
        await ready(page);
        const menu = await checkMobileMenu(page, `iphone-course-menu-${reducedMotion}`);
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#menu')).opacity === '1');
        await startRouteFrames(page);
        await page.locator('#menu').getByRole('link', { name: 'CEN100', exact: true }).click();
        await page.waitForURL(`${base}cen100/`);
        await ready(page);
        const frames = await stopRouteFrames(page);
        await writeFile(path.join(report, `route-${reducedMotion}.json`), JSON.stringify(frames, null, 2));
        assertPaperFade(frames, 'from the menu');
        const incoming = frames.filter((frame) => frame.title === 'Intro to Engineering' && frame.opacity > 0.05);
        assert.ok(incoming.length, 'sample the visible destination');
        assert.ok(incoming.every((frame) => Math.abs(frame.left) < 2 && Math.abs(frame.width - frame.viewport) < 2),
          `the incoming document must stay full width: ${JSON.stringify(incoming.filter((frame) => Math.abs(frame.left) >= 2 || Math.abs(frame.width - frame.viewport) >= 2).slice(0, 4))}`);
        assert.ok(incoming.every((frame) => frame.loader === 'none'), 'no second loading card beside the arriving course');
        assert.equal(await page.evaluate(() => window.routeDocument), true, 'client-side navigation');
        await page.getByRole('button', { name: /Guide tools/ }).click();
        await page.getByRole('dialog', { name: 'Guide tools' }).waitFor();
        await page.keyboard.press('Escape');
        await page.screenshot({ path: path.join(report, `route-${reducedMotion}.png`) });
        return { menu, incomingFrames: incoming.length, final: incoming.at(-1) };
      });
      await check(safari, { ...devices['iPhone 13'], reducedMotion }, `iphone-page-routes-${reducedMotion}`, async (page) => {
        await page.goto(base);
        await ready(page);
        const routes = [];
        const follow = async (label, destination, title, navigate) => {
          await startRouteFrames(page);
          await navigate();
          await page.waitForURL(`${base}${destination}`);
          // Next changes the address before it renders the page: wait for the page itself.
          await page.waitForFunction((heading) => document.querySelector('main h1')?.textContent?.startsWith(heading), title);
          await ready(page);
          const frames = await stopRouteFrames(page);
          await writeFile(path.join(report, `page-route-${label}-${reducedMotion}.json`), JSON.stringify(frames, null, 2));
          assertPaperFade(frames, label);
          const incoming = frames.filter((frame) => frame.title?.startsWith(title) && frame.opacity > 0.05);
          assert.ok(incoming.length, `${label}: sample the visible destination: ${JSON.stringify([...new Set(frames.map((frame) => `${frame.title}@${frame.opacity}`))].slice(-6))}`);
          assert.ok(incoming.every((frame) => Math.abs(frame.left) < 2 && Math.abs(frame.width - frame.viewport) < 2 && frame.loader === 'none'), `${label}: the arriving page stays full width with no loading card`);
          const fading = frames.filter((frame) => frame.opacity > 0.05 && frame.opacity < 0.95);
          if (reducedMotion === 'reduce') {
            assert.deepEqual(fading.slice(0, 4), [], `${label}: with reduced motion the page changes without a fade`);
            assert.ok(frames.every((frame) => !frame.paper), `${label}: with reduced motion the paper never shows`);
          } else assert.ok(fading.length, `${label}: the page change fades`);
          assert.equal(await page.evaluate(() => window.routeDocument), true, `${label}: client-side navigation`);
          routes.push({ label, frames: frames.length, worstExposure: Math.max(...frames.map((frame) => frame.exposure)) });
        };
        // A link on the Desk, at the top of the page.
        await follow('desk-to-course', 'cen100/', 'Intro to Engineering', () => page.evaluate(() => document.querySelector('main a[href$="/cen100/"]').click()));
        // Between courses (the quick fade).
        await follow('course-to-course', 'mth140/', 'Calculus I', () => page.evaluate(() => window.next.router.push('/mth140/', undefined, { scroll: false })));
        // The footer's Desk link at the end of the page, header scrolled away.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForFunction(() => scrollY > 200);
        await follow('footer-to-desk', '', 'TMU Course Guides', () => page.evaluate((desk) => [...document.querySelectorAll('main a[href]')].filter((link) => new URL(link.href).pathname === desk).at(-1).click(), new URL(base).pathname));
        const top = await page.evaluate(() => ({ scrollY, header: getComputedStyle(document.querySelector('header')).opacity }));
        assert.ok(top.scrollY <= 8, 'the Desk opens at its top');
        assert.equal(top.header, '1', 'the header is back after the change');
        return { routes };
      });
    }
  } finally { await safari.close(); }

  const chromePhone = await chromium.launch({ headless: true });
  try {
    await check(chromePhone, devices['Pixel 5'], 'android-desk-menu-paused', async (page) => {
      await page.goto(`${base}?motion=off`);
      await ready(page);
      return checkMobileMenu(page, 'android-desk-menu-paused');
    });
  } finally { await chromePhone.close(); }

  for (const [engine, options, label] of [
    [webkit, devices['iPhone 13'], 'iphone'],
    [webkit, { ...devices['iPhone 13'], reducedMotion: 'reduce' }, 'iphone-still'],
    [chromium, { viewport: { width: 834, height: 1024 }, hasTouch: true }, 'tablet'],
    [chromium, { viewport: { width: 1440, height: 900 } }, 'desktop'],
  ]) {
    const browser = await engine.launch({ headless: true });
    try {
      if (label === 'iphone' || label === 'desktop') await check(browser, options, `${label}-badge-rapid-scroll`, async (page) => {
        const routes = [];
        for (const route of ['', 'cen100/', 'mth140/', 'mth141/', 'courses/']) {
          await page.goto(base + route);
          await ready(page);
          const badge = page.locator('[data-course-badge]').first();
          await badge.scrollIntoViewIfNeeded();
          await page.locator('[data-course-badge][data-badge-rendered="true"]').first().waitFor();
          // Read the existing world through its provider. This check does not
          // inject forces or expose a production debug API.
          const samples = await page.evaluate(async () => {
            const element = document.querySelector('[data-course-badge]');
            let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
            while (fiber && !fiber.memoizedProps?.value?.register) fiber = fiber.return;
            const registry = fiber.memoizedProps.value;
            const entry = registry.getState().entries.find(item => item.element === element);
            const keys = ['fixed', 'j1', 'j2', 'j3', 'card'];
            const bodies = keys.map(key => entry.body[key].current);
            const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
            const scrollTop = () => scroller === window ? scrollY : scroller.scrollTop;
            const centre = Math.max(0, scrollTop() + element.getBoundingClientRect().top - (innerHeight - element.offsetHeight) / 2);
            const records = [];
            // Alternate small visible nudges with full exits/re-entries. The
            // offscreen world must resume rather than remount or jump apart.
            for (let step = 0; step < 120; step++) {
              if (step % 3 === 0) {
                const excursion = step >= 48 && step < 84 ? innerHeight * 1.2 : 44;
                scroller.scrollTo(0, Math.max(0, centre + (step % 6 === 0 ? excursion : 0)));
              }
              await new Promise(requestAnimationFrame);
              const current = registry.getState().entries.find(item => item.id === entry.id);
              const anchor = bodies[0].translation();
              const card = bodies[4].translation();
              const rotation = bodies[4].rotation();
              records.push({ x: card.x - anchor.x, y: card.y - anchor.y, z: card.z - anchor.z,
                rotation: [rotation.x, rotation.y, rotation.z, rotation.w], visible: current.visible,
                same: keys.every((key, i) => current.body[key].current === bodies[i] && bodies[i].isValid()) });
            }
            scroller.scrollTo(0, centre);
            return records;
          });
          assert.ok(samples.every(sample => sample.same && [sample.x, sample.y, sample.z, ...sample.rotation].every(Number.isFinite)), 'rapid scrolling retains the same live, finite bodies');
          assert.ok(samples.some(sample => !sample.visible) && samples.some(sample => sample.visible), 'the stress scroll crosses the visibility boundary');
          const span = Math.max(...samples.map(sample => sample.x)) - Math.min(...samples.map(sample => sample.x));
          assert.ok(span > 0.01 && Math.max(...samples.map(sample => Math.abs(sample.x))) < 1.5, `the badge responds with a bounded natural swing: ${span}`);
          const name = `${label}-${route.replaceAll('/', '') || 'desk'}-rapid-scroll`;
          await writeFile(path.join(report, `${name}.json`), JSON.stringify(samples));
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(report, `${name}.png`) });
          routes.push({ route, span, samples: samples.length });
        }
        return routes;
      });
      if (label !== 'tablet') await check(browser, options, `${label}-companion-scene`, async (page) => {
        await page.addInitScript(() => { Math.random = () => 0.5; });
        await page.goto(base);
        await ready(page);
        assert.equal(await page.locator('[data-companion-statement]').count(), 1);
        assert.equal(await page.locator('[data-companion-statement] [data-companion-progress]').count(), 0);
        const intro = page.locator('[data-desk-introduction]:visible');
        assert.equal(await intro.count(), 1);
        const introLines = await intro.evaluate(element => {
          const text = element.firstChild;
          const copy = text.textContent;
          const split = copy.indexOf('Progress stays in this browser.');
          const previous = document.createRange();
          previous.setStart(text, copy.indexOf('course.') + 'course.'.length - 1);
          previous.setEnd(text, copy.indexOf('course.') + 'course.'.length);
          const progress = document.createRange();
          progress.setStart(text, split);
          progress.setEnd(text, split + 'Progress'.length);
          return { previousTop: previous.getBoundingClientRect().top, progressTop: progress.getBoundingClientRect().top, progressLeft: progress.getBoundingClientRect().left, left: element.getBoundingClientRect().left };
        });
        assert.ok(introLines.progressTop > introLines.previousTop + 1, 'the storage sentence starts after the course sentence');
        assert.ok(Math.abs(introLines.progressLeft - introLines.left) < 1, 'the storage sentence starts at the left of its new line');
        await intro.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(report, `${label}-desk-progress-line.png`) });
        assert.equal(await page.getByText('Open a course guide below', { exact: true }).count(), 0);
        const position = async (fraction) => page.evaluate((fraction) => {
          const section = document.querySelector('[data-companion-statement]');
          const documentMode = document.documentElement.dataset.scrollMode === 'document';
          const scroller = documentMode ? window : document.querySelector('main');
          const top = documentMode ? scrollY : scroller.scrollTop;
          scroller.scrollTo(0, section.getBoundingClientRect().top + top + (section.offsetHeight - innerHeight) * fraction);
        }, fraction);
        const entry = async fraction => page.evaluate(fraction => {
          const section = document.querySelector('[data-companion-statement]');
          const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
          const top = scroller === window ? scrollY : scroller.scrollTop;
          scroller.scrollTo(0, top + section.getBoundingClientRect().top - innerHeight * (1 - fraction));
        }, fraction);
        if (label === 'iphone-still') {
          await position(0);
          await page.waitForFunction(() => document.documentElement.dataset.motion === 'off' && document.querySelector('[data-companion-statement]')?.offsetHeight < innerHeight);
          assert.equal(await page.locator('[data-companion-game] canvas').count(), 0);
          assert.equal(await page.locator('[data-companion-statement] .word').count(), 0);
          await page.screenshot({ path: path.join(report, `${label}-companion.png`) });
          return { reducedMotion: true };
        }
        // Reproduce the blank panel in the reported screenshots: the scene is
        // half way into view while the preceding Desk controls are still above.
        await entry(0.5);
        await page.waitForFunction(() => {
          const words = [...document.querySelectorAll('[data-companion-statement] .word')];
          return words.length > 15 && words.filter(word => {
            const box = word.getBoundingClientRect();
            return Number(getComputedStyle(word).opacity) > 0.3 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
          }).length >= 3;
        }, null, { timeout: 8000 });
        await page.screenshot({ path: path.join(report, `${label}-companion-entry.png`) });
        const sceneRatio = await page.locator('[data-companion-statement]').evaluate(el => el.offsetHeight / innerHeight);
        assert.ok(sceneRatio <= (label === 'iphone' ? 1.3 : 1.55), `the closing scene reserves ${sceneRatio} viewport heights`);
        await entry(0.1);
        await page.waitForFunction(() => {
          const words = [...document.querySelectorAll('[data-companion-statement] .word')];
          return words.reduce((sum, word) => sum + Number(getComputedStyle(word).opacity), 0) / words.length < 0.8;
        });
        await page.locator('[data-companion-game] canvas').waitFor();
        assert.equal(await page.locator('[data-companion-game] canvas').count(), 1);
        const beforeStorage = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
        const words = await page.locator('[data-companion-statement] .word').count();
        assert.ok(words > 15);
        const before = await page.locator('[data-companion-statement] .word').evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(getComputedStyle(node).opacity), 0) / nodes.length);
        const frames = await page.evaluate(async () => {
          const documentMode = document.documentElement.dataset.scrollMode === 'document';
          const scroller = documentMode ? window : document.querySelector('main');
          const initial = documentMode ? scrollY : scroller.scrollTop;
          const travel = innerHeight;
          const records = [];
          let previous = performance.now();
          for (let step = 1; step <= 24; step += 1) {
            await new Promise(requestAnimationFrame);
            const now = performance.now();
            scroller.scrollTo(0, initial + travel * 0.4 * step / 24);
            records.push(now - previous); previous = now;
          }
          return records;
        });
        await page.waitForFunction(before => {
          const words = [...document.querySelectorAll('[data-companion-statement] .word')];
          return words.reduce((sum, word) => sum + Number(getComputedStyle(word).opacity), 0) / words.length > before + 0.05;
        }, before);
        const after = await page.locator('[data-companion-statement] .word').evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(getComputedStyle(node).opacity), 0) / nodes.length);
        assert.ok(after > before, `word reveal follows scrolling: ${before} -> ${after}`);
        // The scene must still be visibly assembling once its stage reaches
        // the viewport top; an opacity-only entry check missed this regression.
        await position(0);
        await page.waitForTimeout(450);
        const assembling = await page.locator('[data-companion-statement] .word').evaluateAll(nodes => nodes.map(node => {
          const css = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return { z: new DOMMatrixReadOnly(css.transform).m43, opacity: Number(css.opacity), visible: box.bottom > 0 && box.top < innerHeight };
        }));
        await page.screenshot({ path: path.join(report, `${label}-companion-mid-reveal.png`) });
        assert.ok(assembling.filter(word => word.visible && word.opacity > 0.3 && word.z > 10).length >= 3,
          `the visible statement retains its 3D reveal: ${JSON.stringify(assembling)}`);
        await position(1);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-companion-statement] .word')].every(word => Number(getComputedStyle(word).opacity) > 0.99));
        await page.waitForFunction(() => Number(document.querySelector('[data-game-discs]')?.dataset.gameDiscs) > 0);
        await page.screenshot({ path: path.join(report, `${label}-companion-and-game.png`) });
        // Interact with centre-launched discs on their actual shared DOM surface.
        // A software-rendered frame can outlast a flight. On iPhone, sample the
        // touch path within each painted frame so native pointer cancellation
        // and a rapid mouse sweep cannot make this mobile check miss every disc.
        // This dispatches input only: the real scene raycaster must slice a disc.
        if (label === 'iphone') {
          await page.evaluate(async () => {
            const stage = document.querySelector('[data-game-discs]');
            const deadline = performance.now() + 12000;
            // Linux WebKit cannot construct Touch/TouchEvent. Dispatch the same
            // touch-list fields on a DOM event; do not call scene callbacks.
            const dispatchTouch = (type, touches, changedTouches) => {
              const event = new Event(type, { bubbles: true, cancelable: true });
              Object.assign(event, { touches, targetTouches: touches, changedTouches });
              stage.dispatchEvent(event);
            };
            while (performance.now() < deadline && !Number(stage.dataset.gameSlices)) {
              await new Promise(requestAnimationFrame);
              const bounds = stage.getBoundingClientRect();
              const clientX = bounds.left + bounds.width / 2;
              let lastTouch;
              for (let clientY = Math.max(1, bounds.top + 1); clientY < Math.min(innerHeight - 1, bounds.bottom); clientY += 8) {
                const touch = { identifier: 1, target: stage, clientX, clientY, pageX: clientX + scrollX, pageY: clientY + scrollY };
                lastTouch = touch;
                const type = clientY === Math.max(1, bounds.top + 1) ? 'touchstart' : 'touchmove';
                dispatchTouch(type, [touch], [touch]);
              }
              dispatchTouch('touchend', [], lastTouch ? [lastTouch] : []);
            }
          });
        } else {
          const stage = await page.locator('[data-game-discs]').boundingBox();
          const sliceDeadline = Date.now() + 12000;
          while (Date.now() < sliceDeadline && !Number(await page.locator('[data-game-discs]').getAttribute('data-game-slices'))) {
            for (let step = 0; step <= 24; step += 1) {
              await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * step / 24);
            }
          }
        }
        assert.ok(Number(await page.locator('[data-game-discs]').getAttribute('data-game-slices')) > 0, 'visible discs respond to shared-surface input');
        const count = Number(await page.locator('[data-game-discs]').getAttribute('data-game-discs'));
        assert.ok(count <= (label === 'iphone' ? 6 : 10));
        assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())), beforeStorage, 'slicing does not change saved progress');
        for (let repeat = 0; repeat < 2; repeat += 1) {
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForFunction(() => document.documentElement.dataset.motion === 'off');
          assert.equal(await page.locator('[data-companion-statement] .word').count(), 0, 'SplitType restores plain text');
          assert.equal(await page.locator('[data-companion-game]').getAttribute('data-active'), 'false');
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await page.waitForFunction(() => document.documentElement.dataset.motion === 'on');
          assert.equal(await page.locator('[data-companion-statement] .word').count(), words);
          assert.equal(await page.locator('[data-companion-statement] .word .word').count(), 0);
        }
        frames.sort((a, b) => a - b);
        return { words, discs: count, reveal: { before, after }, frameP95Ms: frames[Math.floor(frames.length * 0.95)], note: 'CI diagnostics; not physical-device performance.' };
      });
      await check(browser, options, `${label}-work-filters`, async (page) => {
        // Install before application timers, then advance animation frames explicitly.
        // This tests intermediate geometry without relying on a loaded CI runner's FPS.
        await page.clock.install({ time: new Date('2026-10-23T16:00:00Z') });
        await page.goto(`${base}cen100/`);
        await ready(page);
        await page.locator('#course-section:not(:disabled)').waitFor();
        const rows = await page.locator('[data-assignment-link]').count();
        await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
        assert.equal(await page.locator('[data-filter-selection]').count(), 1, 'the selected Work filter has a visible moving indicator');
        const before = await page.locator('[data-filter-selection]').boundingBox();
        assert.ok(before, 'the selected Work filter has a visible moving indicator');
        const all = page.getByRole('button', { name: /^All \(/ });
        const allBox = await all.boundingBox();
        await all.evaluate((button) => button.click());
        await page.clock.runFor(48);
        assert.equal(await all.getAttribute('aria-pressed'), 'true', 'selection acknowledges the click immediately');
        const during = await page.locator('[data-filter-selection]').boundingBox();
        if (options.reducedMotion === 'reduce') assert.ok(Math.abs(during.x - allBox.x) < 2, 'reduced motion selects immediately');
        else assert.ok(during.x > before.x + 1 && during.x < allBox.x - 1, `the selection moves between filters: ${JSON.stringify({ before, during, allBox })}`);
        await page.clock.runFor(400);
        assert.equal(await page.locator('[data-assignment-link]').count(), rows, 'All and Open correctly match before anything is marked done');
        assert.match(await page.locator('[data-work-summary]').innerText(), /all|total/i, 'a visible summary identifies the chosen result set');
        await page.getByRole('button', { name: /^Done \(/ }).evaluate((button) => button.click());
        await page.clock.runFor(48);
        if (options.reducedMotion !== 'reduce') {
          const opacity = await page.locator('[data-work-results]').evaluate((node) => Number(getComputedStyle(node).opacity));
          assert.ok(opacity > 0 && opacity < 1, 'changed results fade out before replacement');
        }
        await page.clock.runFor(500);
        assert.equal(await page.locator('[data-assignment-link]').count(), 0);
        const empty = page.locator('[data-work-empty]');
        assert.match(await empty.innerText(), /mark|completion/i, 'empty Done explains how assignments arrive here');
        await page.screenshot({ path: path.join(report, `${label}-done-empty.png`), fullPage: true });
        const backToWork = empty.getByRole('button', { name: /open|work/i });
        await backToWork.evaluate((button) => button.click());
        await page.clock.runFor(500);
        assert.equal(await page.locator('[data-assignment-link]').count(), rows);
        await page.getByRole('button', { name: /^Done \(/ }).evaluate((button) => button.click());
        await page.clock.runFor(32);
        await all.evaluate((button) => button.click());
        await page.clock.runFor(500);
        assert.equal(await page.locator('[data-assignment-link]').count(), rows, 'a newer filter cancels an outgoing result transition');
        await page.getByRole('button', { name: /^Open \(/ }).evaluate((button) => button.click());
        await page.clock.runFor(400);
        await page.clock.resume();
        await page.getByRole('button', { name: /^All \(/ }).focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => location.hash === '#work/all');
        await settled(page);
        assert.equal(await all.evaluate((button) => button === document.activeElement), true, 'keyboard focus stays on the selected filter');
        // A non-focusing link activation must still focus the new view after
        // its filter controls unmount (Safari taps can retain the old focus).
        await page.getByRole('navigation', { name: 'Course views' }).getByRole('link', { name: 'Schedule', exact: true }).evaluate((link) => link.click());
        await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
        await settled(page);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'course-content', 'leaving Work moves focus into the destination view');
        await page.goBack();
        await page.waitForFunction(() => location.hash === '#work/all');
        await settled(page);
        await page.goBack();
        await page.waitForFunction(() => !location.hash || location.hash === '#work');
        await settled(page);
        await page.waitForFunction(() => {
          const selected = document.querySelector('[data-work-filters] [aria-pressed="true"]').getBoundingClientRect();
          const indicator = document.querySelector('[data-filter-selection]').getBoundingClientRect();
          return Math.abs(selected.x - indicator.x) < 2 && Math.abs(selected.width - indicator.width) < 2;
        });
        await page.screenshot({ path: path.join(report, `${label}-work-filters.png`) });
        if (label === 'iphone') {
          await page.locator('#open-assignment-y1').click();
          await page.locator('#course-view-assignment-y1[data-assignment-detail]').waitFor();
          await settled(page);
          const records = page.locator('[data-assignment-detail] fieldset input[type="checkbox"]');
          assert.equal(await records.count(), 4, 'September items has four separate submission records');
          // The visible label is the touch target; the accessible input is
          // intentionally 1px with pointer-events:none in the existing design.
          await page.locator('[data-assignment-detail] input[type="checkbox"]').first().locator('..').click();
          await records.first().locator('..').click();
          assert.equal(await records.first().isChecked(), true);
          await page.getByRole('button', { name: /Back to Work/ }).first().click();
          await settled(page);
          assert.match(await page.locator('#open-assignment-y1').innerText(), /1\/4 recorded/);
          assert.equal(await page.getByRole('button', { name: 'Done (0)', exact: true }).count(), 1, 'preparation ticks and one record do not finish an assignment');
          await page.locator('#open-assignment-y1').click();
          await page.locator('#course-view-assignment-y1[data-assignment-detail]').waitFor();
          await settled(page);
          for (let i = 1; i < 4; i += 1) await records.nth(i).locator('..').click();
          await page.getByRole('button', { name: /Back to Work/ }).first().click();
          await settled(page);
          await page.getByRole('button', { name: 'Done (1)', exact: true }).click();
          await page.locator('#open-assignment-y1').waitFor();
          assert.equal(await page.locator('[data-assignment-link]').count(), 1);
          // Read storage in a fresh document. Reusing a WebKit page for a full
          // navigation cancels Next's in-flight CSS prefetches (also avoided by
          // check-ios-document). Leave the first tab alive until the assertions.
          const reopened = await page.context().newPage();
          await reopened.goto(page.url());
          await ready(reopened);
          await reopened.locator('#open-assignment-y1').waitFor();
          assert.equal(await reopened.getByRole('button', { name: 'Done (1)', exact: true }).getAttribute('aria-pressed'), 'true');
          await reopened.locator('[data-work-results]').scrollIntoViewIfNeeded();
          await reopened.screenshot({ path: path.join(report, 'iphone-done-recorded.png') });
        }
        return { rows, keyboardAndHistory: true };
      });
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(path.join(report, 'results.json'), JSON.stringify(results, null, 2));
  await new Promise((resolve) => server.close(resolve));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;

