/** Focused course views: production-export browser checks. Browser emulation, not real-device testing. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';
import { createProgress, deadlines, nextDeadline, setSection } from '../src/lib/index.js';
import { memoryStorage } from '../tests/helpers.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = process.env.QA_REPORT_DIR || '/tmp/tmu-course-views-qa';
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${basePath}/`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.QA_CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const results = [];
async function check(name, run) {
  if (process.env.QA_MATCH && !name.includes(process.env.QA_MATCH)) return;
  try {
    const detail = await run();
    results.push({ name, pass: true, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    const search = await page.evaluate(() => {
      const panel = document.getElementById('search');
      if (!panel) return null;
      return {
        hidden: panel.getAttribute('aria-hidden'),
        visibility: getComputedStyle(panel).visibility,
        inert: panel.inert,
        inputActive: document.activeElement?.id === 'search-input',
      };
    }).catch(() => null);
    results.push({ name, pass: false, error: error.message, url: page.url(), search });
    console.error(`FAIL ${name}: ${error.message}`);
    await page.screenshot({ path: path.join(report, `failure-${name.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => {});
  }
}
async function ready(page, route = 'cen100/') {
  await page.goto(url + route);
  await page.locator('main h1').first().waitFor();
  await page.locator('#course-section:not(:disabled)').waitFor();
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return getComputedStyle(main).pointerEvents === 'auto' && (!main.classList.contains('lenis-stopped') || document.querySelector('dialog[open]'));
  });
  await page.waitForTimeout(700);
}
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-23T16:00:00Z'));
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('BROWSER', message.text());
});
try {
  await check('compact opening exposes navigation and first assignment in one screen', async () => {
    await ready(page);
    await page.getByRole('navigation', { name: 'Course views' }).waitFor();
    const box = await page.locator('[data-assignment-link]').first().boundingBox();
    assert.ok(box && box.y + box.height < 844, JSON.stringify(box));
    assert.equal(await page.locator('[data-course-badge="cen100"]').count(), 1);
    assert.equal(await page.locator('[data-course-artwork], img[src*="images/courses"]').count(), 0);
    await page.locator('[data-badge-instance="header-cen100"][data-badge-rendered="true"]').waitFor();
    await page.screenshot({ path: path.join(report, 'cen100-work-390.png') });
    return { firstAssignmentBottom: box.y + box.height };
  });
  await check('singleton badges retain real bodies when motion pauses and resumes', async () => {
    for (const course of ['mth140', 'mth141']) {
      await ready(page, `${course}/`);
      await page.locator(`[data-badge-instance="header-${course}"][data-badge-rendered="true"]`).waitFor();
      // Inspect the existing provider from this isolated test page, without a
      // production debug global or a separate demo world.
      await page.evaluate(() => {
        const element = document.querySelector('[data-course-badge]');
        let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
        while (fiber && !fiber.memoizedProps?.value?.register) fiber = fiber.return;
        window.badgeRegistry = fiber?.memoizedProps.value;
        if (!window.badgeRegistry) throw new Error('Badge provider not found');
        const entries = window.badgeRegistry.getState().entries;
        if (entries.length !== 1) throw new Error(`Expected one badge, saw ${entries.length}`);
        window.badgeBodies = ['fixed', 'j1', 'j2', 'j3', 'card'].map(key => entries[0].body[key].current);
        if (new Set(window.badgeBodies).size !== 5 || window.badgeBodies.some(body => !body?.isValid())) throw new Error('Expected five live Rapier bodies');
      });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => document.documentElement.dataset.motion === 'on');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.documentElement.dataset.motion === 'off');
      assert.ok(await page.evaluate(() => ['fixed', 'j1', 'j2', 'j3', 'card'].every((key, i) => window.badgeRegistry.getState().entries[0].body[key].current === window.badgeBodies[i])), 'Pause must not replace the bodies');
      const before = await page.evaluate(() => window.badgeBodies[4].translation());
      await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(() => window.badgeBodies[4].translation()), before, 'paused pose stays fixed');
      await page.screenshot({ path: path.join(report, `${course}-singleton-paused.png`) });
      await page.evaluate(() => window.badgeRegistry.unregister(window.badgeRegistry.getState().entries[0].id));
      await page.waitForFunction(() => window.badgeRegistry.getState().entries.length === 0 && window.badgeBodies.every(body => {
        // The final View also frees the WASM world: Rapier then throws instead
        // of returning false from an old body's isValid(). Both mean disposed.
        try { return !body.isValid(); }
        catch (error) { if (error.message === 'null pointer passed to rust') return true; throw error; }
      }));
      await page.locator('[data-badge-fallback]').waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(report, `${course}-last-view-removed.png`) });
    }
  });
  await check('Desk badge follows cross-course Mark done and Undo with slow textures', async () => {
    let fixture;
    for (let day = 0; day < 90 && !fixture; day++) {
      const now = new Date(Date.UTC(2026, 8, 1 + day, 16));
      const storage = memoryStorage();
      ['cen100', 'mth140', 'mth141'].forEach(course => setSection(course, 3, storage));
      const progress = createProgress(storage, { events: null });
      for (let step = 0; step < 100; step++) {
        const from = nextDeadline({ now, storage });
        if (!from?.markable) break;
        const initial = Object.fromEntries(storage.data);
        progress.markDone(from.courseId, from.id);
        const to = nextDeadline({ now, storage });
        if (to && to.courseId !== from.courseId) { fixture = { now: now.toISOString(), initial, from, to }; break; }
      }
      progress.dispose?.();
    }
    assert.ok(fixture, 'the published dates supply a cross-course completion transition');
    const deskContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      const desk = await deskContext.newPage();
      desk.on('pageerror', error => errors.push(error.message));
      await desk.clock.setFixedTime(new Date(fixture.now));
      await desk.addInitScript(initial => {
        for (const [key, value] of Object.entries(initial)) localStorage.setItem(key, value);
        const load = document.fonts.load.bind(document.fonts);
        document.fonts.load = async (...args) => {
          const result = await load(...args);
          if (window.holdBadgeFonts) await window.holdBadgeFonts;
          return result;
        };
      }, fixture.initial);
      await desk.goto(url);
      const badge = desk.locator('[data-badge-instance="desk-next"]');
      const courseLink = desk.locator('[data-desk-course-link]');
      const assertCourseLink = async (courseId) => {
        assert.equal(await courseLink.count(), 1);
        assert.equal(await courseLink.getAttribute('href'), `${basePath}/${courseId}/`);
        assert.equal(await courseLink.getAttribute('aria-label'), `Open ${courseId.toUpperCase()} course guide`);
        assert.equal(await courseLink.locator('[data-course-badge]').getAttribute('data-course-badge'), courseId);
      };
      const captureBadge = async (name) => {
        await badge.scrollIntoViewIfNeeded();
        let light = 0;
        for (let attempt = 0; attempt < 12; attempt++) {
          // Scrolling the DOM window and drawing the shared canvas are separate
          // frames. Require actual printed badge pixels before capturing it.
          await desk.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const png = await badge.screenshot({ path: path.join(report, `${name}-badge.png`) });
          light = await desk.evaluate(async base64 => {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
            const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0;
            for (let y = Math.ceil(canvas.height * 0.1); y < canvas.height * 0.9; y++) {
              for (let x = Math.ceil(canvas.width * 0.1); x < canvas.width * 0.9; x++) {
                const i = (y * canvas.width + x) * 4;
                if (Math.min(data[i], data[i + 1], data[i + 2]) > 150) count++;
              }
            }
            bitmap.close(); return count;
          }, png.toString('base64'));
          if (light > 30) break;
          await desk.waitForTimeout(150);
        }
        const pose = await badge.evaluate(element => {
          let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
          while (fiber && !fiber.memoizedProps?.value?.register) fiber = fiber.return;
          const entry = fiber?.memoizedProps.value.getState().entries.find(entry => entry.id === 'desk-next');
          return { visible: entry?.visible, position: entry?.body.card.current?.translation(), rendered: element.dataset.badgeRendered };
        });
        assert.ok(light > 30, `badge face must be drawn, not just flagged ready: ${JSON.stringify({ light, pose })}`);
        await desk.screenshot({ path: path.join(report, `${name}.png`) });
      };

      await badge.scrollIntoViewIfNeeded();
      await badge.locator('[data-badge-fallback]').waitFor({ state: 'hidden' });
      assert.equal(await badge.getAttribute('data-course-badge'), fixture.from.courseId);
      await assertCourseLink(fixture.from.courseId);
      await desk.evaluate(() => { window.holdBadgeFonts = new Promise(resolve => { window.releaseBadgeFonts = resolve; }); });
      await desk.locator('[aria-labelledby="desk-next-heading"]').getByRole('button', { name: /Mark.*done/i }).click();
      await desk.waitForFunction(course => document.querySelector('[data-badge-instance="desk-next"]')?.dataset.courseBadge === course, fixture.to.courseId);
      assert.equal(await badge.count(), 1);
      await assertCourseLink(fixture.to.courseId);
      await badge.locator('[data-badge-fallback]').waitFor({ state: 'visible' });
      assert.match(await badge.textContent(), new RegExp(fixture.to.courseId, 'i'));
      await desk.screenshot({ path: path.join(report, 'desk-next-course-texture-loading.png') });
      await desk.evaluate(() => { window.releaseBadgeFonts(); window.holdBadgeFonts = null; });
      await badge.locator('[data-badge-fallback]').waitFor({ state: 'hidden' });
      await captureBadge('desk-next-course-after-done');
      await desk.getByRole('button', { name: 'UNDO', exact: true }).click();
      await desk.waitForFunction(course => document.querySelector('[data-badge-instance="desk-next"]')?.dataset.courseBadge === course, fixture.from.courseId);
      await badge.locator('[data-badge-fallback]').waitFor({ state: 'hidden' });
      await captureBadge('desk-next-course-after-undo');
      await assertCourseLink(fixture.from.courseId);
      const emptyStorage = memoryStorage(fixture.initial);
      const emptyProgress = createProgress(emptyStorage, { events: null });
      for (const course of ['cen100', 'mth140', 'mth141']) {
        for (const item of deadlines(course, { now: new Date('2099-01-01T12:00:00Z'), storage: emptyStorage })) {
          if (item.markable) emptyProgress.markDone(course, item.id);
        }
      }
      await desk.evaluate(values => {
        for (const [key, value] of Object.entries(values)) {
          localStorage.setItem(key, value);
          window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: localStorage }));
        }
      }, Object.fromEntries(emptyStorage.data));
      emptyProgress.dispose?.();
      await desk.clock.setFixedTime(new Date('2099-01-01T12:00:00Z'));
      await desk.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await desk.locator('[aria-labelledby="desk-next-heading"]').getByText('No upcoming deadlines', { exact: true }).waitFor();
      assert.equal(await badge.count(), 0);
      assert.equal(await desk.locator('[class*="about_imageContainer"]').count(), 0);
      await desk.screenshot({ path: path.join(report, 'desk-no-upcoming.png') });
    } finally { await deskContext.close(); }
    return { from: fixture.from.courseId, to: fixture.to.courseId, date: fixture.now };
  });
  await check('assignment is a single detail, Back restores filter', async () => {
    await page.getByRole('button', { name: /^All \(/ }).click();
    await page.locator('[data-assignment-link]').first().click();
    await page.locator('[data-assignment-detail]').waitFor();
    assert.equal(await page.locator('[data-assignment-link]').count(), 0);
    await page
      .getByRole('button', { name: /Back to / })
      .first()
      .click();
    await page.getByRole('button', { name: /^All \(/, pressed: true }).waitFor();
  });

  await check('note, target and checklist survive immediate navigation and reload', async () => {
    await ready(page, 'cen100/#assignment-m2');
    await page.locator('[data-assignment-detail]').waitFor();
    await page.locator('textarea').fill('Check participant roles; keep interview names private.');
    // Same task: navigate before any debounce or blur-based save could run.
    const savedImmediately = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('cen100-personal-plan-v1'));
      document.querySelector('nav[aria-label="Course views"] a[href$="#schedule"]').click();
      return saved.notes.m2;
    });
    assert.equal(savedImmediately, 'Check participant roles; keep interview names private.');
    await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
    await page.goBack();
    await page.locator('textarea').waitFor();
    assert.equal(await page.locator('textarea').inputValue(), savedImmediately);
    await page.locator('input[type=date]').fill('2026-11-01');
    await page.locator('[data-assignment-detail] input[type=checkbox]').first().check({ force: true });
    const before = await page.evaluate(() => ({ plan: localStorage.getItem('cen100-personal-plan-v1'), ticks: localStorage.getItem('cen100-g9-ticks') }));
    assert.ok(JSON.parse(before.ticks)['m2-0-0']);
    assert.deepEqual(JSON.parse(before.plan).completed, {});
    await page.reload();
    await page.locator('textarea').waitFor();
    assert.equal(await page.locator('textarea').inputValue(), savedImmediately);
    assert.equal(await page.locator('input[type=date]').inputValue(), '2026-11-01');
    assert.deepEqual(
      await page.evaluate(() => ({ plan: localStorage.getItem('cen100-personal-plan-v1'), ticks: localStorage.getItem('cen100-g9-ticks') })),
      before,
    );
  });
  await check('multi-submission assignment stays Open until every record is marked', async () => {
    await ready(page, 'cen100/#assignment-y2');
    const records = page.locator('[data-assignment-detail] fieldset input[type=checkbox]');
    assert.equal(await records.count(), 2);
    await records.first().check({ force: true });
    await page.getByRole('navigation', { name: 'Course views' }).getByRole('link', { name: 'Work', exact: true }).click();
    const row = page.locator('#open-assignment-y2');
    await row.waitFor();
    assert.match(await row.innerText(), /1\/2 recorded/);
    await row.click();
    await page.locator('[data-assignment-detail] fieldset input[type=checkbox]').last().check({ force: true });
    await page
      .getByRole('button', { name: /Back to Work/ })
      .first()
      .click();
    assert.equal(await page.locator('#open-assignment-y2').count(), 0);
    await page.getByRole('button', { name: /^Done \(/ }).click();
    await page.locator('#open-assignment-y2').waitFor();
    await page.locator('#open-assignment-y2').click();
    await page.locator('[data-assignment-detail]').waitFor();
  });
  await check('browser Back/Forward restores All filter, scroller and opener focus', async () => {
    await ready(page, 'cen100/#work/all');
    const row = page.locator('#open-assignment-y9');
    await row.scrollIntoViewIfNeeded();
    await row.focus();
    await page.waitForTimeout(150);
    const before = await page.locator('main').evaluate((el) => el.scrollTop);
    await row.click();
    await page.locator('[data-assignment-detail]').waitFor();
    await page.goBack();
    await page.getByRole('button', { name: /^All \(/, pressed: true }).waitFor();
    await page.waitForTimeout(600);
    const after = await page.locator('main').evaluate((el) => el.scrollTop);
    assert.ok(Math.abs(before - after) < 8, `${before} -> ${after}`);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-assignment-y9');
    await page.goForward();
    await page.locator('#course-view-assignment-y9[data-assignment-detail]').waitFor();
  });
  await check('rapid view changes with motion never replay stale navigation', async () => {
    const rapidContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    try {
      const rapid = await rapidContext.newPage();
      await ready(rapid, 'cen100/#work/all');
      const before = await rapid.evaluate(() => history.length);
      const nav = rapid.getByRole('navigation', { name: 'Course views' });
      await nav.getByRole('link', { name: 'Schedule', exact: true }).click();
      await rapid.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
      await rapid.waitForTimeout(100);
      await nav.getByRole('link', { name: 'Work', exact: true }).click();
      await rapid.getByRole('heading', { name: 'Work', exact: true }).waitFor();
      await rapid.waitForTimeout(1600);
      const state = await rapid.evaluate(() => ({ hash: location.hash, entries: history.length }));
      assert.deepEqual(state, { hash: '#work', entries: before + 2 });
      return state;
    } finally {
      await rapidContext.close();
    }
  });
  await check('course view motion eases the outgoing and incoming content', async () => {
    const motionContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'no-preference',
    });
    try {
      const motion = await motionContext.newPage();
      motion.on('pageerror', (error) => errors.push(error.message));
      // The clock runs timer and frame callbacks itself and reports what they throw
      // to the console rather than as a page error: those must still fail the run.
      motion.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('ClockController')) errors.push(message.text());
      });
      // Install before application timers, then advance animation frames explicitly,
      // as the Work filter check does: the outgoing fade lasts 120 ms, which one
      // frame of a loaded CI runner can cover entirely.
      await motion.clock.install();
      await ready(motion, 'mth140/');
      const sample = () =>
        motion.evaluate(() => {
          const content = document.getElementById('course-content');
          const style = getComputedStyle(content);
          return {
            time: performance.now(),
            heading: content.querySelector('h2')?.textContent,
            opacity: Number(style.opacity),
            transform: style.transform,
          };
        });
      const changes = [];
      for (const [width, from, to] of [
        [390, 'Work', 'Study'],
        [834, 'Study', 'Schedule'],
        [1440, 'Schedule', 'Course info'],
        [1440, 'Course info', 'Work'],
      ]) {
        await motion.setViewportSize({ width, height: 900 });
        // Let responsive canvas/layout work settle before sampling this transition.
        await motion.waitForTimeout(300);
        await motion.clock.pauseAt(new Date(await motion.evaluate(() => Date.now() + 1000)));
        const samples = [await sample()];
        const link = motion.getByRole('navigation', { name: 'Course views' }).getByRole('link', { name: to, exact: true });
        await link.focus();
        await motion.keyboard.press('Enter');
        // One 16 ms frame at a time, through both fades and well past them.
        for (let elapsed = 0; elapsed < 1200; elapsed += 16) {
          await motion.clock.runFor(16);
          samples.push(await sample());
        }
        await motion.clock.resume();
        await motion.getByRole('heading', { name: to, exact: true }).waitFor();
        const moving = (heading) => samples.filter((sample) => sample.heading === heading && sample.opacity > 0 && sample.opacity < 1 && sample.transform !== 'none');
        await writeFile(path.join(report, `motion-${width}-${to}.json`), JSON.stringify(samples, null, 2));
        assert.ok(moving(from).length > 0, `${from} disappeared without an outgoing transition`);
        assert.ok(moving(to).length > 0, `${to} appeared without an incoming transition`);
        const final = samples.at(-1);
        assert.equal(final.heading, to);
        assert.equal(final.opacity, 1);
        assert.equal(final.transform, 'none');
        assert.equal(await motion.locator('#course-content').evaluate((el) => el.inert), false);
        assert.equal(await motion.evaluate(() => document.activeElement.id), 'course-content');
        assert.equal(await motion.locator('main').evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
        await motion.screenshot({ path: path.join(report, `motion-${width}-${to}.png`) });
        changes.push({
          width,
          from,
          to,
          outgoingFrames: moving(from).length,
          incomingFrames: moving(to).length,
        });
      }
      return changes;
    } finally {
      await motionContext.close();
    }
  });
  await check('course view motion handles interrupted navigation, notes, history and preference changes', async () => {
    const motionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    try {
      const motion = await motionContext.newPage();
      motion.on('pageerror', (error) => errors.push(error.message));
      const settled = () => motion.waitForFunction(() => {
        const content = document.getElementById('course-content');
        return !content.inert && getComputedStyle(content).opacity === '1' && getComputedStyle(content).transform === 'none';
      });
      await ready(motion, 'cen100/#assignment-m2');
      await motion.locator('textarea').fill('Keep this note through a rapid transition.');
      const before = await motion.evaluate(() => history.length);
      await motion.evaluate(() => document.querySelector('nav[aria-label="Course views"] a[href$="#schedule"]').click());
      await motion.waitForTimeout(50);
      await motion.evaluate(() => document.querySelector('nav[aria-label="Course views"] a[href$="#work"]').click());
      await motion.getByRole('heading', { name: 'Work', exact: true }).waitFor();
      await settled();
      assert.deepEqual(await motion.evaluate(() => ({ hash: location.hash, entries: history.length })), { hash: '#work', entries: before + 2 });
      await motion.goBack();
      await motion.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
      await settled();
      await motion.goBack();
      await motion.locator('textarea').waitFor();
      await settled();
      assert.equal(await motion.locator('textarea').inputValue(), 'Keep this note through a rapid transition.');
      await motion.goForward();
      await motion.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
      await settled();
      // Stop motion while the old content is leaving, not only before a visit.
      await motion.evaluate(() => document.querySelector('nav[aria-label="Course views"] a[href$="#work"]').click());
      await motion.waitForTimeout(50);
      await motion.emulateMedia({ reducedMotion: 'reduce' });
      await motion.getByRole('heading', { name: 'Work', exact: true }).waitFor();
      await settled();
      assert.equal(await motion.locator('#course-content').getAttribute('aria-busy'), null);
      // Reduced motion must leave no hidden/translated frames on the next move.
      await motion.evaluate(() => {
        window.stillFrames = [];
        const sample = () => {
          const style = getComputedStyle(document.getElementById('course-content'));
          window.stillFrames.push({ opacity: style.opacity, transform: style.transform });
          window.stillFrame = requestAnimationFrame(sample);
        };
        sample();
        document.querySelector('nav[aria-label="Course views"] a[href$="#schedule"]').click();
      });
      await motion.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
      await settled();
      const frames = await motion.evaluate(() => {
        cancelAnimationFrame(window.stillFrame);
        return window.stillFrames;
      });
      assert.ok(frames.length > 0);
      assert.ok(frames.every((frame) => frame.opacity === '1' && frame.transform === 'none'), JSON.stringify(frames));
    } finally {
      await motionContext.close();
    }
  });
  await check('course view motion restores the list position and opener after an animated detail', async () => {
    const motionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    try {
      const motion = await motionContext.newPage();
      motion.on('pageerror', (error) => errors.push(error.message));
      await ready(motion, 'cen100/#work/all');
      const row = motion.locator('#open-assignment-y9');
      await row.scrollIntoViewIfNeeded();
      await row.focus();
      await motion.waitForTimeout(150);
      const before = await motion.locator('main').evaluate((el) => el.scrollTop);
      await motion.keyboard.press('Enter');
      await motion.getByRole('button', { name: '← Back to Work', exact: true }).first().click();
      await motion.getByRole('button', { name: /^All \(/, pressed: true }).waitFor();
      await motion.waitForFunction(() => !document.getElementById('course-content').inert);
      const after = await motion.locator('main').evaluate((el) => el.scrollTop);
      assert.ok(Math.abs(before - after) < 8, `${before} -> ${after}`);
      assert.equal(await motion.evaluate(() => document.activeElement.id), 'open-assignment-y9');
      await motion.goForward();
      await motion.locator('#course-view-assignment-y9[data-assignment-detail]').waitFor();
      await motion.waitForFunction(() => !document.getElementById('course-content').inert);
      assert.equal(await motion.evaluate(() => document.activeElement.id), 'course-view-assignment-y9');
    } finally {
      await motionContext.close();
    }
  });
  for (const [view, selector] of [
    ['schedule', '[data-schedule-link]'],
    ['course-grading', '#course-view-course-grading a[href*="#assignment-"]'],
  ]) {
    await check(`${view} restores keyboard focus and scroll to the detail opener`, async () => {
      await ready(page, `cen100/#${view}`);
      if (view === 'schedule') await page.getByRole('button', { name: 'All dates', exact: true }).click();
      const opener = page.locator(selector).last();
      await opener.scrollIntoViewIfNeeded();
      await opener.focus();
      const href = await opener.getAttribute('href');
      await page.waitForTimeout(150);
      const before = await page.locator('main').evaluate((el) => el.scrollTop);
      await page.keyboard.press('Enter');
      await page.locator('[data-assignment-detail]').waitFor();
      await page
        .getByRole('button', { name: /Back to / })
        .first()
        .click();
      await opener.waitFor();
      await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), href);
      const after = await page.locator('main').evaluate((el) => el.scrollTop);
      assert.ok(Math.abs(before - after) < 8, `${before} -> ${after}`);
    });
  }
  await check('Study retains every published lecture-hour estimate in list and detail', async () => {
    for (const course of ['mth140', 'mth141']) {
      await ready(page, `${course}/#study`);
      const rows = page.locator('a[id^="open-topic-"]');
      const count = await rows.count();
      assert.ok(count > 0);
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const text = await row.innerText();
        assert.match(text, /about \d+ lecture hours/);
        const estimate = text.match(/about \d+ lecture hours/)[0];
        await row.click();
        await page.locator('[data-assignment-detail]').waitFor();
        assert.ok((await page.locator('[data-assignment-detail]').innerText()).includes(estimate));
        await page.getByRole('button', { name: '← Back to Study', exact: true }).first().click();
        await rows.first().waitFor();
      }
    }
  });
  await check('math Study and legacy links open the shared content', async () => {
    for (const [fragment, selector] of [
      ['topic-limits', '#course-view-topic-limits[data-assignment-detail]'],
      ['assessment-midterm', '#course-view-assessment-midterm[data-assignment-detail]'],
      ['t-help', '#info-policy-missed-assessment'],
      ['panel-assessments', '[data-assignment-link]'],
    ]) {
      await ready(page, `mth140/#${fragment}`);
      await page.locator(selector).first().waitFor();
    }
    await ready(page, 'cen100/#t-rules');
    await page.locator('#info-policy-late-work').waitFor();
    await ready(page, 'cen100/#math-tools');
    await page.locator('dialog[open]').waitFor();
    await page.getByRole('button', { name: 'Close guide tools' }).click();
  });
  await check('Schedule agenda and calendar open the same assignment', async () => {
    await ready(page, 'mth140/#schedule');
    await page.getByLabel('Course section').selectOption('3');
    await page.getByRole('button', { name: 'All dates', exact: true }).click();
    const link = page.locator('[data-schedule-link][href$="#assessment-midterm"]');
    await link.click();
    await page.locator('#course-view-assessment-midterm[data-assignment-detail]').waitFor();
    await page
      .getByRole('button', { name: /Back to Schedule/ })
      .first()
      .click();
    await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
    await page.getByRole('button', { name: 'All dates', exact: true, pressed: true }).waitFor();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.screenshot({ path: path.join(report, 'calendar-before-ready.png') });
    await page.locator('.sx__calendar').waitFor();
    await page.screenshot({ path: path.join(report, 'mth140-calendar-390.png') });
    await page.locator('.sx__event[data-event-id="mth140-midterm"]').first().click();
    await page.locator('#course-view-assessment-midterm[data-assignment-detail]').waitFor();
    await page
      .getByRole('button', { name: /Back to Schedule/ })
      .first()
      .click();
    await page.locator('.sx__month-agenda-wrapper').waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.sx__month-grid-wrapper').waitFor();
    await page.screenshot({ path: path.join(report, 'mth140-calendar-1440.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.sx__month-agenda-wrapper').waitFor();
    assert.equal(await page.getByLabel('Course section').inputValue(), '3');
  });
  await check('keyboard search opens the same detail across courses, then returns', async () => {
    await ready(page, 'mth140/#study');
    let attempt = 0;
    try {
      for (; attempt < 3; attempt += 1) {
        await page.keyboard.press('Control+k');
        await page.locator('#search-input').fill('Project Outline');
        await page.getByRole('option').first().waitFor();
        await page.keyboard.press('Enter');
        await page.locator('#course-view-assignment-m2[data-assignment-detail]').waitFor();
        await page.goBack();
        await page.getByRole('heading', { name: 'Study', exact: true }).waitFor();
        // Reopen as soon as Study is visible: the index must already use MTH140.
        await page.keyboard.press('Control+k');
        await page.locator('#search-input').fill('Contacts');
        await page.keyboard.press('Enter');
        await page.waitForURL(target => target.pathname === basePath + '/mth140/' && target.hash === '#contacts');
        await page.locator('#course-view-contacts[data-info-detail]').waitFor();
        const back = page.getByRole('button', { name: '← Back to Study', exact: true }).first();
        await back.focus();
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: 'Study', exact: true }).waitFor();
      }
    } catch (error) {
      throw new Error(`Search/Back cycle ${attempt + 1}: ${error.message}`);
    }
  });
  await check('navigation does not steal focus chosen inside the newly opened view', async () => {
    await ready(page, 'mth140/#work');
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        const contacts = document.querySelector('#course-view-contacts[data-info-detail]');
        if (!contacts?.getClientRects().length) return;
        observer.disconnect();
        // Reach a control before deferred scroll restoration finishes.
        contacts.querySelector('button').focus();
      });
      observer.observe(document.getElementById('course-content'), { childList: true, attributes: true, subtree: true });
      window.location.hash = 'contacts';
    });
    await page.locator('#course-view-contacts[data-info-detail]').waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.activeElement.matches('#course-view-contacts button')), true);
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Work', exact: true }).waitFor();
  });
  await check('backup export and import retain separate records, notes, targets and checks', async () => {
    await ready(page, 'cen100/#assignment-m2');
    await page.locator('textarea').fill('Backup round trip note');
    await page.locator('input[type=date]').fill('2026-11-01');
    await page.locator('[data-assignment-detail] input[type=checkbox]').first().check({ force: true });
    await page.getByRole('button', { name: 'Guide tools ↗', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export my progress', exact: true }).click();
    const download = await downloadPromise;
    const backupPath = path.join(report, 'test-progress-backup.json');
    await download.saveAs(backupPath);
    const backup = JSON.parse(await readFile(backupPath, 'utf8'));
    assert.equal(backup.format, 'cen100-guide-backup');
    await page.getByRole('button', { name: 'Close guide tools' }).click();
    await page.evaluate(() => {
      localStorage.removeItem('cen100-personal-plan-v1');
      localStorage.removeItem('cen100-g9-ticks');
    });
    await page.reload();
    await page.locator('textarea').waitFor();
    assert.equal(await page.locator('textarea').inputValue(), '');
    await page.getByRole('button', { name: 'Guide tools ↗', exact: true }).click();
    await page.locator('#guide-tools input[type=file]').setInputFiles(backupPath);
    await page
      .locator('#guide-tools [role=status]')
      .filter({ hasText: /Imported/ })
      .waitFor();
    await page.getByRole('button', { name: 'Close guide tools' }).click();
    assert.equal(await page.locator('textarea').inputValue(), 'Backup round trip note');
    assert.equal(await page.locator('input[type=date]').inputValue(), '2026-11-01');
    assert.equal(await page.locator('[data-assignment-detail] input[type=checkbox]').first().isChecked(), true);
    await page.getByRole('button', { name: 'Guide tools ↗', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('#guide-tools[open]').waitFor({ state: 'hidden' });
  });
  await check('calendar code stays off Work and a blocked chunk leaves a usable deadline list', async () => {
    const manifest = JSON.parse(await readFile(path.join(site, '.next/react-loadable-manifest.json'), 'utf8'));
    const calendarFiles = Object.entries(manifest)
      .find(([key]) => key.endsWith('workspace/Schedule.jsx -> ./Calendar'))[1]
      .files.filter((file) => file.endsWith('.js'));
    const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const fallback = await fallbackContext.newPage();
    const blocked = [];
    await fallback.route('**/*', (route) => {
      if (calendarFiles.some((file) => route.request().url().endsWith(file))) {
        blocked.push(route.request().url());
        return route.abort('failed');
      }
      return route.continue();
    });
    try {
      await ready(fallback, 'cen100/');
      assert.deepEqual(blocked, []);
      await fallback.getByRole('navigation', { name: 'Course views' }).getByRole('link', { name: 'Schedule' }).click();
      await fallback.getByRole('status').filter({ hasText: 'Calendar unavailable' }).waitFor();
      assert.ok(blocked.length > 0);
      await fallback.locator('[data-schedule-link]').first().click();
      await fallback.locator('[data-assignment-detail]').waitFor();
      return { blockedCalendarChunks: blocked.length };
    } finally {
      await fallbackContext.close();
    }
  });
  await check('tablet header controls remain readable and easy to activate', async () => {
    await page.setViewportSize({ width: 834, height: 900 });
    await ready(page, 'mth141/');
    for (const name of ['Open menu']) {
      const control = page.getByRole('button', { name, exact: true });
      const box = await control.boundingBox();
      assert.ok(box.height >= 44, `${name}: ${box.height}px`);
      const font = await control
        .locator('.p-x')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      assert.ok(font >= 14, `${name}: ${font}px`);
    }
  });
  for (const width of [360, 430, 768, 834, 1024, 1440]) {
    await check(`layout and readable detail at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, 'mth141/');
      assert.equal(await page.locator('[data-course-badge="mth141"]').count(), 1);
      await page.locator('[data-badge-instance="header-mth141"][data-badge-rendered="true"]').waitFor();
      const overflow = await page.evaluate(() => document.querySelector('main').scrollWidth > innerWidth + 1);
      assert.equal(overflow, false);
      const box = await page.locator('[data-assignment-link]').first().boundingBox();
      assert.ok(box.y < 900, JSON.stringify(box));
      await page.screenshot({ path: path.join(report, `mth141-work-${width}.png`) });
      await page.locator('[data-assignment-link]').first().click();
      await page.locator('[data-assignment-detail] .p-l').first().waitFor();
      const fonts = await page
        .locator('[data-assignment-detail] .p-l, [data-assignment-detail] .p-x')
        .evaluateAll((nodes) => nodes.filter((n) => n.getClientRects().length).map((n) => parseFloat(getComputedStyle(n).fontSize)));
      assert.ok(fonts.length && fonts.every((font) => font >= 16), JSON.stringify(fonts));
      assert.equal(await page.evaluate(() => document.querySelector('main').scrollWidth > innerWidth + 1), false);
      if (width === 834 || width === 1440) await page.screenshot({ path: path.join(report, `mth141-detail-${width}.png`) });
    });
  }
  await check('200 percent equivalent reflow keeps details and navigation usable', async () => {
    // 1440×1000 screen at 200%: a 720×500 CSS viewport with 2× rendering.
    // This checks reflow, not a physical browser's native zoom UI.
    const zoomContext = await browser.newContext({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    try {
      const zoomPage = await zoomContext.newPage();
      await ready(zoomPage, 'cen100/');
      await zoomPage.locator('[data-assignment-link]').first().click();
      await zoomPage.locator('[data-assignment-detail]').waitFor();
      const dimensions = await zoomPage.locator('main').evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.client + 1, JSON.stringify(dimensions));
      await zoomPage.screenshot({ path: path.join(report, 'cen100-detail-200-percent-reflow.png') });
      await zoomPage
        .getByRole('button', { name: /Back to Work/ })
        .first()
        .click();
      await zoomPage.locator('[data-assignment-link]').first().waitFor();
    } finally {
      await zoomContext.close();
    }
  });
  await check('grade calculator: marks update the standing, survive reload and stay per course', async () => {
    await ready(page, 'mth140/');
    // The calculator reads saved marks when its view opens.
    await page.evaluate(() => ['mth140', 'mth141', 'cen100'].forEach((id) => localStorage.removeItem(`${id}-grades-v1`)));
    await page.getByRole('navigation', { name: 'Course views' }).getByRole('link', { name: 'Grades', exact: true }).click();
    await page.getByRole('heading', { name: 'Grade calculator', exact: true }).waitFor();
    const current = page.locator('[data-grade-current]');
    assert.match(await current.innerText(), /—/);
    // 17 out of 20 typed into the mark field fills both fields; the midterm as a percentage.
    const quiz = page.getByLabel('Lab Quiz 1', { exact: true });
    await quiz.fill('17/20');
    assert.equal(await quiz.inputValue(), '17');
    assert.equal(await page.getByLabel('Lab Quiz 1: out of').inputValue(), '20');
    // Typed key by key, the slash moves to the total.
    const second = page.getByLabel('Lab Quiz 2', { exact: true });
    await second.pressSequentially('9/10');
    assert.equal(await second.inputValue(), '9');
    assert.equal(await page.getByLabel('Lab Quiz 2: out of').inputValue(), '10');
    await second.fill('');
    await page.getByLabel('Lab Quiz 2: out of').fill('');
    // No error flashes on the way to a valid total (8 / 1 before 8 / 10); a wrong total shows on leaving the field.
    await page.evaluate(() => {
      window.qaGradeErrors = [];
      new MutationObserver(() => {
        if (document.querySelector('[data-grades] li[data-invalid], [data-grades] [aria-invalid="true"]')) window.qaGradeErrors.push(document.activeElement?.value);
      }).observe(document.querySelector('[data-grades]'), { subtree: true, attributes: true, childList: true, characterData: true });
    });
    const third = page.getByLabel('Lab Quiz 3', { exact: true });
    await third.pressSequentially('8/10', { delay: 40 });
    await page.getByLabel('Lab Quiz 3: out of').pressSequentially('0', { delay: 40 });
    await page.getByLabel('Lab Quiz 3: out of').press('Backspace');
    assert.deepEqual(await page.evaluate(() => window.qaGradeErrors), []);
    await page.getByLabel('Lab Quiz 3: out of').fill('1');
    await page.getByLabel('Lab Quiz 3: out of').blur();
    assert.equal(await page.getByLabel('Lab Quiz 3', { exact: true }).getAttribute('aria-invalid'), 'true', '8 out of 1 is flagged after leaving the field');
    await third.fill('');
    await page.getByLabel('Lab Quiz 3: out of').fill('');
    await page.getByLabel('Midterm Test', { exact: true }).fill('70');
    // (85 × 5 + 70 × 40) / 45 = 71.66… → shown rounded down as 71.6%, a B- (72 after TMU rounding).
    await page.waitForFunction(() => /71\.6%/.test(document.querySelector('[data-grade-current]').textContent));
    assert.match(await current.innerText(), /B-/);
    await page.getByRole('button', { name: /^B\+, 77% or more/ }).click();
    assert.match(await page.locator('[data-grade-answer]').innerText(), /For a B\+ \(77%\), you need an average of at least/);
    const field = await page.getByLabel('Midterm Test', { exact: true }).boundingBox();
    assert.ok(field.height >= 44 && field.width >= 44, JSON.stringify(field));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scrolling');
    await page.screenshot({ path: path.join(report, 'grades-mth140-390.png') });
    await page.reload();
    await page.getByRole('heading', { name: 'Grade calculator', exact: true }).waitFor();
    await page.waitForFunction(() => /71\.6%/.test(document.querySelector('[data-grade-current]')?.textContent || ''));
    assert.equal(await page.getByRole('button', { name: /^B\+, 77% or more/ }).getAttribute('aria-pressed'), 'true');
    // Each course keeps its own marks.
    await ready(page, 'mth141/#grades');
    await page.getByRole('heading', { name: 'Grade calculator', exact: true }).waitFor();
    assert.match(await page.locator('[data-grade-current]').innerText(), /—/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mth140-grades-v1')).marks['quiz-1']), '17/20');
    await page.evaluate(() => localStorage.removeItem('mth140-grades-v1'));
  });

  await check('course information remains readable without JavaScript', async () => {
    const staticContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const staticPage = await staticContext.newPage();
      await staticPage.goto(url + 'cen100/');
      await staticPage.getByRole('link', { name: 'Grading', exact: true }).click();
      await staticPage.locator('#course-grading table').first().waitFor();
      await staticPage.getByRole('link', { name: 'Late means zero', exact: true }).click();
      assert.match(await staticPage.locator('#policy-late-work').innerText(), /valid documentation/);
    } finally {
      await staticContext.close();
    }
  });
} finally {
  await writeFile(path.join(report, 'results.json'), JSON.stringify({ url, results, errors }, null, 2));
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
if (results.some((r) => !r.pass) || errors.length) process.exitCode = 1;
