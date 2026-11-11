import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { ARTWORK_FLOOR, ARTWORK_GLOW, BADGE, BADGE_DARK, DARK, DARK_QUERY, FIELD, FIELD_DARK, TOKENS, pageEdgeColor, prefersDark, rgbOf } from '../src/lib/palette.mjs';
import { BAND_HEIGHT, CARD_HEIGHT, CARD_SHARE, CARD_WIDTH, STRAP_SHARE, rimTexels } from '../src/components/courseBadge/badgeRim.mjs';

// Dark mode follows the device setting. It has one black, the ink: the page, the panels, every card and pill, and the
// floor of the moving artwork. Structure comes from hairlines and type. The windows are holes in the ink, as in light
// mode, and show the artwork. The dark panels keep the ink they have in light mode, so the Safari edge rules pinned
// in under-safari-bars.test.mjs hold in both schemes.

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
// The hairlines and the brand fill that only dark mode defines.
const DARK_ONLY = ['borderStrong', 'windowEdge', 'fieldEdge', 'accentFill', 'onAccentFill'];

test('colors.scss mirrors DARK, after the light map, for screens in dark mode only', () => {
  const lower = (value) => value.toLowerCase();
  assert.deepEqual(sassMap('dark'), {
    white: lower(DARK.page),
    pageUnderGrain: lower(DARK.pageUnderGrain),
    card: lower(DARK.page),
    fillColor: lower(DARK.page),
    text: lower(DARK.text),
    onDark: lower(DARK.text),
    menuFontColor: lower(DARK.text),
    muted: lower(DARK.muted),
    mutedOnDark: lower(DARK.mutedOnArtwork),
    border: lower(DARK.border),
    borderStrong: lower(DARK.borderStrong),
    windowEdge: lower(DARK.windowEdge),
    fieldEdge: lower(DARK.fieldEdge),
    accent: lower(DARK.accent),
    accentTint: lower(DARK.accentTint),
    accentFill: lower(DARK.accentFill),
    onAccentFill: lower(DARK.onAccentFill),
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
  assert.match(darkBlock, /\('pageRgb': 'white', 'cardRgb': 'card', 'onDarkRgb': 'onDark', 'mutedOnDarkRgb': 'mutedOnDark', 'textRgb': 'text', 'accentRgb': 'accent'\)/);
  assert.match(darkBlock, /color: var\(--text\);/);
  // The dark-only tokens have no light value: light mode never draws with them.
  const light = sassMap('colors');
  for (const name of DARK_ONLY) assert.ok(!(name in light), `--${name} is dark mode's only`);
});

test('dark mode has one black: the page, the panels, the cards, the pills and the artwork are the ink', () => {
  assert.equal(DARK.page, TOKENS.ink);
  assert.equal(DARK.pageUnderGrain, TOKENS.ink);
  const dark = sassMap('dark');
  for (const name of ['white', 'pageUnderGrain', 'card', 'fillColor']) assert.equal(dark[name], TOKENS.ink.toLowerCase(), `--${name}`);
  // The dark panels keep the ink they have in light mode, which is the same black.
  for (const key of ['black', 'menuColor', 'raised', 'sheen', 'borderOnDark', 'accentColor', 'panelText']) {
    assert.ok(!(key in dark), `--${key} must not change in dark mode`);
  }
  assert.ok(!/'inkRgb'|--inkRgb:/.test(darkBlock), '--inkRgb must not change in dark mode');
  // The artwork's troughs are clamped to the same ink, and light mode is not clamped.
  assert.deepEqual(ARTWORK_FLOOR.light, [0, 0, 0]);
  assert.deepEqual(
    ARTWORK_FLOOR.dark.map((channel) => Math.round(channel * 255)),
    rgbOf(DARK.page).split(', ').map(Number),
  );
  // The theme-color and the shrunk page's edge.
  assert.equal(DARK.pageEdge, DARK.windowEdge);
});

test('cards and pills follow the page: there is no light island in dark mode', async () => {
  assert.equal(existsSync(fileURLToPath(new URL('../src/styles/island.scss', import.meta.url))), false, 'styles/island.scss is gone');
  assert.doesNotMatch(scss, /--light-|\$island/);
  for await (const [file, text] of styleFiles()) {
    assert.doesNotMatch(text, /island|--light-/, file);
  }
  // A card surface (--card, --fillColor) is the ink in dark mode, with its hairline (--border) on it.
  const dark = sassMap('dark');
  assert.equal(dark.card, dark.white);
  assert.equal(dark.fillColor, dark.white);
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

test("text meets WCAG AA over the ink and, where it sits over the artwork, over the artwork's brightest band", () => {
  const onInk = [
    ['text', DARK.text],
    ['muted', DARK.muted],
    ['muted over the artwork', DARK.mutedOnArtwork],
    ['accent (links)', DARK.accent],
    ['on track', DARK.onTrack],
    ['soon', DARK.soon],
    ['urgent', DARK.urgent],
    ['done', DARK.done],
  ];
  for (const [name, color] of onInk) assert.ok(contrast(color, DARK.page) >= 4.5, `${name} on the ink: ${contrast(color, DARK.page).toFixed(2)}`);
  // Menu, Search, the footer and the Courses window are text over the moving artwork. The still ink's muted grey
  // is for the still ink only; over the artwork the lighter one is used.
  for (const [name, color] of [
    ['text', DARK.text],
    ['muted over the artwork', DARK.mutedOnArtwork],
    ['accent (links)', DARK.accent],
    ['on track', DARK.onTrack],
    ['soon', DARK.soon],
    ['urgent', DARK.urgent],
    ['done', DARK.done],
  ]) {
    assert.ok(contrast(color, ARTWORK_GLOW) >= 4.5, `${name} on the artwork's glow: ${contrast(color, ARTWORK_GLOW).toFixed(2)}`);
  }
  assert.ok(contrast(DARK.muted, ARTWORK_GLOW) < 4.5, 'the still ink keeps its own muted grey');
  // Selection: TMU Blue's type on its tint, and the primary action's white label on TMU Blue itself.
  assert.ok(contrast(DARK.accent, DARK.accentTint) >= 4.5, 'a selected tab');
  assert.ok(contrast(DARK.text, DARK.accentTint) >= 4.5, 'text on the accent tint');
  assert.ok(contrast(DARK.onAccentFill, DARK.accentFill) >= 7, 'the primary action');
  assert.equal(DARK.accentFill, TOKENS.accent, 'the primary action is TMU Blue itself');
  assert.ok(contrast(DARK.onAccent, DARK.accent) >= 4.5, 'a label on an accent fill');
  // Focus rings, field edges and the shrunk page's edge are non-text: 3:1.
  assert.ok(contrast(DARK.accent, DARK.page) >= 3);
  assert.ok(contrast(DARK.accent, ARTWORK_GLOW) >= 3);
  assert.ok(contrast(DARK.fieldEdge, DARK.page) >= 3, `field edge on the ink: ${contrast(DARK.fieldEdge, DARK.page).toFixed(2)}`);
  // The hairlines step up from dividers to fields, each plainly lighter than the ink and than the one before it.
  const ladder = [DARK.page, DARK.border, DARK.borderStrong, DARK.windowEdge, DARK.fieldEdge];
  ladder.slice(1).forEach((color, index) => assert.ok(luminance(color) > luminance(ladder[index]), `${color} is lighter than ${ladder[index]}`));
  assert.ok(contrast(DARK.border, DARK.page) >= 1.6, 'a divider shows on the ink');
  assert.ok(contrast(DARK.windowEdge, DARK.page) >= 2.8, 'a window edge shows on the ink');
  // The panels' text.
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
  // --black is the ink of the dark panels: as a text colour it would vanish on the dark page. The exceptions: the
  // back-to-top arrow on its light hover ball in dark mode, and the old next-course card (unrendered).
  assert.deepEqual(ink.sort(), ['components/dom/styles/footer.module.scss fill', 'components/dom/styles/footer.module.scss stroke', 'pages/course/components/nextCourse/styles/nextCourse.module.scss color']);
  // --white is the page: as text it is only the page's colour on a text-coloured fill.
  assert.deepEqual(paper.sort(), [
    'pages/components/home/styles/home.module.scss fill', // the Desk mask's paper (.mask2)
    'pages/course/components/workspace/calendar.module.scss --sx-color-on-primary', // today's date on its light circle (dark mode)
    'pages/course/components/workspace/workspace.module.scss color', // the pressed Schedule toggle (light mode)
  ]);
});

// The rule blocks of a style sheet, each with the statements written directly in it and its ancestors. Sass
// interpolation (#{...}) is text, not a block.
function blocks(text) {
  const found = [];
  const stack = [{ selector: '', own: '', parents: [] }];
  let buffer = '';
  let interpolating = false;
  for (const char of stripComments(text)) {
    if (interpolating) {
      buffer += char;
      if (char === '}') interpolating = false;
    } else if (char === '{' && buffer.endsWith('#')) {
      buffer += char;
      interpolating = true;
    } else if (char === '{') {
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
const inDark = (block) => [block, ...block.parents].some((each) => /@media[^{]*prefers-color-scheme: dark/.test(each.selector));

test('the dark-only tokens are used in dark mode only, so light mode draws exactly as before', async () => {
  const uses = [];
  const outside = [];
  const pattern = new RegExp(`var\\(--(${DARK_ONLY.join('|')})\\)`);
  for await (const [file, text] of styleFiles()) {
    if (file === 'styles/colors.scss') continue;
    for (const block of blocks(text)) {
      if (!pattern.test(block.own)) continue;
      uses.push(file);
      if (!inDark(block)) outside.push(`${file} ${block.selector}`);
    }
  }
  assert.deepEqual(outside, []);
  // Every window, card and pill that dark mode edges.
  for (const file of [
    'styles/glass.scss',
    'components/artwork/signalField.module.scss',
    'components/animationComponents/buttonLink/buttonLink.module.scss',
    'components/dom/styles/footer.module.scss',
    'components/dom/styles/layout.module.scss',
    'components/dom/styles/navigationFeedback.module.scss',
    'components/courseBadge/badge.module.scss',
    'pages/components/about/styles/about.module.scss',
    'pages/components/projects/styles/projects.module.scss',
    'pages/course/components/tools/styles/guideTools.module.scss',
    'pages/course/components/workspace/calendar.module.scss',
    'pages/course/components/workspace/grades.module.scss',
    'pages/course/components/workspace/workspace.module.scss',
  ]) {
    assert.ok(uses.includes(file), `${file} edges its surfaces in dark mode`);
  }
});

test('glass controls are the ink with a strong hairline in dark mode, with no sheen and no tinted blur', async () => {
  const glass = await read('../src/styles/glass.scss');
  const dark = glass.indexOf('@media screen and (prefers-color-scheme: dark)');
  assert.ok(dark > glass.indexOf('@supports ((backdrop-filter'), 'after the blur, so it turns the blur off');
  assert.ok(dark < glass.indexOf(":global(html[data-motion='off']) &"), 'before the solid fallbacks, which still apply');
  assert.ok(dark < glass.indexOf('@media (forced-colors: active)'));
  assert.match(
    glass.slice(dark),
    /^@media screen and \(prefers-color-scheme: dark\) \{\s*--glass-solid: var\(--card\);\s*--glass-backing: var\(--card\);\s*--glass-highlight: transparent;\s*--glass-edge: var\(--borderStrong\);\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;\s*\}/,
  );
});

test('selection is TMU Blue and the primary action its one filled shape', async () => {
  const workspace = await read('../src/pages/course/components/workspace/workspace.module.scss');
  // The tabs and the Open/All/Done filter select with the accent tokens in both schemes.
  assert.match(workspace, /a\[aria-current\] \{\s*color: var\(--accent\);\s*background-color: var\(--accentTint\);\s*box-shadow: inset 0 0 0 1px var\(--accent\);/);
  // Agenda/Calendar and Upcoming/All dates, filled with the text colour in light mode, select the same way in dark.
  assert.match(workspace, /@media screen and \(prefers-color-scheme: dark\) \{\s*button \{\s*border-color: var\(--borderStrong\);\s*\}\s*button\[aria-pressed='true'\] \{\s*background: var\(--accentTint\);\s*color: var\(--accent\);\s*border-color: var\(--accent\);/);
  const button = await read('../src/components/animationComponents/buttonLink/buttonLink.module.scss');
  assert.match(button, /@media screen and \(prefers-color-scheme: dark\) \{\s*background-color: var\(--accentFill\);\s*color: var\(--onAccentFill\);/);
});

test('a hovered row underlines its title in dark mode, where its fill is the page', async () => {
  const workspace = await read('../src/pages/course/components/workspace/workspace.module.scss');
  assert.match(workspace, /&:hover \{\s*background: var\(--fillColor\);\s*\}\s*(\/\/[^\n]*\s*)?@media screen and \(prefers-color-scheme: dark\) \{\s*&:hover \.rowTitle \{\s*text-decoration: underline;/);
  const calendar = await read('../src/pages/course/components/workspace/calendar.module.scss');
  assert.match(calendar, /&:hover \{\s*background: var\(--fillColor\);\s*\}\s*(\/\/[^\n]*\s*)?@media screen and \(prefers-color-scheme: dark\) \{\s*&:hover \[data-row-title\] \{\s*text-decoration: underline;/);
  assert.match(await read('../src/pages/course/components/workspace/Schedule.jsx'), /<span className=\{styles\.rowTitle\} data-row-title>/);
  // Course information's rows underline their label, not the arrow beside it.
  assert.match(workspace, /@media screen and \(prefers-color-scheme: dark\) \{\s*&:hover > :first-child,\s*\.information &:hover > :first-child \{\s*text-decoration: underline;/);
  assert.doesNotMatch(`${workspace}${calendar}`, /highlightRgb\), 0\.06/, 'no grey lift');
});

test('the windows show the artwork, floored at the ink, and each has an edge', async () => {
  // The artwork's darkest output is the ink in dark mode.
  const shader = await read('../src/components/canvas/background/shaders/fragmentShader.js');
  assert.match(shader, /uniform vec3 uFloor;/);
  assert.match(shader, /finalCol\.rgb \+= random\(uvRandom\) \* uNoise;\s*finalCol = max\(finalCol, uFloor\);/);
  const background = await read('../src/components/canvas/background/Background.jsx');
  assert.match(background, /uFloor: \{ value: ARTWORK_FLOOR\.light \}/);
  assert.match(background, /uniforms\.uFloor\.value = prefersDark\(\) \? ARTWORK_FLOOR\.dark : ARTWORK_FLOOR\.light;/);
  assert.match(background, /\}, \[dark, uniforms, invalidate\]\);/);
  // The Desk: the signal field is clear, with white points, and edged where a window shows its border.
  assert.deepEqual(FIELD, { background: TOKENS.ink, point: TOKENS.mutedOnDark, signal: TOKENS.onDark });
  assert.deepEqual(FIELD_DARK, { background: null, point: '#FFFFFF', signal: '#FFFFFF' });
  const field = await read('../src/components/artwork/signalField.mjs');
  assert.match(field, /if \(paint\.background\) \{\s*ctx\.fillStyle = paint\.background;\s*ctx\.fillRect\(0, 0, width, height\);/);
  const fieldJsx = await read('../src/components/artwork/SignalField.jsx');
  assert.match(fieldJsx, /colors: prefersDark\(\) \? FIELD_DARK : FIELD,/);
  assert.match(fieldJsx, /update\(\{ colors: prefersDark\(\) \? FIELD_DARK : FIELD \}\)/);
  assert.match(
    await read('../src/components/artwork/signalField.module.scss'),
    /@media screen and \(prefers-color-scheme: dark\) \{\s*\.field \{\s*background-color: transparent;\s*box-shadow: inset 0 0 0 1px var\(--windowEdge\);/,
  );
  // The Desk's windows: in dark mode only, the paper is drawn through a 1px dilation in the window edge's colour.
  const home = await read('../src/pages/components/home/Index.jsx');
  assert.match(home, /viewBox=\{dark \? undefined : '0 0 100 100'\}/);
  assert.match(home, /\{dark \? \(\s*<g>\s*<rect className=\{styles\.mask2\}/);
  assert.doesNotMatch(home, /filter="url\(#desk-window-edge\)"/, 'the styles apply the filter, on screen only, so printing leaves it out');
  assert.match(home, /\{dark && \(\s*<filter id="desk-window-edge"/);
  assert.match(home, /<feMorphology in="SourceAlpha" operator="dilate" radius="1" result="grown" \/>/);
  assert.match(home, /<feFlood floodColor=\{DARK\.windowEdge\}/);
  assert.match(home, /const LIGHT_PAPER = \{ x: '0', y: '0', width: '100%', height: '100\.3%' \};/);
  const homeStyles = await read('../src/pages/components/home/styles/home.module.scss');
  assert.match(homeStyles, /\.edged mask rect\[data-cell\] \{\s*stroke: #000;\s*stroke-width: 1px;/);
  const deskDark = homeStyles.slice(homeStyles.indexOf('@media screen and (prefers-color-scheme: dark) {\n      .svgWrapper'));
  assert.match(deskDark, /^@media screen and \(prefers-color-scheme: dark\) \{[^@]*\.edged \{\s*overflow: visible;\s*\}\s*\.edged > g \{\s*filter: url\(#desk-window-edge\);\s*\}/);
  assert.match(homeStyles, /inset calc\(var\(--layout-margin\) \* -1\) 0 0 0 var\(--white\)/);
  // Courses: the window shows the artwork untinted until hovered, and is edged.
  const projects = await read('../src/pages/components/projects/styles/projects.module.scss');
  assert.match(projects, /background-color: var\(--card-menu\);\s*(\/\/[^\n]*\s*)?@media screen and \(prefers-color-scheme: dark\) \{\s*opacity: 0;/);
  assert.match(projects, /@media screen and \(prefers-color-scheme: dark\) and \(min-width: #\{\$mobile-breakpoint \+ 1\}\) \{\s*box-shadow:\s*inset 0 0 0 1px var\(--windowEdge\),\s*0 0 0 calc\(var\(--layout-columns-gap\) \* 1\) var\(--white\);/);
  // The badge windows (Desk and course pages) and the footer.
  for (const path of ['../src/pages/components/about/styles/about.module.scss', '../src/pages/course/components/workspace/workspace.module.scss']) {
    assert.match(await read(path), /inset 0 0 0 1px var\(--windowEdge\),\s*0 0 0 300vw var\(--white\);/, path);
  }
  assert.match(await read('../src/components/dom/styles/layout.module.scss'), /&::before \{[^}]*height: 1px;\s*background: var\(--windowEdge\);/);
  // The page is opaque again: no see-through special cases are left.
  assert.doesNotMatch(global, /html:not\(\[data-scroll-mode='document'\]\) body \{\s*background-color: var\(--black\);/);
  assert.doesNotMatch(await read('../src/pages/course/components/workspace/workspace.module.scss'), /--dark-end-fade/);
});

test('the 3D badges carry a light rim in dark mode only', async () => {
  assert.equal(BADGE.rim, undefined);
  assert.deepEqual(BADGE_DARK, { ...BADGE, rim: TOKENS.mutedOnDark });
  const textures = await read('../src/components/courseBadge/badgeTextures.js');
  assert.match(textures, /if \(rim\) \{\s*roundRect\(ctx, rimCard \/ 2, rimCard \/ 2, w - rimCard, h - rimCard, 34 - rimCard \/ 2\);\s*ctx\.strokeStyle = rim;\s*ctx\.globalAlpha = 0\.7;\s*ctx\.lineWidth = rimCard;/);
  assert.match(textures, /ctx\.globalAlpha = 0\.7;\s*ctx\.fillRect\(0, 0, canvas\.width, rimBand\);\s*ctx\.fillRect\(0, canvas\.height - rimBand, canvas\.width, rimBand\);/);
  const badge = await read('../src/components/courseBadge/CourseBadge.jsx');
  assert.match(badge, /\.\.\.\(dark \? \{ \.\.\.BADGE_DARK, rimCard, rimBand \} : BADGE\),/);
  assert.match(badge, /if \(!dark \|\| !node \|\| typeof ResizeObserver === 'undefined'\) return undefined;/, 'light mode measures nothing');
  const scene = await read('../src/components/courseBadge/BadgeScene.jsx');
  assert.match(scene, /look\.strapColor, look\.rim, look\.rimBand, invalidate\]/);
});

test('the badge rim is about one screen pixel at every size the badge is shown', async () => {
  // badgeRim.mjs works from how BadgeScene frames a badge; these must stay as it assumes.
  const scene = await read('../src/components/courseBadge/BadgeScene.jsx');
  assert.match(scene, /<PerspectiveCamera manual makeDefault position=\{\[0, 0, 10\]\} fov=\{25\} \/>/);
  assert.match(scene, /<roundedBoxGeometry ref=\{mergeFaceGroups\} args=\{\[1\.6, 2\.25, 0\.02, 2, 0\.01\]\} \/>/);
  assert.match(scene, /resolution=\{\[1, 1\]\}[^\n]*lineWidth=\{1\}/);
  assert.equal(CARD_WIDTH / CARD_HEIGHT, 1.6 / 2.25);
  // The element sizes the badges are shown at: the Desk's Next up, a Courses card and a course page's header, on a
  // desktop and on a phone. The rim's width on screen stays within about a pixel of 1.25 (clamped at the smallest).
  for (const [width, height] of [[662, 763], [614, 288], [336, 190], [348, 390], [289, 135]]) {
    const { card, band } = rimTexels(width, height);
    const cardPx = (card * CARD_SHARE * height) / CARD_WIDTH;
    const bandPx = (band * STRAP_SHARE * width) / BAND_HEIGHT;
    assert.ok(cardPx >= 0.7 && cardPx <= 1.6, `card rim ${cardPx.toFixed(2)}px at ${width}x${height}`);
    assert.ok(bandPx >= 0.7 && bandPx <= 1.6, `strap rim ${bandPx.toFixed(2)}px at ${width}x${height}`);
  }
  assert.deepEqual(rimTexels(662, 763), { card: 2, band: 10 }, 'the large Desk badge gets a thin rim');
  assert.deepEqual(rimTexels(0, 0), { card: 8, band: 18 }, 'clamped');
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
  // Screen only, like the styles: a page printed from a dark device prints light, JavaScript-drawn parts included.
  assert.equal(DARK_QUERY, 'screen and (prefers-color-scheme: dark)');
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
  // The shrunk page's edge; behind a panel on a phone the page dims to 5%, where only the paper's light edge shows.
  const shell = await read('../src/components/dom/navbar/panelShell.js');
  assert.match(shell, /border: `2px solid \$\{pageEdgeColor\(isMobile\)\}`/);
  assert.match(await read('../src/components/dom/Layout.jsx'), /border: `2px solid \$\{pageEdgeColor\(\)\}`/);
  for (const path of ['../src/components/dom/navbar/panelShell.js', '../src/components/dom/Layout.jsx']) assert.doesNotMatch(await read(path), /TOKENS\.page/, path);
  assert.equal(pageEdgeColor(true), TOKENS.page);
  // Light mode dims the shrunk page to 30%; dark mode keeps it an opaque ink card on wide screens.
  assert.match(shell, /const shrunkPageOpacity = \(\) => \(prefersDark\(\) \? 1 : 0\.3\);/);
  assert.match(shell, /tl\.to\(layout, \{ opacity: isMobile \? 0\.05 : shrunkPageOpacity\(\) \}, 0\);/);
  // A change of scheme rebuilds the Menu/Search shell for the new edge and opacity; it rewinds the old timeline
  // first, or the new one would record the shrunk page as its start and leave the page shrunk once the panel closed.
  const navbar = await read('../src/components/dom/navbar/Index.jsx');
  assert.match(navbar, /const dark = useMediaQuery\(DARK_QUERY\);/);
  assert.match(navbar, /\}, \[isLoading, isMobile, dark\]\);/);
  assert.match(navbar, /const schemeChanged = dark !== prefersDark\(\) && useStore\.getState\(\)\.isTransitioning !== 'handoff';/);
  assert.match(navbar, /if \(\(isMobile !== isMobileNow\(\) \|\| schemeChanged\) && tl\.progress\(\) > 0\) tl\.progress\(0\);/);
});
