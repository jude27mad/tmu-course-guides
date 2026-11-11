// Checks the automatic dark mode (prefers-color-scheme: dark; src/styles/colors.scss) in what GitHub Pages
// publishes (.github/workflows/pages.yml), after `pages-site.mjs build`. Dark mode has one black, the ink: the page,
// the panels, every card and pill, and the floor of the moving artwork, which shows through the windows in the ink.
// In Chromium, emulating a dark device:
//   1. Every page, as a 390 px phone and a 1440 px desktop: the dark tokens apply (no inline palette holds the
//      light ones), the page, its cards and the MENU pill are the ink, text and theme-color are the dark ones, no
//      light block is left on the page, and visible text meets AA against what is behind it. Selected tabs and
//      filters are TMU Blue; the windows on the Desk and Courses show the artwork, floored at the ink, with an edge.
//   2. Menu (the shrunk page is an opaque ink card with an edge), Search, Guide tools, an assignment and the
//      footer's end, with screenshots. The Desk's primary action (MARK DONE) is TMU Blue with a white label.
//   3. An iPhone (Safari's document layout): the colour past the page's ends is the ink, and theme-color says
//      the same.
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
    menu: menu ? { background: getComputedStyle(menu).backgroundColor, border: getComputedStyle(menu).borderTopColor, label: label && getComputedStyle(label).color } : null,
    // The page as the Menu/Search shell leaves it: restored means no transform, full opacity, a visible header.
    shell: {
      main: getComputedStyle(document.querySelector('main')).transform.replace('matrix(1, 0, 0, 1, 0, 0)', 'none'),
      layout: getComputedStyle(document.querySelector('#layout') || document.body).opacity,
      header: getComputedStyle(document.querySelector('header')).opacity,
      headerVisibility: getComputedStyle(document.querySelector('header')).visibility,
    },
  };
}
const RESTORED = { main: 'none', layout: '1', header: '1', headerVisibility: 'visible' };

// Visible text against the colour behind it: the nearest painted ancestor, composited down to the page's ink. Text
// over the artwork (in a window, Menu, the footer) is measured against the ink; tests/dark-mode.test.mjs checks
// those text colours against the artwork's brightest band as well.
function sweep(scope = 'body') {
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
  for (const el of document.querySelectorAll(`${scope} *`)) {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (style.visibility !== 'visible' || box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > innerHeight) continue;
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
  return { low: Array.from(new Set(low)) };
}

// Painted blocks that are light (a white card or pill left on the ink), larger than a 40 px square, on screen.
function lightBlocks() {
  const parse = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const found = [];
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    const bg = parse(style.backgroundColor);
    if (!bg || bg.a < 0.5 || style.visibility !== 'visible' || Number(style.opacity) < 0.2) continue;
    const box = el.getBoundingClientRect();
    if (box.width * box.height < 1600 || box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth) continue;
    if ((bg.r + bg.g + bg.b) / 3 > 128) found.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${style.backgroundColor}`);
  }
  return found;
}

// The darkest and lightest grey levels (1st and 99th percentile) of an area of a screenshot.
async function levels(page, clip) {
  const require = createRequire(import.meta.url);
  const sharp = require('sharp');
  const { data, info } = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
  const values = [];
  for (let i = 0; i < data.length; i += info.channels) values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  values.sort((a, b) => a - b);
  return { low: values[Math.floor(values.length * 0.01)], high: values[Math.floor(values.length * 0.99)] };
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
    assert.equal(state.tokens['--white'], DARK.page.toLowerCase(), `${where}: the page is the ink`);
    assert.equal(state.tokens['--text'], DARK.text.toLowerCase(), `${where}: the text`);
    assert.equal(state.tokens['--card'], DARK.page.toLowerCase(), `${where}: cards are the page's ink`);
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
      // The MENU pill is the ink with a strong hairline and a light label (reduced motion: the solid glass).
      assert.equal(state.menu.background, rgb(DARK.page), `${where}: MENU pill`);
      assert.equal(state.menu.border, rgb(DARK.borderStrong), `${where}: MENU pill's edge`);
      assert.equal(state.menu.label, rgb(DARK.text), `${where}: MENU label`);
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
        assert.deepEqual(state.shell, RESTORED, `${name}: the page is not shrunk`);
        if (name === 'cen100-schedule' && label === 'desktop') {
          const lines = await page.evaluate(() => {
            const node = document.querySelector('.sx__calendar');
            const today = document.querySelector('.sx__today-button');
            const pressed = Array.from(document.querySelectorAll('main button[aria-pressed="true"]')).find((button) => /calendar/i.test(button.textContent));
            return node && { grid: getComputedStyle(node).borderTopColor, today: today && getComputedStyle(today).borderTopColor, pressed: pressed && [getComputedStyle(pressed).backgroundColor, getComputedStyle(pressed).color] };
          });
          // The calendar is drawn on the ink in hairlines: dividers for its lines, the field edge for its controls.
          assert.deepEqual(lines, { grid: rgb(DARK.border), today: rgb(DARK.fieldEdge), pressed: [rgb(DARK.accentTint), rgb(DARK.accent)] }, 'the calendar and the pressed Calendar toggle');
        }
        if (name === 'cen100-work') {
          // The selected tab and the selected filter are TMU Blue: its tint, its outline and its type.
          const selected = await page.evaluate(() => {
            const read = (node) => node && [getComputedStyle(node).backgroundColor, getComputedStyle(node).boxShadow.includes('inset') ? getComputedStyle(node).boxShadow.split(' 0px')[0] : null];
            const tab = document.querySelector('main [aria-current="page"]');
            return { tab: tab && getComputedStyle(tab).color, slider: read(document.querySelector('[data-course-selection]')), filter: read(document.querySelector('[data-filter-selection]')) };
          });
          assert.deepEqual(selected, { tab: rgb(DARK.accent), slider: [rgb(DARK.accentTint), rgb(DARK.accent)], filter: [rgb(DARK.accentTint), rgb(DARK.accent)] }, 'the selected states');
        }
        if (name === 'desk') {
          // The Desk's signal field draws its points on the artwork, with no panel of its own; the paper's windows are
          // edged (in dark mode only, the paper is drawn through the edge filter).
          const desk = await page.evaluate(() => {
            const canvas = document.querySelector('canvas[data-signal-field]');
            const svg = document.querySelector('svg[data-surface="cells"]');
            return {
              corner: canvas && canvas.getContext('2d').getImageData(1, 1, 1, 1).data[3],
              edged: !!svg?.querySelector('g[filter="url(#desk-window-edge)"]') && !!svg?.querySelector('filter#desk-window-edge feMorphology'),
              viewBox: svg?.getAttribute('viewBox'),
            };
          });
          assert.deepEqual(desk, { corner: 0, edged: true, viewBox: null }, 'the Desk field and its edged windows');
          // Next up's primary action (MARK DONE) is the one filled shape: TMU Blue with a white label.
          const primary = await page.evaluate(() => {
            const node = document.querySelector('main [class*="buttonLink_primary"]');
            return node && [getComputedStyle(node).backgroundColor, getComputedStyle(node).color];
          });
          assert.deepEqual(primary, [rgb(DARK.accentFill), rgb(DARK.onAccentFill)], 'the primary action');
        }
        if (name === 'courses' && label === 'desktop') {
          // The Courses card is a window onto the artwork: its light bands show, and its darkest is the page's ink
          // (the artwork is floored at it). Measured against a bare stretch of the page beside the title.
          const card = await page.evaluate(() => {
            const node = document.querySelector('main [class*="projects_innerContainer"]');
            const box = node.getBoundingClientRect();
            return { x: box.x + 8, y: box.y + 8, width: Math.min(box.width - 16, 1200), height: Math.min(innerHeight - box.y - 16, 400), edge: getComputedStyle(node).boxShadow };
          });
          assert.ok(card.edge.startsWith(`${rgb(DARK.windowEdge)} 0px 0px 0px 1px inset`), `the Courses window's edge: ${card.edge}`);
          const inside = await levels(page, { x: card.x, y: card.y, width: card.width, height: card.height });
          const bare = await levels(page, { x: 700, y: 120, width: 600, height: 60 });
          assert.ok(Math.abs(inside.low - bare.low) <= 2, `the window's darkest (${inside.low}) is the page's ink (${bare.low})`);
          assert.ok(inside.high >= bare.high + 12, `the window shows the artwork's light (${inside.high} against ${bare.high})`);
        }
        assert.deepEqual(await page.evaluate(lightBlocks), [], `${name}: light blocks on the ink`);
        const { low } = await page.evaluate(sweep);
        assert.deepEqual(low, [], `${name}: text below AA`);
        await page.screenshot({ path: join(reports, `${label}-${name}.png`) });
      });
    }
    await check(`${label} desk: the footer's end`, async () => {
      await visit(page, '');
      await toEnd(page);
      darkState(await page.evaluate(readState), 'desk end');
      assert.deepEqual((await page.evaluate(sweep)).low, [], 'text below AA at the end');
      // The back-to-top disc is the ink with a window's edge and a light arrow, over the footer's artwork.
      const button = await page.evaluate(() => {
        const node = document.querySelector('footer [aria-label="Back to top"]');
        const arrow = node?.querySelector('svg');
        return node && { background: getComputedStyle(node).backgroundColor, edge: getComputedStyle(node).boxShadow, arrow: arrow && getComputedStyle(arrow).fill };
      });
      assert.deepEqual(button, { background: rgb(DARK.page), edge: `${rgb(DARK.windowEdge)} 0px 0px 0px 1px inset`, arrow: rgb(DARK.text) }, 'the back-to-top disc');
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
      // Wide screens keep the shrunk page an opaque ink card, edged like a window; phones hide it behind the panel.
      const card = await page.evaluate(() => ({ layout: getComputedStyle(document.querySelector('#layout')).opacity, edge: getComputedStyle(document.querySelector('main')).borderTopColor }));
      assert.deepEqual(card, label === 'phone' ? { layout: '0.05', edge: rgb(TOKENS.page) } : { layout: '1', edge: rgb(DARK.pageEdge) }, 'the shrunk page');
      await page.screenshot({ path: join(reports, `${label}-menu.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    });
    await check(`${label} search open`, async () => {
      await visit(page, 'cen100/');
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(1200);
      assert.equal(await page.evaluate(() => document.querySelector('#search')?.getAttribute('aria-hidden')), 'false', 'Search opened');
      await page.keyboard.type('quiz');
      await page.waitForTimeout(800);
      const state = await page.evaluate(readState);
      assert.equal(state.surface, 'dark', 'Search turns the bars dark');
      darkState(state, 'search');
      assert.ok(await page.evaluate(() => document.querySelectorAll('#search-results [id^="search-option-"]').length > 0), 'results for "quiz"');
      // The page behind the panel is dimmed on purpose; the panel's own text must read.
      assert.deepEqual((await page.evaluate(sweep, '#search')).low, [], 'text below AA in Search');
      await page.screenshot({ path: join(reports, `${label}-search.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    });
    await check(`${label} cen100: an assignment`, async () => {
      await visit(page, 'cen100/#work/all');
      const anchor = await page.evaluate(() => {
        const row = document.querySelector('main [data-assignment-link]');
        if (!row) return null;
        row.click();
        return row.getAttribute('href').split('#')[1];
      });
      assert.ok(anchor, 'a work row to open');
      await page.waitForTimeout(1500);
      assert.ok(await page.evaluate((id) => location.hash === `#${id}` && !!document.querySelector(`#course-view-${CSS.escape(id)}[data-assignment-detail]`), anchor), `the assignment ${anchor} opened`);
      assert.deepEqual((await page.evaluate(sweep)).low, [], 'text below AA');
      assert.deepEqual(await page.evaluate(lightBlocks), [], 'light blocks on the ink');
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
        return node && { open: node.open, background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color, edge: getComputedStyle(node).borderTopColor };
      });
      // Guide tools is an ink sheet with a strong hairline.
      assert.deepEqual(dialog, { open: true, background: rgb(DARK.page), color: rgb(DARK.text), edge: rgb(DARK.borderStrong) });
      assert.deepEqual((await page.evaluate(sweep, '#guide-tools')).low, [], 'text below AA in Guide tools');
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
    assert.equal(top.html, rgb(DARK.pageUnderGrain), 'past the top: the ink under the artwork');
    await phone.screenshot({ path: join(reports, 'iphone-desk-top.png') });
    await toEnd(phone);
    const end = await phone.evaluate(readState);
    assert.equal(end.bottom, 'dark', 'the Desk ends in the dark footer');
    assert.equal(end.html, rgb(TOKENS.ink), 'past a dark end: the ink');
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
      if (path) assert.equal(due.toLowerCase(), DARK.accent.toLowerCase(), 'calendar events take the dark accent');
      await page.screenshot({ path: join(reports, `switch-${path ? 'schedule' : 'desk'}-dark.png`) });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForTimeout(800);
      assert.deepEqual(await page.evaluate(readState), before, `${path || 'desk'}: back to light, exactly as before`);
    }
  });

  // The device switches scheme while Menu is open: closing it must bring the page back, in the new scheme.
  for (const [label, options] of [
    ['desktop', { viewport: { width: 1440, height: 900 } }],
    ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ]) {
    await check(`${label}: switching scheme with Menu open`, async () => {
      // With motion on: the shell's timeline is what a rebuild could leave behind.
      const page = await open({ ...options, colorScheme: 'light', reducedMotion: 'no-preference' });
      await visit(page, '');
      await page.waitForTimeout(2500); // the loader's curtain
      const before = await page.evaluate(readState);
      assert.deepEqual(before.shell, RESTORED, 'the page before Menu');
      await page.click('#menu-button');
      await page.waitForTimeout(1500);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(800);
      const card = await page.evaluate(() => ({ edge: getComputedStyle(document.querySelector('main')).borderTopColor, layout: getComputedStyle(document.querySelector('#layout')).opacity }));
      // In the new scheme: wide screens keep the shrunk page an opaque ink card with the window edge.
      assert.deepEqual(card, label === 'phone' ? { edge: rgb(TOKENS.page), layout: '0.05' } : { edge: rgb(DARK.pageEdge), layout: '1' }, 'the shrunk page in the new scheme');
      await page.screenshot({ path: join(reports, `switch-${label}-menu-open.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1800);
      const after = await page.evaluate(readState);
      assert.deepEqual(after.shell, RESTORED, 'the page comes back once Menu closes');
      darkState(after, 'after Menu');
      await page.screenshot({ path: join(reports, `switch-${label}-menu-closed.png`) });
    });
  }

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
