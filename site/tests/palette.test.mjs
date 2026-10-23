import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BADGE, DISC, STATUS, TOKENS, countdownStatus, rgbOf } from '../src/lib/palette.mjs';
import { DEFAULT_PALETTE, PALETTES } from '../src/lib/courses.mjs';

const HOUR = 3600000;
const scss = await readFile(new URL('../src/styles/colors.scss', import.meta.url), 'utf8');
const scssColor = (name) => scss.match(new RegExp(`'${name}': (#[0-9a-f]{6})`, 'i'))?.[1].toUpperCase();

// WCAG 2 relative luminance and contrast ratio.
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

test('colors.scss mirrors the palette tokens', () => {
  const pairs = {
    white: TOKENS.page,
    black: TOKENS.ink,
    menuColor: TOKENS.ink,
    accentColor: TOKENS.card,
    fillColor: TOKENS.card,
    menuFontColor: TOKENS.onDark,
    raised: TOKENS.raised,
    sheen: TOKENS.sheen,
    card: TOKENS.card,
    onDark: TOKENS.onDark,
    muted: TOKENS.muted,
    mutedOnDark: TOKENS.mutedOnDark,
    border: TOKENS.border,
    borderOnDark: TOKENS.borderOnDark,
    accent: TOKENS.accent,
    accentTint: TOKENS.accentTint,
    statusOnTrack: TOKENS.onTrack,
    statusSoon: TOKENS.soon,
    statusUrgent: TOKENS.urgent,
    statusDone: TOKENS.done,
  };
  for (const [name, value] of Object.entries(pairs)) assert.equal(scssColor(name), value, `--${name}`);
});

test('every course shares one palette with the single accent', () => {
  assert.equal(DEFAULT_PALETTE.accent, TOKENS.accent);
  assert.equal(DEFAULT_PALETTE.fillColor, '#FFFFFF');
  for (const palette of Object.values(PALETTES)) assert.equal(palette, DEFAULT_PALETTE);
});

test('badge and disc textures are drawn only from tokens', () => {
  const values = new Set(Object.values(TOKENS));
  for (const look of [BADGE, DISC]) for (const [key, value] of Object.entries(look)) assert.ok(values.has(value), `${key}: ${value}`);
});

test('countdown status follows the time left', () => {
  assert.equal(countdownStatus({ ms: 73 * HOUR }), 'onTrack');
  assert.equal(countdownStatus({ ms: 72 * HOUR }), 'soon');
  assert.equal(countdownStatus({ ms: 25 * HOUR }), 'soon');
  assert.equal(countdownStatus({ ms: 24 * HOUR }), 'urgent');
  assert.equal(countdownStatus({ ms: 60000 }), 'urgent');
  assert.equal(countdownStatus({ ms: 5 * HOUR, done: true }), 'done');
  assert.equal(countdownStatus({ ms: 0 }), null);
  assert.equal(countdownStatus({ ms: null }), null);
  assert.equal(STATUS.onTrack.label, 'On track');
  assert.deepEqual(
    Object.values(STATUS).map((status) => status.color),
    ['#004C9B', '#B45309', '#B91C1C', '#15803D'],
  );
});

test('text pairs meet WCAG AA', () => {
  const body = [
    ['ink on page', TOKENS.ink, TOKENS.page],
    ['ink on card', TOKENS.ink, TOKENS.card],
    ['muted on card', TOKENS.muted, TOKENS.card],
    ['on-dark text on ink', TOKENS.onDark, TOKENS.ink],
    ['muted on ink', TOKENS.mutedOnDark, TOKENS.ink],
    ['muted on raised', TOKENS.mutedOnDark, TOKENS.raised],
    ['on-dark text on sheen', TOKENS.onDark, TOKENS.sheen],
    ['white on accent (primary button)', TOKENS.card, TOKENS.accent],
    ['accent on page (links)', TOKENS.accent, TOKENS.page],
    ['accent on card', TOKENS.accent, TOKENS.card],
    ['accent on tint (badge)', TOKENS.accent, TOKENS.accentTint],
    ['soon on card (badge)', TOKENS.soon, TOKENS.card],
    ['urgent on card (badge)', TOKENS.urgent, TOKENS.card],
    ['done on card (badge)', TOKENS.done, TOKENS.card],
    ['soon on page', TOKENS.soon, TOKENS.page],
    ['urgent on page', TOKENS.urgent, TOKENS.page],
    ['done on page', TOKENS.done, TOKENS.page],
    ['ink on border (done calendar event)', TOKENS.ink, TOKENS.border],
  ];
  for (const [name, fg, bg] of body) assert.ok(contrast(fg, bg) >= 4.5, `${name}: ${contrast(fg, bg).toFixed(2)}`);
  // #71717A on the #F4F4F5 page is 4.40:1: large text only, so muted body text sits on white cards.
  assert.ok(contrast(TOKENS.muted, TOKENS.page) >= 3);
});

// The previous palette: none of it may remain in the site's source, nor black with alpha as a surface.
const OLD = /#(?:f0f4f1|28282b|f2ffbd|d7d7d4|292928|0b0c0b|020002|09050c|070410|f9f9f9)(?![0-9a-f])|rgba?\(\s*40\s*,\s*40\s*,\s*43\b|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,|#000000[0-9a-f]{2}(?![0-9a-f])/gi;
const SOURCE = new Set(['.js', '.jsx', '.mjs', '.cjs', '.scss', '.css', '.json', '.html', '.svg', '.webmanifest', '.md', '.frag', '.vert', '.glsl']);
async function* sourceFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (SOURCE.has(extname(entry.name))) yield path;
  }
}

test('no old colour remains in the site source', async () => {
  const site = fileURLToPath(new URL('..', import.meta.url));
  const hits = [];
  const scan = async (path) => {
    const text = await readFile(path, 'utf8');
    for (const match of text.matchAll(OLD)) hits.push(`${path.slice(site.length)}: ${match[0]}`);
  };
  for (const dir of ['src', 'public']) for await (const path of sourceFiles(join(site, dir))) await scan(path);
  await scan(join(site, 'scripts', 'pages-site.mjs'));
  assert.deepEqual(hits, []);
});
