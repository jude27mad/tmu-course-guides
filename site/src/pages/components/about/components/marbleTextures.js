import { CanvasTexture, MirroredRepeatWrapping, NearestFilter, RepeatWrapping } from 'three';

// Generated stand-ins for the MagicBall's images (decision 6): the original used a
// wallpaper (peakpx.jpg) as the base map, a 2048² colour-blob PNG as the
// height map and a drei <Text> label re-rendered into a window-sized render
// target every frame. Here all three are drawn once on 512² canvases from the
// course palette, so nothing is downloaded and nothing is redrawn per frame.
const SIZE = 512;
const FONT_FAMILY = '"Inter Display", system-ui, sans-serif';

// Deterministic per label, so a course's marble always looks the same.
function seeded(text) {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) seed = (seed * 31 + text.charCodeAt(i)) % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return canvas;
}

function blob(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

// CSS colour (hex or a name such as 'gold') -> rgba() with alpha.
function withAlpha(ctx, color, alpha) {
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const hex = ctx.fillStyle; // the canvas normalises any CSS colour to #rrggbb
  const channel = (i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}

// The soft multi-colour gradient (peakpx look): pale paper base with blobs of
// the course's menu, fluid and ink colours.
function baseCanvas(palette, random) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette.fillColor;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const colors = [palette.menuColor, palette.fluidColor, palette.menuColor, palette.accentColor, palette.fluidColor, palette.primary];
  colors.forEach((color, i) => {
    const radius = SIZE * (0.35 + random() * 0.35) * (i === colors.length - 1 ? 0.6 : 1);
    blob(ctx, random() * SIZE, random() * SIZE, radius, withAlpha(ctx, color, i === colors.length - 1 ? 0.55 : 0.85));
  });
  return canvas;
}

// Smooth blobs for the raymarched height volume (only the red channel is read).
// Mostly high, like the red channel of his warm colour-blob image, so the
// course colour fills most of the ball, broken by lower streaks.
function heightCanvas(random) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(205, 205, 205)';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 9; i += 1) {
    const level = Math.round(120 + random() * 135);
    blob(ctx, random() * SIZE, random() * SIZE, SIZE * (0.2 + random() * 0.4), `rgba(${level}, ${level}, ${level}, 0.9)`);
  }
  return canvas;
}

// White label on black; the shader paints the surface black where the label
// is (the original: drei <Text> in a render target, repeated 5 x 4 on the sphere).
function labelCanvas(label) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = SIZE * 0.2;
  ctx.font = `550 ${size}px ${FONT_FAMILY}`;
  const width = ctx.measureText(label).width || 1;
  // condensed and tall like his scaled <Text> (scale [0.7, 1.5])
  const scaleX = Math.min(0.62, (SIZE * 0.62) / width);
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.scale(scaleX, 1.1);
  ctx.fillText(label, 0, 0);
  ctx.restore();
  return canvas;
}

function texture(canvas, { mirrored = false, nearest = false } = {}) {
  const map = new CanvasTexture(canvas);
  if (mirrored) {
    map.wrapS = MirroredRepeatWrapping;
    map.wrapT = MirroredRepeatWrapping;
  } else {
    map.wrapS = RepeatWrapping;
    map.wrapT = RepeatWrapping;
  }
  if (nearest) map.minFilter = NearestFilter;
  map.needsUpdate = true;
  return map;
}

export function marbleTextures({ label, palette }) {
  const random = seeded(`${label}|${palette.menuColor}`);
  return {
    base: texture(baseCanvas(palette, random), { mirrored: true, nearest: true }),
    height: texture(heightCanvas(random), { mirrored: true, nearest: true }),
    label: texture(labelCanvas(label)),
  };
}

export function disposeMarbleTextures(textures) {
  if (!textures) return;
  Object.values(textures).forEach((map) => map.dispose());
}

// Waits for the face the label is drawn in (falls back to the system face).
export async function loadMarbleFont() {
  try {
    if (typeof document !== 'undefined' && document.fonts?.load) await document.fonts.load(`550 64px ${FONT_FAMILY}`, 'CEN100MTH');
  } catch (error) {
    // draw with the fallback face
  }
}
