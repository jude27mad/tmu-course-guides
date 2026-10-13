/**
 * Install before application code with browserContext.addInitScript(instrument).
 * Keep this function self-contained: Playwright serializes it into the browser.
 * Registries contain WeakRefs, never references that keep removed DOM alive.
 */
export function instrument() {
  if (window.__qaMetrics) return;

  const nativeAdd = EventTarget.prototype.addEventListener;
  const nativeRemove = EventTarget.prototype.removeEventListener;
  const listenerTargets = new WeakMap();
  const listeners = new Set();
  const observerRecords = new Map();
  const contexts = new Set();
  const contextRecords = new WeakMap();
  const pendingRaf = new Map();
  let executingRaf = null;
  let draws2d = 0;
  let drawsWebgl = 0;
  let exposedGsap = null;
  let exposedScrollTrigger = null;

  function targetName(target) {
    if (target === window) return 'window';
    if (target === document) return 'document';
    if (target instanceof Element) {
      return `${target.localName}${target.id ? `#${target.id}` : ''}`;
    }
    return target.constructor?.name || 'EventTarget';
  }

  function targetStatus(target) {
    if (target === window || target === document) return 'connected';
    if (target instanceof Node) return target.isConnected ? 'connected' : 'disconnected';
    return 'other';
  }

  function listenerSource(callback) {
    // Object callbacks may define a handleEvent getter. Native dispatch reads
    // that getter only when an event fires, so registration must not touch it.
    if (typeof callback !== 'function') return 'object listener: handleEvent';
    return Function.prototype.toString.call(callback).replace(/\s+/g, ' ').slice(0, 240);
  }

  // Flatten the native options once, including getters. Leave passive unspecified
  // when absent so the browser retains its default-passive behavior.
  function addOptions(options) {
    if (options == null || (typeof options !== 'object' && typeof options !== 'function')) return {capture: Boolean(options)};
    const normalized = {capture: Boolean(options.capture), once: Boolean(options.once)};
    const passive = options.passive;
    const signal = options.signal;
    if (passive !== undefined) normalized.passive = Boolean(passive);
    if (signal !== undefined) normalized.signal = signal;
    return normalized;
  }

  function removeOptions(options) {
    return {capture: options && (typeof options === 'object' || typeof options === 'function') ? Boolean(options.capture) : Boolean(options)};
  }

  function deactivate(record) {
    if (!record.active) return;
    record.active = false;
    listeners.delete(record);
    const target = record.target.deref();
    const callback = record.callback.deref();
    const byType = target && listenerTargets.get(target);
    const byCallback = byType?.get(record.type);
    const byCapture = callback && byCallback?.get(callback);
    byCapture?.delete(record.capture);
    if (byCapture?.size === 0) byCallback.delete(callback);
    if (byCallback?.size === 0) byType.delete(record.type);
    const signal = record.signal?.deref();
    if (signal && record.abort) nativeRemove.call(signal, 'abort', record.abort);
    record.abort = null;
  }

  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if (callback == null || (typeof callback !== 'function' && typeof callback !== 'object') || typeof type === 'symbol') {
      return nativeAdd.call(this, type, callback, options);
    }
    type = String(type);
    const normalized = addOptions(options);
    let byType = listenerTargets.get(this);
    let byCallback = byType?.get(type);
    let byCapture = byCallback?.get(callback);
    let existing = byCapture?.get(normalized.capture);
    if (existing?.signal?.deref()?.aborted) {
      // Native AbortSignal cleanup runs independently of abort-event bubbling.
      // An application may stop our bookkeeping handler before it runs.
      deactivate(existing);
      existing = null;
      byCallback = byType?.get(type);
      byCapture = byCallback?.get(callback);
    }
    if (existing) {
      // Native registration ignores changed once/passive/signal on duplicates.
      return nativeAdd.call(this, type, existing.wrapper.deref(), normalized);
    }
    const record = {
      active: true, type, capture: normalized.capture, once: Boolean(normalized.once),
      target: new WeakRef(this), callback: new WeakRef(callback), source: listenerSource(callback),
      signal: normalized.signal ? new WeakRef(normalized.signal) : null, abort: null, wrapper: null,
    };
    const wrapped = function (event) {
      if (record.once) deactivate(record);
      if (typeof callback === 'function') return callback.call(this, event);
      return callback.handleEvent.call(callback, event);
    };
    record.wrapper = new WeakRef(wrapped);
    // Validate through the native method before registering any QA bookkeeping.
    nativeAdd.call(this, type, wrapped, normalized);
    if (normalized.signal?.aborted) return;
    if (!byType) listenerTargets.set(this, byType = new Map());
    if (!byCallback) byType.set(type, byCallback = new Map());
    if (!byCapture) byCallback.set(callback, byCapture = new Map());
    byCapture.set(normalized.capture, record);
    listeners.add(record);
    if (normalized.signal) {
      record.abort = () => deactivate(record);
      // QA's own abort/context listeners bypass the patched method.
      nativeAdd.call(normalized.signal, 'abort', record.abort, {once: true});
    }
  };

  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    if (callback == null || (typeof callback !== 'function' && typeof callback !== 'object') || typeof type === 'symbol') {
      return nativeRemove.call(this, type, callback, options);
    }
    type = String(type);
    const normalized = removeOptions(options);
    const record = listenerTargets.get(this)?.get(type)?.get(callback)?.get(normalized.capture);
    nativeRemove.call(this, type, record?.wrapper.deref() || callback, normalized);
    if (record) deactivate(record);
  };

  for (const [kind, name] of [['intersection', 'IntersectionObserver'], ['mutation', 'MutationObserver'], ['resize', 'ResizeObserver']]) {
    const Native = window[name];
    const records = new Set();
    const byObserver = new WeakMap();
    observerRecords.set(kind, records);
    if (!Native) continue;
    const proto = Native.prototype;
    const observe = proto.observe;
    const disconnect = proto.disconnect;
    const unobserve = proto.unobserve;
    window[name] = new Proxy(Native, {
      construct(target, args, newTarget) {
        const observer = Reflect.construct(target, args, newTarget);
        const record = {observer: new WeakRef(observer), targets: new Set()};
        byObserver.set(observer, record);
        records.add(record);
        return observer;
      },
    });
    proto.observe = function (target, ...options) {
      const result = observe.call(this, target, ...options);
      const record = byObserver.get(this);
      if (record && !Array.from(record.targets).some(ref => ref.deref() === target)) {
        record.targets.add(new WeakRef(target));
      }
      return result;
    };
    proto.disconnect = function () {
      const result = disconnect.call(this);
      byObserver.get(this)?.targets.clear();
      return result;
    };
    if (unobserve) proto.unobserve = function (target) {
      const result = unobserve.call(this, target);
      const record = byObserver.get(this);
      if (record) for (const ref of record.targets) if (!ref.deref() || ref.deref() === target) record.targets.delete(ref);
      return result;
    };
  }

  const nativeRequestRaf = window.requestAnimationFrame;
  const nativeCancelRaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = function (callback) {
    if (typeof callback !== 'function') return nativeRequestRaf.call(this, callback);
    const record = {recurring: Boolean(executingRaf)};
    const id = nativeRequestRaf.call(this, function (timestamp) {
      pendingRaf.delete(id);
      const previous = executingRaf;
      executingRaf = record;
      try { return callback.call(this, timestamp); }
      finally { executingRaf = previous; }
    });
    pendingRaf.set(id, record);
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    const result = nativeCancelRaf.call(this, id);
    pendingRaf.delete(Number(id));
    return result;
  };

  for (const name of ['HTMLCanvasElement', 'OffscreenCanvas']) {
    const proto = window[name]?.prototype;
    if (!proto?.getContext) continue;
    const getContext = proto.getContext;
    proto.getContext = function (...args) {
      const context = getContext.apply(this, args);
      if (!context || contextRecords.has(context)) return context;
      const webgl = typeof context.isContextLost === 'function';
      const record = {context: new WeakRef(context), canvas: new WeakRef(this), webgl, lost: false};
      contextRecords.set(context, record);
      contexts.add(record);
      if (webgl && this instanceof EventTarget) {
        nativeAdd.call(this, 'webglcontextlost', () => { record.lost = true; });
        nativeAdd.call(this, 'webglcontextrestored', () => { record.lost = false; });
      }
      return context;
    };
  }

  const patchedMethods = new Set();
  function countDraws(proto, names, webgl) {
    if (!proto) return;
    for (const name of names) {
      const native = proto[name];
      if (typeof native !== 'function' || patchedMethods.has(native)) continue;
      const wrapped = function (...args) {
        const result = native.apply(this, args);
        if (webgl) drawsWebgl++; else draws2d++;
        return result;
      };
      patchedMethods.add(wrapped);
      proto[name] = wrapped;
    }
  }
  const drawMethods2d = ['clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke', 'fillText', 'strokeText', 'drawImage', 'putImageData'];
  const drawMethodsWebgl = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer'];
  countDraws(window.CanvasRenderingContext2D?.prototype, drawMethods2d, false);
  countDraws(window.OffscreenCanvasRenderingContext2D?.prototype, drawMethods2d, false);
  countDraws(window.WebGLRenderingContext?.prototype, drawMethodsWebgl, true);
  countDraws(window.WebGL2RenderingContext?.prototype, drawMethodsWebgl, true);

  function listenerSnapshot() {
    const counts = {live: 0, retained: 0, connected: 0, disconnected: 0, other: 0, details: []};
    const groups = new Map();
    for (const record of listeners) {
      const target = record.target.deref();
      if (!target || !record.callback.deref() || !record.wrapper.deref()) {
        deactivate(record);
        continue;
      }
      // Check aborted signals as well: stopImmediatePropagation on an abort event
      // must not make our accounting disagree with the browser's abort algorithm.
      if (record.signal?.deref()?.aborted) { deactivate(record); continue; }
      const status = targetStatus(target);
      counts[status]++;
      counts.retained++;
      if (status !== 'disconnected') counts.live++;
      const detail = {target: targetName(target), type: record.type, capture: record.capture,
        once: record.once, source: record.source, status};
      const key = JSON.stringify(detail);
      const group = groups.get(key);
      if (group) group.count++;
      else groups.set(key, {...detail, count: 1});
    }
    counts.details = Array.from(groups.values()).sort((a, b) =>
      a.target.localeCompare(b.target) || a.type.localeCompare(b.type) || a.source.localeCompare(b.source));
    return counts;
  }

  function observerSnapshot() {
    const snapshot = {total: 0};
    for (const [kind, records] of observerRecords) {
      const counts = {active: 0, instances: 0, targets: 0, connectedTargets: 0};
      for (const record of records) {
        if (!record.observer.deref()) { records.delete(record); continue; }
        counts.instances++;
        let targets = 0;
        for (const ref of record.targets) {
          const target = ref.deref();
          if (!target) { record.targets.delete(ref); continue; }
          targets++;
          if (target.isConnected) counts.connectedTargets++;
        }
        counts.targets += targets;
        if (targets) counts.active++;
      }
      snapshot[kind] = counts;
      snapshot.total += counts.active;
    }
    return snapshot;
  }

  function connectedCanvases(root = document) {
    let count = root.querySelectorAll('canvas').length;
    for (const node of root.querySelectorAll('*')) if (node.shadowRoot) count += connectedCanvases(node.shadowRoot);
    return count;
  }

  function canvasSnapshot() {
    const canvases = {connected: connectedCanvases(), contexts: 0, drawCalls: draws2d + drawsWebgl, drawCalls2d: draws2d};
    const webgl = {active: 0, lost: 0, total: 0, connected: 0, drawCalls: drawsWebgl};
    for (const record of contexts) {
      const context = record.context.deref();
      if (!context) { contexts.delete(record); continue; }
      canvases.contexts++;
      if (!record.webgl) continue;
      webgl.total++;
      const lost = context.isContextLost();
      record.lost = lost;
      if (lost) webgl.lost++;
      else webgl.active++;
      if (record.canvas.deref()?.isConnected) webgl.connected++;
    }
    return {canvases, webgl};
  }

  /** Observe the site's already-loaded GSAP singleton; never create animations. */
  function installGsap(gsap, ScrollTrigger) {
    exposedGsap = gsap?.gsap || gsap || exposedGsap;
    exposedScrollTrigger = ScrollTrigger || exposedScrollTrigger;
  }

  function gsapSnapshot() {
    const gsap = exposedGsap || window.gsap;
    const ScrollTrigger = exposedScrollTrigger || window.ScrollTrigger || gsap?.core?.globals?.()?.ScrollTrigger;
    if (gsap) installGsap(gsap, ScrollTrigger);
    const ticker = gsap?.ticker;
    const callbacks = ticker?._listeners;
    return {
      available: Boolean(gsap),
      tickerCallbacks: Array.isArray(callbacks) ? callbacks.length : null,
      scrollTriggers: typeof ScrollTrigger?.getAll === 'function' ? ScrollTrigger.getAll().length : null,
    };
  }

  Object.defineProperty(window, '__qaMetrics', {
    configurable: true,
    value: {
      installGsap,
      snapshot() {
        const {canvases, webgl} = canvasSnapshot();
        return {
          listeners: listenerSnapshot(), observers: observerSnapshot(),
          raf: {pending: pendingRaf.size, recurring: Array.from(pendingRaf.values()).filter(record => record.recurring).length},
          canvases, webgl, gsap: gsapSnapshot(),
        };
      },
    },
  });
}
