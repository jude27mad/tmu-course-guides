import { CanvasTexture, RepeatWrapping } from 'three';
import { BAND_HEIGHT, BAND_WIDTH, CARD_HEIGHT, CARD_WIDTH } from './badgeRim.mjs';

// The lanyard badge's printed faces, drawn on 2D canvases from the course
// palette (the original used client-branded PNGs on a GLB card). The card carries the
// course index, code, name and next date; the band repeats the course code.
// Every colour comes from the look (BADGE in lib/palette.mjs); none is set here.
// Colours stay in the canvas's own values: the shared canvas outputs linear
// colour on the Desk, so untagged textures show exactly what is drawn (as his
// PNG textures did).
const FONT_FAMILY = '"Inter Display", system-ui, sans-serif';

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
export function drawCard(canvas, { index, code, name, term, nextLabel, nextValue, background, color, secondary, divider, slot, rim, rimCard = 2 }) {
  const ctx = canvas.getContext('2d');
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const pad = 44;
  ctx.clearRect(0, 0, w, h);

  // rounded card (transparent corners are cut by the material's alphaTest)
  roundRect(ctx, 0, 0, w, h, 34);
  ctx.fillStyle = background;
  ctx.fill();

  // dark mode: a soft light rim just inside the card's edge, rimCard texels wide (about a screen pixel; badgeRim.mjs)
  if (rim) {
    roundRect(ctx, rimCard / 2, rimCard / 2, w - rimCard, h - rimCard, 34 - rimCard / 2);
    ctx.strokeStyle = rim;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = rimCard;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // the clip slot
  roundRect(ctx, w / 2 - 52, 26, 104, 18, 9);
  ctx.fillStyle = slot;
  ctx.fill();

  ctx.textBaseline = 'alphabetic';

  // index and term, like the footer's meta pairs
  ctx.fillStyle = secondary;
  ctx.textAlign = 'left';
  ctx.font = `550 30px ${FONT_FAMILY}`;
  ctx.fillText(index, pad, 104);
  ctx.textAlign = 'right';
  ctx.fillText(term, w - pad, 104);

  // course code and name
  ctx.textAlign = 'left';
  fitFont(ctx, code, 750, 132, w - pad * 2);
  ctx.fillStyle = color;
  ctx.fillText(code, pad - 4, 380);
  fitFont(ctx, name, 550, 50, w - pad * 2);
  ctx.fillStyle = secondary;
  ctx.fillText(name, pad, 448);

  // hairline, then the next date
  ctx.fillStyle = divider;
  ctx.fillRect(pad, 560, w - pad * 2, 2);
  ctx.fillStyle = secondary;
  ctx.font = `550 28px ${FONT_FAMILY}`;
  ctx.fillText(nextLabel, pad, 610);
  fitFont(ctx, nextValue, 650, 44, w - pad * 2);
  ctx.fillStyle = color;
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
export function bandTexture({ code, strap, strapColor, rim, rimBand = 4 }) {
  const canvas = document.createElement('canvas');
  canvas.width = BAND_WIDTH;
  canvas.height = BAND_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = strap;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // dark mode: the same rim along both edges of the strap, rimBand texels wide
  if (rim) {
    ctx.fillStyle = rim;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(0, 0, canvas.width, rimBand);
    ctx.fillRect(0, canvas.height - rimBand, canvas.width, rimBand);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = strapColor;
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
