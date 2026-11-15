import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const textures = read('src/components/dom/prefooter/emojiTextures.js');
const names = JSON.parse(textures.match(/GAME_EMOJI = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
const folder = new URL('public/images/game/', root);

test('every game emoji is a vector file, and only those files are in the folder', () => {
  assert.deepEqual(names, ['rocket', 'brain', 'laptop', 'books', 'hot_beverage', 'gear']);
  for (const name of names) assert.ok(existsSync(new URL(`${name}.svg`, folder)), `${name}.svg`);
  assert.deepEqual(readdirSync(folder).sort(), names.map((name) => `${name}.svg`).sort(), 'no stale raster artwork is left behind');
  assert.match(textures, /\/images\/game\/\$\{name\}\.svg/);
});

test('each emoji SVG is self-contained, well formed and drawable at 512 px', () => {
  for (const name of names) {
    const path = new URL(`${name}.svg`, folder);
    const svg = readFileSync(path, 'utf8');
    // An intrinsic size lets every browser rasterise it on the 2D canvas at full resolution.
    assert.match(svg, /^\s*<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="512" height="512" viewBox="0 0 512 512">/, name);
    assert.ok(statSync(path).size < 16 * 1024, `${name} stays small`);
    assert.doesNotMatch(svg, /<(script|image|foreignObject|style|text|filter|use)\b/i, `${name} uses only plain shapes and gradients`);
    assert.doesNotMatch(svg, /\bon[a-z]+\s*=|javascript:|@import/i, name);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name} ids are unique`);
    const references = [...svg.matchAll(/url\(([^)]*)\)|href="([^"]*)"/g)].map((match) => match[1] ?? match[2]);
    for (const reference of references) {
      assert.match(reference, /^#/, `${name} refers only to its own definitions`);
      assert.ok(ids.includes(reference.slice(1)), `${name} defines ${reference}`);
    }
    const stack = [];
    for (const [tag, closing, element, selfClosing] of svg.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>/g)) {
      if (selfClosing) continue;
      if (closing) assert.equal(stack.pop(), element, `${name}: ${tag} closes the element it opened`);
      else stack.push(element);
    }
    assert.deepEqual(stack, [], `${name}: every element is closed`);
  }
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
