import test from 'node:test';
import assert from 'node:assert/strict';

const revealModule = () => import('../src/components/courseArtwork/pixelReveal.mjs');

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    dispatch(name) { for (const callback of listeners.get(name) || []) callback(); },
    listenerCount() { return [...listeners.values()].reduce((total, set) => total + set.size, 0); },
  };
}

function fixture({ complete = true, context = true, drawFailure = false } = {}) {
  const draws = [];
  const context2d = { clearRect() {}, drawImage(...args) { if (drawFailure) throw Error('Canvas unavailable'); draws.push(args); }, imageSmoothingEnabled: true };
  const canvas = { width: 0, height: 0, style: {}, getContext: () => context ? context2d : null };
  const temp = { width: 0, height: 0, getContext: () => context ? context2d : null };
  const image = { ...eventTarget(), naturalWidth: 3200, naturalHeight: 2400, complete, style: {} };
  const scroller = {};
  const document = { ...eventTarget(), hidden: false, createElement: () => temp, querySelector: () => scroller };
  const calls = [];
  const tweens = [];
  const timelines = [];
  const triggers = [];
  const gsap = {
    set(target, values) { calls.push(['set', target, values]); },
    timeline(options) {
      const timeline = {
        options, killed: false, playing: false,
        to(target, values, position) { tweens.push({ target, values, position }); return this; },
        play() { this.playing = true; return this; },
        pause() { this.playing = false; return this; },
        kill() { this.playing = false; this.killed = true; },
      };
      timelines.push(timeline);
      return timeline;
    },
  };
  const ScrollTrigger = {
    create(options) {
      const trigger = { options, killed: false, kill() { this.killed = true; } };
      triggers.push(trigger);
      return trigger;
    },
  };
  return { image, canvas, temp, document, gsap, ScrollTrigger, scroller, calls, draws, context2d, tweens, timelines, triggers, element: {} };
}

test('the reveal uses Atelier North’s small raster → unsmoothed full canvas, capped in size', async () => {
  const { createPixelReveal } = await revealModule();
  const f = fixture();
  const reveal = createPixelReveal({ ...f, active: true });
  assert.deepEqual([f.canvas.width, f.canvas.height], [1600, 1200]);
  assert.deepEqual([f.temp.width, f.temp.height], [18, 14]);
  assert.equal(f.context2d.imageSmoothingEnabled, false);
  assert.equal(f.canvas.style.visibility, 'visible');
  const progress = f.tweens.find(({ target }) => 'progress' in target);
  assert.equal(progress.values.duration, 1.5);
  progress.target.progress = 0.5;
  progress.values.onUpdate();
  assert.equal(f.temp.width, Math.round(18 + (1600 - 18) * Math.pow(0.5, 2.5)));
  assert.equal(f.triggers[0].options.scroller, f.scroller);
  assert.equal(f.triggers[0].options.start, 'top center');
  assert.equal(f.calls.find(([kind]) => kind === 'set')[2].scale, 1.1);
  assert.ok(f.tweens.some(({ target, values, position }) => target === f.canvas && values.scale === 1 && values.duration === 1.5 && position === 0));
  reveal.destroy();
});

test('the reveal waits for its trigger, pauses outside view and while hidden, and resumes once', async () => {
  const { createPixelReveal } = await revealModule();
  const f = fixture();
  const reveal = createPixelReveal({ ...f, active: false });
  const timeline = f.timelines[0];
  f.triggers[0].options.onEnter();
  assert.equal(timeline.playing, false);
  reveal.setActive(true);
  assert.equal(timeline.playing, true);
  f.document.hidden = true;
  f.document.dispatch('visibilitychange');
  assert.equal(timeline.playing, false);
  f.document.hidden = false;
  f.document.dispatch('visibilitychange');
  assert.equal(timeline.playing, true);
  reveal.setActive(false);
  assert.equal(timeline.playing, false);
  reveal.setActive(true);
  assert.equal(f.timelines.length, 1);
  reveal.destroy();
});

test('the reveal holds while a page change or the loader animates, then plays', async () => {
  const { createPixelReveal } = await revealModule();
  const f = fixture();
  const reveal = createPixelReveal({ ...f, active: true, held: true });
  const timeline = f.timelines[0];
  f.triggers[0].options.onEnter();
  assert.equal(timeline.playing, false);
  const drawsWhileHeld = f.draws.length;
  reveal.setHeld(false);
  assert.equal(timeline.playing, true);
  reveal.setHeld(true);
  assert.equal(timeline.playing, false);
  assert.equal(f.draws.length, drawsWhileHeld, 'holding draws nothing beyond the first frame');
  reveal.destroy();
});

test('the photo is decoded before the first draw, and a late decode after destroy does nothing', async () => {
  const { createPixelReveal } = await revealModule();
  const f = fixture();
  let resolveDecode;
  f.image.decode = () => new Promise((resolve) => { resolveDecode = resolve; });
  const reveal = createPixelReveal({ ...f, active: true });
  assert.equal(f.draws.length, 0, 'no synchronous draw before decoding');
  assert.equal(f.timelines.length, 0);
  resolveDecode();
  await new Promise((done) => setImmediate(done));
  assert.ok(f.draws.length > 0);
  assert.equal(f.timelines.length, 1);
  reveal.destroy();

  const g = fixture();
  let resolveLate;
  g.image.decode = () => new Promise((resolve) => { resolveLate = resolve; });
  const late = createPixelReveal({ ...g, active: true });
  late.destroy();
  resolveLate();
  await new Promise((done) => setImmediate(done));
  assert.equal(g.draws.length, 0);
  assert.equal(g.timelines.length, 0);

  const h = fixture();
  h.image.decode = () => Promise.reject(new Error('EncodingError'));
  const rejected = createPixelReveal({ ...h, active: true });
  await new Promise((done) => setImmediate(done));
  assert.equal(h.timelines.length, 1, 'a decoded-elsewhere image still reveals when decode() rejects');
  rejected.destroy();
});

test('completion reveals the untouched real image and cannot restart the animation', async () => {
  const { createPixelReveal } = await revealModule();
  const f = fixture();
  const reveal = createPixelReveal({ ...f, active: true });
  f.timelines[0].options.onComplete();
  assert.equal(f.canvas.style.visibility, 'hidden');
  assert.deepEqual(f.image.style, {});
  reveal.setActive(true);
  assert.equal(f.timelines[0].playing, false);
  assert.equal(f.triggers[0].killed, true);
  reveal.destroy();
});

test('saved Pause motion / reduced motion immediately exposes the image without any animation work', async () => {
  const { createPixelReveal } = await revealModule();
  const f = fixture();
  const reveal = createPixelReveal({ ...f, still: true, active: true });
  assert.equal(f.canvas.style.visibility, 'hidden');
  assert.deepEqual(f.image.style, {});
  assert.equal(f.timelines.length, 0);
  assert.equal(f.triggers.length, 0);
  assert.equal(f.document.listenerCount(), 0);
  assert.equal(f.image.listenerCount(), 0);
  reveal.destroy();
});

test('canvas or drawing failures keep the underlying photograph visible', async () => {
  const { createPixelReveal } = await revealModule();
  for (const options of [{ context: false }, { drawFailure: true }]) {
    const f = fixture(options);
    const reveal = createPixelReveal({ ...f, active: true });
    assert.equal(f.canvas.style.visibility, 'hidden');
    assert.deepEqual(f.image.style, {});
    assert.ok(f.timelines.every((timeline) => !timeline.playing));
    reveal.destroy();
  }
});

test('destroy removes loading/visibility listeners and animation resources, including late image loads', async () => {
  const { createPixelReveal } = await revealModule();
  for (const complete of [false, true]) {
    const f = fixture({ complete });
    const reveal = createPixelReveal({ ...f, active: true });
    const pendingLoad = [...(f.image.listeners.get('load') || [])][0];
    reveal.destroy();
    reveal.destroy();
    pendingLoad?.();
    assert.equal(f.image.listenerCount(), 0);
    assert.equal(f.document.listenerCount(), 0);
    assert.equal(f.canvas.style.visibility, 'hidden');
    assert.ok(f.timelines.every((timeline) => timeline.killed));
    assert.ok(f.triggers.every((trigger) => trigger.killed));
    assert.equal(f.canvas.width, 0);
    assert.equal(f.temp.width, 0);
  }
});

test('an image failure ends the reveal without leaving a blank canvas over the fallback', async () => {
  const { createPixelReveal } = await revealModule();
  const f = fixture({ complete: false });
  const reveal = createPixelReveal({ ...f, active: true });
  f.image.dispatch('error');
  assert.equal(f.canvas.style.visibility, 'hidden');
  assert.equal(f.timelines.length, 0);
  assert.equal(f.image.listenerCount(), 0);
  reveal.destroy();
});

test('each course resolves to local imagery; missing and unresolved courses have the same real fallback', async () => {
  const { artworkFor } = await import('../src/components/courseArtwork/artworks.mjs');
  const artworks = ['cen100', 'mth140', 'mth141'].map(artworkFor);
  assert.equal(new Set(artworks.map(({ src }) => src)).size, 3);
  for (const artwork of artworks) {
    assert.match(artwork.src, /^\/images\/courses\/.+\.webp$/);
    assert.ok(artwork.width > 0 && artwork.height > 0);
    assert.equal(typeof artwork.position, 'string');
  }
  assert.equal(artworkFor(null), artworkFor('not-yet-resolved'));
  assert.ok(artworks.includes(artworkFor(undefined)));
});
