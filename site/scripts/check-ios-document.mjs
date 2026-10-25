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
const navigationFailures = [];
let browser;
async function ready(page) {
  await page.waitForFunction(
    () => {
      const main = document.querySelector('main');
      const loader = document.querySelector('#loader');
      return main && getComputedStyle(main).opacity === '1' && !document.querySelector('.lenis-stopped') && !document.querySelector('#layout')?.hasAttribute('inert') && (!loader || getComputedStyle(loader).display === 'none');
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
        left: box.left,
        right: box.right,
        width: box.width,
        empty: node.childNodes.length === 0,
        hidden: node.getAttribute('aria-hidden'),
      };
    });
    // Transparent guards must not introduce extra scrolling or move page text.
    nodes.forEach((node) => { node.style.display = 'none'; });
    const without = { height: document.scrollingElement.scrollHeight, top: main.getBoundingClientRect().top };
    nodes.forEach((node) => { node.style.removeProperty('display'); });
    // Safari 26.1+ takes an edge's colour from a viewport-sized fixed or sticky layer with a visible
    // background-color; the invisible fluid base once did, and showed as solid black bands.
    const tintingLayers = [...document.querySelectorAll('body *')]
      .filter((node) => {
        if (node.hasAttribute('data-safari-blend')) return false;
        const css = getComputedStyle(node);
        if (!['fixed', 'sticky'].includes(css.position) || css.display === 'none' || css.visibility === 'hidden') return false;
        const box = node.getBoundingClientRect();
        return box.width >= innerWidth * 0.9 && box.height >= innerHeight * 0.9;
      })
      .map((node) => {
        const css = getComputedStyle(node);
        return { node: node.id ? `#${node.id}` : `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]}`, background: css.backgroundColor, backdrop: css.backdropFilter };
      })
      .filter((layer) => layer.background !== 'rgba(0, 0, 0, 0)' || (layer.backdrop && layer.backdrop !== 'none'));
    // The open menu and search panels are dark on purpose: the bars follow them, in the panel's own ink.
    const panelOpen = ['#menu', '#search'].some((selector) => {
      const panel = document.querySelector(selector);
      return panel && getComputedStyle(panel).visibility !== 'hidden';
    });
    const fluid = document.querySelector('#fluidCanvas');
    // The fixed artwork reaches past both edges, under Safari's bars; paper covers it
    // above the start of the page until the page is well into its scroll, or a dark
    // panel (which shows the artwork through its ink) reaches the status bar.
    const art = document.querySelector('[class*="app_background"]')?.getBoundingClientRect();
    const darkFromStart = Math.min(
      Infinity,
      ...[...main.querySelectorAll('[data-surface="dark"]')].map((panel) => panel.getBoundingClientRect()).filter((box) => box.height).map((box) => box.top + scrollY),
    );
    const skip = document.querySelector('.skip-link');
    return {
      guards,
      before,
      without,
      viewport: { width: innerWidth, height: innerHeight },
      oldSamples: document.querySelectorAll('[data-safari-edge]').length,
      tintingLayers,
      panelOpen,
      surface: document.documentElement.dataset.browserSurface,
      fluidBackground: fluid ? getComputedStyle(fluid).backgroundColor : null,
      art: art ? { top: art.top, bottom: art.bottom } : null,
      edgeTop: document.documentElement.dataset.edgeTop,
      darkFromStart,
      topCap: getComputedStyle(main, '::before').display,
      scrollY: window.scrollY,
      skipOpacity: skip && document.activeElement !== skip ? getComputedStyle(skip).opacity : null,
    };
  });
  assert.equal(state.oldSamples, 0, 'opaque edge samplers must not return');
  assert.deepEqual(state.guards.map((guard) => guard.side), ['top', 'bottom']);
  const stray = state.tintingLayers.filter((layer) => !(state.panelOpen && layer.background === 'rgb(24, 24, 27)' && (!layer.backdrop || layer.backdrop === 'none')));
  assert.deepEqual(stray, [], `a viewport-sized fixed layer would colour Safari's bars: ${JSON.stringify(state)}`);
  // Hydration keeps the exported server style, so this fails if the colour comes back through inline style.
  assert.ok(state.fluidBackground === null || state.fluidBackground === 'rgba(0, 0, 0, 0)', JSON.stringify(state));
  for (const guard of state.guards) {
    assert.equal(guard.position, 'sticky', JSON.stringify(state));
    assert.equal(guard.background, 'rgba(0, 0, 0, 0)', JSON.stringify(state));
    assert.equal(guard.image, 'none');
    assert.notEqual(guard.clip, 'text', 'opaque backgrounds must not be disguised with text clipping');
    // WebKit repeats its edge search with a pointer-events:none guard skipped, so the guard would not decide anything.
    assert.equal(guard.pointerEvents, 'auto', JSON.stringify(state));
    // WebKit samples the middle of each edge; the corners stay open to taps (the phone menu needs them).
    assert.ok(guard.left <= state.viewport.width / 2 - 4 && guard.right >= state.viewport.width / 2 + 4, JSON.stringify(state));
    assert.ok(guard.left >= 8 && guard.right <= state.viewport.width - 8, JSON.stringify(state));
    assert.equal(guard.border, '0px');
    assert.equal(guard.shadow, 'none');
    assert.equal(guard.empty, true);
    assert.equal(guard.hidden, 'true');
  }
  assert.ok(state.art && state.art.top <= -100 && state.art.bottom >= state.viewport.height + 100, `the artwork must continue under the bars: ${JSON.stringify(state)}`);
  assert.equal(state.edgeTop, state.scrollY >= Math.min(480, state.darkFromStart) ? 'open' : 'closed', JSON.stringify(state));
  assert.equal(state.topCap, state.edgeTop === 'open' ? 'none' : 'block', JSON.stringify(state));
  assert.ok(state.skipOpacity === null || state.skipOpacity === '0', `the parked skip link shows under the status bar: ${JSON.stringify(state)}`);
  assert.ok(Math.abs(state.before.height - state.without.height) < 2, JSON.stringify(state));
  assert.ok(Math.abs(state.before.top - state.without.top) < 2, JSON.stringify(state));
  assert.ok(state.guards[0].top >= -3 && state.guards[0].top <= 1, JSON.stringify(state));
  assert.ok(state.guards[1].bottom >= state.viewport.height - 7 && state.guards[1].bottom <= state.viewport.height + 3, JSON.stringify(state));
  return state;
}

async function navigationState(page) {
  return page.evaluate(() => {
    const describe = (element) => {
      if (!element) return null;
      const { x, y, width, height, top, bottom } = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        rect: { x, y, width, height, top, bottom },
        transform: style.transform,
        height: style.height,
        opacity: style.opacity,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
      };
    };
    const main = document.querySelector('main');
    const heading = main?.querySelector('h1');
    return {
      url: location.href,
      mode: document.documentElement.dataset.scrollMode,
      scrollY: window.scrollY,
      mainScrollTop: main?.scrollTop,
      documentHeight: document.scrollingElement.scrollHeight,
      viewport: { width: innerWidth, height: innerHeight },
      main: describe(main),
      layout: describe(document.querySelector('#layout')),
      heading: { text: heading?.textContent, ...describe(heading) },
      sameDocument: window.__allCoursesNavigation === true,
    };
  });
}

async function checkAllCoursesNavigation(context, motion, scenario = 'stable') {
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  const documentRequests = [];
  const entry = { route: 'desk -> courses', motion, scenario, pass: false };
  const screenshotName = `${motion}-all-courses-${scenario}`;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure() }));
  try {
    await page.goto(base);
    await ready(page);
    await page.evaluate(() => { window.__allCoursesNavigation = true; });
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests.push(request.url());
    });

    // This is the pill below the last stacked card, not a menu link or direct entry.
    const allCourses = page.getByRole('link', { name: 'ALL COURSES', exact: true });
    if (scenario === 'revisit-viewport') {
      await allCourses.scrollIntoViewIfNeeded();
      await allCourses.tap();
      await page.waitForURL(`${base}courses/`);
      await page.getByRole('heading', { level: 1, name: 'All Courses', exact: true }).waitFor();
      await ready(page);
      await page.goBack();
      await page.waitForURL(base);
      await allCourses.waitFor();
      await ready(page);
    }
    await allCourses.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.scrollY > innerHeight);
    entry.before = await navigationState(page);

    if (scenario !== 'stable') {
      if (scenario === 'revisit-viewport') {
        const viewport = page.viewportSize();
        await page.exposeFunction('__changeCourseViewport', () => page.setViewportSize({ width: viewport.width, height: viewport.height - 100 }));
      }
      await page.evaluate((kind) => {
        // Observe the real incoming route. No Lenis or production helper is invoked.
        // The injected native scroll models a late browser adjustment; it is a
        // resilience check, not a reproduction of Safari's physical browser chrome.
        // Native iOS now fades the full-size page without a loader card. Use
        // the route's actual scroll lock to inject during either choreography.
        // Delayed loading feedback deliberately ends before cosmetic entry.
        const entryActive = () => document.querySelector('.lenis-stopped') !== null;
        const observer = new MutationObserver(() => {
          if (document.querySelector('main h1')?.textContent !== 'All Courses' || !entryActive()) return;
          observer.disconnect();
          const adjustment = { kind, triggered: true, before: { scrollY, height: innerHeight, duringEntry: entryActive() } };
          window.__allCoursesEntryAdjustment = adjustment;
          const complete = () => {
            adjustment.after = { scrollY, height: innerHeight, duringEntry: entryActive() };
            adjustment.completed = true;
          };
          if (kind === 'revisit-viewport') window.__changeCourseViewport().then(complete);
          else {
            window.scrollTo({ top: Math.min(innerHeight, document.scrollingElement.scrollHeight - innerHeight), behavior: 'instant' });
            complete();
          }
        });
        observer.observe(document.querySelector('main'), { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
      }, scenario);
    }

    await allCourses.tap();
    await page.waitForURL(`${base}courses/`);
    await page.getByRole('heading', { level: 1, name: 'All Courses', exact: true }).waitFor();
    if (scenario !== 'stable') {
      await page.waitForFunction(() => window.__allCoursesEntryAdjustment?.completed, null, { timeout: 5000 });
      entry.adjustment = await page.evaluate(() => window.__allCoursesEntryAdjustment);
      assert.equal(entry.adjustment.before.duringEntry, true, 'the adjustment must begin during route entry');
      assert.equal(entry.adjustment.after.duringEntry, true, 'the adjustment must complete before route entry finishes');
      if (scenario === 'revisit-viewport') {
        assert.notEqual(entry.adjustment.after.height, entry.adjustment.before.height, 'the viewport must really change during entry');
      } else {
        assert.ok(entry.adjustment.after.scrollY > 100, 'the injected native scroll must really move the document');
      }
    }
    await ready(page);
    // Let the browser commit geometry after route motion and transform cleanup.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    entry.after = await navigationState(page);

    assert.equal(entry.after.sameDocument, true, 'All courses must use the client-side route transition');
    assert.deepEqual(documentRequests, [], 'All courses must not reload the document');
    assert.equal(entry.after.mode, 'document');
    assert.ok(entry.after.scrollY <= 8, `All courses must start at the top: ${JSON.stringify(entry.after)}`);
    assert.equal(entry.after.mainScrollTop, 0, 'the native document remains the only scroll owner');
    assert.ok(entry.after.heading.rect.top >= -1 && entry.after.heading.rect.bottom <= entry.after.viewport.height,
      `the All Courses heading must be visible on arrival: ${JSON.stringify(entry.after)}`);

    const firstCourse = page.locator(`main a[href="${basePath}/cen100/"]`).first();
    const card = await firstCourse.boundingBox();
    assert.ok(card && card.y >= 0 && card.y < entry.after.viewport.height,
      `the first course must be visible on arrival: ${JSON.stringify({ card, after: entry.after })}`);
    await page.screenshot({ path: path.join(report, `${screenshotName}.png`) });
    await firstCourse.click({ trial: true });
    assert.deepEqual(errors, [], JSON.stringify({ motion, failedRequests }));
    entry.pass = true;
    console.log('PASS', motion, scenario, 'All courses from the bottom of the Desk');
  } catch (error) {
    entry.error = error.message;
    if (scenario !== 'stable') entry.adjustment = await page.evaluate(() => window.__allCoursesEntryAdjustment).catch(() => null);
    entry.failureState = await navigationState(page).catch((captureError) => ({ error: captureError.message }));
    await page.screenshot({ path: path.join(report, `${screenshotName}-failure.png`) }).catch(() => {});
    navigationFailures.push(`${motion} ${scenario}: ${error.message}`);
    console.error('FAIL', motion, scenario, 'All courses from the bottom of the Desk', JSON.stringify(entry));
  } finally {
    results.push({ ...entry, errors, failedRequests, documentRequests });
    await page.close();
  }
}

// iPad (and a landscape iPhone) opens Menu and Search through the shell that
// shrinks the page. A transformed main holds its fixed paper caps, which would
// then frame the shrunk page instead of covering the reach under Safari's bars.
async function checkShrunkPage(context, motion) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const caps = () =>
    page.evaluate(() => {
      const main = document.querySelector('main');
      return {
        mode: document.documentElement.dataset.scrollMode,
        width: innerWidth,
        shrunk: 'pageShrunk' in document.documentElement.dataset,
        edgeTop: document.documentElement.dataset.edgeTop,
        topCap: getComputedStyle(main, '::before').display,
        transform: getComputedStyle(main).transform,
      };
    });
  try {
    await page.goto(base);
    await ready(page);
    const atTop = await caps();
    assert.deepEqual([atTop.mode, atTop.shrunk, atTop.edgeTop, atTop.topCap], ['document', false, 'closed', 'block'], JSON.stringify(atTop));
    assert.ok(atTop.width >= 812, `the shell shrinks the page only from 812px: ${JSON.stringify(atTop)}`);
    await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
    await page.getByRole('button', { name: 'Close menu', exact: true }).waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).transform !== 'none');
    const open = await caps();
    assert.deepEqual([open.shrunk, open.topCap], [true, 'none'], JSON.stringify(open));
    await page.getByRole('button', { name: 'Close menu', exact: true }).tap();
    await page.waitForFunction(() => !('pageShrunk' in document.documentElement.dataset));
    await ready(page);
    const closed = await caps();
    assert.deepEqual([closed.topCap, closed.transform], ['block', 'none'], JSON.stringify(closed));
    // Leaving from the open menu: the route entry restores main, not the shell.
    await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
    await page.getByRole('button', { name: 'Close menu', exact: true }).waitFor();
    await page.waitForFunction(() => 'pageShrunk' in document.documentElement.dataset);
    await page.locator('#menu').getByRole('link', { name: 'CEN100', exact: true }).click();
    await page.waitForURL(`${base}cen100/`);
    await ready(page);
    const landed = await caps();
    assert.deepEqual([landed.shrunk, landed.edgeTop, landed.topCap, landed.transform], [false, 'closed', 'block', 'none'], JSON.stringify(landed));
    assert.deepEqual(errors, [], JSON.stringify({ motion, errors }));
    results.push({ route: 'iPad menu', motion, pass: true, atTop, open, closed, landed });
    console.log('PASS', motion, 'iPad menu shrinks the page without its paper caps');
  } catch (error) {
    await page.screenshot({ path: path.join(report, `${motion}-ipad-menu-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}

try {
  browser = await webkit.launch({ headless: true });
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ ...devices['iPad Pro 11'], reducedMotion: motion });
    try {
      await checkShrunkPage(context, motion);
    } finally {
      await context.close();
    }
  }
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: motion });
    try {
      await checkAllCoursesNavigation(context, motion);
      if (motion === 'no-preference') {
        await checkAllCoursesNavigation(context, motion, 'revisit-viewport');
        await checkAllCoursesNavigation(context, motion, 'late-native-scroll-fault-injection');
      }
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
          // A diagonal swipe must not expose the artwork beside a shifted page.
          // Native scrollTo also exercises focus/history scrolling into overflow
          // that overflow-x:hidden alone can leave programmatically reachable.
          await page.evaluate(() => window.scrollTo({ left: innerWidth * 0.6, top: 0, behavior: 'instant' }));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const horizontal = await page.evaluate(() => {
            const main = document.querySelector('main').getBoundingClientRect();
            return { x: scrollX, width: innerWidth, contentWidth: document.scrollingElement.scrollWidth, left: main.left, right: main.right };
          });
          await page.screenshot({ path: path.join(report, `${motion}-${route.replaceAll('/', '') || 'desk'}-horizontal.png`) });
          assert.ok(horizontal.contentWidth <= horizontal.width + 1 && Math.abs(horizontal.x) < 1 && Math.abs(horizontal.left) < 1 && Math.abs(horizontal.right - horizontal.width) < 1,
            `the document stays full width without a sideways scroll range: ${JSON.stringify(horizontal)}`);
          if (motion === 'no-preference' && await page.locator('[data-companion-statement]').count()) {
            for (const fraction of [0.15, 0.65, 1, 0.35, 0.85]) {
              await page.evaluate(fraction => {
                const section = document.querySelector('[data-companion-statement]');
                const top = scrollY + section.getBoundingClientRect().top - innerHeight + section.offsetHeight * fraction;
                window.scrollTo({ left: innerWidth * 0.6, top, behavior: 'instant' });
              }, fraction);
              await page.waitForTimeout(250);
              const duringReveal = await page.evaluate(() => ({ x: scrollX, width: innerWidth, contentWidth: document.scrollingElement.scrollWidth, left: document.querySelector('main').getBoundingClientRect().left }));
              assert.ok(duringReveal.contentWidth <= duringReveal.width + 1 && Math.abs(duringReveal.x) < 1 && Math.abs(duringReveal.left) < 1,
                `the animated statement cannot shift the page sideways at ${fraction}: ${JSON.stringify(duringReveal)}`);
            }
            await page.screenshot({ path: path.join(report, `${route.replaceAll('/', '') || 'desk'}-reveal-width.png`) });
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForFunction(() => scrollY === 0);
          }
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
          // Safari fills past the page's ends and under its bottom bar with the
          // document's background: the grained paper, and the footer's ink at a dark end.
          const fill = () => page.evaluate(() => ({ colour: getComputedStyle(document.documentElement).backgroundColor, bottom: document.documentElement.dataset.browserBottom, scrollY }));
          const endsDark = await page.evaluate(() => !!document.querySelector('main footer [data-surface="dark"]'));
          await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
          await page.waitForFunction((dark) => document.documentElement.dataset.browserBottom === (dark ? 'dark' : 'light'), endsDark, { timeout: 3000 });
          const fillAtEnd = await fill();
          assert.equal(fillAtEnd.colour, endsDark ? 'rgb(24, 24, 27)' : 'rgb(241, 241, 241)', JSON.stringify({ route, fillAtEnd }));
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForFunction(() => scrollY === 0 && document.documentElement.dataset.browserBottom === 'light', null, { timeout: 3000 });
          const fillAtTop = await fill();
          assert.equal(fillAtTop.colour, 'rgb(241, 241, 241)', JSON.stringify({ route, fillAtTop }));
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
          results.push({ route, motion, pass: true, initial, edgesAtTop, edgesAfterScroll, fillAtEnd, fillAtTop });
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
assert.equal(navigationFailures.length, 0, navigationFailures.join('\n'));

