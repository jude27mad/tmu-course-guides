import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const textures = read('src/components/dom/prefooter/emojiTextures.js');
const names = JSON.parse(textures.match(/GAME_EMOJI = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const folder = new URL('public/images/game/', root);

test('every game emoji is a locally hosted WebP, and only those files are in the folder', () => {
  assert.deepEqual(names, ['rocket', 'brain', 'laptop', 'books', 'hot_beverage', 'gear']);
  assert.deepEqual(readdirSync(folder).sort(), names.map((name) => `${name}.webp`).sort(), 'no stale artwork is left behind');
  assert.match(textures, /\/images\/game\/\$\{name\}\.webp/);
});

test('each emoji is a 512 px WebP with an alpha channel, small enough to load quickly', () => {
  for (const name of names) {
    const path = new URL(`${name}.webp`, folder);
    const bytes = readFileSync(path);
    assert.equal(bytes.toString('latin1', 0, 4), 'RIFF', name);
    assert.equal(bytes.toString('latin1', 8, 12), 'WEBP', name);
    // Extended format: the flags carry the alpha bit, then the canvas size minus one, 24-bit little-endian.
    assert.equal(bytes.toString('latin1', 12, 16), 'VP8X', `${name} uses the extended format`);
    assert.ok(bytes[20] & 0x10, `${name} has an alpha channel`);
    assert.equal(1 + bytes.readUIntLE(24, 3), 512, `${name} width`);
    assert.equal(1 + bytes.readUIntLE(27, 3), 512, `${name} height`);
    assert.ok(statSync(path).size < 48 * 1024, `${name} stays small`);
  }
});

test('the Noto 3D artwork ships with its licence and source notes', () => {
  const notes = read('public/licenses/README.md');
  assert.match(read('public/licenses/Noto-Emoji-OFL.txt'), /^Copyright 2013 Google LLC[\s\S]*SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(notes, /## Noto 3D Emoji game artwork/);
  for (const name of names) assert.ok(notes.includes(`\`${name}.webp\``), `${name} has a source row`);
});

test('emoji textures keep clean edges: premultiplied, undecoded and blended to match', () => {
  assert.match(textures, /EMOJI_TEXTURE_SIZE = 512/);
  assert.match(textures, /texture\.premultiplyAlpha = true/);
  assert.match(textures, /texture\.colorSpace = NoColorSpace/);
  for (const factor of ['blending: CustomBlending', 'blendSrc: OneFactor', 'blendDst: OneMinusSrcAlphaFactor', 'blendSrcAlpha: OneFactor', 'blendDstAlpha: OneMinusSrcAlphaFactor']) assert.ok(textures.includes(factor), factor);
  // three.js's premultipliedAlpha would multiply the colours by alpha a second time.
  assert.doesNotMatch(textures, /premultipliedAlpha\s*[:=]/);
  const canvas = read('src/components/dom/prefooter/Index.jsx');
  assert.match(canvas, /^\s*linear$/m, 'the game canvas does not re-encode the sRGB artwork');
  assert.match(canvas, /dpr=\{\[1, 3\]\}/, 'the game draws at up to three times the pixel density');
  assert.match(read('src/components/dom/prefooter/FruitNinja.jsx'), /import \{ emojiMaterial, emojiTextures, loadEmojiImages \}/);
});
