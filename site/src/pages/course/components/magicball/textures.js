import * as THREE from 'three';

// Generated textures for the original MagicBall (replacing the original peakpx.jpg wallpaper,
// the noise1/noise2 height maps and the troika <Text> label render target).
// Drawn once on a 2D canvas and cached, so every ball of a page shares them.
const cache = new Map();

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Small deterministic generator, so a course always gets the same marble.
/* eslint-disable no-bitwise */
function random(seedText) {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
/* eslint-enable no-bitwise */

const css = (color) => {
  const value = new THREE.Color();
  value.setStyle(color, THREE.SRGBColorSpace);
  return `#${value.getHexString(THREE.SRGBColorSpace)}`;
};

// Soft colour blobs on a base colour: the "mesh gradient" look of the wallpaper
// the original used as the marble's base map, in the course palette.
function paintBlobs(ctx, width, height, colors, next, count) {
  for (let i = 0; i < count; i += 1) {
    const x = next() * width;
    const y = next() * height;
    const radius = (0.18 + next() * 0.42) * Math.max(width, height);
    const color = colors[i % colors.length];
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `${color}ff`);
    gradient.addColorStop(0.55, `${color}88`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

function finish(canvas, { srgb = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.MirroredRepeatWrapping;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Base map (≤512²): palette gradient.
export function gradientTexture(palette, seed = '') {
  const colors = [palette.menuColor, palette.fillColor, palette.fluidColor, palette.accentColor, palette.menuColor].filter(Boolean).map(css);
  const key = `gradient:${colors.join(',')}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const width = 512;
  const height = 256;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = css(palette.secondary || '#f0f4f1');
  ctx.fillRect(0, 0, width, height);
  paintBlobs(ctx, width, height, colors, random(key), 14);
  const texture = finish(canvas, { srgb: true });
  cache.set(key, texture);
  return texture;
}

// Height volume map (256²): smooth grey blobs; the raymarch reads its red channel.
export function heightTexture(seed = 'sphere') {
  const key = `height:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#404040';
  ctx.fillRect(0, 0, size, size);
  paintBlobs(ctx, size, size, ['#ffffff', '#000000', '#d0d0d0', '#202020'], random(key), 18);
  const texture = finish(canvas);
  cache.set(key, texture);
  return texture;
}

// The label (white on black, read with step(0.5, r)): drawn once on a 512² canvas.
// The original rendered a drei <Text> into a window-sized render target every frame.
const LABEL_FONT = '"Inter Display", sans-serif';
function drawLabel(canvas, text, widthRatio) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = size * 0.3;
  ctx.font = `750 ${fontSize}px ${LABEL_FONT}`;
  // condensed like the original label (scale [0.7, 1.5])
  const stretch = 1.6;
  const measured = ctx.measureText(text).width || 1;
  fontSize = Math.min(fontSize, (fontSize * size * widthRatio * stretch) / measured);
  ctx.font = `750 ${fontSize}px ${LABEL_FONT}`;
  ctx.translate(size / 2, size / 2);
  ctx.scale(1 / stretch, 1);
  ctx.fillText(text, 0, 0);
}

export function labelTexture(text, { widthRatio = 0.6 } = {}) {
  const label = String(text || '').toUpperCase();
  const key = `label:${label}:${widthRatio}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = makeCanvas(512, 512);
  drawLabel(canvas, label, widthRatio);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cache.set(key, texture);
  // Redraw once the bold face is in (it may still be loading on the first draw).
  if (typeof document !== 'undefined' && document.fonts?.load) {
    document.fonts
      .load(`750 64px ${LABEL_FONT}`)
      .then(() => {
        drawLabel(canvas, label, widthRatio);
        texture.needsUpdate = true;
      })
      .catch(() => {});
  }
  return texture;
}
