// Checks the site palette (src/lib/palette.mjs) in what GitHub Pages publishes (.github/workflows/pages.yml),
// after `pages-site.mjs build`:
//   1. No old colour is left in any published file. Black with alpha is allowed only in Schedule-X's own
//      calendar theme (its dialog shadows); those third-party hits are listed in the report, not failed.
//   2. In Chromium as a 390 px phone: the three course cards are identical, the pills, round button and
//      countdown follow the palette, the MENU pill turns light over dark windows and back, the accent stays on
//      small elements, and no page shows an old colour, a yellow or a second accent.
//   3. Screenshots of the Desk (badges, course cards), the course list and the three course pages, named as the
//      before set in docs/qa/neutral-palette/before/.
// Usage: PLAYWRIGHT_PATH=/path/to/node_modules/playwright QA_REPORT_DIR=<dir> node scripts/check-palette-site.mjs <folder>
// With GITHUB_STEP_SUMMARY set, the report is also written to the job summary.
import assert from 'node:assert/strict';
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, relative } from 'node:path';
import { STATUS, TOKENS, rgbOf } from '../src/lib/palette.mjs';
import { servePages } from './pages-server.mjs';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node scripts/check-palette-site.mjs <published folder>');
  process.exit(2);
}

// The previous palette, as authored and as a build can write it.
const OLD = ['#F0F4F1', '#28282B', '#F2FFBD', '#D7D7D4', '#292928', '#0B0C0B', '#020002', '#09050C', '#070410', '#F9F9F9'];
const OLD_TEXT = new RegExp(`(?:#|0x)(?:${OLD.map((hex) => hex.slice(1)).join('|')})(?![0-9a-f])|rgba?\\(\\s*40\\s*,\\s*40\\s*,\\s*43\\b`, 'gi');
const BLACK_ALPHA = /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,/]|#000000[0-9a-f]{2}(?![0-9a-f])|#000[0-9a-f](?![0-9a-f])/gi;
const TEXT = new Set(['.html', '.js', '.css', '.json', '.txt', '.webmanifest', '.svg', '.xml']);

const rgb = (hex) => `rgb(${rgbOf(hex)})`;
const INK = rgb(TOKENS.ink);
const CARD = rgb(TOKENS.card);
const ON_DARK = rgb(TOKENS.onDark);
const MUTED = rgb(TOKENS.muted);
const BORDER = rgb(TOKENS.border);
const ACCENT = rgb(TOKENS.accent);
const ACCENT_TINT = rgb(TOKENS.accentTint);
// Saturated colours the palette allows: the accent, its tint and the countdown status colours.
const SATURATED = [TOKENS.accent, TOKENS.accentTint, TOKENS.soon, TOKENS.urgent, TOKENS.done].map(rgbOf);
const OLD_RGB = OLD.map(rgbOf);

const reports = process.env.QA_REPORT_DIR || '/tmp/palette-qa';
const failures = [];
const notes = [];
const check = async (name, run) => {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error.message).split('\n')[0]}`);
    console.log(`FAIL ${name}\n     ${String(error.message).split('\n').join('\n     ')}`);
  }
};

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (TEXT.has(extname(entry.name))) yield path;
  }
}

// The CSS rule a match sits in (minified: `selector{…}`), to tell Schedule-X's theme from the site's own CSS.
function selectorAt(css, index) {
  const open = css.lastIndexOf('{', index);
  const start = Math.max(css.lastIndexOf('}', open), css.lastIndexOf('{', open - 1)) + 1;
  return css.slice(start, open).trim();
}

async function scanFiles() {
  const old = [];
  const thirdParty = [];
  const black = [];
  for await (const path of files(folder)) {
    const text = await readFile(path, 'utf8');
    const name = relative(folder, path);
    for (const match of text.matchAll(OLD_TEXT)) old.push(`${name}: ${match[0]} … ${text.slice(Math.max(0, match.index - 40), match.index + 40)}`);
    for (const match of text.matchAll(BLACK_ALPHA)) {
      if (extname(path) === '.css') {
        const selector = selectorAt(text, match.index);
        if (/(^|[\s,>+~])\.sx__/.test(selector)) thirdParty.push(`${name}: ${match[0]} in Schedule-X \`${selector.slice(0, 80)}\``);
        else black.push(`${name}: ${match[0]} in \`${selector.slice(0, 80)}\``);
      } else {
        // Script bundles: the site's own sources hold none (tests/palette.test.mjs), so these are libraries.
        thirdParty.push(`${name}: ${match[0]} in library code … ${text.slice(Math.max(0, match.index - 40), match.index + 30).replace(/\s+/g, ' ')}`);
      }
    }
  }
  return { old, black, thirdParty };
}

async function checkBrowser(site) {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM_PATH || undefined });
  // The phone the before screenshots were taken with.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const visit = async (path) => {
    await page.goto(`${site}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // the loader and the first reveal
  };
  // Scrolls <main> (Lenis's wrapper) so `selector` sits `offset` px below the top, as the before set did.
  const scrollTo = async (selector, offset = 0) => {
    await page.evaluate(
      ([sel, off]) => {
        const main = document.querySelector('main');
        const el = sel ? document.querySelector(sel) : null;
        const y = el ? el.getBoundingClientRect().top + main.scrollTop + off : 0;
        main.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      },
      [selector, offset],
    );
    await page.waitForTimeout(1800);
  };
  const shot = (name) => page.screenshot({ path: join(reports, `${name}.png`) });

  // The MENU pill and whether its centre is over a dark window, measured independently of the button's own logic.
  const menu = () =>
    page.evaluate(() => {
      const button = document.querySelector('#menu-button');
      const box = button.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const over = Array.from(document.querySelectorAll('[data-surface="dark"]')).some((node) => {
        const area = node.getBoundingClientRect();
        return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
      });
      const style = getComputedStyle(button);
      return { over, background: style.backgroundColor, shadow: style.boxShadow, label: getComputedStyle(button.querySelector('p:not([aria-hidden])')).color };
    });
  const pillFits = (state) => (state.over ? state.background === CARD && state.label === INK && state.shadow.includes(BORDER) : state.background === INK && state.label === ON_DARK);
  const settledMenu = async () => {
    let state = await menu();
    for (let i = 0; i < 20 && !pillFits(state); i += 1) {
      await page.waitForTimeout(250); // the label colour eases over 0.45 s
      state = await menu();
    }
    return state;
  };
  const menuOver = async (selector) => {
    let state;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const found = await page.evaluate((sel) => {
        const target = document.querySelector(sel);
        if (!target) return false;
        const main = document.querySelector('main');
        const box = document.querySelector('#menu-button').getBoundingClientRect();
        const area = target.getBoundingClientRect();
        main.scrollTo({ top: main.scrollTop + area.top - (box.top + box.height / 2) + Math.min(60, area.height / 2), behavior: 'instant' });
        return true;
      }, selector);
      assert.ok(found, `${selector} is on the page`);
      await page.waitForTimeout(800);
      state = await menu();
      if (state.over) break;
    }
    assert.ok(state.over, `could not bring a dark window under the MENU pill (${selector})`);
    state = await settledMenu();
    assert.ok(pillFits(state), `MENU pill over ${selector}: ${JSON.stringify(state)}`);
  };
  const menuOnLight = async () => {
    await scrollTo(null);
    const state = await settledMenu();
    assert.equal(state.over, false, 'the top of the page is light');
    assert.ok(pillFits(state), `MENU pill on light: ${JSON.stringify(state)}`);
  };

  const courseCards = async () => {
    const cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="projects_imageContainer"]'), (card) => {
        const style = getComputedStyle(card);
        const panel = card.closest('a')?.querySelector('[data-surface="dark"]');
        return {
          text: card.textContent,
          background: style.backgroundColor,
          code: getComputedStyle(card.firstElementChild).color,
          subtitle: getComputedStyle(card.lastElementChild).color,
          shadow: style.boxShadow,
          radius: style.borderRadius,
          panel: panel ? getComputedStyle(panel).backgroundColor : null,
        };
      }),
    );
    assert.equal(cards.length, 3, 'three course cards');
    const strip = ({ text, ...look }) => look;
    for (const card of cards) {
      assert.deepEqual(
        { background: card.background, code: card.code, subtitle: card.subtitle, panel: card.panel },
        { background: CARD, code: INK, subtitle: MUTED, panel: INK },
        `course card ${card.text}`,
      );
      assert.deepEqual(strip(card), strip(cards[0]), `${card.text} looks like ${cards[0].text}`);
    }
  };

  const pills = async () => {
    const found = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="buttonLink_btnPosnawr"]'))
        .filter((el) => el.getClientRects().length)
        .map((el) => {
          const style = getComputedStyle(el);
          return { text: el.innerText.trim(), primary: /buttonLink_primary/.test(el.className), background: style.backgroundColor, color: style.color, shadow: style.boxShadow };
        }),
    );
    for (const pill of found) {
      if (/^MARK DONE$/i.test(pill.text)) assert.ok(pill.primary, 'MARK DONE is the primary pill');
      if (pill.primary) assert.deepEqual([pill.background, pill.color], [ACCENT, CARD], `primary pill ${pill.text}`);
      else {
        assert.deepEqual([pill.background, pill.color], [CARD, INK], `secondary pill ${pill.text}`);
        assert.ok(pill.shadow.includes(BORDER), `secondary pill ${pill.text} has the ${BORDER} border: ${pill.shadow}`);
      }
    }
    return found;
  };

  // Every element's painted colours: no old colour, no yellow, no saturated colour beyond the accent and status
  // colours, and the accent never on a large surface.
  const sweep = async (label) => {
    const problems = await page.evaluate(
      ({ old, saturated, accent }) => {
        const found = [];
        const hsl = (r, g, b) => {
          const [R, G, B] = [r / 255, g / 255, b / 255];
          const max = Math.max(R, G, B);
          const min = Math.min(R, G, B);
          const l = (max + min) / 2;
          const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
          let h = 0;
          if (max !== min) {
            if (max === R) h = ((G - B) / (max - min)) % 6;
            else if (max === G) h = (B - R) / (max - min) + 2;
            else h = (R - G) / (max - min) + 4;
          }
          return { h: (h * 60 + 360) % 360, s, l };
        };
        const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className ? `.${el.className.split(' ')[0]}` : ''}`;
        for (const el of document.querySelectorAll('body *')) {
          const style = getComputedStyle(el);
          const values = [
            ['color', style.color],
            ['background-color', style.backgroundColor],
            ['box-shadow', style.boxShadow],
          ];
          if (style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) > 0) values.push(['border-top-color', style.borderTopColor]);
          if (style.borderBottomStyle !== 'none' && parseFloat(style.borderBottomWidth) > 0) values.push(['border-bottom-color', style.borderBottomColor]);
          if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) values.push(['outline-color', style.outlineColor]);
          if (el instanceof SVGElement) values.push(['fill', style.fill], ['stroke', style.stroke]);
          for (const [property, value] of values) {
            for (const match of String(value).matchAll(/rgba?\(([^)]+)\)/g)) {
              const [r, g, b, a = 1] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
              if (a === 0) continue;
              const key = `${r}, ${g}, ${b}`;
              const { h, s, l } = hsl(r, g, b);
              if (old.includes(key)) found.push(`${describe(el)} ${property}: old colour rgb(${key})`);
              else if (s > 0.25 && l > 0.08 && l < 0.97 && !saturated.includes(key)) found.push(`${describe(el)} ${property}: rgb(${key}) is not a palette colour${h >= 40 && h <= 100 ? ' (yellow)' : ''}`);
            }
          }
          if (style.backgroundColor === accent && el.offsetWidth * el.offsetHeight > 60000) found.push(`${describe(el)}: the accent on a ${el.offsetWidth}×${el.offsetHeight} surface`);
        }
        return Array.from(new Set(found));
      },
      { old: OLD_RGB, saturated: SATURATED, accent: ACCENT },
    );
    assert.deepEqual(problems.slice(0, 30), [], `${label}: colours outside the palette`);
  };

  try {
    // The Desk: the before set's spots, then the checks.
    await visit('');
    for (const [name, selector, offset] of [
      ['01-desk-top', null, 0],
      ['02-desk-next-up', '[class*="about_container"]', -70],
      ['03-desk-badge-cen100', '[class*="clients_first"]', -70],
      ['04-desk-badge-mth140', '[class*="clients_second"]', -70],
      ['05-desk-badge-mth141', '[class*="clients_third"]', -70],
      ['06-desk-course-cards-1', '[class*="projects_innerContainer"]', -70],
      ['07-desk-course-cards-2', '[class*="projects_card"]:nth-child(3)', -380],
    ]) {
      await scrollTo(selector, offset);
      await shot(name);
    }
    await check('Desk: the MENU pill is ink on the light page', menuOnLight);
    await check('Desk: the MENU pill turns light over a badge window', () => menuOver('[class*="clients_first"]'));
    await check('Desk: the MENU pill turns light over a course card panel', () => menuOver('[class*="projects_canvas"]'));
    await check('Desk: the MENU pill is ink again back on the light page', menuOnLight);
    await check('Desk: the three course cards are identical apart from their text', courseCards);
    await check('Desk: secondary and primary pills', async () => {
      assert.ok((await pills()).length > 0, 'pills on the Desk');
    });
    await check('Desk: the round button is white with a border and an ink icon', async () => {
      const round = await page.evaluate(() => {
        const button = document.querySelector('button[aria-label="Back to top"]');
        if (!button) return null;
        const style = getComputedStyle(button);
        return { background: style.backgroundColor, shadow: style.boxShadow, icon: getComputedStyle(button.querySelector('svg')).fill };
      });
      assert.ok(round, 'the Back to top button');
      assert.equal(round.background, CARD);
      assert.ok(round.shadow.includes(BORDER), round.shadow);
      assert.equal(round.icon, INK);
    });
    await check('Desk: the countdown takes its status colour and badge', async () => {
      const face = await page.evaluate(() => {
        const countdown = document.querySelector('[class*="about_countdown"][data-status]');
        if (!countdown) return null;
        const number = countdown.querySelector('[class*="about_digits"], [class*="about_word"]');
        const badge = document.querySelector('[class*="about_statusBadge"]');
        return {
          status: countdown.dataset.status,
          number: number && getComputedStyle(number).color,
          badge: badge && { text: badge.textContent.trim(), color: getComputedStyle(badge).color, background: getComputedStyle(badge).backgroundColor },
        };
      });
      if (!face) {
        notes.push('No countdown was running on the Desk at test time, so its status colour was not checked in the browser (tests/palette.test.mjs covers the thresholds).');
        return;
      }
      const status = STATUS[face.status];
      assert.ok(status, `known status ${face.status}`);
      assert.equal(face.number, rgb(status.color), 'countdown number');
      assert.ok(face.badge, 'status badge');
      assert.deepEqual([face.badge.text, face.badge.color], [status.label, rgb(status.color)], 'status badge');
      if (face.status === 'onTrack') assert.equal(face.badge.background, ACCENT_TINT, 'On track badge tint');
      notes.push(`Desk countdown status at test time: ${face.status} (${status.label}).`);
    });
    await check('Desk: only palette colours', () => sweep('Desk'));

    await visit('courses/');
    await shot('08-courses-page');
    await check('Courses: the three course cards are identical apart from their text', courseCards);
    await check('Courses: the MENU pill is ink on the light page', menuOnLight);
    await check('Courses: only palette colours', () => sweep('Courses'));

    const summaries = [];
    for (const [name, path] of [
      ['09-cen100', 'cen100/'],
      ['10-mth140', 'mth140/'],
      ['11-mth141', 'mth141/'],
    ]) {
      await visit(path);
      await shot(name);
      await check(`/${path}: the next-deadline card and its link`, async () => {
        const summary = await page.evaluate(() => {
          const card = document.querySelector('[class*="workspace_summary"]');
          if (!card) return null;
          const style = getComputedStyle(card);
          const link = card.querySelector('a');
          return { background: style.backgroundColor, shadow: style.boxShadow, radius: style.borderRadius, color: style.color, link: link ? getComputedStyle(link).color : null };
        });
        assert.ok(summary, 'the next-deadline card');
        assert.equal(summary.background, CARD);
        assert.ok(summary.shadow.includes(BORDER), summary.shadow);
        if (summary.link) assert.equal(summary.link, ACCENT, 'the next-deadline link');
        summaries.push(summary);
      });
      await check(`/${path}: the MENU pill is ink on the light page`, menuOnLight);
      await check(`/${path}: pills`, () => pills());
      await check(`/${path}: only palette colours`, () => sweep(path));
      if (path === 'cen100/') {
        await scrollTo('[class*="workspace_workGroup"]', -70);
        await shot('12-cen100-work');
      }
    }
    await check('the three course pages share one next-deadline card', () => {
      assert.equal(summaries.length, 3);
      const look = ({ link, ...rest }) => rest;
      for (const summary of summaries) assert.deepEqual(look(summary), look(summaries[0]));
    });
    await check('no page errors', () => assert.deepEqual(errors, []));
  } finally {
    await browser.close();
  }
}

await mkdir(reports, { recursive: true });
const scan = await scanFiles();
await check('no old colour in the published files', () => assert.deepEqual(scan.old.slice(0, 20), []));
await check('black with alpha only in third-party calendar styles', () => assert.deepEqual(scan.black.slice(0, 20), []));
const { server, site } = await servePages(folder);
try {
  await checkBrowser(site);
} finally {
  server.close();
}

const report = [
  '## Palette check',
  failures.length ? `**${failures.length} check(s) failed:**\n\n${failures.map((failure) => `- ${failure}`).join('\n')}` : 'All palette checks passed.',
  notes.length ? `\n${notes.map((note) => `- ${note}`).join('\n')}` : '',
  `\nThird-party colour hits in the published files (allowed, not the site's own source): ${scan.thirdParty.length}`,
  ...scan.thirdParty.slice(0, 40).map((hit) => `- ${hit}`),
  `\nScreenshots (390 px, 2x): artifact \`pages-site-qa\`, folder \`palette/\`.`,
].join('\n');
console.log(`\n${report}`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
if (failures.length) process.exit(1);
