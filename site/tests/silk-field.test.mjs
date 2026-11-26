import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SILK, SILK_DARK, DARK, TOKENS, rgbOf } from '../src/lib/palette.mjs';
import { SILK_CUT, mountSilkField } from '../src/components/artwork/silkField.mjs';

// The Desk's artwork where WebGL 2 works: React Bits' silk under Giats's window mask, on the site's clock, with
// Kairo's field as the stand-in wherever the cloth cannot be drawn.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn, options) {
      listeners.set(type, { fn, options });
    },
    removeEventListener(type, fn) {
      if (listeners.get(type)?.fn === fn) listeners.delete(type);
    },
    emit(type, event = {}) {
      listeners.get(type)?.fn(event);
    },
  };
}

// A WebGL 2 context that records what is drawn. `fail` names the step that should fail: 'compile' or 'link'.
function fakeGL({ fail } = {}) {
  const calls = [];
  const lose = { lost: 0 };
  const live = { programs: 0, shaders: 0, buffers: 0, arrays: 0 };
  const gl = {
    calls,
    lose,
    live,
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    createShader: (type) => {
      live.shaders += 1;
      return { type };
    },
    shaderSource(shader, source) {
      shader.source = source;
    },
    compileShader() {},
    getShaderParameter: () => fail !== 'compile',
    deleteShader() {
      live.shaders -= 1;
    },
    createProgram: () => {
      live.programs += 1;
      return { shaders: [] };
    },
    attachShader(program, shader) {
      program.shaders.push(shader);
    },
    bindAttribLocation() {},
    linkProgram() {},
    getProgramParameter: () => fail !== 'link',
    deleteProgram() {
      live.programs -= 1;
    },
    getUniformLocation: (program, name) => name,
    createBuffer: () => {
      live.buffers += 1;
      return {};
    },
    deleteBuffer() {
      live.buffers -= 1;
    },
    createVertexArray: () => {
      live.arrays += 1;
      return {};
    },
    deleteVertexArray() {
      live.arrays -= 1;
    },
    bindVertexArray() {},
    bindBuffer() {},
    bufferData() {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    viewport: (...args) => calls.push(['viewport', ...args]),
    useProgram() {},
    drawArrays: (...args) => calls.push(['draw', ...args]),
    getExtension: (name) =>
      name === 'WEBGL_lose_context'
        ? {
            loseContext() {
              lose.lost += 1;
            },
          }
        : null,
  };
  for (const kind of ['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform3fv', 'uniform4fv']) {
    gl[kind] = (name, ...values) => calls.push(['uniform', name, ...values.map((value) => (ArrayBuffer.isView(value) ? Array.from(value) : value))]);
  }
  return gl;
}

function fixture({ gl = fakeGL(), width = 1200, height = 600, devicePixelRatio = 3 } = {}) {
  const doc = { ...target(), hidden: false };
  const observers = [];
  const win = {
    devicePixelRatio,
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }

      observe(element) {
        this.element = element;
      }

      disconnect() {
        this.element = null;
      }
    },
  };
  doc.defaultView = win;
  const asked = [];
  const canvas = {
    ...target(),
    ownerDocument: doc,
    clientWidth: width,
    clientHeight: height,
    getContext(kind, attributes) {
      asked.push([kind, attributes]);
      return kind === 'webgl2' ? gl : null;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
  };
  const host = target();
  canvas.parentElement = host;
  const frames = new Set();
  const subscribe = (callback) => {
    frames.add(callback);
    return () => frames.delete(callback);
  };
  const tick = (time) => [...frames].forEach((callback) => callback(time));
  // The value last given to a uniform, and how many frames have been drawn.
  const uniform = (name) => gl.calls.findLast((call) => call[0] === 'uniform' && call[1] === name)?.slice(2);
  const draws = () => gl.calls.filter((call) => call[0] === 'draw').length;
  return { gl, canvas, host, doc, win, observers, asked, frames, subscribe, tick, uniform, draws };
}

const channels = (hex) =>
  rgbOf(hex)
    .split(', ')
    .map((value) => Number(value) / 255);
const close = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6, `${label}: ${actual} against ${expected}`));
};

test('the cloth is drawn in the palette, on one small context, at a bounded resolution', () => {
  const f = fixture();
  const field = mountSilkField(f.canvas, { subscribe: f.subscribe, visible: true });
  assert.ok(field, 'the cloth mounts where WebGL 2 works');
  assert.deepEqual(f.asked, [['webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }]]);
  // A phone's three device pixels per CSS pixel are capped, and so is the canvas's area.
  assert.ok(f.canvas.width <= 1200 * 1.5 && f.canvas.height <= 600 * 1.5);
  assert.ok(f.canvas.width * f.canvas.height <= 1_200_000 * 1.01, `${f.canvas.width} x ${f.canvas.height}`);
  assert.deepEqual(
    f.gl.calls.find((call) => call[0] === 'viewport'),
    ['viewport', 0, 0, f.canvas.width, f.canvas.height],
  );
  close(f.uniform('uColor')[0], channels(SILK.color), 'the cloth');
  close(f.uniform('uSheenColor')[0], channels(SILK.sheen), 'its sheen');
  close(f.uniform('uShade')[0], SILK.shade.flatMap(channels), 'the blues it is screened over');
  assert.deepEqual(f.uniform('uScale'), [SILK_CUT.scale]);
  assert.deepEqual(f.uniform('uRotation'), [SILK_CUT.rotation]);
  // The site's cut: folds that turn across the panel, and a broader gloss than React Bits' 48.
  assert.deepEqual(f.uniform('uMeander'), [SILK_CUT.meander]);
  assert.deepEqual(f.uniform('uGloss'), [SILK_CUT.gloss]);
  assert.ok(SILK_CUT.meander > 0 && SILK_CUT.meander <= 0.45, 'the folds turn by at most about 25 degrees');
  assert.ok(SILK_CUT.gloss < 48);
  field.destroy();
});

test('the cloth is TMU Blue: its colour and its shade are blues, and the shade stays clear of the ink', () => {
  const luminance = (hex) => {
    const [r, g, b] = channels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const [name, silk] of [
    ['light', SILK],
    ['dark', SILK_DARK],
  ]) {
    for (const hex of [silk.color, ...silk.shade]) {
      const [r, g, b] = channels(hex);
      assert.ok(b > g && g > r, `${name} ${hex} is a blue`);
    }
    assert.equal(silk.shade.length, 3, `${name}: three stops`);
    assert.ok(luminance(silk.color) > luminance(silk.shade[0]), `${name}: the cloth is lighter than its shade`);
  }
  // On the dark page a window's darkest point must still read as blue beside the ink, not as a second black.
  for (const hex of SILK_DARK.shade) {
    const [r, , b] = channels(hex);
    const [inkR, , inkB] = channels(DARK.page);
    assert.ok(b - r > inkB - inkR + 0.1, `${hex} is plainly bluer than the ink`);
  }
  assert.equal(DARK.page, TOKENS.ink);
});

test('one shared ticker subscription; it stops off screen, hidden, paused and after unmount', () => {
  const f = fixture();
  const field = mountSilkField(f.canvas, { subscribe: f.subscribe, visible: true });
  assert.equal(f.frames.size, 1);
  field.update({ visible: true, still: false });
  assert.equal(f.frames.size, 1);
  f.tick(100);
  f.tick(150);
  const moving = f.uniform('uTime')[0];
  f.tick(200);
  assert.ok(f.uniform('uTime')[0] > moving, 'the cloth flows');
  field.update({ visible: false });
  assert.equal(f.frames.size, 0);
  field.update({ visible: true });
  assert.equal(f.frames.size, 1);
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.frames.size, 0);
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  assert.equal(f.frames.size, 1);
  field.update({ still: true });
  assert.equal(f.frames.size, 0);
  field.update({ still: false });
  assert.equal(f.frames.size, 1);
  field.destroy();
  field.destroy();
  assert.equal(f.frames.size, 0);
  assert.equal(f.host.listeners.size, 0);
  assert.equal(f.doc.listeners.size, 0);
  assert.equal(f.canvas.listeners.size, 0);
  assert.ok(f.observers.every((observer) => observer.element === null));
  assert.deepEqual(f.gl.live, { programs: 0, shaders: 0, buffers: 0, arrays: 0 }, 'everything on the GPU is freed');
  assert.equal(f.gl.lose.lost, 1, 'and the context is given back');
  const after = f.draws();
  field.update({ visible: true, still: false });
  f.tick(500);
  f.observers[0].callback();
  assert.equal(f.draws(), after, 'nothing is drawn after unmount');
});

test('the cloth unfolds once, then flows at the same pace on any refresh rate', () => {
  const run = (hz) => {
    const f = fixture();
    const field = mountSilkField(f.canvas, { subscribe: f.subscribe, visible: true });
    assert.deepEqual(f.uniform('uPresence'), [0], 'it starts folded away');
    for (let frame = 0; frame <= hz * 3; frame += 1) f.tick((frame * 1000) / hz);
    const state = { presence: f.uniform('uPresence')[0], fold: f.uniform('uFold')[0], time: f.uniform('uTime')[0] };
    field.destroy();
    return state;
  };
  const slow = run(60);
  const fast = run(120);
  assert.equal(slow.presence, 1);
  assert.equal(slow.fold, 1);
  assert.ok(Math.abs(slow.time - fast.time) < 0.02, `${slow.time} at 60 Hz, ${fast.time} at 120 Hz`);
  // 0.1 x speed per second, as React Bits' default.
  assert.ok(Math.abs(slow.time - 3 * 0.1 * SILK_CUT.speed) < 0.05, `three seconds of flow: ${slow.time}`);
});

test('motion off: one held frame of the open cloth, and pausing settles it without a jump', () => {
  const f = fixture();
  const field = mountSilkField(f.canvas, { subscribe: f.subscribe, visible: true, still: true });
  assert.equal(f.frames.size, 0);
  assert.equal(f.draws(), 1, 'one frame, drawn at once');
  assert.deepEqual(f.uniform('uPresence'), [1]);
  assert.deepEqual(f.uniform('uFold'), [1]);
  const held = f.uniform('uTime')[0];
  assert.ok(held > 0, 'the held frame is not the folded start');
  f.tick(100);
  f.host.emit('pointerdown', { pointerType: 'mouse', clientX: 300, clientY: 300, target: { closest: () => null } });
  assert.equal(f.draws(), 1, 'nothing moves while motion is off');
  field.destroy();

  // Pause motion during the unfolding: the cloth opens fully where it is and holds.
  const g = fixture();
  const moving = mountSilkField(g.canvas, { subscribe: g.subscribe, visible: true });
  g.tick(100);
  g.tick(400);
  g.host.emit('pointerdown', { pointerType: 'mouse', clientX: 300, clientY: 300, target: { closest: () => null } });
  g.tick(420);
  const before = g.uniform('uTime')[0];
  assert.ok(g.uniform('uPresence')[0] < 1);
  assert.ok(
    g.uniform('uWaves')[0].some((value) => value !== 0),
    'a ripple is running',
  );
  moving.update({ still: true });
  assert.equal(g.frames.size, 0);
  assert.deepEqual(g.uniform('uPresence'), [1]);
  assert.ok(
    g.uniform('uWaves')[0].every((value) => value === 0),
    'the ripple is gone',
  );
  // The cloth keeps its place: only the unfolding's rush (at most 1.6) is taken up, and never backwards.
  const moved = g.uniform('uTime')[0] - before;
  assert.ok(moved >= 0 && moved <= 1.6 + 1e-9, `the cloth keeps its place: ${moved}`);
  moving.destroy();
});

test('a mouse pulls the cloth, any pointer ripples it, and nothing blocks scrolling', () => {
  const f = fixture();
  const field = mountSilkField(f.canvas, { subscribe: f.subscribe, visible: true });
  f.tick(0);
  const rippling = () => f.uniform('uWaves')[0].some((value) => value !== 0);
  const event = {
    pointerType: 'touch',
    clientX: 300,
    clientY: 150,
    target: { closest: () => null },
    preventDefault() {
      assert.fail('must preserve native scrolling');
    },
  };
  // A finger moving over the cloth is scrolling the page: it does not pull.
  f.host.emit('pointermove', event);
  for (let frame = 1; frame <= 30; frame += 1) f.tick(frame * 16);
  assert.ok(f.uniform('uPointer')[2] < 0.01, 'touch does not pull the cloth');
  assert.ok(!rippling());
  // But a tap ripples it, at the point touched (WebGL's y runs upwards).
  f.host.emit('pointerdown', event);
  f.tick(500);
  assert.ok(rippling(), 'a tap ripples the cloth');
  const [x, y] = f.uniform('uWaves')[0];
  assert.ok(Math.abs(x - 300 / 1200) < 1e-6 && Math.abs(y - (1 - 150 / 600)) < 1e-6, `${x}, ${y}`);
  // A control over the artwork keeps its own click.
  const g = fixture();
  const other = mountSilkField(g.canvas, { subscribe: g.subscribe, visible: true });
  g.tick(0);
  g.host.emit('pointerdown', { ...event, pointerType: 'mouse', target: { closest: () => ({}) } });
  g.tick(16);
  assert.ok(g.uniform('uWaves')[0].every((value) => value === 0));
  // A mouse pulls the cloth towards itself and lets go when it leaves.
  g.host.emit('pointermove', { ...event, pointerType: 'mouse' });
  for (let frame = 2; frame <= 60; frame += 1) g.tick(frame * 16);
  assert.ok(g.uniform('uPointer')[2] > 0.5, 'the mouse pulls the cloth');
  g.host.emit('pointerleave', {});
  for (let frame = 61; frame <= 400; frame += 1) g.tick(frame * 16);
  assert.ok(g.uniform('uPointer')[2] < 0.05, 'and lets go');
  for (const host of [f.host, g.host]) for (const { options } of host.listeners.values()) assert.equal(options.passive, true);
  // At most four ripples at once (the shader's array).
  for (let i = 0; i < 9; i += 1) f.host.emit('pointerdown', { ...event, clientX: 100 + i * 10 });
  f.tick(520);
  assert.equal(f.uniform('uWaves')[0].length, 16);
  field.destroy();
  other.destroy();
});

test('the scheme changes the blues; a cloth that is not drawing frames repaints its held frame', () => {
  const f = fixture();
  const field = mountSilkField(f.canvas, { subscribe: f.subscribe, visible: true, still: true, colors: SILK });
  close(f.uniform('uShade')[0], SILK.shade.flatMap(channels), 'light');
  const before = f.draws();
  field.update({ colors: SILK_DARK });
  assert.equal(f.draws(), before + 1);
  close(f.uniform('uShade')[0], SILK_DARK.shade.flatMap(channels), 'dark');
  close(f.uniform('uColor')[0], channels(SILK_DARK.color), 'dark cloth');
  field.destroy();
});

test('no WebGL 2, or a shader that will not build: null, with nothing left behind', () => {
  // No context at all.
  const none = fixture();
  none.canvas.getContext = () => null;
  assert.equal(mountSilkField(none.canvas, { subscribe: none.subscribe, visible: true }), null);
  // A browser that throws instead.
  const throws = fixture();
  throws.canvas.getContext = () => {
    throw new Error('SecurityError');
  };
  assert.equal(mountSilkField(throws.canvas, { subscribe: throws.subscribe, visible: true }), null);
  for (const fail of ['compile', 'link']) {
    const f = fixture({ gl: fakeGL({ fail }) });
    assert.equal(mountSilkField(f.canvas, { subscribe: f.subscribe, visible: true }), null, fail);
    assert.deepEqual(f.gl.live, { programs: 0, shaders: 0, buffers: 0, arrays: 0 }, `${fail}: nothing is left on the GPU`);
    assert.equal(f.gl.lose.lost, 1, `${fail}: the context is given back`);
    assert.equal(f.frames.size, 0);
    assert.equal(f.host.listeners.size, 0);
    assert.equal(f.doc.listeners.size, 0);
    assert.equal(f.canvas.listeners.size, 0);
    assert.equal(f.observers.length, 0);
  }
});

test('a lost GPU context stops the cloth; a restored one rebuilds it, and one that cannot be rebuilt fails over', () => {
  const f = fixture();
  let failed = 0;
  const field = mountSilkField(f.canvas, {
    subscribe: f.subscribe,
    visible: true,
    onFail: () => {
      failed += 1;
    },
  });
  f.tick(0);
  f.tick(16);
  let prevented = 0;
  f.canvas.emit('webglcontextlost', {
    preventDefault() {
      prevented += 1;
    },
  });
  assert.equal(prevented, 1, 'asks the browser to restore the context');
  assert.equal(f.frames.size, 0);
  const lostAt = f.draws();
  f.observers[0].callback();
  field.update({ colors: SILK_DARK });
  assert.equal(f.draws(), lostAt, 'nothing is drawn on a lost context');
  f.canvas.emit('webglcontextrestored', {});
  assert.equal(f.frames.size, 1);
  assert.ok(f.draws() > lostAt, 'the cloth is drawn again');
  assert.equal(failed, 0);
  close(f.uniform('uColor')[0], channels(SILK_DARK.color), 'in the colours it was given meanwhile');
  field.destroy();

  // The context comes back but the shader no longer builds: the Kairo field is asked for.
  const gl = fakeGL();
  const g = fixture({ gl });
  let asked = 0;
  const broken = mountSilkField(g.canvas, {
    subscribe: g.subscribe,
    visible: true,
    onFail: () => {
      asked += 1;
    },
  });
  g.canvas.emit('webglcontextlost', { preventDefault() {} });
  gl.getProgramParameter = () => false;
  g.canvas.emit('webglcontextrestored', {});
  assert.equal(asked, 1);
  assert.equal(g.frames.size, 0);
  broken.destroy();
});

test('the Desk shows the silk where WebGL 2 works and the Kairo field where it does not', () => {
  const artwork = read('../src/components/artwork/HeroArtwork.jsx');
  assert.match(artwork, /const webgl = useWebGL\(\);/);
  assert.match(artwork, /if \(webgl && !failed\) return <SilkField onFail=\{onFail\} \/>;/);
  assert.match(artwork, /if \(webgl === false \|\| failed\) return <SignalField \/>;/);
  // Neither canvas is in the static HTML or the hydration pass, so every browser gets the same markup.
  assert.match(artwork, /return <div className=\{styles\.field\} aria-hidden="true" \/>;/);
  const silk = read('../src/components/artwork/SilkField.jsx');
  assert.match(silk, /subscribe: \(callback\) => Tempus\.add\(callback, 1\),/, "Giats's shared clock");
  assert.match(silk, /still: startsStill\.current,/);
  assert.match(silk, /colors: prefersDark\(\) \? SILK_DARK : SILK,/);
  assert.match(silk, /if \(!controller\.current\) fail\.current\?\.\(\);/);
  assert.match(silk, /controller\.current\?\.update\(\{ visible, still \}\);/);
  assert.match(silk, /<canvas ref=\{canvasRef\} data-silk-field className=\{styles\.canvas\} \/>/);
  // Not a three.js <Canvas>: it needs no WebGLGate, and tests/webgl.test.mjs keeps counting only those.
  assert.doesNotMatch(`${artwork}${silk}`, /<Canvas[\s>]|@react-three/);
  const home = read('../src/pages/components/home/Index.jsx');
  assert.equal((home.match(/<HeroArtwork\b/g) || []).length, 1);
  assert.doesNotMatch(home, /<SignalField\b|<SilkField\b/);
});

test('the silk carries its notice, and the shader keeps its source', () => {
  const source = read('../src/components/artwork/silkField.mjs');
  assert.match(source, /Adapted from React Bits' Silk, src\/content\/Backgrounds\/Silk\/Silk\.jsx at\s+\* 37f53df7efb61238b0fea9ea8be74e3cce62b959\./);
  assert.match(source, /MIT \+ Commons Clause;\s+\* see public\/licenses\/React-Bits-Silk\.txt\./);
  const notice = read('../public/licenses/React-Bits-Silk.txt');
  assert.match(notice, /^MIT \+ Commons Clause License Condition v1\.0\s+Copyright \(c\) 2026 David Haz/);
  assert.match(read('../public/licenses/README.md'), /## React Bits silk/);
  // React Bits' cloth: the fold function is unchanged but for the wide-panel line the site adds.
  assert.match(source, /return 0\.6 \+ 0\.4 \* uFold \* sin\(5\.0 \* \(tex\.x \+ tex\.y \+ cos\(3\.0 \* tex\.x \+ 5\.0 \* tex\.y\) \+ 0\.02 \* tOffset\) \+ uRipple \* sin\(20\.0 \* \(tex\.x \+ tex\.y - 0\.1 \* tOffset\)\)\);/);
  assert.match(source, /vUv\.x \*= max\(1\.0, uView\.x \/ uView\.y\);/);
  assert.match(source, /float turn = uMeander \* sin\(2\.3 \* vUv\.x - 1\.7 \* vUv\.y \+ 0\.8\);\s*vec2 uv = rotateUvs\(vUv \* uScale, uRotation \+ turn\);/);
  // The cloth is screened over the shade, so a fold's shadow is that blue.
  assert.match(source, /vec3 result = under \+ cloth - under \* cloth;/);
});

test('the panel is the shade, with a rim of the page, and the silk needs no window edge', () => {
  const silk = read('../src/components/artwork/SilkField.jsx');
  assert.match(silk, /const \[top, middle, foot\] = \(dark \? SILK_DARK : SILK\)\.shade;/);
  assert.match(silk, /style=\{\{ backgroundImage: `linear-gradient\(155deg, \$\{top\} 0%, \$\{middle\} 45%, \$\{foot\} 100%\)` \}\}/, 'the same stops as the shader');
  const source = read('../src/components/artwork/silkField.mjs');
  assert.match(source, /vec2 down = vec2\(0\.42262, 0\.90631\);/, '155deg, as CSS measures it');
  assert.match(source, /t < 0\.45 \? mix\(uShade\[0\], uShade\[1\], t \/ 0\.45\) : mix\(uShade\[1\], uShade\[2\], \(t - 0\.45\) \/ 0\.55\)/);
  const styles = read('../src/components/artwork/silkField.module.scss');
  assert.match(styles, /border: 1px solid var\(--white\);\s*background-color: var\(--black\);\s*background-clip: padding-box;/);
  assert.doesNotMatch(styles, /prefers-color-scheme|windowEdge/, 'no edge of its own, in either scheme');
  const home = read('../src/pages/components/home/styles/home.module.scss');
  // Dark mode: the paper's edge filter is for the Kairo field's clear windows only.
  assert.match(home, /&:has\(canvas\[data-silk-field\]\) \.edged > g \{\s*filter: none;\s*\}/);
  // Touching windows overlap by half a pixel in both schemes, so no seam of paper shows between them.
  assert.match(home, /mask rect\[data-cell\] \{\s*stroke: #000;\s*stroke-width: 1px;\s*vector-effect: non-scaling-stroke;\s*\}/);
  // The paper covers the field's last column of pixels on a phone.
  assert.match(home, /width: 100\.1%;\s*width: max\(100\.1%, calc\(100% \+ 1px\)\);/);
});
