import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {instrument} from './instrument.mjs';

const require = createRequire(import.meta.url);
let browser;
let fixture;
let fixtureUrl;

before(async () => {
  let playwright;
  try { playwright = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright'); }
  catch (error) {
    try { playwright = require('playwright'); }
    catch { throw new Error('Browser instrumentation tests need Playwright; set PLAYWRIGHT_PATH to its installed package.', {cause: error}); }
  }
  browser = await playwright.chromium.launch({
    headless: true,
    ...((process.env.QA_CHROMIUM_PATH || process.env.QA_CHROMIUM_EXECUTABLE)
      ? {executablePath: process.env.QA_CHROMIUM_PATH || process.env.QA_CHROMIUM_EXECUTABLE} : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'],
  });
  const gsapModule = await readFile(new URL('../../assets/vendor/gsap-3.15.0.mjs', import.meta.url), 'utf8');
  fixture = createServer((request, response) => {
    response.writeHead(200, {'Content-Type': request.url === '/gsap.mjs' ? 'text/javascript' : 'text/html'});
    response.end(request.url === '/gsap.mjs' ? gsapModule : '<body><div id="target"></div></body>');
  });
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
});

after(async () => {
  await browser?.close();
  if (fixture) await new Promise(resolve => fixture.close(resolve));
});

async function pageFor(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.addInitScript(instrument);
  const page = await context.newPage();
  await page.goto(fixtureUrl);
  assert.equal(await page.evaluate(() => typeof window.__qaMetrics?.snapshot), 'function', 'init script exposes snapshot()');
  return page;
}

test('listener counts honor duplicate tuples, capture, native callback this, and removal', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const node = document.querySelector('#target');
    const baseline = __qaMetrics.snapshot().listeners.live;
    let calls = 0;
    let correctThis = true;
    function listener() { calls++; correctThis &&= this === node; }
    node.addEventListener('probe', listener);
    node.addEventListener('probe', listener, {passive: true, once: true});
    node.addEventListener('probe', listener, true);
    const added = __qaMetrics.snapshot().listeners.live - baseline;
    node.dispatchEvent(new Event('probe'));
    node.removeEventListener('probe', listener, {capture: true});
    const afterCaptureRemoval = __qaMetrics.snapshot().listeners.live - baseline;
    node.removeEventListener('probe', listener);
    return {added, calls, correctThis, afterCaptureRemoval, removed: __qaMetrics.snapshot().listeners.live - baseline};
  });
  assert.deepEqual(result, {added: 2, calls: 2, correctThis: true, afterCaptureRemoval: 1, removed: 0});
});

test('once and object listeners disappear before their callback and remain removable by original identity', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const node = document.querySelector('#target');
    const baseline = __qaMetrics.snapshot().listeners.live;
    const observed = [];
    const listener = {handleEvent() { observed.push(__qaMetrics.snapshot().listeners.live - baseline); }};
    node.addEventListener('probe', listener, {once: true});
    node.dispatchEvent(new Event('probe'));
    node.dispatchEvent(new Event('probe'));
    node.addEventListener('probe', listener);
    node.removeEventListener('probe', listener);
    return {observed, remaining: __qaMetrics.snapshot().listeners.live - baseline};
  });
  assert.deepEqual(result, {observed: [0], remaining: 0});
});

test('instrumentation does not evaluate an object listener handleEvent getter at registration', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const node = document.querySelector('#target');
    let getterCalls = 0;
    let deliveries = 0;
    const listener = {get handleEvent() { getterCalls++; return () => deliveries++; }};
    node.addEventListener('probe', listener);
    const beforeDispatch = getterCalls;
    node.dispatchEvent(new Event('probe'));
    node.removeEventListener('probe', listener);
    return {beforeDispatch, getterCalls, deliveries};
  });
  assert.deepEqual(result, {beforeDispatch: 0, getterCalls: 1, deliveries: 1});
});

test('function-valued listener options retain native dictionary semantics', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const node = document.querySelector('#target');
    const baseline = __qaMetrics.snapshot().listeners.live;
    const options = Object.assign(function options() {}, {capture: false, once: true});
    node.addEventListener('dictionary-probe', () => {}, options);
    const detail = __qaMetrics.snapshot().listeners.details.find(entry => entry.type === 'dictionary-probe');
    node.dispatchEvent(new Event('dictionary-probe'));
    return {capture: detail.capture, once: detail.once, remaining: __qaMetrics.snapshot().listeners.live - baseline};
  });
  assert.deepEqual(result, {capture: false, once: true, remaining: 0});
});

test('AbortSignal cleanup is synchronous, excludes QA listeners, and preserves duplicate registration ownership', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const node = document.querySelector('#target');
    const baseline = __qaMetrics.snapshot().listeners.live;
    const first = new AbortController();
    const duplicate = new AbortController();
    let calls = 0;
    const listener = () => calls++;
    node.addEventListener('probe', listener, {signal: first.signal});
    node.addEventListener('probe', listener, {signal: duplicate.signal});
    const added = __qaMetrics.snapshot().listeners.live - baseline;
    duplicate.abort();
    node.dispatchEvent(new Event('probe'));
    const afterDuplicateAbort = __qaMetrics.snapshot().listeners.live - baseline;
    first.abort();
    node.dispatchEvent(new Event('probe'));
    const afterAbort = __qaMetrics.snapshot().listeners.live - baseline;
    node.addEventListener('probe', listener, {signal: first.signal});
    return {added, afterDuplicateAbort, afterAbort, calls, afterAbortedAdd: __qaMetrics.snapshot().listeners.live - baseline};
  });
  assert.deepEqual(result, {added: 1, afterDuplicateAbort: 1, afterAbort: 0, calls: 1, afterAbortedAdd: 0});
});

test('re-registration after an abort survives an abort handler that stops event propagation', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const node = document.querySelector('#target');
    const baseline = __qaMetrics.snapshot().listeners.live;
    const controller = new AbortController();
    controller.signal.addEventListener('abort', event => event.stopImmediatePropagation(), {once: true});
    let calls = 0;
    const callback = () => calls++;
    node.addEventListener('probe', callback, {signal: controller.signal});
    controller.abort();
    node.addEventListener('probe', callback, {once: true});
    const readded = __qaMetrics.snapshot().listeners.live - baseline;
    node.dispatchEvent(new Event('probe'));
    const onceFinished = __qaMetrics.snapshot().listeners.live - baseline;
    node.addEventListener('probe', callback);
    node.addEventListener('probe', callback);
    const duplicateReadded = __qaMetrics.snapshot().listeners.live - baseline;
    node.removeEventListener('probe', callback);
    return {readded, onceFinished, duplicateReadded, calls, removed: __qaMetrics.snapshot().listeners.live - baseline};
  });
  assert.deepEqual(result, {readded: 1, onceFinished: 0, duplicateReadded: 1, calls: 1, removed: 0});
});

test('detached DOM registrations are reported separately from live connected listeners', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const baseline = __qaMetrics.snapshot().listeners;
    const node = document.querySelector('#target');
    node.addEventListener('probe', function detachedProbe() {});
    node.remove();
    const snapshot = __qaMetrics.snapshot().listeners;
    return {live: snapshot.live - baseline.live, disconnected: snapshot.disconnected - baseline.disconnected,
      retained: snapshot.retained - baseline.retained, detail: snapshot.details.find(entry => entry.type === 'probe')};
  });
  assert.equal(result.live, 0);
  assert.equal(result.disconnected, 1);
  assert.equal(result.retained, 1);
  assert.match(result.detail.source, /detachedProbe/);
  assert.match(result.detail.target, /div#target/);
});

test('the registry allows collection of detached DOM even when its listener closes over the node', async t => {
  const page = await pageFor(t);
  await page.evaluate(() => {
    const node = document.createElement('div');
    node.addEventListener('collect-probe', () => node.id);
  });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.gc());
    await page.waitForTimeout(20);
  }
  const details = await page.evaluate(() => __qaMetrics.snapshot().listeners.details);
  assert.equal(details.some(entry => entry.type === 'collect-probe'), false, 'QA bookkeeping must not retain detached DOM');
});

test('Intersection and Resize observers count unique observed targets and clear on unobserve/disconnect', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const target = document.querySelector('#target');
    const io = new IntersectionObserver(() => {});
    const ro = new ResizeObserver(() => {});
    io.observe(target); io.observe(target);
    ro.observe(target); ro.observe(target);
    const active = __qaMetrics.snapshot().observers;
    io.unobserve(target); ro.disconnect();
    const inactive = __qaMetrics.snapshot().observers;
    io.observe(target); ro.observe(target);
    io.disconnect(); ro.unobserve(target);
    return {active, inactive, afterReuse: __qaMetrics.snapshot().observers.total, instanceofIO: io instanceof IntersectionObserver};
  });
  assert.equal(result.active.total, 2);
  assert.equal(result.active.intersection.targets, 1);
  assert.equal(result.active.resize.targets, 1);
  assert.equal(result.inactive.total, 0);
  assert.equal(result.afterReuse, 0);
  assert.equal(result.instanceofIO, true);
});

test('Mutation observers preserve native delivery while disconnect clears active metrics', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const target = document.querySelector('#target');
    let deliveries = 0;
    const observer = new MutationObserver(records => { deliveries += records.length; });
    observer.observe(target, {childList: true});
    observer.observe(target, {childList: true, subtree: true});
    target.append(document.createElement('span'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const active = __qaMetrics.snapshot().observers.mutation;
    observer.disconnect();
    target.append(document.createElement('span'));
    await new Promise(resolve => setTimeout(resolve, 0));
    return {deliveries, active, inactive: __qaMetrics.snapshot().observers.mutation};
  });
  assert.equal(result.deliveries, 1);
  assert.equal(result.active.active, 1);
  assert.equal(result.active.targets, 1);
  assert.equal(result.inactive.active, 0);
});

test('rAF metrics count pending callbacks, drop cancellation, and identify active recurring loops', {timeout: 15_000}, async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const baseline = __qaMetrics.snapshot().raf;
    const cancelled = requestAnimationFrame(() => { throw new Error('cancelled callback ran'); });
    const pending = __qaMetrics.snapshot().raf.pending - baseline.pending;
    cancelAnimationFrame(cancelled);
    const afterCancel = __qaMetrics.snapshot().raf.pending - baseline.pending;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const afterOneShot = __qaMetrics.snapshot().raf;
    let frames = 0;
    let next;
    let notify;
    const twoFrames = new Promise(resolve => { notify = resolve; });
    function loop() {
      frames++;
      next = requestAnimationFrame(loop);
      if (frames === 2) notify();
    }
    next = requestAnimationFrame(loop);
    await twoFrames;
    const looping = __qaMetrics.snapshot().raf;
    cancelAnimationFrame(next);
    return {pending, afterCancel, afterOneShot, looping, stopped: __qaMetrics.snapshot().raf, frames};
  });
  assert.equal(result.pending, 1);
  assert.equal(result.afterCancel, 0);
  assert.deepEqual(result.afterOneShot, {pending: 0, recurring: 0});
  assert.ok(result.frames >= 2);
  assert.deepEqual(result.looping, {pending: 1, recurring: 1});
  assert.deepEqual(result.stopped, {pending: 0, recurring: 0});
});

test('canvas metrics count connected canvases, deduplicate contexts, and record actual draw calls', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    const context = canvas.getContext('2d');
    canvas.getContext('2d');
    const before = __qaMetrics.snapshot().canvases;
    context.fillRect(0, 0, 1, 1);
    context.clearRect(0, 0, 1, 1);
    const drawn = __qaMetrics.snapshot().canvases;
    canvas.remove();
    return {before, drawn, detached: __qaMetrics.snapshot().canvases};
  });
  assert.equal(result.before.connected, 1);
  assert.equal(result.before.contexts, 1);
  assert.equal(result.drawn.drawCalls - result.before.drawCalls, 2);
  assert.equal(result.detached.connected, 0);
});

test('WebGL context metrics reflect WEBGL_lose_context and restoration without QA event listener inflation', {timeout: 15_000}, async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    const listenersBefore = __qaMetrics.snapshot().listeners.live;
    const gl = canvas.getContext('webgl2');
    if (!gl) return {unavailable: true};
    canvas.getContext('webgl2');
    const extension = gl.getExtension('WEBGL_lose_context');
    const initial = __qaMetrics.snapshot();
    gl.clear(gl.COLOR_BUFFER_BIT);
    const lostEvent = new Promise(resolve => canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); resolve();
    }, {once: true}));
    extension.loseContext();
    const immediate = __qaMetrics.snapshot().webgl;
    await lostEvent;
    const lost = __qaMetrics.snapshot().webgl;
    // Restoration is valid after the loss event finishes dispatching and the
    // browser has applied preventDefault(), not in that event's microtask.
    await new Promise(resolve => setTimeout(resolve, 30));
    const restoredEvent = new Promise(resolve => canvas.addEventListener('webglcontextrestored', resolve, {once: true}));
    extension.restoreContext();
    await restoredEvent;
    return {initial, immediate, lost, restored: __qaMetrics.snapshot().webgl,
      listenersBefore, listenersAfter: __qaMetrics.snapshot().listeners.live};
  });
  assert.equal(result.unavailable, undefined, 'software WebGL2 must be available for the lifecycle test');
  assert.equal(result.initial.webgl.active, 1);
  assert.equal(result.initial.webgl.total, 1);
  assert.equal(result.initial.listeners.live, result.listenersBefore);
  assert.equal(result.immediate.active, 0);
  assert.equal(result.lost.lost, 1);
  assert.equal(result.restored.active, 1);
  assert.equal(result.listenersAfter, result.listenersBefore);
});

test('the GSAP hook reads real ticker state without changing add/remove or retaining once callbacks', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const {gsap} = await import('/gsap.mjs');
    const add = gsap.ticker.add;
    const remove = gsap.ticker.remove;
    __qaMetrics.installGsap(gsap);
    const methodsUnchanged = add === gsap.ticker.add && remove === gsap.ticker.remove;
    const baseline = __qaMetrics.snapshot().gsap;
    const callback = () => {};
    gsap.ticker.add(callback);
    const added = __qaMetrics.snapshot().gsap.tickerCallbacks;
    gsap.ticker.remove(callback);
    const removed = __qaMetrics.snapshot().gsap.tickerCallbacks;
    await new Promise(resolve => gsap.ticker.add(resolve, true));
    const onceFinished = __qaMetrics.snapshot().gsap.tickerCallbacks;
    return {methodsUnchanged, baseline, added, removed, onceFinished};
  });
  assert.equal(result.methodsUnchanged, true, 'installing metrics must not change the vendor ticker');
  assert.equal(result.baseline.available, true);
  assert.equal(result.added, result.baseline.tickerCallbacks + 1);
  assert.equal(result.removed, result.baseline.tickerCallbacks);
  assert.equal(result.onceFinished, result.baseline.tickerCallbacks);
});
