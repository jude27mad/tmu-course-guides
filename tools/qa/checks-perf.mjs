import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, collectPageErrors } from './runtime.mjs';
/** Poll the already-scheduled native frame checkpoints from Node. Offscreen
 * surfaces have no pending callback and never extend the collection window. */
export async function waitForReadableFrames({ snapshot, remainingMs, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const started = now(), deadline = started + Math.max(0, remainingMs);
  let state = await snapshot();
  const initialPending = [...(state.pendingReadableFrames ?? [])];
  while (state.pendingReadableFrames?.length && now() < deadline) {
    await pause(Math.min(100, deadline - now()));
    state = await snapshot();
  }
  const pendingAtEnd = [...(state.pendingReadableFrames ?? [])];
  return { state, wait: { waited: initialPending.length > 0, durationMs: now() - started, remainingMs, capped: pendingAtEnd.length > 0, initialPending, pendingAtEnd, reason: pendingAtEnd.length ? 'The collection cap was reached while scheduled native readability frame callbacks remained pending; visibility timings stay null.' : null } };
}

/** Recheck after every asynchronous browser capture: activity makes it stale. */
export async function collectQuietSample({ network, isReady, capture, started = Date.now(), capMs = 90_000, now = Date.now, pause = () => new Promise(resolve => setTimeout(resolve, 100)), optionalSettlementMs = 2500, networkQuietMs = 1500 }) {
  let readyAt = null, sample, quiet = false, captureAttempts = 0;
  const checkpoint = () => readyAt !== null && now() - readyAt >= optionalSettlementMs && network.activeCount === 0 && now() - network.lastActivityMs >= networkQuietMs;
  while (now() - started < capMs) {
    if (await isReady() && readyAt === null) readyAt = now();
    if (checkpoint()) {
      const revision = network.revision;
      sample = await capture({ checkpoint }); captureAttempts++;
      // Appearance checkpoint exhaustion is diagnostic. A capture begun before
      // the cap can still establish unchanged network quiet at its completion.
      if (!sample?.interrupted && checkpoint() && network.revision === revision) { quiet = true; break; }
    }
    await pause();
  }
  if (!quiet) sample = await capture({ checkpoint: () => true, capped: true });
  return { sample, collection: { durationMs: now() - started, capMs, optionalSettlementMs, networkQuietMs, routeReady: readyAt !== null, networkQuiet: quiet, capped: !quiet, timeCapReached: now() - started >= capMs, appearanceCheckpointWait: sample?.readabilityWait ?? null, activeRequestsAtEnd: network.activeCount, captureAttempts } };
}

/** Pure, shared criteria used by the installed viewport probe and focused tests. */
export function isReadableProbe({ text, rect, viewport, effectiveOpacity, blurPx, fullyClipped, hidden, fcpMs, sampleTimeMs }) {
  return Boolean(Number.isFinite(fcpMs) && sampleTimeMs >= fcpMs && text?.trim() && !hidden && !fullyClipped && effectiveOpacity >= .85 - 1e-6 && blurPx === 0 && rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width);
}

export function assertPerfTelemetry(events, label) {
  return ['console', 'pageerror', 'requestfailed', 'http'].map(type => {
    const errors = events.filter(event => event.type === type);
    return assertion(`${label}: no ${type} errors`, errors.length === 0, errors, []);
  });
}

const ROUTES = ['desk', 'cen100', 'mth140', 'mth141'];
const WALL_TIME = '2026-10-13T16:00:00.000Z';
const RESOURCE_TYPES = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'texttrack', 'xhr', 'fetch', 'prefetch', 'eventsource', 'websocket', 'manifest', 'signedexchange', 'ping', 'cspviolationreport', 'preflight', 'other'];
export const PROFILES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, cpuRate: 4, network: { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: 'cellular4g' } },
  desktop: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1, cpuRate: 1, network: null }
};
const DEFAULT_MARGIN = { fraction: .1, requestCount: 2, transferBytes: 4096, bytesByType: 8192, chainDepth: 1 };
const finiteCount = value => Number.isFinite(value) && value >= 0;
const byteBreakdownPresent = row => row.network?.bytesByType !== null && typeof row.network?.bytesByType === 'object' && !Array.isArray(row.network.bytesByType);
const caseKey = row => [row.base, row.route, row.profile].join('|');
const assertion = (name, pass, actual, expected, detail) => ({ name, pass: Boolean(pass), actual, expected, ...(detail ? { detail } : {}) });

function measurementCases(input, base) {
  if (Array.isArray(input)) return input.flatMap(item => measurementCases(item, base));
  if (input && ['network', 'route', 'profile'].some(key => Object.hasOwn(input, key))) return [{ ...input, base: input.base ?? base }];
  if (input?.checks) return measurementCases(input.checks.find(item => item.name === 'perf'), base);
  if (input?.observations?.cases) return measurementCases(input.observations.cases, input.base ?? base);
  if (input?.cases) return measurementCases(input.cases, input.base ?? base);
  return [];
}

function budgetMetrics(row) {
  return { requestCount: row.network?.requestCount, transferBytes: row.network?.transferBytes, bytesByType: { ...row.network?.bytesByType }, chainDepth: row.modules?.chainDepth };
}

/** Pure conversion of recorded perf.json (or flat measured cases) into explicit limits. */
export function makeBudgets(measurements, { margin = DEFAULT_MARGIN } = {}) {
  const cases = measurementCases(measurements), seen = new Set();
  if (!cases.length) throw new Error('Performance budgets require at least one measurement.');
  const allowance = { ...DEFAULT_MARGIN, ...margin };
  for (const [metric, value] of Object.entries(allowance)) if (!finiteCount(value)) throw new Error(`Invalid budget margin ${metric}.`);
  const increase = (value, minimum) => Math.ceil(value + Math.max(value * allowance.fraction, minimum));
  return {
    schemaVersion: 1,
    margin: allowance,
    timingPolicy: 'FCP, LCP, CLS, visible-content time and long tasks are reported without timing gates.',
    cases: cases.map(row => {
      const key = caseKey(row), baseline = budgetMetrics(row);
      if (!row.base || !row.route || !row.profile || seen.has(key)) throw new Error(`Invalid or duplicate measurement case ${key}.`);
      seen.add(key);
      if (!byteBreakdownPresent(row)) throw new Error(`Invalid ${key} measurement bytesByType.`);
      for (const metric of ['requestCount', 'transferBytes', 'chainDepth']) if (!finiteCount(baseline[metric])) throw new Error(`Invalid ${key} measurement ${metric}.`);
      for (const [type, bytes] of Object.entries(baseline.bytesByType)) if (!finiteCount(bytes)) throw new Error(`Invalid ${key} measurement bytesByType.${type}.`);
      const limits = {
        requestCount: increase(baseline.requestCount, allowance.requestCount),
        transferBytes: increase(baseline.transferBytes, allowance.transferBytes),
        bytesByType: Object.fromEntries([...new Set([...RESOURCE_TYPES, ...Object.keys(baseline.bytesByType)])].sort().map(type => [type, increase(baseline.bytesByType[type] ?? 0, allowance.bytesByType)])),
        chainDepth: Math.ceil(baseline.chainDepth + allowance.chainDepth)
      };
      return { base: row.base, route: row.route, profile: row.profile, baseline, limits };
    })
  };
}

/** Return runner-compatible assertions; missing/malformed measurements fail closed. */
export function assertBudgets(measurements, budgets, { base } = {}) {
  const cases = measurementCases(measurements).filter(row => base === undefined || row.base === base), out = [];
  if (budgets?.schemaVersion !== 1 || !Array.isArray(budgets?.cases)) return [assertion('performance budget schema', false, budgets?.schemaVersion, 1)];
  if (!cases.length) return [assertion('performance budget measurements available', false, 0, 'at least one measured case')];
  const expectedCases = budgets.cases.filter(row => base === undefined || row.base === base);
  const countKeys = rows => rows.reduce((counts, row) => counts.set(caseKey(row), (counts.get(caseKey(row)) ?? 0) + 1), new Map());
  const actualCounts = countKeys(cases), budgetCounts = countKeys(expectedCases);
  for (const [key, count] of actualCounts) if (count > 1) out.push(assertion(`${key}: no duplicate measurement case`, false, count, 1));
  for (const [key, count] of budgetCounts) {
    if (count > 1) out.push(assertion(`${key}: no duplicate budget case`, false, count, 1));
    out.push(assertion(`${key}: expected measurement case present`, actualCounts.has(key), actualCounts.get(key) ?? 0, 1));
  }
  for (const row of cases) {
    const key = caseKey(row), budget = budgets.cases.find(item => caseKey(item) === key);
    if (!budget) { out.push(assertion(`${key}: budget case present`, false, key, 'committed case budget')); continue; }
    const actual = budgetMetrics(row);
    out.push(assertion(`${key}: transfer byte breakdown available`, byteBreakdownPresent(row), row.network?.bytesByType, 'measured bytes by resource type'));
    for (const metric of ['requestCount', 'transferBytes', 'chainDepth']) {
      const limit = budget.limits?.[metric];
      out.push(assertion(`${key}: budget ${metric}`, finiteCount(actual[metric]) && finiteCount(limit) && actual[metric] <= limit, actual[metric], limit));
    }
    const types = [...new Set([...Object.keys(actual.bytesByType), ...Object.keys(budget.limits?.bytesByType ?? {})])].sort();
    for (const type of types) {
      const bytes = Object.hasOwn(actual.bytesByType, type) ? actual.bytesByType[type] : 0, limit = budget.limits?.bytesByType?.[type];
      out.push(assertion(`${key}: budget bytesByType.${type}`, finiteCount(bytes) && finiteCount(limit) && bytes <= limit, bytes, limit));
    }
  }
  return out;
}

export function computeCLS(entries) {
  let maximum = 0, session = 0, first = 0, previous = -Infinity;
  for (const entry of [...entries].filter(row => !row.hadRecentInput).sort((a, b) => a.startTime - b.startTime)) {
    if (entry.startTime - previous >= 1000 || entry.startTime - first >= 5000) { first = entry.startTime; session = 0; }
    session += entry.value;
    previous = entry.startTime;
    maximum = Math.max(maximum, session);
  }
  return maximum;
}

export function summarizeNetwork(resources) {
  const bytesByType = Object.fromEntries(RESOURCE_TYPES.map(type => [type, 0]));
  const urlCounts = {}, moduleURLs = new Map();
  let transferBytes = 0;
  for (const resource of resources) {
    const type = (resource.type || 'Other').toLowerCase(), bytes = finiteCount(resource.transferBytes) ? resource.transferBytes : 0;
    bytesByType[type] = (bytesByType[type] ?? 0) + bytes;
    transferBytes += bytes;
    urlCounts[resource.url] = (urlCounts[resource.url] ?? 0) + 1;
    try {
      const url = new URL(resource.url);
      if (/\.(?:mjs|js)$/i.test(url.pathname)) {
        const key = url.origin + url.pathname, urls = moduleURLs.get(key) ?? new Set();
        urls.add(resource.url); moduleURLs.set(key, urls);
      }
    } catch { /* Non-URL diagnostics cannot be a fetched module alias. */ }
  }
  return {
    requestCount: resources.length, transferBytes, bytesByType, urlCounts,
    duplicateURLs: Object.entries(urlCounts).filter(([, count]) => count > 1).map(([url, count]) => ({ url, count })),
    moduleURLCollisions: [...moduleURLs].filter(([, urls]) => urls.size > 1).map(([path, urls]) => ({ path, urls: [...urls].sort() })).sort((a, b) => a.path.localeCompare(b.path)),
    fetchedModuleURLs: [...moduleURLs.values()].flatMap(urls => [...urls]).sort(),
    unfinishedURLs: resources.filter(row => !row.finished && !row.failed).map(row => row.url),
    byteSource: 'CDP Network.loadingFinished.encodedDataLength; Content-Length and decoded response-body bytes are separate diagnostics.',
    resources
  };
}

// Runs before product scripts. Only native PerformanceObservers and short-lived
// visibility polling are added; lifecycle wrappers and vendor imports are absent.
export function installPerfObservers({ route, wallTime }) {
  const NativeDate = Date, offset = NativeDate.parse(wallTime) - NativeDate.now();
  window.Date = new Proxy(NativeDate, {
    construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [target.now() + offset], newTarget); },
    apply(target) { return new target(target.now() + offset).toString(); },
    get(target, key, receiver) { return key === 'now' ? () => target.now() + offset : Reflect.get(target, key, receiver); }
  });
  const state = { supportedEntryTypes: [...(PerformanceObserver.supportedEntryTypes ?? [])], fcpMs: null, lcpMs: null, lcpEntries: [], layoutShifts: [], longTasks: [], courseworkVisibleMs: null, deadlineVisibleMs: null, deadlineChipVisibleMs: null, firstReadableDOMMs: {}, coursework: null, deadline: null, deadlineChip: null, routeReadyMs: null, observerErrors: [], timingMethod: 'First post-FCP readable viewport sample followed by two native animation frames; effective ancestor opacity >=0.85, no nonzero blur or full clipping. DOM/CSS approximation with 100 ms polling, not physical screen presentation.' };
  const observers = [];
  const record = (type, entries) => {
    for (const entry of entries) {
      if (type === 'paint' && entry.name === 'first-contentful-paint') state.fcpMs = entry.startTime;
      if (type === 'largest-contentful-paint') {
        state.lcpMs = entry.startTime;
        state.lcpEntries.push({ startTime: entry.startTime, renderTime: entry.renderTime, loadTime: entry.loadTime, size: entry.size, url: entry.url, element: entry.element ? { tag: entry.element.tagName, id: entry.element.id, class: String(entry.element.className) } : null });
      }
      if (type === 'layout-shift') state.layoutShifts.push({ startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput });
      if (type === 'longtask' && entry.duration > 50) state.longTasks.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration, attribution: [...(entry.attribution ?? [])].map(item => ({ name: item.name, containerType: item.containerType, containerName: item.containerName, containerId: item.containerId, containerSrc: item.containerSrc })) });
    }
  };
  for (const type of ['paint', 'largest-contentful-paint', 'layout-shift', 'longtask']) {
    if (!state.supportedEntryTypes.includes(type)) continue;
    try {
      const observer = new PerformanceObserver(list => record(type, list.getEntries()));
      observer.observe({ type, buffered: true }); observers.push({ type, observer });
    } catch (error) { state.observerErrors.push({ type, message: error.message }); }
  }
  const selectors = route === 'desk'
    ? { coursework: '[data-desk-overall-body] .desk-next-title, .desk-course', deadline: '.desk-face .desk-digits, .desk-face .desk-word', deadlineChip: '.desk-chip' }
    : { coursework: '.ns-hud [data-ns-title], #next-assessment h2, #nextsign .head, #assessment-list .assessment-title, #teamlist .tile .n, #youlist .tile .n', deadline: '.ns-hud [data-ns-chip], .ns-dock-chip', deadlineChip: '.ns-hud [data-ns-chip], .ns-dock-chip' };
  const probe = element => {
    const bounds = element.getBoundingClientRect();
    const info = { text: element.textContent.trim(), rect: { width: bounds.width, height: bounds.height, top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right }, viewport: { width: innerWidth, height: innerHeight }, effectiveOpacity: 1, blurPx: 0, fullyClipped: false, hidden: Boolean(element.closest('[hidden],[inert]')), fcpMs: state.fcpMs, sampleTimeMs: performance.now(), ancestorEffects: [] };
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const css = getComputedStyle(node);
      info.effectiveOpacity *= Number(css.opacity);
      info.hidden ||= css.visibility === 'hidden' || css.display === 'none' || css.contentVisibility === 'hidden';
      for (const match of css.filter.matchAll(/blur\(([^)]+)\)/g)) info.blurPx = Math.max(info.blurPx, parseFloat(match[1]) || 0);
      const inset = css.clipPath.match(/^inset\(([^)]+)\)$/)?.[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
      if (inset && inset.length <= 4) {
        const values = inset.length === 1 ? [inset[0], inset[0], inset[0], inset[0]] : inset.length === 2 ? [inset[0], inset[1], inset[0], inset[1]] : inset.length === 3 ? [inset[0], inset[1], inset[2], inset[1]] : inset;
        const rect = node.getBoundingClientRect(), pixels = (value, dimension) => value.endsWith('%') ? parseFloat(value) * dimension / 100 : parseFloat(value);
        info.fullyClipped ||= pixels(values[0], rect.height) + pixels(values[2], rect.height) >= rect.height || pixels(values[1], rect.width) + pixels(values[3], rect.width) >= rect.width;
      }
      info.fullyClipped ||= /^rect\(0px[, ]+0px[, ]+0px[, ]+0px\)$/.test(css.clip);
      if (css.opacity !== '1' || css.filter !== 'none' || css.clipPath !== 'none') info.ancestorEffects.push({ tag: node.tagName, id: node.id, opacity: css.opacity, filter: css.filter, clipPath: css.clipPath });
      if (node === element) info.font = { family: css.fontFamily, size: css.fontSize, lineHeight: css.lineHeight, color: css.color };
    }
    return info;
  };
  let poll; const pending = new Set();
  const sample = () => {
    for (const kind of ['coursework', 'deadline', 'deadlineChip']) {
      const field = kind + 'VisibleMs';
      if (state[field] !== null || pending.has(kind)) continue;
      const elements = [...document.querySelectorAll(selectors[kind])];
      const element = elements.find(element => {
        const info = probe(element);
        if (window.__qaPerfReadableText({ ...info, fcpMs: 0 }) && state.firstReadableDOMMs[kind] === undefined) state.firstReadableDOMMs[kind] = info.sampleTimeMs;
        return window.__qaPerfReadableText(info);
      });
      if (element) {
        pending.add(kind);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          pending.delete(kind);
          const info = probe(element);
          if (!element.isConnected || !window.__qaPerfReadableText(info) || state[field] !== null) return;
          state[field] = info.sampleTimeMs;
          state[kind] = { selector: selectors[kind], surface: kind === 'deadline' && route === 'desk' ? 'Desk hero countdown' : kind === 'deadlineChip' || kind === 'deadline' ? 'Populated deadline chip' : 'Real coursework text', tag: element.tagName, id: element.id, class: String(element.className), ...info, text: info.text.slice(0, 220) };
        }));
      }
    }
    if (['coursework', 'deadline', 'deadlineChip'].every(kind => state[kind + 'VisibleMs'] !== null)) clearInterval(poll);
  };
  document.addEventListener('route-changed', event => { if (event.detail?.route === route) { state.routeReadyMs = performance.now(); sample(); } }, { once: true });
  document.addEventListener('DOMContentLoaded', sample, { once: true });
  poll = setInterval(sample, 100);
  window.__qaPerf = {
    state,
    snapshot() {
      for (const { type, observer } of observers) record(type, observer.takeRecords());
      sample();
      state.sampleEndMs = performance.now();
      state.pendingReadableFrames = [...pending];
      state.missingVisibleTimingReasons = Object.fromEntries(['coursework', 'deadline', 'deadlineChip'].map(kind => [kind, state[kind + 'VisibleMs'] !== null ? null : pending.has(kind) ? 'Readable viewport text was found, but its scheduled two-native-animation-frame checkpoint remained pending at the snapshot.' : state.fcpMs === null ? 'First contentful paint was not observed during the sample.' : 'No populated, post-FCP readable text on this surface was found inside the initial viewport during the sample.']));
      return state;
    },
    stop() {
      const result = this.snapshot(); clearInterval(poll);
      for (const { observer } of observers) observer.disconnect();
      return result;
    }
  };
}

function collectNetwork(session) {
  const resources = [], current = new Map(), active = new Set();
  let lastActivityMs = Date.now(), revision = 0;
  const activity = () => { lastActivityMs = Date.now(); revision++; };
  const applyResponse = (row, response) => {
    if (!row) return;
    const rawLength = Object.entries(response.headers ?? {}).find(([key]) => key.toLowerCase() === 'content-length')?.[1];
    Object.assign(row, { status: response.status, mimeType: response.mimeType, protocol: response.protocol, fromDiskCache: Boolean(response.fromDiskCache), fromServiceWorker: Boolean(response.fromServiceWorker), contentLength: rawLength === undefined ? null : Number(rawLength) });
  };
  const handlers = {
    'Network.requestWillBeSent': event => {
      activity();
      if (!/^https?:/.test(event.request.url)) return;
      const previous = current.get(event.requestId);
      if (event.redirectResponse && previous) {
        applyResponse(previous, event.redirectResponse);
        previous.transferBytes = event.redirectResponse.encodedDataLength ?? null;
        previous.finished = true; previous.redirect = true;
      }
      const initiator = event.initiator ?? {};
      const row = { requestId: event.requestId, url: event.request.url, method: event.request.method, type: event.type ?? 'Other', startTimestamp: event.timestamp, initiator: { type: initiator.type, url: initiator.url, lineNumber: initiator.lineNumber, stack: initiator.stack?.callFrames?.slice(0, 16).map(frame => ({ functionName: frame.functionName, url: frame.url, lineNumber: frame.lineNumber, columnNumber: frame.columnNumber })) ?? [] }, transferBytes: null, contentLength: null, bodyBytes: null, finished: false, failed: false };
      resources.push(row); current.set(event.requestId, row); active.add(event.requestId);
    },
    'Network.responseReceived': event => { activity(); const row = current.get(event.requestId); if (row) row.type = event.type ?? row.type; applyResponse(row, event.response); },
    'Network.loadingFinished': event => { activity(); active.delete(event.requestId); const row = current.get(event.requestId); if (row) Object.assign(row, { transferBytes: event.encodedDataLength, finished: true, endTimestamp: event.timestamp }); },
    'Network.loadingFailed': event => { activity(); active.delete(event.requestId); const row = current.get(event.requestId); if (row) Object.assign(row, { failed: true, errorText: event.errorText, canceled: event.canceled, endTimestamp: event.timestamp }); }
  };
  for (const [event, handler] of Object.entries(handlers)) session.on(event, handler);
  return {
    resources,
    get activeCount() { return active.size; },
    get lastActivityMs() { return lastActivityMs; },
    get revision() { return revision; },
    stop() { for (const [event, handler] of Object.entries(handlers)) session.off(event, handler); },
    async bodyDiagnostics() {
      // Inspection happens after the timed sample. CDP reads existing response
      // buffers and does not fetch any new module, image, font or vendor URL.
      await Promise.all(resources.map(async row => {
        if (!row.finished || row.redirect || row.bodyBytes !== null) return;
        try {
          const result = await session.send('Network.getResponseBody', { requestId: row.requestId });
          row.bodyBytes = result.base64Encoded ? Buffer.from(result.body, 'base64').byteLength : Buffer.byteLength(result.body, 'utf8');
        } catch (error) { row.bodyDiagnosticError = error.message; }
      }));
    }
  };
}

async function measureRoute(env, route, profileName, out) {
  const profile = PROFILES[profileName], label = `${route} ${profileName}`;
  const observation = { name: label, base: env.base, route, profile: profileName, url: env.origin + env.base + (route === 'desk' ? '' : route + '/'), settings: { ...profile, wallTime: WALL_TIME, wallClock: 'Moving Date offset; native timers and requestAnimationFrame remain active.', cacheDisabled: true, serviceWorkers: 'blocked and CDP bypassed', lifecycleInstrumentation: false } };
  out.observations.cases.push(observation);
  let context, session, network, errors;
  try {
    const { cpuRate, network: throttle, ...contextOptions } = profile;
    context = await env.browser.newContext({ ...contextOptions, serviceWorkers: 'block', timezoneId: 'America/Toronto' });
    await context.addInitScript({ content: `window.__qaPerfReadableText = (${isReadableProbe.toString()});` });
    await context.addInitScript(installPerfObservers, { route, wallTime: WALL_TIME });
    const page = await context.newPage();
    errors = collectPageErrors(page);
    session = await context.newCDPSession(page);
    await session.send('Network.enable', { maxTotalBufferSize: 32 * 1024 * 1024, maxResourceBufferSize: 8 * 1024 * 1024 });
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Network.setBypassServiceWorker', { bypass: true });
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    if (throttle) await session.send('Network.emulateNetworkConditions', throttle);
    network = collectNetwork(session);
    const started = Date.now(), capMs = 90_000;
    await page.goto(observation.url, { waitUntil: 'commit', timeout: capMs });
    let readiness = {}, criticalGraph;
    const { collectBootCriticalGraph } = await import('../module-graph.mjs');
    const expectedFeatures = route === 'desk' ? ['palette'] : ['palette', 'hero', 'scroll'];
    const snapshot = () => page.evaluate(() => ({ ...window.__qaPerf.snapshot(), moduleScripts: [...document.querySelectorAll('script[type="module"][src]')].map(script => ({ url: script.src, kind: script.hasAttribute('data-route-module') ? 'route' : script.hasAttribute('data-shell-module') ? 'shell' : 'entry' })) }));
    const { sample: { state, graph }, collection } = await collectQuietSample({ network, started, capMs,
      isReady: async () => {
        readiness = await page.evaluate(({ route, expectedFeatures }) => {
        const main = document.querySelector('main[data-route-region]');
        const identity = document.body?.dataset.page === 'desk' ? 'desk' : document.body?.dataset.course;
        const deadline = document.querySelector(route === 'desk' ? '[data-desk-overall-body]:not([hidden])' : '.ns-hud [data-ns-chip],.ns-count-when');
        return { perfObserverReady: typeof window.__qaPerf?.snapshot === 'function', routeReady: Boolean(identity === route && window.TMURouter?.route === route && Number.isFinite(window.__qaPerf?.state.routeReadyMs) && main?.textContent.trim().length > 20 && deadline?.textContent.trim().length > 0), optionalStyles: expectedFeatures.map(name => ({ name, href: document.querySelector(`link[data-night="${name}"]`)?.href ?? null })) };
        }, { route, expectedFeatures });
        readiness.optionalFeatures = readiness.optionalStyles.map(feature => ({ ...feature, requests: network.resources.filter(row => {
          const pathname = new URL(row.url).pathname;
          return pathname === env.base + `assets/night/${feature.name}.mjs` || pathname === env.base + `assets/night/${feature.name}.css`;
        }).map(row => ({ url: row.url, finished: row.finished, failed: row.failed, status: row.status })) }));
        readiness.optionalFeaturesAttempted = readiness.optionalFeatures.every(feature => feature.href && feature.requests.some(row => new URL(row.url).pathname.endsWith('.mjs')) && feature.requests.some(row => new URL(row.url).pathname.endsWith('.css')));
        return readiness.routeReady && readiness.optionalFeaturesAttempted;
      },
      capture: async ({ checkpoint }) => {
        // Browser RPCs can take seconds under software rendering. Do not freeze
        // observers or detach Network while new optional requests may begin.
        if (!readiness.perfObserverReady) throw new Error('Performance observers were unavailable before the collection cap.');
        await snapshot();
        if (!checkpoint()) return { interrupted: true };
        const html = await page.content();
        criticalGraph ??= await collectBootCriticalGraph({ rootDir: env.root ?? ROOT, documentPath: route === 'desk' ? 'index.html' : `${route}/index.html`, baseURL: env.origin + env.base, html });
        if (!checkpoint()) return { interrupted: true };
        await network.bodyDiagnostics();
        const { state, wait: readabilityWait } = await waitForReadableFrames({ snapshot, remainingMs: capMs - (Date.now() - started) });
        return { state, graph: criticalGraph, readabilityWait };
      }
    });
    // There is no asynchronous gap between the final quiet/revision validation
    // and detaching Network. The accepted snapshot defines the capture window.
    network.stop();
    observation.collection = { ...collection, navigationWaitUntil: 'commit', readinessIncludes: 'Completed semantic route and declared optional CSS/module fetch attempts', readiness };
    observation.timings = { fcpMs: state.fcpMs, lcpMs: state.lcpMs, cls: computeCLS(state.layoutShifts), clsMethod: 'Largest session window: less than one-second gaps and less than five-second span; recent input excluded.', courseworkVisibleMs: state.courseworkVisibleMs, deadlineVisibleMs: state.deadlineVisibleMs, deadlineChipVisibleMs: state.deadlineChipVisibleMs, firstReadableDOMMs: state.firstReadableDOMMs, pendingReadableFrames: state.pendingReadableFrames, timingMethod: state.timingMethod, routeReadyMs: state.routeReadyMs, sampleEndMs: state.sampleEndMs, longTaskCount: state.longTasks.length, longTaskDurationMs: state.longTasks.reduce((total, entry) => total + entry.duration, 0), longTasks: state.longTasks, lcpEntries: state.lcpEntries, layoutShifts: state.layoutShifts, coursework: state.coursework, deadline: state.deadline, deadlineChip: state.deadlineChip, supportedEntryTypes: state.supportedEntryTypes, observerErrors: state.observerErrors, missingVisibleTimingReasons: state.missingVisibleTimingReasons, visibilitySampleIntervalMs: 100 };
    observation.network = summarizeNetwork(network.resources);
    observation.modules = { chainDepth: graph.longestChainDepth, shortestDistanceDepth: graph.maxDepth, moduleCount: graph.moduleCount, edgeCount: graph.edgeCount, entryScripts: state.moduleScripts, bootDynamicEdges: graph.bootDynamicEdges, graph, fetchedLazyModuleURLs: observation.network.fetchedModuleURLs.filter(url => !graph.nodes.some(node => node.url === url)), runtimeURLCollisions: observation.network.moduleURLCollisions };
    out.assertions.push(assertion(`${label}: completed route and real deadline content`, readiness.routeReady, readiness, 'completed route, real content and populated deadline'));
    out.assertions.push(assertion(`${label}: declared optional feature fetches attempted`, readiness.optionalFeaturesAttempted, readiness.optionalFeatures, expectedFeatures, 'Observe normal product loading; QA never imports optional vendors.'));
    out.assertions.push(assertion(`${label}: network sample reaches quiet boundary`, collection.networkQuiet && observation.network.unfinishedURLs.length === 0, observation.collection, 'complete readiness + 2500 ms optional settlement + 1500 ms no active requests, unchanged during browser capture'));
    for (const type of ['paint', 'largest-contentful-paint', 'layout-shift', 'longtask']) out.assertions.push(assertion(`${label}: performance observer ${type} supported`, state.supportedEntryTypes.includes(type), state.supportedEntryTypes, type));
    out.assertions.push(assertion(`${label}: performance observers installed`, state.observerErrors.length === 0, state.observerErrors, []));
    out.assertions.push(assertion(`${label}: fetched modules use one URL per path`, observation.network.moduleURLCollisions.length === 0, observation.network.moduleURLCollisions, []));
    out.assertions.push(assertion(`${label}: critical module graph uses one URL per path`, graph.aliases.length === 0, graph.aliases, [], 'Static module identities include URL fragments that are absent from HTTP request URLs.'));
    out.assertions.push(assertion(`${label}: cold responses bypass cache and service workers`, network.resources.every(row => !row.fromDiskCache && !row.fromServiceWorker), network.resources.filter(row => row.fromDiskCache || row.fromServiceWorker), []));
  } catch (error) {
    out.assertions.push(assertion(`${label}: performance measurement completes`, false, error.stack || String(error), 'complete measurement'));
    if (network) observation.network ??= summarizeNetwork(network.resources);
  } finally {
    network?.stop();
    await session?.detach().catch(() => {});
    await context?.close();
    if (errors) { observation.telemetry = errors.events; out.assertions.push(...assertPerfTelemetry(errors.events, label)); errors.detach(); }
  }
}

export async function perf(env) {
  const variables = env.env ?? process.env, recordOnly = variables.QA_PERF_RECORD === '1';
  const budgetPath = path.resolve(env.root ?? ROOT, variables.QA_PERF_BASELINE || 'tools/qa/perf-budgets.json');
  const out = { assertions: [], observations: { cases: [], budget: { mode: recordOnly ? 'record' : 'gate', path: budgetPath, override: Boolean(variables.QA_PERF_BASELINE), timingGates: false } }, skipped: [] };
  let budgets;
  if (!recordOnly) {
    try { budgets = JSON.parse(await readFile(budgetPath, 'utf8')); }
    catch (error) {
      out.assertions.push(assertion('performance budget file available', false, error.message, budgetPath, 'Use QA_PERF_RECORD=1 only to record a baseline, then commit budgets generated with makeBudgets(perfReport). QA_PERF_BASELINE selects an alternate budget file.'));
      return out;
    }
  }
  for (const profileName of Object.keys(PROFILES)) for (const route of ROUTES) {
    env.progress?.(`measuring ${route} ${profileName}`);
    await measureRoute(env, route, profileName, out);
  }
  if (recordOnly) out.observations.budget.note = 'Explicit recording mode: budget comparisons omitted; readiness, observer support, network completeness and module URL identity assertions remain active.';
  else out.assertions.push(...assertBudgets(out.observations.cases, budgets, { base: env.base }));
  return out;
}
