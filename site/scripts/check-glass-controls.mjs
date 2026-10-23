// CI browser checks for glass controls. Run after the production export.
// Screenshots/traces are browser emulation, never physical-device evidence.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreview } from '../../tools/preview-server.mjs';

const require = createRequire(import.meta.url);
const engine = process.env.QA_BROWSER || 'chromium';
const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { basePath } = JSON.parse(await readFile(path.join(site, '.next/routes-manifest.json'), 'utf8'));
const report = path.join(process.env.QA_REPORT_DIR || '/tmp/tmu-glass', engine);
await mkdir(report, { recursive: true });
const server = createPreview({ root: path.join(site, 'out'), base: basePath });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port + basePath + '/';
const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}) });
const results = [];
const nav = 'nav[aria-label="Course views"]';
const ready = async (page) => {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const section = document.querySelector('#course-section');
    const loader = document.querySelector('#loader');
    const header = document.getElementById('menu-button')?.closest('header');
    return main && getComputedStyle(main).opacity === '1' && document.documentElement.dataset.motion &&
      header && getComputedStyle(header).opacity === '1' && getComputedStyle(header).visibility === 'visible' &&
      (!loader || getComputedStyle(loader).display === 'none') &&
      !main.classList.contains('lenis-stopped') && (!section || !section.disabled) &&
      (!section || document.querySelector('nav[data-selection-ready="true"]'));
  });
  // JS-ready is not paint-ready in WebKit: the first capture can precede the
  // header's text paint, while the next capture is correct with no DOM change.
  // Settle fonts and a paint boundary before visual/pixel assertions. This is
  // test capture readiness only; the application does not wait for fonts.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
};
const settled = (page) => page.waitForFunction(() => {
  const content = document.querySelector('#course-content');
  return content && !content.inert && getComputedStyle(content).opacity === '1' && getComputedStyle(content).transform === 'none';
});
const aligned = (page) => page.waitForFunction(() => {
  const selected = document.querySelector('nav[aria-label="Course views"] a[aria-current]');
  const capsule = document.querySelector('[data-course-selection]');
  if (!selected || !capsule) return false;
  const a = selected.getBoundingClientRect();
  const b = capsule.getBoundingClientRect();
  return ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) < 2) && getComputedStyle(capsule).opacity === '1';
});
const panelSettled = (page, selector) => page.waitForFunction((selector) => {
  const panel = document.querySelector(selector);
  if (!panel || getComputedStyle(panel).opacity !== '1') return false;
  return [...panel.querySelectorAll('[data-menu-anim]')].every((item) => {
    const transform = getComputedStyle(item).transform;
    return transform === 'none' || Math.abs(new DOMMatrixReadOnly(transform).m41) < 0.1;
  });
}, selector);
const material = (page) => page.locator('[data-glass]').evaluateAll((elements) => elements.map((element) => {
  const style = getComputedStyle(element);
  return { tone: element.dataset.glass, filter: style.backdropFilter || style.webkitBackdropFilter || 'none', background: style.backgroundColor, color: style.color };
}));
const rgb = (value) => value.match(/[\d.]+/g).map(Number);
const luminance = (color) => color.slice(0, 3).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const composite = (front, back) => front.slice(0, 3).map((v, i) => v * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
async function assertMenuPaint(page, screenshot) {
  // DOM visibility alone does not prove that a label is actually painted.
  // Inspect the actual captured pill, excluding its edge and surrounding page.
  const lightPixels = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const scale = canvas.width / innerWidth;
    const rect = document.querySelector('#menu-button').getBoundingClientRect();
    const x = Math.ceil((rect.x + 8) * scale);
    const y = Math.ceil((rect.y + 8) * scale);
    const width = Math.floor((rect.width - 16) * scale);
    const height = Math.floor((rect.height - 16) * scale);
    const pixels = context.getImageData(x, y, width, height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 210 && pixels[i + 1] > 210 && pixels[i + 2] > 210) count += 1;
    }
    return count;
  }, screenshot.toString('base64'));
  assert.ok(lightPixels > 8, 'MENU label did not paint inside its dark pill: ' + lightPixels + ' light pixels');
}
async function check(name, run, options = {}) {
  const phone = engine === 'webkit' && (options.viewport?.width || 390) <= 500 ? playwright.devices['iPhone 13'] : {};
  const context = await browser.newContext({ ...phone, viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'no-preference', ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    const detail = await run(page, context);
    results.push({ name, pass: true, detail });
    console.log('PASS ' + name, detail || '');
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
    console.error('FAIL ' + name + ': ' + error.message);
    await page.screenshot({ path: path.join(report, results.length + '-failure.png') }).catch(() => {});
  } finally { await context.close(); }
}
try {
  for (const width of [320, 390, 834, 1440]) {
    await check('compact controls and dialog at ' + width + 'px', async (page) => {
      for (const course of ['cen100', 'mth140', 'mth141']) {
        await page.goto(url + course + '/');
        await ready(page);
        await aligned(page);
        const boxes = await page.locator(nav + ' a').evaluateAll((links) => links.map((link) => {
          const box = link.getBoundingClientRect();
          return { text: link.textContent, x: box.x, right: box.right, width: box.width, height: box.height, font: parseFloat(getComputedStyle(link).fontSize) };
        }));
        assert.equal(boxes.length, course === 'cen100' ? 3 : 4);
        assert.ok(boxes.every((b) => b.x >= 0 && b.right <= width && b.width >= 44 && b.height >= 44 && b.font >= 16), JSON.stringify(boxes));
        assert.equal(await page.locator(nav).evaluate((el) => getComputedStyle(el).position), 'relative');
        assert.equal(await page.locator(nav + ' [data-course-selection]').count(), 1);
        assert.equal(await page.locator('#course-content [data-glass]').count(), 0, 'reading content has acquired glass');
        // A single course bar + two small pills on phones; desktop also has Search.
        const filtered = await page.evaluate(() => [...document.querySelectorAll('*')].filter((el) => {
          const s = getComputedStyle(el);
          return (s.backdropFilter || s.webkitBackdropFilter || 'none') !== 'none';
        }).map((el) => ({ glass: el.dataset.glass, parentGlass: !!el.parentElement.closest('[data-glass]'), filter: getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter })));
        assert.ok(filtered.length <= 4 && filtered.every((el) => el.glass && !el.parentGlass), JSON.stringify(filtered));
        if (width <= 500) assert.equal(filtered.length, 0, 'phones must not pay for a backdrop-filter pass');
        const screenshot = await page.screenshot({ path: path.join(report, course + '-' + width + '.png') });
        await assertMenuPaint(page, screenshot);
      }
      const opener = page.getByRole('button', { name: /Guide tools/ });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Guide tools' });
      await dialog.waitFor();
      assert.equal(await dialog.evaluate((el) => {
        const s = getComputedStyle(el);
        return s.backdropFilter || s.webkitBackdropFilter || 'none';
      }), 'none');
      await page.screenshot({ path: path.join(report, 'tools-' + width + '.png') });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(await opener.evaluate((el) => el === document.activeElement), 'dialog did not return focus');
    }, { viewport: { width, height: width > 500 ? 1024 : 844 } });
  }

  await check('selection follows rapid taps and history without moving the page', async (page) => {
    await page.goto(url + 'mth140/');
    await ready(page);
    const before = await page.locator(nav).boundingBox();
    await page.evaluate(() => {
      for (const hash of ['schedule', 'study', 'course-info']) document.querySelector('nav[aria-label="Course views"] a[href$="#' + hash + '"]').click();
    });
    await page.getByRole('heading', { name: 'Course info', exact: true }).waitFor();
    await settled(page);
    await aligned(page);
    const after = await page.locator(nav).boundingBox();
    assert.ok(Math.abs(before.y - after.y) < 2, 'switching views moved the navigation');
    await page.locator(nav + ' a[href$="#study"]').click();
    await page.getByRole('heading', { name: 'Study', exact: true }).waitFor();
    await settled(page);
    await page.goBack();
    await page.getByRole('heading', { name: 'Course info', exact: true }).waitFor();
    await aligned(page);
    await page.goForward();
    await page.getByRole('heading', { name: 'Study', exact: true }).waitFor();
    await aligned(page);
  });

  await check('header controls leave the reading area in the active scroll mode', async (page) => {
    await page.goto(url + 'mth140/');
    await ready(page);
    await page.evaluate(() => {
      const scroller = document.documentElement.dataset.scrollMode === 'document' ? window : document.querySelector('main');
      scroller.scrollTo(0, 300);
    });
    try {
      await page.locator('#menu-button').waitFor({ state: 'hidden', timeout: 3000 });
    } catch (error) {
      const state = await page.evaluate(() => {
        const button = document.querySelector('#menu-button');
        const controls = button.closest('header > div');
        return { mode: document.documentElement.dataset.scrollMode, scrollY, mainScroll: document.querySelector('main').scrollTop,
          buttonTop: button.getBoundingClientRect().top, transform: controls.style.transform, inert: controls.inert, scrolledAway: controls.dataset.scrolledAway };
      });
      throw new Error('Header still covers reading content: ' + JSON.stringify(state));
    }
  });

  await check('keyboard focus and 200% zoom retain the selection', async (page) => {
    await page.goto(url + 'mth140/');
    await ready(page);
    const study = page.locator(nav + ' a[href$="#study"]');
    await study.focus();
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return { text: el.textContent, width: parseFloat(s.outlineWidth), style: s.outlineStyle };
    });
    assert.equal(focus.text, 'Course info');
    assert.ok(focus.width >= 2 && focus.style !== 'none');
    await page.keyboard.press('Enter');
    await aligned(page);
    // CSS zoom exercises actual layout scale; separate 320px checks cover narrow reflow.
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await aligned(page);
    const overflow = await page.locator(nav).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { right: r.right, viewport: innerWidth, labels: [...el.querySelectorAll('a')].map((a) => a.getBoundingClientRect().right) };
    });
    assert.ok(overflow.right <= overflow.viewport + 2 && overflow.labels.every((right) => right <= overflow.viewport + 2), JSON.stringify(overflow));
    await page.screenshot({ path: path.join(report, 'zoom-200.png') });
  }, { viewport: { width: 834, height: 1024 }, hasTouch: false });

  await check('text retains contrast over worst-case bright and dark backdrops', async (page) => {
    await page.goto(url + 'mth140/');
    await ready(page);
    const values = await material(page);
    const measured = [];
    for (const value of values) {
      const backing = rgb(value.background);
      for (const extreme of [0, 255]) {
        const base = composite(backing, [extreme, extreme, extreme]);
        // Check both ends of the white sheen gradient as well as the plain backing.
        for (const sheen of [0, value.tone === 'dark' ? 0.12 : 0.65]) {
          const visible = composite([255, 255, 255, sheen], base);
          const ratio = contrast(rgb(value.color), visible);
          assert.ok(ratio >= 4.5, JSON.stringify({ ...value, extreme, sheen, ratio }));
          measured.push(Number(ratio.toFixed(2)));
        }
      }
    }
    assert.ok(contrast([0, 76, 155], [230, 238, 247]) >= 4.5, 'active selection text contrast');
    return { minimumContrast: Math.min(...measured) };
  }, { viewport: { width: 1440, height: 1000 } });

  await check('reduced motion and Pause motion use solid controls immediately', async (page) => {
    await page.goto(url + 'mth140/');
    await ready(page);
    await page.locator(nav + ' a[href$="#study"]').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'off');
    await aligned(page);
    assert.ok((await material(page)).every((m) => m.filter === 'none' && rgb(m.background).length === 3));
    await page.screenshot({ path: path.join(report, 'reduced-motion.png') });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'on');
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'Pause motion', exact: false }).click();
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'off');
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    assert.ok((await material(page)).every((m) => m.filter === 'none'));
    await page.reload();
    await ready(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('guide-motion-paused')), 'true');
    assert.ok((await material(page)).every((m) => m.filter === 'none'));
  });

  await check('contrast preferences and unsupported-filter fallback stay readable', async (page) => {
    await page.goto(url + 'mth140/');
    await ready(page);
    await page.emulateMedia({ contrast: 'more' });
    assert.ok((await material(page)).every((m) => m.filter === 'none'));
    await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' });
    // WebKit does not emulate forced colours; report that coverage instead of claiming it.
    const forcedSupported = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
    if (forcedSupported) {
      assert.ok((await material(page)).every((m) => m.filter === 'none'));
      await page.screenshot({ path: path.join(report, 'forced-colors.png') });
    }
    await page.emulateMedia({ forcedColors: 'none' });
    const fallback = await page.addStyleTag({ content: '[data-glass] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; background-color: var(--glass-solid) !important; }' });
    assert.ok((await material(page)).every((m) => m.filter === 'none' && rgb(m.background).length === 3));
    await page.screenshot({ path: path.join(report, 'solid-fallback.png') });
    await fallback.evaluate((el) => el.remove());
    // Exercise the actual CSS media rule with CDP when available.
    let reducedTransparency = 'not emulated by this engine';
    if (engine === 'chromium') {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
      if (await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)) {
        assert.ok((await material(page)).every((m) => m.filter === 'none'));
        reducedTransparency = 'passed';
      } else reducedTransparency = 'media preference unavailable in this browser';
      await session.detach();
    }
    return { forcedColours: forcedSupported ? 'passed' : 'not emulated by this engine', reducedTransparency, fallback: 'simulated filter unavailability' };
  });

  for (const width of [390, 834, 1440]) {
    await check('Desk and Menu/Search retain their solid content at ' + width + 'px', async (page) => {
      await page.goto(url);
      await ready(page);
      const screenshot = await page.screenshot({ path: path.join(report, 'desk-' + width + '.png') });
      await assertMenuPaint(page, screenshot);
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await page.getByRole('button', { name: 'Close menu', exact: true }).waitFor();
      await panelSettled(page, '#menu');
      await page.screenshot({ path: path.join(report, 'menu-' + width + '.png') });
      const hintSize = await page.locator('#menu-motion-note').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      await page.getByRole('button', { name: 'Close menu', exact: true }).click();
      await page.locator('#menu').waitFor({ state: 'hidden' });
      await page.keyboard.press('Control+k');
      const search = page.locator('#search');
      await search.getByRole('combobox').fill('quiz');
      await panelSettled(page, '#search');
      await page.screenshot({ path: path.join(report, 'search-' + width + '.png') });
      assert.equal(await search.locator('[data-glass]').count(), 0);
      assert.ok(hintSize >= 16, 'Motion-setting help is too small: ' + hintSize + 'px');
      await search.getByRole('combobox').fill('motion');
      const motionHelp = search.getByRole('option').filter({ hasText: 'Stops animation and makes glass controls solid' }).locator('small');
      await motionHelp.waitFor();
      assert.ok(await motionHelp.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16), 'Search motion help is too small');
      await page.screenshot({ path: path.join(report, 'search-motion-' + width + '.png') });
    }, { viewport: { width, height: width > 500 ? 1024 : 844 } });
  }

  await check('typing a note and immediately leaving preserves the shared detail', async (page) => {
    await page.goto(url + 'cen100/#assignment-m2');
    await ready(page);
    const note = page.locator('[data-assignment-detail] textarea').first();
    await note.fill('Glass must not lose this note.');
    await page.locator(nav + ' a[href$="#schedule"]').click();
    await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
    await settled(page);
    await page.goBack();
    await note.waitFor();
    assert.equal(await note.inputValue(), 'Glass must not lose this note.');
    await page.reload();
    await ready(page);
    assert.equal(await note.inputValue(), 'Glass must not lose this note.');
    await page.screenshot({ path: path.join(report, 'shared-assignment-detail.png') });
  });

  await check('paired glass on/off interaction traces', async (page, context) => {
    await context.tracing.start({ screenshots: true, snapshots: true });
    const samples = [];
    try {
      for (const paused of [false, true]) {
        await page.goto(url + 'mth140/?motion=' + (paused ? 'off' : 'full'));
        await ready(page);
        for (let i = 0; i < 6; i += 1) {
          // Reverse the middle pair to reduce order bias; same route/build/runner.
          // Reset to the same content so both variants measure Work -> Study.
          await page.locator(nav + ' a[href$="#work"]').click();
          await settled(page);
          await aligned(page);
          const glass = [true, false, false, true, true, false][i];
          const override = glass ? null : await page.addStyleTag({ content: '[data-glass] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; background-color: var(--glass-solid) !important; }' });
          const result = await page.evaluate(async () => {
            const values = [];
            let previous = performance.now();
            let frame;
            const sample = (now) => { values.push(now - previous); previous = now; frame = requestAnimationFrame(sample); };
            frame = requestAnimationFrame(sample);
            const hash = '#study';
            const link = document.querySelector('nav[aria-label="Course views"] a[href$="' + hash + '"]');
            const materialStyle = getComputedStyle(link.closest('nav'));
            const actualFilter = materialStyle.backdropFilter || materialStyle.webkitBackdropFilter || 'none';
            let stateAcknowledgementMs = null;
            const start = performance.now();
            const acknowledgement = new MutationObserver(() => {
              if (link.getAttribute('aria-current') === 'page') {
                stateAcknowledgementMs = performance.now() - start;
                acknowledgement.disconnect();
              }
            });
            acknowledgement.observe(link, { attributes: true, attributeFilter: ['aria-current'] });
            link.click();
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const twoFrameResponseMs = performance.now() - start;
            acknowledgement.disconnect();
            const selected = link.getAttribute('aria-current');
            // Exercise a small scroll and its return while the material is visible.
            const main = document.querySelector('main');
            const scroller = document.scrollingElement.scrollHeight > innerHeight + 1 ? document.scrollingElement : main;
            const top = scroller.scrollTop;
            scroller.scrollTop = top + 36;
            await new Promise((resolve) => setTimeout(resolve, 250));
            scroller.scrollTop = top;
            await new Promise((resolve) => setTimeout(resolve, 250));
            cancelAnimationFrame(frame);
            values.sort((a, b) => a - b);
            return { selected, actualFilter, stateAcknowledgementMs, twoFrameResponseMs, frameP95Ms: values[Math.floor(values.length * 0.95)], longFrames: values.filter((v) => v > 50).length, frames: values.length };
          });
          assert.equal(result.selected, 'page');
          await settled(page);
          await aligned(page);
          samples.push({ paused, glassRequested: glass, ...result });
          if (override) await override.evaluate((el) => el.remove());
        }
      }
      await writeFile(path.join(report, 'performance.json'), JSON.stringify({ note: 'Paired CI diagnostics, not physical-device FPS. Phones omit backdrop blur; default vs override compares translucent vs solid backing. Paused samples are solid in both variants. actualFilter records the effective material; state acknowledgement and two-frame response are separate timings.', samples }, null, 2));
      return samples;
    } finally { await context.tracing.stop({ path: path.join(report, 'interaction-trace.zip') }); }
  });
} finally {
  await writeFile(path.join(report, 'results.json'), JSON.stringify({ engine, deviceTesting: 'browser emulation only', results }, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
