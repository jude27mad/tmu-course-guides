import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { DARK, DARK_QUERY, TOKENS, pageEdgeColor, prefersDark, rgbOf } from '../src/lib/palette.mjs';

// Dark mode follows the device setting. Only the page and what sits on it change; every dark panel keeps its
// colours, so the Safari edge rules pinned in under-safari-bars.test.mjs hold in both schemes.

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const scss = await read('../src/styles/colors.scss');
const global = await read('../src/styles/global.scss');

const luminance = (hex) => {
  const [r, g, b] = rgbOf(hex).split(', ').map((byte) => {
    const c = Number(byte) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// The `$name: ( 'key': #hex, … );` map in colors.scss.
const sassMap = (name) => {
  const body = scss.match(new RegExp(`\\$${name}: \\(([^;]*)\\);`))?.[1];
  assert.ok(body, `$${name} in colors.scss`);
  return Object.fromEntries([...body.matchAll(/'(\w+)': (#[0-9a-f]{6})/gi)].map(([, key, value]) => [key, value.toUpperCase()]));
};

test('colors.scss mirrors DARK, after the light map, for screens in dark mode only', () => {
  const dark = sassMap('dark');
  assert.deepEqual(dark, {
    white: DARK.page,
    pageUnderGrain: DARK.pageUnderGrain,
    text: DARK.text,
    card: DARK.card,
    fillColor: DARK.card,
    muted: DARK.muted,
    border: DARK.border,
    accent: DARK.accent,
    accentTint: DARK.accentTint,
    onAccent: DARK.onAccent,
    statusOnTrack: DARK.onTrack,
    statusSoon: DARK.soon,
    statusUrgent: DARK.urgent,
    statusDone: DARK.done,
  });
  // palette.test.mjs reads the first value of each name: the light map must come first.
  assert.ok(scss.indexOf('$colors: (') < scss.indexOf('$dark: ('));
  const block = scss.slice(scss.indexOf('@media screen and (prefers-color-scheme: dark)'));
  assert.ok(scss.indexOf('$dark: (') < scss.indexOf('@media screen and (prefers-color-scheme: dark)'));
  assert.match(block, /@each \$name, \$color in \$dark/);
  assert.match(block, /color: var\(--text\);/);
});

test('the dark panels, the ink and the light channels keep their colours in dark mode', () => {
  const dark = sassMap('dark');
  for (const key of ['black', 'menuColor', 'menuFontColor', 'accentColor', 'raised', 'sheen', 'onDark', 'mutedOnDark', 'borderOnDark', 'panelText']) {
    assert.ok(!(key in dark), `--${key} must not change in dark mode`);
  }
  const block = scss.slice(scss.indexOf('@media screen and (prefers-color-scheme: dark)'));
  // The ink's channels shade the dark end and the dark glass; the page's light channel draws the scrollbar.
  for (const name of ['inkRgb', 'pageRgb', 'onDarkRgb', 'mutedOnDarkRgb', 'highlightRgb']) {
    assert.ok(!new RegExp(`'${name}'|--${name}:`).test(block), `--${name} must not change in dark mode`);
  }
  assert.match(block, /\('cardRgb': 'card', 'textRgb': 'text', 'accentRgb': 'accent'\)/);
});

test('the light values of the new role tokens equal the ones they replace', () => {
  const light = sassMap('colors');
  assert.equal(light.text, light.black);
  assert.equal(light.panelText, light.white);
  assert.equal(light.onAccent, light.card);
  assert.equal(TOKENS.text, TOKENS.ink);
  assert.equal(TOKENS.panelText, TOKENS.page);
  assert.equal(TOKENS.onAccent, TOKENS.card);
  // The light glass's sheen and rim, as glass.scss drew them before.
  assert.match(scss, /--glassHighlight: rgba\(var\(--cardRgb\), 0\.65\);\s*--glassEdge: rgba\(var\(--inkRgb\), 0\.18\);/);
});

test('dark mode colours meet WCAG AA', () => {
  const body = [
    ['text on page', DARK.text, DARK.page],
    ['text on card', DARK.text, DARK.card],
    ['text on border (done calendar event)', DARK.text, DARK.border],
    ['muted on page', DARK.muted, DARK.page],
    ['muted on card', DARK.muted, DARK.card],
    ['accent on page', DARK.accent, DARK.page],
    ['accent on card', DARK.accent, DARK.card],
    ['accent on tint', DARK.accent, DARK.accentTint],
    ['text on tint', DARK.text, DARK.accentTint],
    ['label on accent', DARK.onAccent, DARK.accent],
    ['page on text (pressed filter, today in the calendar)', DARK.page, DARK.text],
    ['on track on page', DARK.onTrack, DARK.page],
    ['on track on card', DARK.onTrack, DARK.card],
    ['soon on page', DARK.soon, DARK.page],
    ['soon on card', DARK.soon, DARK.card],
    ['urgent on page', DARK.urgent, DARK.page],
    ['urgent on card', DARK.urgent, DARK.card],
    ['done on page', DARK.done, DARK.page],
    ['done on card', DARK.done, DARK.card],
    ['on dark on ink (toasts, the target label)', TOKENS.onDark, TOKENS.ink],
    ['panel text on ink', TOKENS.panelText, TOKENS.ink],
  ];
  for (const [name, fg, bg] of body) assert.ok(contrast(fg, bg) >= 4.5, `${name}: ${contrast(fg, bg).toFixed(2)}`);
  // Focus rings and the shrunk page's edge are non-text: 3:1.
  assert.ok(contrast(DARK.accent, DARK.page) >= 3);
  assert.ok(contrast(DARK.accent, DARK.card) >= 3);
  assert.ok(contrast(DARK.pageEdge, TOKENS.ink) >= 3, `page edge on the ink: ${contrast(DARK.pageEdge, TOKENS.ink).toFixed(2)}`);
  assert.ok(contrast(DARK.pageEdge, DARK.page) >= 3, `page edge on the page: ${contrast(DARK.pageEdge, DARK.page).toFixed(2)}`);
});

// Each declaration in the site's styles: [file, property, value].
async function* declarations() {
  const src = fileURLToPath(new URL('../src/', import.meta.url));
  async function* walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) yield* walk(path);
      else if (['.scss', '.css'].includes(extname(entry.name))) yield path;
    }
  }
  for await (const path of walk(src)) {
    const text = (await readFile(path, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const match of text.matchAll(/([-\w]+)\s*:\s*([^;{}]*var\(--(?:black|white)\)[^;{}]*);/g)) {
      yield [path.slice(src.length).replaceAll('\\', '/'), match[1], match[2].trim()];
    }
  }
}
const TEXT = /^(color|fill|stroke|caret-color|outline(-color)?|border(-\w+)*|text-decoration(-color)?|-webkit-text-stroke(-color)?|--sx-color-on-[\w-]+|--sx-internal-color-text)$/;

test('text on the page uses --text, text on the dark panels --panelText', async () => {
  const ink = [];
  const paper = [];
  for await (const [file, property, value] of declarations()) {
    if (!TEXT.test(property)) continue;
    if (value.includes('var(--black)')) ink.push(`${file} ${property}`);
    if (value.includes('var(--white)')) paper.push(`${file} ${property}`);
  }
  // --black is the ink of the dark panels, which stays dark: as a text colour it would vanish on the dark page.
  // The one exception is unrendered (the old next-course card, text on its own light gradient).
  assert.deepEqual(ink, ['pages/course/components/nextCourse/styles/nextCourse.module.scss color']);
  // --white is the page: as text it is only the page's colour on an ink or text-coloured fill.
  assert.deepEqual(paper.sort(), [
    'pages/components/home/styles/home.module.scss fill', // the Desk mask's paper (.mask2)
    'pages/course/components/workspace/calendar.module.scss --sx-color-on-primary', // today, dark mode
    'pages/course/components/workspace/workspace.module.scss color', // the pressed Work filter
  ]);
});

test('controls on the dark panels keep their light colours, and Schedule-X its lines', async () => {
  // The footer's back-to-top disc and the course cards' badge frame sit on dark panels.
  const footer = await read('../src/components/dom/styles/footer.module.scss');
  assert.match(footer, /@media screen and \(prefers-color-scheme: dark\) \{\s*\.circleButton \{\s*--card: #ffffff;\s*--text: #18181b;\s*--border: #e4e4e7;\s*\}\s*\}/);
  const light = sassMap('colors');
  assert.deepEqual(['#FFFFFF', '#18181B', '#E4E4E7'], [light.card, light.text, light.border]);
  const projects = await read('../src/pages/components/projects/styles/projects.module.scss');
  assert.match(projects, /@media screen and \(prefers-color-scheme: dark\) \{\s*box-shadow: 0 0 0 0\.01vw #e4e4e7;\s*\}/);
  // Schedule-X composes --sx-border on :root from its own grey, so the dark block sets it again.
  const calendar = await read('../src/pages/course/components/workspace/calendar.module.scss');
  assert.match(calendar.slice(calendar.indexOf('@media screen and (prefers-color-scheme: dark)')), /--sx-border: 1px solid var\(--border\);/);
});

test('the document follows the device scheme', async () => {
  const doc = await read('../src/pages/_document.page.jsx');
  assert.match(doc, /<meta name="color-scheme" content="light dark" \/>/);
  const light = doc.indexOf('<meta name="theme-color" media="(prefers-color-scheme: light)" content={TOKENS.page} />');
  const dark = doc.indexOf('<meta name="theme-color" media="(prefers-color-scheme: dark)" content={DARK.page} />');
  assert.ok(light > -1 && dark > light, 'one theme-color per scheme, light first');
  assert.match(global, /color-scheme: light dark;/);
  assert.doesNotMatch(global, /only light/);
  assert.match(global, /@media screen and \(prefers-color-scheme: dark\) \{\s*#layout::before \{\s*background-image: url\('#\{\$base-path\}\/other\/grain-dark\.png'\);\s*\}\s*\}/);
  assert.match(global, /@media print \{\s*html \{\s*color-scheme: light;\s*\}\s*\}/);
  assert.equal(DARK_QUERY, '(prefers-color-scheme: dark)');
  // Outside a browser there is no device setting: light.
  assert.equal(prefersDark(), false);
  assert.equal(pageEdgeColor(), TOKENS.page);
});

test('the colour Safari paints past the page is the page as seen through its grain, in both schemes', async () => {
  assert.match(global, /#layout::before \{[^}]*background-image: url\('#\{\$base-path\}\/other\/grain\.png'\);\s*opacity: 0\.65;/);
  const OPACITY = 0.65;
  // The mean colour of `page` under the grain texture at the page's opacity.
  const shown = async (file, hex) => {
    const { data, info } = await sharp(fileURLToPath(new URL(`../public/other/${file}`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const page = rgbOf(hex).split(', ').map(Number);
    const sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += info.channels) {
      const a = (data[i + 3] / 255) * OPACITY;
      for (let c = 0; c < 3; c += 1) sum[c] += page[c] * (1 - a) + data[i + c] * a;
    }
    return sum.map((value) => value / (data.length / info.channels));
  };
  const near = (actual, hex, tolerance, name) => {
    const expected = rgbOf(hex).split(', ').map(Number);
    actual.forEach((value, c) => assert.ok(Math.abs(value - expected[c]) <= tolerance, `${name}: ${actual.map((v) => v.toFixed(2))} vs ${hex}`));
  };
  // The light value is the long-standing #F1F1F1, a neutral grey: the grained page's blue shows 1.6 higher.
  near(await shown('grain.png', TOKENS.page), TOKENS.pageUnderGrain, 1.6, 'light page');
  near(await shown('grain-dark.png', DARK.page), DARK.pageUnderGrain, 1, 'dark page');
  // The ink under each grain stays within about a level of the flat ink Safari paints past a dark end.
  near(await shown('grain.png', TOKENS.ink), TOKENS.ink, 1.25, 'ink, light grain');
  near(await shown('grain-dark.png', TOKENS.ink), TOKENS.ink, 1.25, 'ink, dark grain');
});

test('colours written from scripts follow the stylesheet in both schemes', async () => {
  const theme = await read('../src/utils/theme.js');
  // An inline palette value would hold in dark mode too; the default palette is never written inline.
  assert.match(theme, /if \(full\[key\] === DEFAULT_PALETTE\[key\]\) root\.style\.removeProperty\(name\);/);
  assert.match(theme, /themeMetas\(\)\.forEach\(\(meta\) => meta\.setAttribute\('content', topDark \? TOKENS\.ink : edgeFor\(meta, DEFAULT_PALETTE\.secondary\)\)\);/);
  assert.match(theme, /export function watchColorScheme\(\)/);
  const app = await read('../src/pages/_app.page.jsx');
  assert.match(app, /useEffect\(\(\) => watchColorScheme\(\), \[\]\);/);
  assert.match(app, /<ColorSchemeSync \/>/);
  // Schedule-X writes the event colours on <html>: palette variables, so they resolve per scheme.
  const calendar = await read('../src/pages/course/components/workspace/Calendar.jsx');
  assert.doesNotMatch(calendar, /TOKENS\./);
  assert.match(calendar, /lightColors: \{ main: 'var\(--accent\)', container: 'var\(--card\)', onContainer: 'var\(--text\)' \}/);
  assert.doesNotMatch(calendar, /isDark\s*:/);
  // Behind a panel on a phone the page dims to 5%, where only the paper's light edge shows.
  assert.match(await read('../src/components/dom/navbar/panelShell.js'), /border: `2px solid \$\{pageEdgeColor\(isMobile\)\}`/);
  assert.match(await read('../src/components/dom/Layout.jsx'), /border: `2px solid \$\{pageEdgeColor\(\)\}`/);
  for (const path of ['../src/components/dom/navbar/panelShell.js', '../src/components/dom/Layout.jsx']) assert.doesNotMatch(await read(path), /TOKENS\.page/, path);
  assert.equal(pageEdgeColor(true), TOKENS.page);
  // A change of scheme rebuilds the Menu/Search shell for the new edge colour; it rewinds the old timeline first,
  // or the new one would record the shrunk page as its start and leave the page shrunk once the panel closed.
  const navbar = await read('../src/components/dom/navbar/Index.jsx');
  assert.match(navbar, /const dark = useMediaQuery\(DARK_QUERY\);/);
  assert.match(navbar, /\}, \[isLoading, isMobile, dark\]\);/);
  assert.match(navbar, /const schemeChanged = dark !== prefersDark\(\) && useStore\.getState\(\)\.isTransitioning !== 'handoff';/);
  assert.match(navbar, /if \(\(isMobile !== isMobileNow\(\) \|\| schemeChanged\) && tl\.progress\(\) > 0\) tl\.progress\(0\);/);
});
