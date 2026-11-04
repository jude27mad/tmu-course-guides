// Browser check for the opt-in browser-scrolled page (?scroll=fast; see src/pages/_document.page.jsx).
// Without the link the page is exactly today's (main overflow:hidden). With it, main is a real scroller that
// Lenis still drives, and input that scrolls nothing today still scrolls nothing: keys on a focused button,
// Ctrl+End, a wheel over the Schedule calendar, middle-click autoscroll; the menu still locks the page;
// touch swipes still go to Lenis (no native pan, no pointercancel for the fluid trail).
//
// Usage, after the production export in site/out:
//   PLAYWRIGHT_PATH=/path/to/node_modules/playwright QA_REPORT_DIR=<dir> node scripts/check-scroll-trial.mjs
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
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-scroll-trial';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = (route) => `http://127.0.0.1:${server.address().port}${basePath}/${route}`;
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM_PATH || undefined });
const results = [];

async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, ok: true, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.stack || String(error) });
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

async function open({ mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors };
}

// Poll from Node: the site's CSP blocks page.waitForFunction's eval in older Chromium.
async function until(page, predicate, argument, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate, argument)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out: ${predicate.toString()}`);
}

async function ready(page, route) {
  await page.goto(url(route));
  await page.locator('main h1').first().waitFor();
  // the loader has finished and Lenis is running (it unlocks main)
  await until(page, () => {
    const main = document.querySelector('main');
    return main && !main.classList.contains('lenis-stopped') && getComputedStyle(main).pointerEvents !== 'none' && Number(getComputedStyle(main).opacity) > 0.99 && Math.abs(main.getBoundingClientRect().x) < 1;
  });
  await page.waitForTimeout(300);
}

const state = (page) => page.evaluate(() => {
  const main = document.querySelector('main');
  const style = getComputedStyle(main);
  return { trial: document.documentElement.dataset.scrollTrial || null, stored: localStorage.getItem('guide-scroll-trial'), overflowY: style.overflowY, touchAction: style.touchAction, top: main.scrollTop, width: main.clientWidth, viewport: window.innerWidth };
});
const top = (page) => page.evaluate(() => document.querySelector('main').scrollTop);
// Settled scroll position: no change for 300 ms.
async function settled(page) {
  let last = await top(page);
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(150);
    const now = await top(page);
    if (Math.abs(now - last) < 0.5) return now;
    last = now;
  }
  return last;
}

await check('without the link the page is today\'s: main is not user-scrollable', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, '');
    const now = await state(page);
    assert.equal(now.trial, null);
    assert.equal(now.overflowY, 'hidden');
    assert.deepEqual(errors, []);
    return now;
  } finally {
    await context.close();
  }
});

await check('?scroll=fast makes main a real scroller, remembered, with its scrollbar still hidden', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, '?scroll=fast');
    const now = await state(page);
    assert.equal(now.trial, 'fast');
    assert.equal(now.stored, 'fast');
    assert.equal(now.overflowY, 'auto');
    assert.equal(now.touchAction, 'pinch-zoom');
    assert.equal(now.width, now.viewport, 'no scrollbar narrows the page');
    await ready(page, 'courses/');
    assert.equal((await state(page)).trial, 'fast', 'a later page without the link');
    await ready(page, '?scroll=classic');
    const off = await state(page);
    assert.equal(off.trial, null);
    assert.equal(off.stored, null);
    assert.equal(off.overflowY, 'hidden');
    assert.deepEqual(errors, []);
    return { now, off };
  } finally {
    await context.close();
  }
});

await check('with the trial on, the wheel and keys still glide through Lenis, and the menu still locks the page', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, '?scroll=fast');
    // the menu stops Lenis, which locks main (the header hides once the page scrolls, so open it first)
    await page.locator('#menu-button').click();
    await until(page, () => getComputedStyle(document.querySelector('main')).overflowY === 'hidden');
    await page.keyboard.press('Escape');
    await until(page, () => getComputedStyle(document.querySelector('main')).overflowY === 'auto');
    await page.waitForTimeout(600);
    await page.mouse.move(720, 450);
    const start = await top(page);
    const samples = [];
    await page.mouse.wheel(0, 600);
    for (let i = 0; i < 12; i += 1) {
      samples.push(await top(page));
      await page.waitForTimeout(40);
    }
    const afterWheel = await settled(page);
    assert.ok(afterWheel > start + 300, `wheel scrolled ${start} -> ${afterWheel}`);
    assert.ok(new Set(samples.map(Math.round)).size >= 4, `smoothed over several frames: ${samples.map(Math.round)}`);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('ArrowDown');
    const afterArrow = await settled(page);
    assert.ok(Math.abs(afterArrow - afterWheel - 80) < 2, `Arrow Down glides 80 px: ${afterWheel} -> ${afterArrow}`);
    // focus inside main (the skip link, a hash target, a link) keeps Lenis's keys too, not the browser's
    await page.evaluate(() => document.querySelector('main').focus({ preventScroll: true }));
    await page.keyboard.press('ArrowDown');
    const fromMain = await settled(page);
    assert.ok(Math.abs(fromMain - afterArrow - 80) < 2, `Arrow Down from main glides 80 px: ${afterArrow} -> ${fromMain}`);
    await page.evaluate(() => document.querySelector('main a[href]')?.focus({ preventScroll: true }));
    await page.keyboard.press('ArrowDown');
    const fromLink = await settled(page);
    assert.ok(Math.abs(fromLink - fromMain - 80) < 2, `Arrow Down from a link glides 80 px: ${fromMain} -> ${fromLink}`);
    // the usual path: a click on the page's text focuses main (tabindex -1), then Space and Page Down
    const text = await page.evaluate(() => {
      const paragraph = [...document.querySelectorAll('main p')].find((element) => {
        const box = element.getBoundingClientRect();
        return box.top > 120 && box.bottom < window.innerHeight - 40 && box.width > 40 && !element.closest('a, button');
      });
      if (!paragraph) return null;
      const box = paragraph.getBoundingClientRect();
      return { x: box.left + 4, y: box.top + box.height / 2 };
    });
    assert.ok(text, 'a paragraph on screen to click');
    await page.mouse.click(text.x, text.y);
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('main')), true, 'a click on text focuses main');
    const beforeSpace = await settled(page);
    await page.keyboard.press('Space');
    const afterSpace = await settled(page);
    await page.keyboard.press('PageDown');
    const afterPage = await settled(page);
    const page85 = await page.evaluate(() => window.innerHeight * 0.85);
    assert.ok(Math.abs(afterSpace - beforeSpace - page85) < 2, `Space glides 85% of the window: ${beforeSpace} -> ${afterSpace}`);
    assert.ok(Math.abs(afterPage - afterSpace - page85) < 2, `Page Down glides 85% of the window: ${afterSpace} -> ${afterPage}`);
    assert.deepEqual(errors, []);
    return { start, samples, afterWheel, afterArrow };
  } finally {
    await context.close();
  }
});

await check('with the trial on, keys and middle-click that scroll nothing today still scroll nothing', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, 'mth140/?scroll=fast');
    const button = page.getByRole('button', { name: /Guide tools/ }).first();
    await button.focus();
    const before = await settled(page);
    for (const key of ['PageDown', 'End', 'ArrowDown']) {
      await page.keyboard.press(key);
      assert.equal(await settled(page), before, `${key} on a focused button`);
    }
    // with main focused (a click on the page's text focuses it), where the browser's own Ctrl+End would start
    await page.evaluate(() => document.querySelector('main').focus({ preventScroll: true }));
    for (const key of ['Control+End', 'Alt+PageDown']) {
      await page.keyboard.press(key);
      assert.equal(await settled(page), before, `${key} with main focused`);
    }
    assert.deepEqual(errors, []);
    return { before };
  } finally {
    await context.close();
  }
});

await check('with the trial on, Page Down in a text field scrolls nothing, as today', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, 'mth140/?scroll=fast#grades');
    const field = page.locator('main input[type="text"]').first();
    await field.waitFor();
    await field.evaluate((input) => input.focus({ preventScroll: true }));
    const before = await settled(page);
    for (const key of ['PageDown', 'PageUp', 'PageDown']) {
      await page.keyboard.press(key);
      assert.equal(await settled(page), before, `${key} in a text field`);
    }
    await page.keyboard.type('17');
    assert.equal(await field.inputValue(), '17', 'typing still works');
    assert.deepEqual(errors, []);
    return { before };
  } finally {
    await context.close();
  }
});

// Keys in a note or a date field: the same page positions as without the trial, key by key (a caret moved
// out of view is revealed in both), and main unlocked again after each key.
async function fieldKeys(route) {
  const { context, page, errors } = await open();
  try {
    await ready(page, route);
    const seen = [];
    for (const selector of ['main textarea', 'main input[type="date"]']) {
      const field = page.locator(selector).first();
      await field.waitFor();
      await field.scrollIntoViewIfNeeded();
      await page.mouse.move(1300, 450);
      for (let i = 0; i < 20; i += 1) {
        const y = await field.evaluate((element) => element.getBoundingClientRect().top);
        if (y > 300 && y < 600) break;
        await page.mouse.wheel(0, y > 600 ? 200 : -200);
        await settled(page);
      }
      const box = await field.boundingBox();
      await page.mouse.click(box.x + 12, box.y + box.height / 2);
      // (Alt+Down on the date field opens its picker, which would then take the keys meant for the note)
      const keys = selector.includes('date') ? ['PageDown', 'PageUp', 'Home', 'End'] : ['PageDown', 'PageUp', 'Home', 'End', 'Alt+ArrowDown'];
      for (const key of keys) {
        await page.keyboard.press(key);
        const at = Math.round(await settled(page));
        const overflowY = await page.evaluate(() => getComputedStyle(document.querySelector('main')).overflowY);
        seen.push({ selector, key, at, overflowY });
      }
    }
    const note = page.locator('main textarea').first();
    await note.fill('');
    await note.evaluate((element) => element.focus({ preventScroll: true }));
    await page.keyboard.type('line one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('line two');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.type('!');
    return { seen, value: await note.inputValue(), errors };
  } finally {
    await context.close();
  }
}

await check('with the trial on, keys in a note or a date field move the page exactly as today, and the fields still work', async () => {
  const today = await fieldKeys('mth140/#assessment-midterm');
  const trial = await fieldKeys('mth140/?scroll=fast#assessment-midterm');
  trial.seen.forEach((step, index) => {
    const before = today.seen[index];
    assert.ok(Math.abs(step.at - before.at) <= 2, `${step.key} in ${step.selector}: ${before.at} today, ${step.at} with the trial`);
    assert.equal(step.overflowY, 'auto', `main unlocked again after ${step.key}`);
  });
  assert.equal(trial.value, 'line one!\nline two', 'Up still moves the caret in a note');
  assert.equal(trial.value, today.value);
  assert.deepEqual([...today.errors, ...trial.errors], []);
  return { today: today.seen, trial: trial.seen };
});

await check('with the trial on, middle-click does not start the browser\'s autoscroll', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, 'mth140/?scroll=fast');
    const prevented = await page.evaluate(() => {
      const main = document.querySelector('main');
      const target = main.querySelector('h1');
      const event = new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(prevented, true, 'middle-click autoscroll is cancelled');
    assert.deepEqual(errors, []);
    return { prevented };
  } finally {
    await context.close();
  }
});

await check('with the trial on, Guide tools and page changes still lock the page while they run', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, 'mth140/?scroll=fast');
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 500);
    const before = await settled(page);
    await page.getByRole('button', { name: /Guide tools/ }).first().evaluate((button) => button.click());
    await page.locator('#guide-tools[open]').waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('main')).overflowY), 'hidden', 'locked behind Guide tools');
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#guide-tools[open]') && getComputedStyle(document.querySelector('main')).overflowY === 'auto');
    assert.equal(await settled(page), before, 'the reader stays where they were');
    // a page change: the old page leaves and the new one arrives with main locked, then unlocked at the top
    const sawLock = page.evaluate(() => new Promise((resolve) => {
      const main = document.querySelector('main');
      const observer = new MutationObserver(() => {
        if (main.classList.contains('lenis-stopped') && getComputedStyle(main).overflowY === 'hidden') { observer.disconnect(); resolve(true); }
      });
      observer.observe(main, { attributes: true, attributeFilter: ['class'] });
      setTimeout(() => resolve(false), 8000);
    }));
    await page.evaluate(() => document.querySelector('a[href$="/mth141/"]')?.click());
    assert.equal(await sawLock, true, 'main locks for the page change');
    await page.waitForURL(/\/mth141\/$/);
    await until(page, () => { const main = document.querySelector('main'); return !main.classList.contains('lenis-stopped') && getComputedStyle(main).overflowY === 'auto'; });
    assert.ok((await settled(page)) <= 8, 'the new page starts at the top');
    assert.deepEqual(errors, []);
    return { before };
  } finally {
    await context.close();
  }
});

await check('with the trial on, a wheel over the Schedule calendar does not scroll the page', async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, 'mth140/?scroll=fast#schedule');
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const calendar = page.locator('[data-course-calendar]');
    await page.locator('.sx__calendar').waitFor();
    await calendar.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await calendar.boundingBox();
    // points over the calendar's toolbar and its body, each checked to be inside the region Lenis leaves alone
    const points = [[box.x + 24, box.y + 18], [box.x + box.width / 2, box.y + Math.min(box.height - 20, 260)]];
    const seen = [];
    for (const [x, y] of points) {
      const where = await page.evaluate(([px, py]) => {
        const element = document.elementFromPoint(px, py);
        const scrollers = [];
        for (let node = element; node && node.tagName !== 'MAIN'; node = node.parentElement) {
          const { overflowY } = getComputedStyle(node);
          if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) scrollers.push(node.className || node.tagName);
        }
        return { inRegion: !!element?.closest('[data-lenis-prevent]'), tag: element?.tagName, className: String(element?.className || '').slice(0, 60), scrollers };
      }, [x, y]);
      assert.ok(where.inRegion, `point ${x},${y} is over the calendar: ${JSON.stringify(where)}`);
      await page.mouse.move(x, y);
      for (const delta of [400, 400, 400, -400, -400, -400, 400]) {
        const before = await settled(page);
        await page.mouse.wheel(0, delta);
        const after = await settled(page);
        seen.push({ ...where, delta, before, after });
        assert.equal(after, before, `wheel ${delta} at ${x},${y} moved the page ${before} -> ${after}: ${JSON.stringify(where)}`);
      }
    }
    // the wheel guard itself (Chromium's overscroll containment alone already holds the points above)
    const wired = await page.evaluate(() => {
      const target = document.querySelector('[data-course-calendar] button') || document.querySelector('[data-course-calendar]');
      const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return { prevented: event.defaultPrevented, tag: target.tagName };
    });
    assert.equal(wired.prevented, true, `a wheel the calendar cannot take is cancelled: ${JSON.stringify(wired)}`);
    await page.screenshot({ path: path.join(report, 'calendar-wheel.png') });
    assert.deepEqual(errors, []);
    return seen;
  } finally {
    await context.close();
  }
});

await check('with the trial on, a phone swipe still goes to Lenis: no native pan and no pointercancel', async () => {
  const { context, page, errors } = await open({ mobile: true });
  try {
    await ready(page, '?scroll=fast');
    await page.evaluate(() => {
      window.__swipe = { moves: 0, cancels: 0 };
      const main = document.querySelector('main');
      main.addEventListener('pointermove', () => { window.__swipe.moves += 1; });
      main.addEventListener('pointercancel', () => { window.__swipe.cancels += 1; });
    });
    const cdp = await context.newCDPSession(page);
    const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
    const before = await top(page);
    await touch('touchStart', 700);
    for (let k = 1; k <= 12; k += 1) {
      await touch('touchMove', 700 - k * 40);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    const after = await settled(page);
    const swipe = await page.evaluate(() => window.__swipe);
    assert.ok(after > before + 300, `swiped ${before} -> ${after}`);
    assert.equal(swipe.cancels, 0, 'the browser never took the gesture');
    assert.ok(swipe.moves >= 10, `the fluid trail saw the moves (${swipe.moves})`);
    assert.equal((await state(page)).touchAction, 'pinch-zoom');
    assert.deepEqual(errors, []);
    return { before, after, swipe };
  } finally {
    await context.close();
  }
});

await check('with the trial on, a two-finger pan does not scroll the page natively, and one finger still does', async () => {
  const { context, page, errors } = await open({ mobile: true });
  try {
    await ready(page, '?scroll=fast');
    const cdp = await context.newCDPSession(page);
    const two = (y) => [{ id: 0, x: 150, y, radiusX: 5, radiusY: 5 }, { id: 1, x: 240, y, radiusX: 5, radiusY: 5 }];
    const before = await settled(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: two(700) });
    for (let k = 1; k <= 10; k += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: two(700 - k * 30) });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [two(400)[0]] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const afterTwo = await settled(page);
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    assert.equal(afterTwo, before, `two fingers moved main ${before} -> ${afterTwo}`);
    assert.equal(await page.evaluate(() => document.querySelector('main').hasAttribute('data-multitouch')), false, 'the lock ends with the gesture');
    const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
    await touch('touchStart', 700);
    for (let k = 1; k <= 12; k += 1) {
      await touch('touchMove', 700 - k * 40);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    const afterOne = await settled(page);
    assert.ok(afterOne > afterTwo + 300, `one finger still scrolls: ${afterTwo} -> ${afterOne}`);
    assert.deepEqual(errors, []);
    return { before, afterTwo, afterOne };
  } finally {
    await context.close();
  }
});

await check('with the trial on, a two-finger gesture that starts or ends on the header locks and then frees the page', async () => {
  const { context, page, errors } = await open({ mobile: true });
  try {
    await ready(page, '?scroll=fast');
    const cdp = await context.newCDPSession(page);
    const header = await page.evaluate(() => { const element = document.elementFromPoint(30, 40); return !!element && !element.closest('main'); });
    assert.ok(header, 'the point 30,40 is outside main (the header)');
    const page0 = (dy) => ({ id: 0, x: 195, y: 500 + dy, radiusX: 5, radiusY: 5 });
    const head1 = (dy) => ({ id: 1, x: 30, y: 40 + dy, radiusX: 5, radiusY: 5 });
    const seen = [];
    for (const order of ['page-first', 'header-first']) {
      const before = await settled(page);
      const first = order === 'page-first' ? page0 : head1;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first(0)] });
      await page.waitForTimeout(30);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [head1(0), page0(0)] });
      const locked = await page.evaluate(() => document.querySelector('main').hasAttribute('data-multitouch'));
      for (let k = 1; k <= 7; k += 1) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [head1(-k * 5), page0(-k * 5)] });
        await page.waitForTimeout(20);
      }
      // lift the page finger first, then the header finger
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [head1(-35)] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const after = await settled(page);
      const end = await page.evaluate(() => ({ flag: document.querySelector('main').hasAttribute('data-multitouch'), overflowY: getComputedStyle(document.querySelector('main')).overflowY }));
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      seen.push({ order, locked, before, after, end });
      assert.equal(locked, true, `${order}: locked while two fingers are down`);
      assert.equal(after, before, `${order}: two fingers moved main ${before} -> ${after}`);
      assert.deepEqual(end, { flag: false, overflowY: 'auto' }, `${order}: freed when the last finger lifts`);
    }
    assert.deepEqual(errors, []);
    return seen;
  } finally {
    await context.close();
  }
});

await check('with motion off the trial changes nothing: native scrolling as today', async () => {
  const { context, page, errors } = await open({ mobile: true });
  try {
    await ready(page, '?scroll=fast&motion=off');
    const now = await state(page);
    assert.equal(now.overflowY, 'auto');
    assert.equal(now.touchAction, 'auto', 'native touch scrolling with motion off');
    assert.deepEqual(errors, []);
    return now;
  } finally {
    await context.close();
  }
});

await browser.close();
server.close();
await writeFile(path.join(report, 'scroll-trial.json'), JSON.stringify(results, null, 2));
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`${failed.length} scroll trial check(s) failed`);
  process.exit(1);
}
