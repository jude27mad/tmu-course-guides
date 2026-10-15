import { CanvasTexture, SRGBColorSpace } from 'three';

// FruitNinja "fruit": a course-code disc in the course's menu colours,
// drawn on a 2D canvas (the original used third-party logo images). The "sliced"
// version is the same disc cut in two halves that drift apart.
const SIZE = 256;
const FONT_FAMILY = '"Inter Display", system-ui, sans-serif';

function drawDisc(ctx, { code, background, color }) {
  const r = SIZE * 0.47;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();
  // The original hairline ring
  ctx.lineWidth = SIZE * 0.012;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, r - SIZE * 0.035, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = SIZE * 0.2;
  ctx.font = `750 ${size}px ${FONT_FAMILY}`;
  const max = r * 1.6;
  const { width } = ctx.measureText(code);
  if (width > max) {
    size *= max / width;
    ctx.font = `750 ${size}px ${FONT_FAMILY}`;
  }
  ctx.fillText(code, 0, SIZE * 0.01);
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return canvas;
}

function toTexture(canvas) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function discTexture(course) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.translate(SIZE / 2, SIZE / 2);
  drawDisc(ctx, course);
  return toTexture(canvas);
}

export function slicedDiscTexture(course) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const half = (side) => {
    ctx.save();
    ctx.translate(SIZE / 2 + side * SIZE * 0.06, SIZE / 2 + side * SIZE * 0.035);
    ctx.rotate(side * 0.12);
    ctx.scale(0.9, 0.9);
    // each half keeps one side of a vertical cut, then both drift apart and tilt
    ctx.beginPath();
    if (side < 0) ctx.rect(-SIZE, -SIZE, SIZE, SIZE * 2);
    else ctx.rect(0, -SIZE, SIZE, SIZE * 2);
    ctx.clip();
    drawDisc(ctx, course);
    ctx.restore();
  };
  half(-1);
  half(1);
  return toTexture(canvas);
}

// Waits for the bold face so the code is drawn in Inter Display, not a fallback.
export async function loadDiscFont() {
  try {
    if (document.fonts?.load) await document.fonts.load(`750 52px ${FONT_FAMILY}`, 'CEN100MTH');
  } catch (error) {
    // draw with the fallback face
  }
}
