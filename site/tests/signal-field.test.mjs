import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = new URL('../src/components/artwork/signalField.mjs', import.meta.url);
async function implementation() {
  assert.ok(existsSync(source), 'the isolated Kairo field controller exists');
  return import(source);
}

function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn, options) { listeners.set(type, { fn, options }); },
    removeEventListener(type, fn) { if (listeners.get(type)?.fn === fn) listeners.delete(type); },
    emit(type, event = {}) { listeners.get(type)?.fn(event); },
  };
}

function fixture() {
  const doc = { ...target(), hidden: false };
  const observers = [];
  const win = {
    devicePixelRatio: 3,
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(element) { this.element = element; }
      disconnect() { this.element = null; }
    },
  };
  doc.defaultView = win;
  const drawing = [];
  const ctx = {
    setTransform(...args) { drawing.push(['transform', ...args]); },
    clearRect() { drawing.length = 0; },
    fillRect(...args) { drawing.push(['point', this.fillStyle, this.globalAlpha, ...args]); },
    beginPath() {}, arc(...args) { drawing.push(['arc', ...args]); }, stroke() {}, fill() {},
  };
  const canvas = {
    ownerDocument: doc, clientWidth: 1200, clientHeight: 600,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 600 }),
  };
  const host = target();
  canvas.parentElement = host;
  const frames = new Set();
  const subscribe = (callback) => { frames.add(callback); return () => frames.delete(callback); };
  const tick = (time) => [...frames].forEach((callback) => callback(time));
  return { canvas, host, doc, observers, drawing, frames, subscribe, tick };
}

test('Kairo draws a deliberate bone/orange static field and caps high-DPR canvas allocation', async () => {
  const { mountSignalField } = await implementation();
  const f = fixture();
  const field = mountSignalField(f.canvas, { subscribe: f.subscribe, still: true, visible: true });
  assert.equal(f.frames.size, 0);
  assert.ok(f.canvas.width <= 2048 && f.canvas.height <= 1536);
  assert.ok(f.canvas.width * f.canvas.height <= 2_000_000);
  assert.ok(f.drawing.some((draw) => draw[0] === 'point' && draw[1] === 'rgb(235, 233, 226)'));
  assert.ok(f.drawing.some((draw) => draw[0] === 'point' && draw[1] === 'rgb(255, 91, 31)'));
  assert.ok(f.drawing.some((draw) => draw[0] === 'arc' && draw[3] > 100));
  field.destroy();
});

test('field uses one shared ticker subscription and stops offscreen, hidden, paused and after unmount', async () => {
  const { mountSignalField } = await implementation();
  const f = fixture();
  const field = mountSignalField(f.canvas, { subscribe: f.subscribe, visible: true });
  assert.equal(f.frames.size, 1);
  field.update({ visible: true, still: false });
  assert.equal(f.frames.size, 1);
  f.tick(100); f.tick(150);
  const moving = JSON.stringify(f.drawing);
  f.tick(200);
  assert.notEqual(JSON.stringify(f.drawing), moving);
  field.update({ visible: false });
  assert.equal(f.frames.size, 0);
  field.update({ visible: true });
  f.doc.hidden = true; f.doc.emit('visibilitychange');
  assert.equal(f.frames.size, 0);
  f.doc.hidden = false; f.doc.emit('visibilitychange');
  assert.equal(f.frames.size, 1);
  field.update({ still: true });
  assert.equal(f.frames.size, 0);
  field.update({ still: false });
  assert.equal(f.frames.size, 1);
  field.destroy(); field.destroy();
  assert.equal(f.frames.size, 0);
  assert.equal(f.host.listeners.size, 0);
  assert.equal(f.doc.listeners.size, 0);
  assert.ok(f.observers.every((observer) => observer.element === null));
  const after = JSON.stringify(f.drawing);
  field.update({ visible: true, still: false }); f.tick(500);
  f.observers[0].callback();
  assert.equal(JSON.stringify(f.drawing), after);
});

test('pointer response is passive; touch and interactive targets do not launch pulses', async () => {
  const { mountSignalField } = await implementation();
  const f = fixture();
  const field = mountSignalField(f.canvas, { subscribe: f.subscribe, visible: true });
  f.tick(100);
  const arcCount = () => f.drawing.filter((draw) => draw[0] === 'arc').length;
  const before = arcCount();
  const event = { pointerType: 'touch', clientX: 100, clientY: 100, target: { closest: () => null }, preventDefault() { assert.fail('must preserve native scrolling'); } };
  f.host.emit('pointerdown', event); f.host.emit('pointermove', event); f.tick(150);
  assert.equal(arcCount(), before);
  f.host.emit('pointerdown', { ...event, pointerType: 'mouse', target: { closest: () => ({}) } }); f.tick(200);
  assert.equal(arcCount(), before);
  f.host.emit('pointerdown', { ...event, pointerType: 'mouse' }); f.tick(250);
  assert.ok(arcCount() > before);
  for (const { options } of f.host.listeners.values()) assert.equal(options.passive, true);
  field.destroy();
});

test('missing canvas support leaves the static fallback and no subscriptions', async () => {
  const { mountSignalField } = await implementation();
  const f = fixture();
  f.canvas.getContext = () => null;
  const field = mountSignalField(f.canvas, { subscribe: f.subscribe, visible: true });
  field.update({ still: true }); field.destroy();
  assert.equal(f.frames.size, 0);
  assert.equal(f.host.listeners.size, 0);
  assert.equal(f.doc.listeners.size, 0);
  assert.equal(f.observers.length, 0);
});

test('the existing moving mask contains one continuous signal canvas and no sphere/physics mount', () => {
  const home = readFileSync(new URL('../src/pages/components/home/Index.jsx', import.meta.url), 'utf8');
  assert.equal((home.match(/<SignalField\b/g) || []).length, 1);
  assert.match(home, /<mask id="mask"/);
  assert.match(home, /\{renderRects\}/);
  assert.doesNotMatch(home, /FloatingMeshes|FloatRigidBody|<Physics/);
});
