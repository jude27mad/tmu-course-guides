/* eslint-disable import/prefer-default-export, no-use-before-define */
// Adapted from Atelier North's pixelateImage(), src/scripts/global.js.
// Copyright (c) 2026 Codrops. MIT; see public/licenses/Atelier-North-Codrops-MIT.txt.
// Source: codrops/atelier-north at 6703fc3f15ec92979964070814a99855d0baa38f.
// Keep its 18-pixel downsample, progress^2.5 sharpening, unsmoothed upscale
// and simultaneous 1.1 → 1 zoom. React owns the elements and their lifetime.
export function createPixelReveal({ image, canvas, element, gsap, ScrollTrigger, document, active = false, held = false, still = false, onComplete = () => {} }) {
  let destroyed = false;
  let finished = false;
  let started = false;
  let visible = active;
  // Held while a page change animates: per-frame redraws would make it stutter.
  let holding = held;
  let timeline;
  let trigger;
  let temp;
  let ctx;
  let tctx;
  const state = { progress: 0 };
  canvas.style.visibility = 'hidden';

  function removeListeners() {
    image.removeEventListener('load', prepare);
    image.removeEventListener('error', finish);
    document.removeEventListener('visibilitychange', sync);
  }

  function finish() {
    if (finished || destroyed) return;
    finished = true;
    canvas.style.visibility = 'hidden';
    timeline?.kill();
    trigger?.kill();
    removeListeners();
    onComplete();
  }

  function sync() {
    if (!timeline || destroyed || finished) return;
    if (started && visible && !holding && !document.hidden) timeline.play();
    else timeline.pause();
  }

  function render() {
    if (destroyed || finished) return false;
    try {
      const w = canvas.width;
      const h = canvas.height;
      const pixels = 18 + (w - 18) * state.progress ** 2.5;
      const pw = Math.max(1, Math.round(pixels));
      const ph = Math.max(1, Math.round((h / w) * pw));
      temp.width = pw;
      temp.height = ph;
      tctx.clearRect(0, 0, pw, ph);
      tctx.drawImage(image, 0, 0, pw, ph);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0, pw, ph, 0, 0, w, h);
      return true;
    } catch (error) {
      finish();
      return false;
    }
  }

  function initialize() {
    if (destroyed || finished || timeline) return;
    if (!image.naturalWidth || !image.naturalHeight) {
      finish();
      return;
    }
    try {
      ctx = canvas.getContext('2d');
      temp = document.createElement('canvas');
      tctx = temp.getContext('2d');
      if (!ctx || !tctx) {
        finish();
        return;
      }
      // CSS object-fit handles responsive cropping; cap both backing dimensions.
      const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      if (!render()) return;
      gsap.set(canvas, { scale: 1.1 });
      timeline = gsap.timeline({ paused: true, onComplete: finish });
      timeline.to(state, { progress: 1, duration: 1.5, onUpdate: render }).to(canvas, { scale: 1, duration: 1.5 }, 0);
      trigger = ScrollTrigger.create({
        trigger: element,
        scroller: document.querySelector('main'),
        start: 'top center',
        onEnter: () => {
          started = true;
          sync();
        },
        onEnterBack: () => {
          started = true;
          sync();
        },
      });
      canvas.style.visibility = 'visible';
      sync();
    } catch (error) {
      finish();
    }
  }

  // Decode the photo off the main thread before the first draw, which would
  // otherwise decode it synchronously in the middle of a page change.
  function prepare() {
    if (destroyed || finished || timeline) return;
    if (typeof image.decode !== 'function') {
      initialize();
      return;
    }
    image.decode().then(initialize, () => (image.naturalWidth ? initialize() : finish()));
  }

  const controls = {
    setActive(next) {
      visible = next;
      sync();
    },
    setHeld(next) {
      holding = next;
      sync();
    },
    finish,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      timeline?.kill();
      trigger?.kill();
      removeListeners();
      canvas.style.visibility = 'hidden';
      canvas.width = 0;
      canvas.height = 0;
      if (temp) {
        temp.width = 0;
        temp.height = 0;
      }
    },
  };

  if (still) {
    finish();
    return controls;
  }
  image.addEventListener('load', prepare);
  image.addEventListener('error', finish);
  document.addEventListener('visibilitychange', sync);
  if (image.complete) prepare();
  return controls;
}
