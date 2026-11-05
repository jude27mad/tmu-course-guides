import { CanvasTexture, SRGBColorSpace } from 'three';
import { withBasePath } from '@src/utils/basePath';

// Locally hosted Fluent Emoji artwork; see public/licenses/Fluent-Emoji-MIT.txt.
// Images, rather than text glyphs, keep the same shapes and colours on every OS.
export const GAME_EMOJI = ['rocket', 'brain', 'laptop', 'books', 'hot_beverage', 'gear'];
const SIZE = 256;

export async function loadEmojiImages() {
  const results = await Promise.allSettled(
    GAME_EMOJI.map(
      (name) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ name, image });
          image.onerror = reject;
          image.src = withBasePath(`/images/game/${name}.png`);
        }),
    ),
  );
  // A failed image must not stop the other targets or create an invisible one.
  return results.filter(({ status }) => status === 'fulfilled').map(({ value }) => value);
}

function makeTexture(name, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  draw(canvas.getContext('2d'));
  const texture = new CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

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
      ctx.restore();
    });
  });
  return { whole, sliced };
}
