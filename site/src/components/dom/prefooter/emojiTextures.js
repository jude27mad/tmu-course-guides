import { CanvasTexture, CustomBlending, MeshBasicMaterial, NoColorSpace, OneFactor, OneMinusSrcAlphaFactor } from 'three';
import { withBasePath } from '@src/utils/basePath';

// Original vector artwork drawn for this site (public/images/game/*.svg). Images, rather than text
// glyphs, keep the same shapes and colours on every OS, and vectors stay sharp at any pixel density:
// each is rasterised once, here, at SIZE.
export const GAME_EMOJI = ['rocket', 'brain', 'laptop', 'books', 'hot_beverage', 'gear'];
// A target is about 300 device pixels across at most (a large Retina display), so 512 keeps a texel
// per pixel or better there; the mipmaps cover phones.
export const EMOJI_TEXTURE_SIZE = 512;
const SIZE = EMOJI_TEXTURE_SIZE;

export async function loadEmojiImages() {
  const results = await Promise.allSettled(
    GAME_EMOJI.map(
      (name) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ name, image });
          image.onerror = reject;
          image.src = withBasePath(`/images/game/${name}.svg`);
        }),
    ),
  );
  // A failed image must not stop the other targets or create an invisible one.
  return results.filter(({ status }) => status === 'fulfilled').map(({ value }) => value);
}

// The canvas holds sRGB colours with premultiplied alpha, and they are uploaded as they are: no
// colour-space decode (the game's Canvas is `linear`, so nothing is re-encoded on the way out) and no
// un-premultiplying. Un-premultiplied, every transparent texel turns black and the filtering and the
// mipmaps pull that black into the outline, which drew a dark, grainy rim; decoding premultiplied
// values drew a light one. Blended this way the edges match the browser's own rendering of the artwork.
function makeTexture(name, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  draw(canvas.getContext('2d'));
  const texture = new CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = NoColorSpace;
  texture.premultiplyAlpha = true;
  texture.anisotropy = 4;
  return texture;
}

// Premultiplied colours need ONE, ONE_MINUS_SRC_ALPHA. three.js's own `premultipliedAlpha` would
// multiply by alpha a second time in the shader, so the blending is set out in full instead.
export const emojiMaterial = (map) =>
  new MeshBasicMaterial({
    map,
    transparent: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -10,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });

export function emojiTextures({ name, image }) {
  const draw = (ctx) => ctx.drawImage(image, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
  const whole = makeTexture(name, (ctx) => {
    ctx.translate(SIZE / 2, SIZE / 2);
    draw(ctx);
  });
  const sliced = makeTexture(`${name}-sliced`, (ctx) => {
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(SIZE / 2 + side * SIZE * 0.06, SIZE / 2 + side * SIZE * 0.035);
      ctx.rotate(side * 0.12);
      ctx.scale(0.9, 0.9);
      // Preserve the existing split, separation and tilt, with no disc behind it.
      ctx.beginPath();
      ctx.rect(side < 0 ? -SIZE : 0, -SIZE, SIZE, SIZE * 2);
      ctx.clip();
      draw(ctx);
      // A thin bright edge along the cut, only where the half has artwork, so the slice reads as clean.
      const width = SIZE * 0.012;
      const sheen = ctx.createLinearGradient(0, 0, -side * width, 0);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = sheen;
      ctx.fillRect(side < 0 ? -width : 0, -SIZE, width, SIZE * 2);
      ctx.restore();
    });
  });
  return { whole, sliced };
}
