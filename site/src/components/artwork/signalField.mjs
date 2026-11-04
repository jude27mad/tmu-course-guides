/* eslint-disable import/prefer-default-export, no-plusplus, no-restricted-syntax, no-continue */
/*
 * Adapted from Pixels71/kairo-astro signal-field.ts at 97426fdfa1f3bd812cf0acc364273c28a89f871e.
 * Copyright (c) 2026 Pixels71 — MIT; see public/licenses/Kairo-MIT.txt.
 * The point wave, repulsion, pulse bands and timing are Kairo's; the colours are the site palette's.
 * This adapter replaces its global intro/initialization with a disposable controller
 * driven by Giats's existing Tempus clock, visibility and motion preferences.
 */
import { TOKENS, rgbOf } from '../../lib/palette.mjs';
import { easeFor, frameShare } from '../../utils/frameStep.mjs';

const BONE = rgbOf(TOKENS.mutedOnDark);
const SIGNAL = rgbOf(TOKENS.onDark);
const PULSE_LIFE = 2.8;
const PULSE_SPEED = 240;
const REPEL = 170;
const noop = () => {};

export function mountSignalField(canvas, { subscribe, host = canvas.parentElement, visible = false, still = false } = {}) {
  let ctx;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    /* CSS field remains visible. */
  }
  if (!ctx) return { update: noop, destroy: noop };
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const pulses = [];
  // Per-frame values of each live pulse, so the point loop does not recompute
  // them for every point: x, y, ring radius, ring fade, core fade.
  const live = new Float64Array(4 * 5);
  const hot = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, power: 0, target: 0 };
  let width = 0;
  let height = 0;
  let gap = 26;
  let cols = 0;
  let rows = 0;
  let offsetX = 0;
  let offsetY = 0;
  let inView = visible;
  let paused = still;
  let disposed = false;
  let unsubscribe = null;
  let nextPulse = 1.2;
  let clock = 0;
  let last = null;

  const spawn = (x, y) => {
    const px = x ?? width * (0.3 + Math.random() * 0.3);
    const py = y ?? height * (0.12 + Math.random() * 0.4);
    const snapX = offsetX + Math.round((px - offsetX) / gap) * gap;
    const snapY = offsetY + Math.round((py - offsetY) / gap) * gap;
    pulses.push({ x: snapX, y: snapY, born: clock });
    if (pulses.length > 4) pulses.shift();
  };

  // Kairo's pointer easing is per 60 Hz frame; `share` is the part of one
  // that this frame covers (0.5 at 120 Hz).
  const draw = (share = 1) => {
    const t = clock;
    const follow = easeFor(0.12, share);
    mouse.x += (mouse.tx - mouse.x) * follow;
    mouse.y += (mouse.ty - mouse.y) * follow;
    mouse.power += (mouse.target - mouse.power) * easeFor(0.08, share);
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = TOKENS.ink;
    ctx.fillRect(0, 0, width, height);

    let liveCount = 0;
    for (const pulse of pulses) {
      const age = t - pulse.born;
      if (age < 0 || age > PULSE_LIFE) continue;
      live.set([pulse.x, pulse.y, age * PULSE_SPEED, 1 - age / PULSE_LIFE, Math.max(0, 1 - age / 1.2)], liveCount * 5);
      liveCount++;
    }
    const repel = mouse.power > 0.01;

    hot.length = 0;
    ctx.fillStyle = `rgb(${BONE})`;

    for (let i = 0; i < cols; i++) {
      const bx = offsetX + i * gap;
      for (let j = 0; j < rows; j++) {
        const by = offsetY + j * gap;
        const shown = 1;

        const wave = Math.sin(bx * 0.006 + t * 0.7) * Math.cos(by * 0.008 - t * 0.5) + Math.sin((bx + by) * 0.004 + t * 0.9) * 0.5;
        let x = bx;
        let y = by + wave * 5;
        let lift = 0;

        if (repel) {
          const mx = bx - mouse.x;
          const my = by - mouse.y;
          const distance = Math.sqrt(mx * mx + my * my);
          if (distance < REPEL) {
            const force = (1 - distance / REPEL) ** 2 * mouse.power;
            const nx = distance ? mx / distance : 0;
            const ny = distance ? my / distance : 0;
            x += nx * force * 30;
            y += ny * force * 30;
            lift = force;
          }
        }

        let heat = 0;
        for (let k = 0; k < liveCount * 5; k += 5) {
          const dx = x - live[k];
          const dy = y - live[k + 1];
          const d = Math.sqrt(dx * dx + dy * dy);
          const band = Math.exp(-((d - live[k + 2]) ** 2) / 1400) * live[k + 3];
          const core = Math.exp(-(d * d) / 900) * live[k + 4];
          heat = Math.max(heat, band, core);
        }

        const alpha = (0.1 + ((wave + 1.5) / 3) * 0.32 + lift * 0.45) * shown;
        const size = (width < 768 ? 1.4 : 1.7) + lift * 1.8 + heat * 1.4;
        if (heat > 0.04) {
          hot.push(x, y, size, Math.min(1, alpha + heat * 0.85));
          continue;
        }
        ctx.globalAlpha = alpha;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }

    ctx.fillStyle = `rgb(${SIGNAL})`;
    for (let k = 0; k < hot.length; k += 4) {
      ctx.globalAlpha = hot[k + 3];
      ctx.fillRect(hot[k] - hot[k + 2] / 2, hot[k + 1] - hot[k + 2] / 2, hot[k + 2], hot[k + 2]);
    }

    for (const pulse of pulses) {
      const age = t - pulse.born;
      if (age < 0 || age > PULSE_LIFE) continue;
      const fade = 1 - age / PULSE_LIFE;
      ctx.globalAlpha = fade * 0.55;
      ctx.strokeStyle = `rgb(${SIGNAL})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, age * PULSE_SPEED, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${SIGNAL})`;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    last = null;
  };

  const staticFrame = () => {
    // Kairo's own reduced-motion composition: a single travelling pulse held
    // 0.9 seconds into its life, with the full fine-point field exposed.
    pulses.length = 0;
    clock = 0;
    mouse.power = 0;
    mouse.target = 0;
    spawn(width * 0.72, height * 0.32);
    clock = 0.9;
    nextPulse = 1.2;
    draw();
  };

  const resize = () => {
    if (disposed) return;
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(win.devicePixelRatio || 1, 1.5, 2048 / width, 1536 / height, Math.sqrt(2_000_000 / (width * height)));
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    gap = width < 768 ? 22 : 26;
    cols = Math.ceil(width / gap) + 1;
    rows = Math.ceil(height / gap) + 1;
    offsetX = (width - (cols - 1) * gap) / 2;
    offsetY = (height - (rows - 1) * gap) / 2;
    if (paused || !unsubscribe) staticFrame();
    else draw();
  };

  const loop = (now) => {
    if (disposed || paused || !inView || doc.hidden) return;
    const delta = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += delta;
    if (clock > nextPulse) {
      spawn();
      nextPulse = clock + 2.4 + Math.random() * 1.4;
    }
    draw(frameShare(delta));
  };

  const sync = () => {
    if (disposed) return;
    if (paused || !inView || doc.hidden) stop();
    else if (!unsubscribe) unsubscribe = subscribe(loop);
  };

  const pointFor = (event) => {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * width) / (box.width || 1),
      y: ((event.clientY - box.top) * height) / (box.height || 1),
    };
  };
  const ignores = (event) => paused || !inView || doc.hidden || event.pointerType === 'touch' || event.target?.closest?.('a, button, input, select, textarea, [role="button"]');
  const onMove = (event) => {
    if (ignores(event)) return;
    const point = pointFor(event);
    mouse.tx = point.x;
    mouse.ty = point.y;
    if (mouse.power < 0.05) {
      mouse.x = mouse.tx;
      mouse.y = mouse.ty;
    }
    mouse.target = 1;
  };
  const onLeave = () => {
    mouse.target = 0;
  };
  const onDown = (event) => {
    if (ignores(event)) return;
    const point = pointFor(event);
    spawn(point.x, point.y);
  };
  const onVisibility = () => {
    mouse.target = 0;
    sync();
  };
  resize();
  const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  observer?.observe(canvas);
  doc.addEventListener('visibilitychange', onVisibility);
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', onLeave, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  sync();

  return {
    update(state) {
      if (disposed) return;
      const wasPaused = paused;
      if ('visible' in state) inView = state.visible;
      if ('still' in state) paused = state.still;
      sync();
      if (paused && !wasPaused) staticFrame();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      observer?.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointerdown', onDown);
      pulses.length = 0;
    },
  };
}
