import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWebGLSupport, isContextError, webgl } from '../src/utils/webgl.mjs';

/* A document whose canvases hand out `context` for webgl2 and nothing for anything else. */
function fakeDocument(context, { throws = false } = {}) {
  const calls = { created: 0, kinds: [] };
  return {
    calls,
    createElement(tag) {
      assert.equal(tag, 'canvas');
      calls.created += 1;
      return {
        getContext(kind) {
          calls.kinds.push(kind);
          if (throws) throw new Error('SecurityError');
          return kind === 'webgl2' ? context : null;
        },
      };
    },
  };
}
const context = () => {
  const state = { lost: 0 };
  const loseContext = () => {
    state.lost += 1;
  };
  return { state, getExtension: (name) => (name === 'WEBGL_lose_context' ? { loseContext } : null) };
};

test('WebGL 2 available: reported true, probed once, and the probe context is given back', () => {
  const gl = context();
  const doc = fakeDocument(gl);
  const support = createWebGLSupport(() => doc);
  assert.equal(support.available(), true);
  assert.equal(support.available(), true);
  assert.equal(doc.calls.created, 1, 'the probe runs once');
  assert.deepEqual(doc.calls.kinds, ['webgl2'], 'three.js r163+ needs WebGL 2; WebGL 1 does not count');
  assert.equal(gl.state.lost, 1, 'the throwaway context is released');
});

test('WebGL disabled (getContext returns null): reported false, remembered', () => {
  const doc = fakeDocument(null);
  const support = createWebGLSupport(() => doc);
  assert.equal(support.available(), false);
  assert.equal(support.available(), false);
  assert.equal(doc.calls.created, 1);
});

test('a context without WEBGL_lose_context still counts as available', () => {
  const support = createWebGLSupport(() => fakeDocument({ getExtension: () => null }));
  assert.equal(support.available(), true);
});

test('a WebGL 1-only browser does not count: three.js r163+ would throw on it', () => {
  const doc = {
    createElement: () => ({ getContext: (kind) => (kind === 'webgl' || kind === 'experimental-webgl' ? context() : null) }),
  };
  assert.equal(createWebGLSupport(() => doc).available(), false);
});

test('a context that is already lost counts as no WebGL', () => {
  const lost = { ...context(), isContextLost: () => true };
  assert.equal(createWebGLSupport(() => fakeDocument(lost)).available(), false);
  const fine = { ...context(), isContextLost: () => false };
  assert.equal(createWebGLSupport(() => fakeDocument(fine)).available(), true);
});

test('failing to release the probe context does not make WebGL unavailable', () => {
  const gl = {
    getExtension() {
      throw new Error('blocked by a privacy shim');
    },
  };
  assert.equal(createWebGLSupport(() => fakeDocument(gl)).available(), true);
  const loseThrows = {
    getExtension: () => ({
      loseContext() {
        throw new Error('boom');
      },
    }),
  };
  assert.equal(createWebGLSupport(() => fakeDocument(loseThrows)).available(), true);
});

test('a browser that throws while creating a context reports false instead of throwing', () => {
  assert.equal(createWebGLSupport(() => fakeDocument(null, { throws: true })).available(), false);
  const broken = {
    createElement() {
      throw new Error('no canvas');
    },
  };
  assert.equal(createWebGLSupport(() => broken).available(), false);
});

test('without a document (the server render) it is false and not remembered', () => {
  let doc = null;
  const support = createWebGLSupport(() => doc);
  assert.equal(support.available(), false);
  doc = fakeDocument(context());
  assert.equal(support.available(), true, 'a later probe in a browser still runs');
});

test('markUnavailable turns the answer false for good and tells subscribers once', () => {
  const support = createWebGLSupport(() => fakeDocument(context()));
  let notified = 0;
  const unsubscribe = support.subscribe(() => {
    notified += 1;
  });
  assert.equal(support.available(), true);
  support.markUnavailable();
  support.markUnavailable();
  assert.equal(support.available(), false);
  assert.equal(notified, 1);
  unsubscribe();
  const other = createWebGLSupport(() => fakeDocument(context()));
  let late = 0;
  other.subscribe(() => {
    late += 1;
  })();
  other.markUnavailable();
  assert.equal(late, 0, 'an unsubscribed listener is not called');
});

test('markUnavailable before any probe also wins', () => {
  const doc = fakeDocument(context());
  const support = createWebGLSupport(() => doc);
  support.markUnavailable();
  assert.equal(support.available(), false);
  assert.equal(doc.calls.created, 0);
});

test('the shared instance has no document under Node and says false', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(webgl.available(), false);
});

test('isContextError recognises what three.js and the browser say', () => {
  assert.ok(isContextError(new Error('Error creating WebGL context.')));
  assert.ok(isContextError(new Error('THREE.WebGLRenderer: A WebGL context could not be created.')));
  assert.ok(isContextError('WebGL: CONTEXT_LOST_WEBGL'));
  assert.ok(!isContextError(new Error('Rapier failed to initialise')));
  assert.ok(!isContextError(null));
  assert.ok(!isContextError(undefined));
});

/* A document that records the capture listeners the support module installs, and timers the test fires by hand. */
function watchedDocument(gl) {
  const doc = fakeDocument(gl);
  const handlers = {};
  doc.addEventListener = (type, handler, capture) => {
    assert.equal(capture, true, `${type} does not bubble, so it is heard in the capture phase`);
    assert.ok(!handlers[type], `${type} is listened for once`);
    handlers[type] = handler;
  };
  doc.emit = (type, target) => handlers[type]({ target });
  doc.listening = () => Object.keys(handlers).sort();
  return doc;
}
function manualTimers() {
  const timers = { pending: null, cleared: 0 };
  timers.setTimer = (callback, ms) => {
    timers.pending = { callback, ms };
    return 1;
  };
  timers.clearTimer = () => {
    timers.pending = null;
    timers.cleared += 1;
  };
  timers.fire = () => {
    const { callback } = timers.pending;
    timers.pending = null;
    callback();
  };
  return timers;
}
const lostCanvas = ({ connected = true, lost = true } = {}) => ({ isConnected: connected, getContext: (kind) => (kind === 'webgl2' ? { isContextLost: () => lost } : null) });
const supportWith = (doc, timers) => createWebGLSupport(() => doc, { graceMs: 5000, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

test('context events are watched only where the probe found WebGL, and once', () => {
  const yes = watchedDocument(context());
  const support = supportWith(yes, manualTimers());
  assert.deepEqual(yes.listening(), []);
  support.available();
  support.available();
  assert.deepEqual(yes.listening(), ['webglcontextlost', 'webglcontextrestored']);
  const no = watchedDocument(null);
  supportWith(no, manualTimers()).available();
  assert.deepEqual(no.listening(), [], 'nothing to watch without WebGL');
});

test('a context that stays lost turns the layer off after the grace period, and tells subscribers', () => {
  const doc = watchedDocument(context());
  const timers = manualTimers();
  const support = supportWith(doc, timers);
  let notified = 0;
  support.subscribe(() => {
    notified += 1;
  });
  assert.equal(support.available(), true);
  doc.emit('webglcontextlost', lostCanvas());
  assert.equal(timers.pending.ms, 5000);
  assert.equal(support.available(), true, 'a loss is not acted on at once: three.js and R3F ride it out');
  doc.emit('webglcontextlost', lostCanvas());
  timers.fire();
  assert.equal(support.available(), false);
  assert.equal(notified, 1);
});

test('a context that comes back in time keeps the layer on and lets failed canvases retry', () => {
  const doc = watchedDocument(context());
  const timers = manualTimers();
  const support = supportWith(doc, timers);
  let retried = 0;
  support.onRestored(() => {
    retried += 1;
  });
  support.available();
  const a = lostCanvas();
  const b = lostCanvas();
  doc.emit('webglcontextlost', a);
  doc.emit('webglcontextlost', b);
  doc.emit('webglcontextrestored', a);
  assert.ok(timers.pending, 'one canvas is still lost: the timer keeps running');
  doc.emit('webglcontextrestored', b);
  assert.equal(timers.pending, null, 'every context is back: the timer is cancelled');
  assert.equal(retried, 2);
  assert.equal(support.available(), true);
});

test('a lost canvas that React took down, or that has recovered, does not turn the layer off', () => {
  for (const canvas of [lostCanvas({ connected: false }), lostCanvas({ lost: false })]) {
    const doc = watchedDocument(context());
    const timers = manualTimers();
    const support = supportWith(doc, timers);
    support.available();
    doc.emit('webglcontextlost', canvas);
    timers.fire();
    assert.equal(support.available(), true);
  }
});

test('onRestored listeners can be removed', () => {
  const doc = watchedDocument(context());
  const support = supportWith(doc, manualTimers());
  support.available();
  let calls = 0;
  support.onRestored(() => {
    calls += 1;
  })();
  doc.emit('webglcontextrestored', lostCanvas());
  assert.equal(calls, 0);
});

test('canvasFailed: WebGL errors and any error of a critical canvas turn the layer off; other errors stay local', () => {
  const fresh = () => createWebGLSupport(() => fakeDocument(context()));
  const check = (error, options, expected) => {
    const support = fresh();
    assert.equal(support.available(), true);
    support.canvasFailed(error, options);
    assert.equal(support.available(), !expected, `${error.message} ${JSON.stringify(options)}`);
  };
  check(new Error('Error creating WebGL context.'), undefined, true);
  check(new Error('Error creating WebGL context.'), { critical: false }, true);
  check(new Error('Rapier failed to initialise'), undefined, false);
  check(new Error('Rapier failed to initialise'), { critical: false }, false);
  check(new Error('Rapier failed to initialise'), { critical: true }, true);
  check(new Error("Cannot read properties of null (reading 'alpha')"), {}, false);
});

/* Every R3F <Canvas> on the site must sit in a WebGLGate: a canvas without one throws when WebGL is missing
   and Next.js shows its application-error screen. This reads the sources so a new canvas cannot slip in. */
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(jsx?|mjs)$/.test(name) ? [path] : [];
  });
const count = (text, pattern) => (text.match(pattern) || []).length;
// source without its comments (they name <Canvas> and <View> in prose)
const code = (path) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');

test('every <Canvas> is wrapped in a <WebGLGate>', () => {
  const canvasFiles = sources(SRC)
    .map((path) => [path, code(path)])
    .filter(([, text]) => /<Canvas[\s>]/.test(text));
  assert.ok(canvasFiles.length >= 3, 'the shared, background and pre-footer canvases are found');
  for (const [path, text] of canvasFiles) {
    const label = path.slice(SRC.length);
    assert.match(text, /import WebGLGate from '@src\/components\/canvas\/WebGLGate'/, `${label} imports the gate`);
    assert.equal(count(text, /<WebGLGate[\s>]/g), count(text, /<Canvas[\s>]/g), `${label}: one gate per canvas`);
    // the gate is the canvas's direct parent
    assert.equal(count(text, /<WebGLGate[^>]*>\s*<Canvas[\s>]/g), count(text, /<Canvas[\s>]/g), `${label}: each canvas sits directly in its gate`);
  }
});

test('the gate hands errors to the shared policy and retries a failed canvas when a context returns', () => {
  const gate = code(fileURLToPath(new URL('../src/components/canvas/WebGLGate.jsx', import.meta.url)));
  assert.match(gate, /webgl\.canvasFailed\(error, \{ critical \}\)/);
  assert.match(gate, /webgl\.onRestored\(this\.retry\)/);
  assert.match(gate, /this\.stopWatching\(\)/);
});

test('the shared canvas that hosts the Views is the critical one', () => {
  const app = code(fileURLToPath(new URL('../src/pages/_app.page.jsx', import.meta.url)));
  assert.match(app, /<WebGLGate critical>\s*<Canvas[^]*?<View\.Port \/>/);
});

test('every drei <View> window has a stand-in for browsers without WebGL', () => {
  const views = sources(SRC)
    .map((path) => [path, code(path)])
    .filter(([, text]) => /<View[\s>]/.test(text));
  assert.ok(views.length >= 1, 'the badge windows are found');
  for (const [path, text] of views) {
    assert.match(text, /useWebGL\(\)/, `${path.slice(SRC.length)} asks useWebGL`);
    assert.match(text, /=== false/, `${path.slice(SRC.length)} draws its stand-in only on a real false`);
  }
});
