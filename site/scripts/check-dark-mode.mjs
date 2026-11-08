// Checks the automatic dark mode (prefers-color-scheme: dark; src/styles/colors.scss) in what GitHub Pages
// publishes (.github/workflows/pages.yml), after `pages-site.mjs build`. In Chromium, emulating a dark device:
//   1. Every page, as a 390 px phone and a 1440 px desktop: the dark tokens apply (no inline palette holds the
//      light ones), the page, text and theme-color are the dark ones, the dark panels keep the ink, the MENU
//      label stays readable, no white surface is left, and visible text meets AA against what is behind it.
//   2. Menu, Search, Guide tools, an assignment and the footer's end, with screenshots.
//   3. An iPhone (Safari's document layout): the colour past the page's ends is the dark page under its grain,
//      or the ink at a dark end, and theme-color says the same.
//   4. A device switching scheme mid-visit: light, dark, then light again, ending exactly where it started.
// Usage: PLAYWRIGHT_PATH=/path/to/node_modules/playwright QA_REPORT_DIR=<dir> node scripts/check-dark-mode.mjs <folder>
// With GITHUB_STEP_SUMMARY set, the report is also written to the job summary.
import assert from 'node:assert/strict';
import { appendFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { DARK, TOKENS, rgbOf } from '../src/lib/palette.mjs';
import { servePages } from './pages-server.mjs';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node scripts/check-dark-mode.mjs <published folder>');
  process.exit(2);
}

const rgb = (hex) => `rgb(${rgbOf(hex)})`;
const reports = process.env.QA_REPORT_DIR || '/tmp/dark-mode-qa';
const failures = [];
const check = async (name, run) => {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error.message).split('\n')[0]}`);
    console.log(`FAIL ${name}\n     ${String(error.message).split('\n').join('\n     ')}`);
  }
};

const ROUTES = [
  ['desk', ''],
  ['courses', 'courses/'],
  ['cen100-work', 'cen100/'],
  ['cen100-schedule', 'cen100/#schedule'],
  ['cen100-grades', 'cen100/#grades'],
  ['cen100-info', 'cen100/#course-info'],
  ['mth140-work', 'mth140/'],
  ['mth141-study', 'mth141/#study'],
  ['privacy', 'privacy/'],
  ['updates', 'updates/'],
  ['not-found', 'no-such-page/'],
];

// What the page shows, read in the page.
function readState() {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const token = (name) => {
    const value = css.getPropertyValue(name).trim().toLowerCase();
    return /^#[0-9a-f]{3}$/.test(value) ? `#${[...value.slice(1)].map((d) => d + d).join('')}` : value;
  };
  const menu = document.querySelector('#menu-button');
  const label = menu?.querySelector('p:not([aria-hidden])');
  return {
    tokens: Object.fromEntries(['--white', '--black', '--text', '--card', '--accent', '--pageUnderGrain', '--menuColor'].map((name) => [name, token(name)])),
    inline: ['--black', '--white', '--accent', '--fillColor', '--accentColor'].filter((name) => root.style.getPropertyValue(name)),
    scheme: css.colorScheme,
    html: css.backgroundColor,
    main: getComputedStyle(document.querySelector('main')).color,
    metas: Array.from(document.querySelectorAll('meta[name="theme-color"]'), (meta) => [meta.getAttribute('media'), meta.content.toLowerCase()]),
    surface: root.dataset.browserSurface || null,
    bottom: root.dataset.browserBottom || null,
    scrollMode: root.dataset.scrollMode,
    menu: menu ? { background: getComputedStyle(menu).backgroundColor, label: label && getComputedStyle(label).color } : null,
  };
}

// Visible text against the colour behind it (the nearest painted ancestor, composited down to the page), and any
// opaque white surface. Text on the transparent windows onto the artwork is measured against the page: the
// artwork is darker than the page, so the light text there only gains.
function sweep() {
  const parse = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const page = parse(getComputedStyle(document.documentElement).backgroundColor);
  const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className ? `.${el.className.split(' ')[0]}` : ''}`;
  const behind = (el) => {
    const layers = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) break;
      }
    }
    return layers.reverse().reduce((under, layer) => over(layer, under), page);
  };
  const opacity = (el) => {
    let value = 1;
    for (let node = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  };
  const low = [];
  const white = [];
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (style.visibility !== 'visible' || box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > innerHeight) continue;
    const bg = parse(style.backgroundColor);
    if (bg && bg.a >= 0.99 && bg.r === 255 && bg.g === 255 && bg.b === 255 && box.width * box.height > 400) white.push(describe(el));
    const text = Array.from(el.childNodes).some((node) => node.nodeType === 3 && node.textContent.trim());
    // Disabled controls are exempt (WCAG 1.4.3), and are drawn faded in both schemes.
    if (!text || el.closest('[aria-hidden="true"], #fluidCanvas, canvas, .sr-only, [class*="visuallyHidden"], :disabled, [aria-disabled="true"]')) continue;
    const alpha = opacity(el);
    if (alpha < 0.2) continue; // still fading in, or a decoration
    const color = parse(style.color);
    if (!color) continue;
    const under = behind(el);
    const shown = over({ ...color, a: color.a * alpha }, under);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const value = ratio(shown, under);
    if (value < (large ? 3 : 4.5)) low.push(`${describe(el)} "${el.textContent.trim().slice(0, 40)}" ${value.toFixed(2)}:1`);
  }
  return { low: Array.from(new Set(low)), white: Array.from(new Set(white)) };
}

async function main() {
  await mkdir(reports, { recursive: true });
  const { server, site } = await servePages(folder);
  const require = createRequire(import.meta.url);
  const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM_PATH || undefined });
  const errors = [];
  const contexts = [];
  const open = async (options) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    return page;
  };
  const visit = async (page, path) => {
    await page.goto(`${site}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500); // the loader and the first reveal
  };
  const toEnd = async (page) => {
    await page.evaluate(() => {
      const main = document.querySelector('main');
      const scroller = document.documentElement.dataset.scrollMode === 'document' ? document.scrollingElement : main;
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' });
    });
    await page.waitForTimeout(1500);
  };

  const darkState = (state, where) => {
    assert.equal(state.tokens['--white'], DARK.page.toLowerCase(), `${where}: the page`);
    assert.equal(state.tokens['--text'], DARK.text.toLowerCase(), `${where}: the text`);
    assert.equal(state.tokens['--card'], DARK.card.toLowerCase(), `${where}: cards`);
    assert.equal(state.tokens['--accent'], DARK.accent.toLowerCase(), `${where}: the accent`);
    assert.equal(state.tokens['--black'], TOKENS.ink.toLowerCase(), `${where}: the dark panels keep the ink`);
    assert.equal(state.tokens['--menuColor'], TOKENS.ink.toLowerCase(), `${where}: the menu keeps the ink`);
    assert.deepEqual(state.inline, [], `${where}: no inline palette holds the light colours`);
    assert.equal(state.scheme, 'light dark', `${where}: color-scheme`);
    assert.equal(state.main, rgb(DARK.text), `${where}: the text colour`);
    assert.deepEqual(state.metas.map(([media]) => media), ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'], `${where}: theme-color metas`);
    const dark = state.metas[1][1];
    const page = state.scrollMode === 'document' ? DARK.pageUnderGrain : DARK.page;
    assert.equal(dark, state.surface === 'dark' ? TOKENS.ink.toLowerCase() : page.toLowerCase(), `${where}: dark theme-color`);
    if (state.menu?.label) {
      const ink = rgb(TOKENS.ink).slice(4, -1);
      const label = state.menu.label;
      assert.ok(state.menu.background.includes(ink) ? label === rgb(TOKENS.onDark) : label === rgb(DARK.text), `${where}: MENU label ${label} on ${state.menu.background}`);
    }
  };

  // 1. Every page, phone and desktop.
  for (const [width, height, label, extra] of [
    [390, 844, 'phone', { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    [1440, 900, 'desktop', { deviceScaleFactor: 1 }],
  ]) {
    const page = await open({ viewport: { width, height }, colorScheme: 'dark', ...extra });
    for (const [name, path] of ROUTES) {
      await check(`${label} ${name}: dark page`, async () => {
        await visit(page, path);
        const state = await page.evaluate(readState);
        darkState(state, name);
        assert.equal(state.html, rgb(DARK.page), `${name}: the page behind everything`);
        const { low, white } = await page.evaluate(sweep);
        assert.deepEqual(white, [], `${name}: white surfaces left`);
        assert.deepEqual(low, [], `${name}: text below AA`);
        await page.screenshot({ path: join(reports, `${label}-${name}.png`) });
      });
    }
    await check(`${label} desk: the footer's end`, async () => {
      await visit(page, '');
      await toEnd(page);
      darkState(await page.evaluate(readState), 'desk end');
      assert.deepEqual((await page.evaluate(sweep)).low, [], 'text below AA at the end');
      await page.screenshot({ path: join(reports, `${label}-desk-end.png`) });
    });
    await check(`${label} cen100: the footer's end`, async () => {
      await visit(page, 'cen100/');
      await toEnd(page);
      assert.deepEqual((await page.evaluate(sweep)).low, [], 'text below AA at the end');
      await page.screenshot({ path: join(reports, `${label}-cen100-end.png`) });
    });
    await check(`${label} menu open`, async () => {
      await visit(page, '');
      await page.click('#menu-button');
      await page.waitForTimeout(1500);
      const state = await page.evaluate(readState);
      assert.equal(state.surface, 'dark', 'the menu turns the bars dark');
      darkState(state, 'menu');
      await page.screenshot({ path: join(reports, `${label}-menu.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    });
    await check(`${label} search open`, async () => {
      await visit(page, 'cen100/');
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(1200);
      await page.keyboard.type('quiz');
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(reports, `${label}-search.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    });
    await check(`${label} cen100: an assignment`, async () => {
      await visit(page, 'cen100/#work/all');
      const opened = await page.evaluate(() => {
        const row = document.querySelector('main [data-assignment-link]');
        if (!row) return false;
        row.click();
        return true;
      });
      assert.ok(opened, 'a work row to open');
      await page.waitForTimeout(1500);
      assert.deepEqual((await page.evaluate(sweep)).low, [], 'text below AA');
      await page.screenshot({ path: join(reports, `${label}-cen100-assignment.png`) });
    });
    await check(`${label} cen100: Guide tools`, async () => {
      await visit(page, 'cen100/');
      const opened = await page.evaluate(() => {
        const button = document.querySelector('[aria-controls="guide-tools"]') || Array.from(document.querySelectorAll('button')).find((node) => /guide tools/i.test(node.textContent));
        button?.click();
        return !!button;
      });
      assert.ok(opened, 'the Guide tools button');
      await page.waitForTimeout(1200);
      const dialog = await page.evaluate(() => {
        const node = document.querySelector('#guide-tools');
        return node && { open: node.open, background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color };
      });
      assert.deepEqual(dialog, { open: true, background: rgb(DARK.page), color: rgb(DARK.text) });
      await page.screenshot({ path: join(reports, `${label}-cen100-guide-tools.png`) });
    });
  }

  // 3. iPhone: Safari's document layout. Chromium follows the layout, not Safari's painting of its bars.
  const phone = await open({ ...devices['iPhone 13'], colorScheme: 'dark', reducedMotion: 'reduce' });
  await check('iphone desk: the colour past the page', async () => {
    await visit(phone, '');
    const top = await phone.evaluate(readState);
    assert.equal(top.scrollMode, 'document');
    darkState(top, 'iphone top');
    assert.equal(top.html, rgb(DARK.pageUnderGrain), 'past the top: the dark page as seen through its grain');
    await phone.screenshot({ path: join(reports, 'iphone-desk-top.png') });
    await toEnd(phone);
    const end = await phone.evaluate(readState);
    if (end.bottom === 'dark') assert.equal(end.html, rgb(TOKENS.ink), 'past a dark end: the ink');
    await phone.screenshot({ path: join(reports, 'iphone-desk-end.png') });
  });
  await check('iphone cen100: the colour past a light end', async () => {
    await visit(phone, 'cen100/');
    await toEnd(phone);
    const end = await phone.evaluate(readState);
    assert.equal(end.bottom, 'light');
    assert.equal(end.html, rgb(DARK.pageUnderGrain));
    await phone.screenshot({ path: join(reports, 'iphone-cen100-end.png') });
  });

  // 4. The device switches scheme mid-visit.
  await check('desktop: switching scheme mid-visit', async () => {
    const page = await open({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    for (const path of ['', 'cen100/#schedule']) {
      await visit(page, path);
      const before = await page.evaluate(readState);
      assert.equal(before.tokens['--white'], TOKENS.page.toLowerCase(), `${path || 'desk'}: light first`);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(800);
      darkState(await page.evaluate(readState), `${path || 'desk'} after the switch`);
      const due = await page.evaluate(() => getComputedStyle(document.querySelector('.sx__calendar') || document.documentElement).getPropertyValue('--sx-color-due').trim());
      // Schedule-X's event colours are palette variables, so they resolve to the dark accent.
      if (path) assert.equal(due.toLowerCase(), DARK.accent.toLowerCase(), 'calendar events follow the scheme');
      await page.screenshot({ path: join(reports, `switch-${path ? 'schedule' : 'desk'}-dark.png`) });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForTimeout(800);
      assert.deepEqual(await page.evaluate(readState), before, `${path || 'desk'}: back to light, exactly as before`);
    }
  });

  await check('no page errors', async () => assert.deepEqual(errors, []));
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
  server.close();

  const report = [`### Dark mode`, '', failures.length ? failures.map((failure) => `- ${failure}`).join('\n') : 'All checks passed.', '', `Screenshots: ${reports}`].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
}

await main();
