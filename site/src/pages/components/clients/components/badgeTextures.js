import { CanvasTexture, RepeatWrapping } from 'three';

// The lanyard badge's printed faces, drawn on 2D canvases from the course
// palette (the original used client-branded PNGs on a GLB card). The card carries the
// course index, code, name and next date; the band repeats the course code.
// Colours stay in the canvas's own values: the shared canvas outputs linear
// colour on the Desk, so untagged textures show exactly what is drawn (as his
// PNG textures did).
const FONT_FAMILY = '"Inter Display", system-ui, sans-serif';
export const CARD_WIDTH = 512;
export const CARD_HEIGHT = 720; // 1.6 x 2.25, the card's own proportions

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fitFont(ctx, text, weight, size, maxWidth) {
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${FONT_FAMILY}`;
  const { width } = ctx.measureText(text);
  if (width > maxWidth) {
    fontSize *= maxWidth / width;
    ctx.font = `${weight} ${fontSize}px ${FONT_FAMILY}`;
  }
  return fontSize;
}

// Draws (or redraws) the card face onto `canvas`.
export function drawCard(canvas, { index, code, name, term, nextLabel, nextValue, background, color }) {
  const ctx = canvas.getContext('2d');
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const pad = 44;
  ctx.clearRect(0, 0, w, h);

  // rounded card (transparent corners are cut by the material's alphaTest)
  roundRect(ctx, 0, 0, w, h, 34);
  ctx.fillStyle = background;
  ctx.fill();

  // the clip slot
  roundRect(ctx, w / 2 - 52, 26, 104, 18, 9);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';

  // index and term, like the footer's meta pairs
  ctx.textAlign = 'left';
  ctx.font = `550 30px ${FONT_FAMILY}`;
  ctx.fillText(index, pad, 104);
  ctx.textAlign = 'right';
  ctx.fillText(term, w - pad, 104);

  // course code and name
  ctx.textAlign = 'left';
  fitFont(ctx, code, 750, 132, w - pad * 2);
  ctx.fillText(code, pad - 4, 380);
  fitFont(ctx, name, 550, 50, w - pad * 2);
  ctx.fillText(name, pad, 448);

  // hairline, then the next date
  ctx.globalAlpha = 0.35;
  ctx.fillRect(pad, 560, w - pad * 2, 2);
  ctx.globalAlpha = 0.7;
  ctx.font = `550 28px ${FONT_FAMILY}`;
  ctx.fillText(nextLabel, pad, 610);
  ctx.globalAlpha = 1;
  fitFont(ctx, nextValue, 650, 44, w - pad * 2);
  ctx.fillText(nextValue, pad, 664);
}

export function cardTexture(look) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  drawCard(canvas, look);
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function redrawCard(texture, look) {
  drawCard(texture.image, look);
  texture.needsUpdate = true;
}

// The lanyard print: the course code repeated along the band.
export function bandTexture({ code, background, color }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `750 120px ${FONT_FAMILY}`;
  const step = canvas.width / 2;
  for (let i = 0; i < 2; i += 1) ctx.fillText(code, step * i + step / 2, canvas.height / 2 + 6);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export async function loadBadgeFonts() {
  try {
    if (typeof document !== 'undefined' && document.fonts?.load) {
      await Promise.all([
        document.fonts.load(`750 64px ${FONT_FAMILY}`, 'CEN100'),
        document.fonts.load(`550 32px ${FONT_FAMILY}`, 'Engineering'),
        document.fonts.load(`650 32px ${FONT_FAMILY}`, 'Wed Oct 21'),
      ]);
    }
  } catch (error) {
    // draw with the fallback face
  }
}
