import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { ARTWORK_GLOW, DARK, DARK_QUERY, FIELD, FIELD_DARK, TOKENS, pageEdgeColor, prefersDark, rgbOf } from '../src/lib/palette.mjs';

// Dark mode follows the device setting. The page has no colour of its own: it is the moving black artwork behind
// it, the one black of dark mode, with light text. Cards and pills keep the light palette (styles/island.scss), and
// the dark panels keep theirs, so the Safari edge rules pinned in under-safari-bars.test.mjs hold in both schemes.

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const scss = await read('../src/styles/colors.scss');
const global = await read('../src/styles/global.scss');
const src = fileURLToPath(new URL('../src/', import.meta.url));

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

// The `$name: ( 'key': value, … );` map in colors.scss.
const sassMap = (name) => {
  const body = scss.match(new RegExp(`\\$${name}: \\(([^;]*)\\);`))?.[1];
  assert.ok(body, `$${name} in colors.scss`);
  return Object.fromEntries([...body.matchAll(/'(\w+)': (rgba\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)/gi)].map(([, key, value]) => [key, value.toLowerCase()]));
};
const darkBlock = scss.slice(scss.indexOf('@media screen and (prefers-color-scheme: dark)'));

test('colors.scss mirrors DARK, after the light map, for screens in dark mode only', () => {
  const lower = (value) => value.toLowerCase();
  assert.deepEqual(sassMap('dark'), {
    white: 'transparent',
    pageUnderGrain: lower(DARK.pageUnderGrain),
    text: lower(DARK.text),
    muted: lower(DARK.muted),
    border: lower(DARK.border),
    accent: lower(DARK.accent),
    accentTint: lower(DARK.accentTint),
    onAccent: lower(DARK.onAccent),
    statusOnTrack: lower(DARK.onTrack),
    statusSoon: lower(DARK.soon),
    statusUrgent: lower(DARK.urgent),
    statusDone: lower(DARK.done),
  });
  // palette.test.mjs reads the first value of each name: the light map must come first.
  assert.ok(scss.indexOf('$colors: (') < scss.indexOf('$dark: ('));
  assert.ok(scss.indexOf('$dark: (') < scss.indexOf('@media screen and (prefers-color-scheme: dark)'));
  assert.match(darkBlock, /@each \$name, \$color in \$dark/);
  assert.match(darkBlock, /color: var\(--text\);/);
  // The page's base where the artwork is not drawn, theme-color and the colour Safari paints past the ends: the ink.
  assert.equal(DARK.page, TOKENS.ink);
  assert.equal(DARK.pageUnderGrain, TOKENS.ink);
});

test('the dark panels and the cards keep their colours; cards and pills are islands of the light palette', async () => {
  const dark = sassMap('dark');
  for (const key of ['black', 'menuColor', 'menuFontColor', 'accentColor', 'raised', 'sheen', 'onDark', 'mutedOnDark', 'borderOnDark', 'panelText', 'card', 'fillColor']) {
    assert.ok(!(key in dark), `--${key} must not change in dark mode`);
  }
  for (const name of ['inkRgb', 'pageRgb', 'cardRgb', 'onDarkRgb', 'mutedOnDarkRgb', 'highlightRgb', 'glassHighlight', 'glassEdge']) {
    assert.ok(!new RegExp(`'${name}'|--${name}:`).test(darkBlock), `--${name} must not change in dark mode`);
  }
  assert.match(darkBlock, /\('textRgb': 'text', 'accentRgb': 'accent'\)/);
  // The light palette under --light-* names, kept in both schemes, and the island mixin that brings it back.
  const kept = scss.match(/\$island: \(([^)]*)\);/)[1].match(/'(\w+)'/g).map((name) => name.slice(1, -1));
  assert.deepEqual(kept, ['white', 'text', 'card', 'fillColor', 'muted', 'border', 'accent', 'accentTint', 'onAccent', 'statusOnTrack', 'statusSoon', 'statusUrgent', 'statusDone']);
  const light = scss.slice(0, scss.indexOf('$dark: ('));
  assert.match(light, /@each \$name in \$island \{\s*--light-#\{\$name\}: #\{map\.get\(\$colors, \$name\)\};\s*\}/);
  assert.match(light, /\('cardRgb': 'card', 'textRgb': 'text', 'accentRgb': 'accent'\) \{\s*--light-#\{\$name\}/);
  const island = await read('../src/styles/island.scss');
  const tokens = island.match(/\$tokens: \(([^)]*)\);/)[1].match(/'(\w+)'/g).map((name) => name.slice(1, -1));
  assert.deepEqual(tokens, [...kept, 'cardRgb', 'textRgb', 'accentRgb']);
  assert.match(island, /@media screen and \(prefers-color-scheme: dark\) \{\s*@each \$name in \$tokens \{\s*--#\{\$name\}: var\(--light-#\{\$name\}\);/);
  assert.match(island, /--focus: var\(--light-accent\);\s*color: var\(--light-text\);/);
});

test('the light values of the role tokens equal the ones they replace', () => {
  const light = sassMap('colors');
  assert.equal(light.text, light.black);
  assert.equal(light.panelText, light.white);
  assert.equal(light.onAccent, light.card);
  assert.equal(TOKENS.text, TOKENS.ink);
  assert.equal(TOKENS.panelText, TOKENS.page);
  assert.equal(TOKENS.onAccent, TOKENS.card);
  assert.match(scss, /--glassHighlight: rgba\(var\(--cardRgb\), 0\.65\);\s*--glassEdge: rgba\(var\(--inkRgb\), 0\.18\);/);
});

test("text on the dark page meets WCAG AA over the ink and over the artwork's brightest band", () => {
  for (const [name, color] of [
    ['text', DARK.text],
    ['muted', DARK.muted],
    ['accent (links)', DARK.accent],
    ['on track', DARK.onTrack],
    ['soon', DARK.soon],
    ['urgent', DARK.urgent],
    ['done', DARK.done],
  ]) {
    for (const [under, behind] of [
      ['the ink', DARK.page],
      ["the artwork's glow", ARTWORK_GLOW],
    ]) {
      assert.ok(contrast(color, behind) >= 4.5, `${name} on ${under}: ${contrast(color, behind).toFixed(2)}`);
    }
  }
  assert.ok(contrast(DARK.onAccent, DARK.accent) >= 4.5, 'a label on an accent fill');
  assert.ok(contrast(DARK.text, DARK.accentTint) >= 4.5, 'text on the accent tint');
  // Focus rings and the shrunk page's edge are non-text: 3:1.
  assert.ok(contrast(DARK.accent, ARTWORK_GLOW) >= 3);
  assert.ok(contrast(DARK.pageEdge, TOKENS.ink) >= 3, `page edge on the ink: ${contrast(DARK.pageEdge, TOKENS.ink).toFixed(2)}`);
  // Cards keep the light palette (palette.test.mjs checks its pairs), and the panels theirs.
  assert.ok(contrast(TOKENS.onDark, TOKENS.ink) >= 4.5);
});

// The site's live style sheets (the unrendered course components are left out).
const DEAD = /^pages\/course\/components\/(hero|deadlines|nextCourse|checklist|tiles|overview|info|details)\/|^pages\/course\/course\.module\.scss$/;
async function* styleFiles(dir = src) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* styleFiles(path);
    else if (['.scss', '.css'].includes(extname(entry.name))) yield [path.slice(src.length).replaceAll('\\', '/'), await readFile(path, 'utf8')];
  }
}
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// Each declaration in the site's styles: [file, property, value].
async function* declarations() {
  for await (const [file, raw] of styleFiles()) {
    for (const match of stripComments(raw).matchAll(/([-\w]+)\s*:\s*([^;{}]*var\(--(?:black|white)\)[^;{}]*);/g)) yield [file, match[1], match[2].trim()];
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
  // --black is the ink of the dark panels: as a text colour it would vanish on the dark page.
  // The one exception is unrendered (the old next-course card, text on its own light gradient).
  assert.deepEqual(ink, ['pages/course/components/nextCourse/styles/nextCourse.module.scss color']);
  // --white is the page (clear in dark mode): as text it is only the page's colour on a text-coloured fill.
  assert.deepEqual(paper.sort(), [
    'pages/components/home/styles/home.module.scss fill', // the Desk mask's paper (.mask2)
    'pages/course/components/workspace/workspace.module.scss color', // the pressed Schedule toggle
  ]);
});

// The rule blocks of a style sheet, each with the statements written directly in it and its ancestors.
function blocks(text) {
  const found = [];
  const stack = [{ selector: '', own: '', parents: [] }];
  let buffer = '';
  for (const char of stripComments(text)) {
    if (char === '{') {
      const block = { selector: buffer.trim(), own: '', parents: stack.slice() };
      stack.push(block);
      found.push(block);
      buffer = '';
    } else if (char === '}') {
      stack.at(-1).own += buffer;
      stack.pop();
      buffer = '';
    } else if (char === ';') {
      stack.at(-1).own += `${buffer};`;
      buffer = '';
    } else buffer += char;
  }
  return found;
}
const chain = (block) => [...block.parents.slice(1), block].map((each) => each.selector).join(' ');
const inHover = (block) => [block, ...block.parents].some((each) => /:hover/.test(each.selector));
// Pieces that sit inside a card in the page (their own rule is not nested in the card's): the Guide tools close
// pill (in .dialog), the calendar's header (in .calendar) and the letter-grade chips (in .targets).
const INSIDE_A_CARD = ['pages/course/components/tools/styles/guideTools.module.scss .close', 'pages/course/components/workspace/calendar.module.scss .calendar :global(.sx__calendar-header)', "pages/course/components/workspace/grades.module.scss .chip &[data-state='unreachable']"];

test('every card and pill keeps the light palette in dark mode', async () => {
  const bare = [];
  for await (const [file, text] of styleFiles()) {
    if (DEAD.test(file) || file === 'styles/glass.scss' || file === 'styles/colors.scss') continue;
    const all = blocks(text);
    // The rules (by their nesting) that include the island, here or in another rule for the same selector.
    const islands = new Set(all.filter((block) => /@include island\.light/.test(block.own)).map(chain));
    const islanded = (block) => [block, ...block.parents.slice(1)].some((each) => islands.has(chain(each)));
    for (const block of all) {
      if (/@media[^{]*prefers-color-scheme: dark/.test(block.selector)) continue;
      // A card surface: the card or fill colour as a background (a hovered row is handled below).
      if (/background(-color)?:\s*var\(--(card|fillColor)\)/.test(block.own) && !inHover(block) && !islanded(block) && !INSIDE_A_CARD.includes(`${file} ${chain(block)}`)) bare.push(`${file} ${chain(block)}`);
    }
  }
  assert.deepEqual(bare, []);
  // Every glass control, whatever its tone, is a light pill in dark mode.
  const glass = await read('../src/styles/glass.scss');
  assert.match(glass, /@use '@src\/styles\/island';/);
  assert.match(glass, /@include island\.light;\s*background-color: var\(--glass-solid\);/);
  assert.match(glass, /@media screen and \(prefers-color-scheme: dark\) \{\s*--glass-solid: var\(--light-card\);/);
  // The page-coloured sheets that are cards: the Guide tools dialog and the navigation toast; and the dark
  // "Opening…" toast, which turns light.
  const tools = await read('../src/pages/course/components/tools/styles/guideTools.module.scss');
  assert.match(tools, /background: var\(--white\);\s*color: var\(--text\);\s*@include island\.light;/);
  const feedback = await read('../src/components/dom/styles/navigationFeedback.module.scss');
  assert.match(feedback, /background: var\(--white\);\s*color: var\(--text\);\s*@include island\.light;/);
  const workspace = await read('../src/pages/course/components/workspace/workspace.module.scss');
  assert.match(workspace, /background: var\(--black\);\s*color: var\(--onDark\);[^}]*@include island\.light;\s*@media screen and \(prefers-color-scheme: dark\) \{\s*background: var\(--light-card\);/);
  // The calendar is a light card, with the event colours Schedule-X writes on <html> set again inside it.
  const calendar = await read('../src/pages/course/components/workspace/calendar.module.scss');
  assert.match(calendar, /\.calendar \{\s*@include island\.light;\s*@media screen and \(prefers-color-scheme: dark\) \{\s*--sx-color-due: var\(--accent\);/);
});

test('a hovered row takes a faint lift in dark mode, not the white card fill', async () => {
  for (const path of ['../src/pages/course/components/workspace/workspace.module.scss', '../src/pages/course/components/workspace/calendar.module.scss']) {
    const text = await read(path);
    const hovers = text.match(/&:hover \{\s*background: var\(--fillColor\);/g) || [];
    const lifted = text.match(/&:hover \{\s*background: var\(--fillColor\);[^}]*@media screen and \(prefers-color-scheme: dark\) \{\s*background: rgba\(var\(--highlightRgb\), 0\.06\);/g) || [];
    assert.ok(hovers.length > 0, path);
    assert.equal(lifted.length, hovers.length, path);
  }
});

test('the page is the moving artwork: see-through surfaces, the Desk field and the course cards', async () => {
  // Under the see-through page, the root and body are the artwork's ink.
  assert.match(global, /html:not\(\[data-scroll-mode='document'\]\),\s*html:not\(\[data-scroll-mode='document'\]\) body \{\s*background-color: var\(--black\);\s*\}/);
  // The Desk's signal field has no panel of its own in dark mode.
  assert.deepEqual(FIELD, { background: TOKENS.ink, point: TOKENS.mutedOnDark, signal: TOKENS.onDark });
  assert.deepEqual(FIELD_DARK, { background: null, point: TOKENS.mutedOnDark, signal: TOKENS.onDark });
  const field = await read('../src/components/artwork/signalField.mjs');
  assert.match(field, /if \(paint\.background\) \{\s*ctx\.fillStyle = paint\.background;\s*ctx\.fillRect\(0, 0, width, height\);/);
  assert.match(field, /if \(state\.colors\) paint = paintFor\(state\.colors\);/);
  const fieldJsx = await read('../src/components/artwork/SignalField.jsx');
  assert.match(fieldJsx, /colors: prefersDark\(\) \? FIELD_DARK : FIELD,/);
  assert.match(fieldJsx, /update\(\{ colors: prefersDark\(\) \? FIELD_DARK : FIELD \}\)/);
  assert.match(await read('../src/components/artwork/signalField.module.scss'), /@media screen and \(prefers-color-scheme: dark\) \{\s*\.field \{\s*background-color: transparent;/);
  // The course cards on Courses take no tint of their own until hovered.
  assert.match(await read('../src/pages/components/projects/styles/projects.module.scss'), /background-color: var\(--card-menu\);\s*(\/\/[^\n]*\s*)?@media screen and \(prefers-color-scheme: dark\) \{\s*opacity: 0;/);
  // On iPhone and iPad the course pages end in a fade into the ink Safari paints past the end.
  assert.match(await read('../src/pages/course/components/workspace/workspace.module.scss'), /@media screen and \(prefers-color-scheme: dark\) \{\s*:global\(html\[data-scroll-mode='document'\]\) & \{\s*background-image: var\(--dark-end-fade\);/);
});

test('the document follows the device scheme', async () => {
  const doc = await read('../src/pages/_document.page.jsx');
  assert.match(doc, /<meta name="color-scheme" content="light dark" \/>/);
  const light = doc.indexOf('<meta name="theme-color" media="(prefers-color-scheme: light)" content={TOKENS.page} />');
  const dark = doc.indexOf('<meta name="theme-color" media="(prefers-color-scheme: dark)" content={DARK.page} />');
  assert.ok(light > -1 && dark > light, 'one theme-color per scheme, light first');
  assert.match(global, /color-scheme: light dark;/);
  assert.doesNotMatch(global, /only light/);
  assert.match(global, /@media screen and \(prefers-color-scheme: dark\) \{\s*#layout::before \{\s*background-image: url\('#\{\$base-path\}\/other\/grain-dark\.png'\);\s*\}/);
  assert.match(global, /@media print \{\s*html \{\s*color-scheme: light;\s*\}\s*\}/);
  assert.equal(DARK_QUERY, '(prefers-color-scheme: dark)');
  // Outside a browser there is no device setting: light.
  assert.equal(prefersDark(), false);
  assert.equal(pageEdgeColor(), TOKENS.page);
});

test('the colour Safari paints past the page meets the grained page in both schemes', async () => {
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
  // The ink under each grain stays within about a level of the flat ink Safari paints past the page's ends.
  near(await shown('grain.png', TOKENS.ink), TOKENS.ink, 1.25, 'ink, light grain');
  near(await shown('grain-dark.png', DARK.pageUnderGrain), DARK.pageUnderGrain, 1.25, 'ink, dark grain');
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
