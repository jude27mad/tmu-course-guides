import { CanvasTexture, RepeatWrapping } from 'three';
import { BAND_HEIGHT, BAND_WIDTH, CARD_HEIGHT, CARD_WIDTH } from './badgeRim.mjs';
import { DRAWING, FONT_MARGIN, FOOTER_Y, PRINT_FONT, TEXT_WIDTH, printLines, subjectArt } from './badgePrint.mjs';
import { paintBandWeave } from './bandWeave.mjs';

// Keep the card's printed edges and diagrams sharp on high-density screens without increasing the shared
// WebGL surface's pixel ratio. Small windows have a 1x print; the large Desk pass has a 2x print.
export const printScale = (height) => (height >= 450 ? 2 : 1);

function drawDiagram(ctx, code, accent) {
  ctx.save();
  ctx.translate(DRAWING.x, DRAWING.y);
  ctx.scale(DRAWING.scale, DRAWING.scale);
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  subjectArt(code).forEach((layer) => {
    const outline = new Path2D(layer.path);
    ctx.globalAlpha = layer.opacity ?? 1;
    if (layer.fill) {
      ctx.fill(outline);
    } else {
      ctx.lineWidth = layer.weight;
      ctx.stroke(outline);
    }
  });
  ctx.restore();
}

export function drawCard(canvas, look) {
  const { code, background, color, accent, rim, rimCard = 2 } = look;
  const ctx = canvas.getContext('2d');
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  ctx.save();
  ctx.scale(canvas.width / w, canvas.height / h);
  // The slot and rounding are real holes in the mesh, so opaque ink can run right to the cut edge.
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.36;
  ctx.fillRect(FONT_MARGIN, 132, w - 2 * FONT_MARGIN, 2);
  ctx.globalAlpha = 1;
  drawDiagram(ctx, code, accent);
  ctx.fillStyle = accent;
  ctx.fillRect(0, FOOTER_Y, w, h - FOOTER_Y);
  printLines(look).forEach((line) => {
    ctx.fillStyle = line.ink;
    ctx.textAlign = line.end ? 'right' : 'left';
    ctx.font = `${line.weight} ${line.size}px ${PRINT_FONT}`;
    const { width } = ctx.measureText(line.text);
    ctx.save();
    ctx.translate(line.x, line.y);
    if (width) ctx.scale((line.fitWidth ?? Math.min(width, TEXT_WIDTH)) / width, 1);
    ctx.fillText(line.text, 0, 0);
    ctx.restore();
  });
  if (rim) {
    // The print's logical units also define this rim. Its on-screen width is independent of print density.
    ctx.strokeStyle = rim;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = rimCard;
    ctx.beginPath();
    ctx.roundRect(rimCard / 2, rimCard / 2, w - rimCard, h - rimCard, 34 - rimCard / 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function cardTexture(look, density = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * density;
  canvas.height = CARD_HEIGHT * density;
  drawCard(canvas, look);
  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export function redrawCard(texture, look) {
  drawCard(texture.image, look);
  texture.needsUpdate = true;
}

export function bandTexture({ code, strap, strapColor, rim, rimBand = 4 }) {
  const canvas = document.createElement('canvas');
  canvas.width = BAND_WIDTH;
  canvas.height = BAND_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = strap;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paintBandWeave(ctx, canvas.width, canvas.height);
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
  ctx.font = `650 108px ${PRINT_FONT}`;
  const step = canvas.width / 2;
  for (let i = 0; i < 2; i += 1) ctx.fillText(code, step * i + step / 2, canvas.height / 2 + 6);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export async function loadBadgeFonts() {
  try {
    if (typeof document !== 'undefined' && document.fonts?.load) {
      await Promise.all([
        document.fonts.load(`750 64px ${PRINT_FONT}`, 'CEN100'),
        document.fonts.load(`550 32px ${PRINT_FONT}`, 'Engineering'),
        document.fonts.load(`650 32px ${PRINT_FONT}`, 'Wed Oct 21'),
      ]);
    }
  } catch (error) {
    // Draw with the system typeface when a font fails.
  }
}
