import test from 'node:test';
import assert from 'node:assert/strict';
import { RESILIENCE_CHECKS, IPHONE, expectedTarget, expectedChip, expectedFailureEvent, readableDate, seedDeadlines, webkit } from './checks-resilience.mjs';
import * as noScriptPolicy from './checks-resilience.mjs';

function nativeOperationFixture(browserName = 'chromium', gpu = false, registered = true) {
  const context = {}, observation = {}, listeners = new Map(), frame = { url: () => page.url() };
  const page = { context: () => context, url: () => 'https://guide.test/cen100/?motion=off', mainFrame: () => frame,
    on(type, fn) { const callbacks = listeners.get(type) ?? new Set();callbacks.add(fn);listeners.set(type, callbacks); },
    off(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type, argument) { for (const fn of [...(listeners.get(type) ?? [])]) fn(argument); } };
  const telemetry = [{ type: 'requestfailed', message: 'retained evidence' }];
  if (registered) noScriptPolicy.registerResilienceReadinessScope(context, { browser: { browserType: () => ({ name: () => browserName }) }, gpu, observation, telemetry: () => telemetry }).registerPage(page);
  return { page, frame, observation, listeners, telemetry };
}

test('cross-tab Mark and Undo retain native evaluation, locator strictness and the selected per-call limit', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceInteraction, 'function');
  for (const [browserName, gpu, registered, timeout] of [['chromium', false, true, 30_000], ['chromium', true, true, 10_000], ['webkit', false, true, 10_000], [null, false, false, 10_000]]) {
    const { page, observation } = nativeOperationFixture(browserName, gpu, registered);const calls = [];let clicks = 0;
    page.locator = selector => {
      const target = first => ({ evaluate: async (fn, arg, options) => { calls.push({ selector, first, arg, options });fn({ click() { clicks++; } }); } });
      return { ...target(false), first: () => target(true) };
    };
    for (const [name, selector, first] of [['Mark done', '[data-quick-complete]', true], ['Undo', '#undo-complete', false]]) {
      const trace = await noScriptPolicy.performResilienceInteraction(page, { name, selector, method: 'evaluate-click', first });
      assert.deepEqual(calls.at(-1), { selector, first, arg: undefined, options: { timeout } });
      assert.equal(trace.status, 'activated');assert.equal(trace.timeoutMs, timeout);assert.equal(trace.sourceURL, page.url());
      assert.equal(trace.policy.browserName, registered ? browserName : null);
      assert.equal(trace.policy.gpu, registered ? gpu : null);
    }
    assert.equal(clicks, 2);if (registered) assert.equal(observation.interactionActions.length, 2);
  }
});

test('cross-tab section actions preserve physical hit-testing and native selectOption arguments', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceInteraction, 'function');
  for (const [browserName, gpu, timeout] of [['chromium', false, 30_000], ['chromium', true, 10_000], ['webkit', false, 10_000]]) {
    const { page, observation } = nativeOperationFixture(browserName, gpu);const calls = [];
    page.locator = selector => ({ first() { assert.fail('section actions retain strict locators'); }, click: async options => calls.push({ method: 'click', selector, options }), selectOption: async (value, options) => calls.push({ method: 'selectOption', selector, value, options }) });
    await noScriptPolicy.performResilienceInteraction(page, { name: 'open section', selector: '.workspace-section', method: 'click' });
    for (const value of ['32', '31']) await noScriptPolicy.performResilienceInteraction(page, { name: 'select section', selector: '#section-select', method: 'selectOption', value });
    assert.deepEqual(calls, [{ method: 'click', selector: '.workspace-section', options: { timeout } }, ...['32', '31'].map(value => ({ method: 'selectOption', selector: '#section-select', value, options: { timeout } }))]);
    assert.equal(observation.interactionActions.length, 3);assert.ok(observation.interactionActions.every(trace => trace.status === 'activated' && trace.first === false));
    assert.deepEqual(observation.interactionActions.slice(1).map(trace => trace.value), ['32', '31']);
    assert.deepEqual(observation.routeActions, []);assert.deepEqual(observation.readiness, []);
  }
});

test('cross-tab missing controls still fail and retain Node evidence when passive diagnostics fail', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceInteraction, 'function');
  const { page, observation, telemetry } = nativeOperationFixture();const error = Error('locator.evaluate: missing Mark done button');let time = 0;
  page.emit('request', { url: () => 'https://guide.test/pending.mjs', method: () => 'GET', resourceType: () => 'script' });
  page.locator = () => ({ first: () => ({ evaluate: async (_fn, _arg, options) => { time += options.timeout;throw error; } }) });
  await assert.rejects(noScriptPolicy.performResilienceInteraction(page, { name: 'Mark done', selector: '[data-quick-complete]', method: 'evaluate-click', first: true }, { now: () => time, snapshot: async () => { throw Error('snapshot unavailable'); } }), candidate => candidate === error);
  const trace = observation.interactionActions[0];assert.equal(trace.status, 'error');assert.equal(trace.elapsedMs, 30_000);assert.equal(trace.error, error.message);assert.equal(trace.snapshotError, 'snapshot unavailable');
  assert.equal(trace.failureNetwork.pendingRequests[0].url, 'https://guide.test/pending.mjs');assert.deepEqual(trace.failureNetwork.telemetry, telemetry);
});

test('native-operation diagnostics have a virtual five-second bound and clear their timer on every outcome', async () => {
  assert.equal(typeof noScriptPolicy.boundedResilienceDiagnostic, 'function');
  let fire, limit, cleared = 0;
  const options = { setTimer(fn, ms) { fire = fn;limit = ms;return 17; }, clearTimer(timer) { assert.equal(timer, 17);cleared++; } };
  assert.equal(await noScriptPolicy.boundedResilienceDiagnostic(async () => 'snapshot', options), 'snapshot');assert.equal(limit, 5000);assert.equal(cleared, 1);
  const error = Error('snapshot rejected');await assert.rejects(noScriptPolicy.boundedResilienceDiagnostic(() => Promise.reject(error), options), candidate => candidate === error);assert.equal(cleared, 2);
  const pending = noScriptPolicy.boundedResilienceDiagnostic(() => new Promise(() => {}), options);fire();
  await assert.rejects(pending, /snapshot exceeded 5000ms/);assert.equal(cleared, 3);
});

test('native-operation diagnostic timeout preserves the original action error and its selected limit', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceInteraction, 'function');
  const { page, observation } = nativeOperationFixture();const error = Error('native action timeout');let time = 0, cleared = false;
  page.locator = () => ({ evaluate: async (_fn, _arg, options) => { time += options.timeout;throw error; } });
  await assert.rejects(noScriptPolicy.performResilienceInteraction(page, { name: 'Undo', selector: '#undo-complete', method: 'evaluate-click' }, {
    now: () => time, snapshot: () => new Promise(() => {}), setTimer(fn, ms) { assert.equal(ms, 5000);queueMicrotask(() => { time += ms;fn(); });return 1; }, clearTimer(timer) { assert.equal(timer, 1);cleared = true; }
  }), candidate => candidate === error);
  const trace = observation.interactionActions[0];assert.equal(trace.status, 'error');assert.equal(trace.timeoutMs, 30_000);assert.equal(trace.elapsedMs, 30_000);assert.equal(trace.diagnosticElapsedMs, 5000);assert.match(trace.snapshotError, /5000ms/);assert.equal(cleared, true);
});

test('native-operation failures survive throwing Node telemetry and diagnostic timer setup', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceInteraction, 'function');
  for (const telemetryError of [Error('Node telemetry unavailable'), null, undefined]) for (const timerThrows of [false, true]) {
    const context = {}, observation = {}, error = Error('native Undo action failed');
    noScriptPolicy.registerResilienceReadinessScope(context, { browser: { browserType: () => ({ name: () => 'chromium' }) }, gpu: false, observation, telemetry() { throw telemetryError; } });
    const page = { context: () => context, locator: () => ({ evaluate: async () => { throw error; } }) };
    await assert.rejects(noScriptPolicy.performResilienceInteraction(page, { name: 'Undo', selector: '#undo-complete', method: 'evaluate-click' }, {
      snapshot: async () => ({ targetPresent: false }), ...(timerThrows ? { setTimer() { throw Error('diagnostic timer setup failed'); }, clearTimer() {} } : {})
    }), candidate => candidate === error);
    const trace = observation.interactionActions[0];assert.equal(trace.status, 'error');assert.equal(trace.error, error.message);
    assert.deepEqual(trace.failureNetwork, { pendingRequests: [], telemetry: [], errors: [{ source: 'telemetry', message: telemetryError?.message ?? String(telemetryError) }] });
    if (timerThrows) assert.equal(trace.snapshotError, 'diagnostic timer setup failed');else assert.equal(trace.failureSnapshot.targetPresent, false);
  }
});

test('BFCache parking retains load and native Back retains commit under only the selected call budget', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceNavigation, 'function');
  for (const [browserName, gpu, registered, timeout] of [['chromium', false, true, 30_000], ['chromium', true, true, 10_000], ['webkit', false, true, 10_000], [null, false, false, 10_000]]) {
    const { page, observation, listeners } = nativeOperationFixture(browserName, gpu, registered);const calls = [], parking = 'https://guide.test/privacy.html', returning = page.url();
    page.goto = async (target, options) => { calls.push({ method: 'goto', target, options });page.url = () => target;return { url: () => target, status: () => 200 }; };
    page.goBack = async options => { calls.push({ method: 'goBack', options });page.url = () => returning;return null; };
    const park = await noScriptPolicy.performResilienceNavigation(page, { name: 'BFCache park', method: 'goto', targetURL: parking });
    const back = await noScriptPolicy.performResilienceNavigation(page, { name: 'BFCache Back', method: 'goBack', targetURL: returning });
    assert.deepEqual(calls, [{ method: 'goto', target: parking, options: { waitUntil: 'load', timeout } }, { method: 'goBack', options: { waitUntil: 'commit', timeout } }]);
    assert.equal(park.status, 'navigated');assert.deepEqual(park.response, { url: parking, status: 200 });assert.equal(back.status, 'navigated');assert.equal(back.response, null, 'a cached native Back can return no HTTP response');
    assert.equal(back.resultURL, returning);assert.equal(back.sourceURL, parking);assert.equal(back.timeoutMs, timeout);
    if (registered) { assert.equal(observation.navigations.length, 2);assert.deepEqual(observation.readiness, []);assert.deepEqual(observation.routeActions, []); }
    for (const callbacks of listeners.values()) assert.ok(callbacks.size <= 1, 'temporary navigation listeners are removed');
  }
});

test('BFCache passive native navigation records main-frame milestones and detaches its temporary listeners', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceNavigation, 'function');
  const { page, frame, observation, listeners } = nativeOperationFixture();let time = 0;const targetURL = 'https://guide.test/privacy.html';
  const documentRequest = { isNavigationRequest: () => true, frame: () => frame, url: () => targetURL, method: () => 'GET', resourceType: () => 'document' }, childRequest = { ...documentRequest, frame: () => ({}) };
  page.goto = async () => {
    page.emit('request', childRequest);time = 2;page.emit('request', documentRequest);
    time = 4;page.emit('response', { request: () => documentRequest, url: () => targetURL, status: () => 200 });
    page.url = () => targetURL;time = 6;page.emit('framenavigated', frame);time = 8;page.emit('domcontentloaded');time = 10;page.emit('requestfinished', documentRequest);time = 12;page.emit('load');return null;
  };
  const trace = await noScriptPolicy.performResilienceNavigation(page, { name: 'BFCache park', method: 'goto', targetURL }, { now: () => time });
  assert.deepEqual(trace.events.map(event => [event.type, event.elapsedMs]), [['request', 2], ['response', 4], ['commit', 6], ['domcontentloaded', 8], ['requestfinished', 10], ['load', 12]]);
  assert.ok(trace.events.every(event => event.phase === 'operation' && event.url === targetURL));assert.equal(trace.elapsedMs, 12);assert.equal(trace.droppedEvents, 0);
  assert.equal(observation.navigations[0], trace);assert.equal(listeners.get('request').size, 1, 'only the existing pending-request observer remains');
  for (const type of ['response', 'framenavigated', 'load', 'close']) assert.equal(listeners.get(type).size, 0);
});

test('BFCache navigation failure remains a failure while late native events and passive state are diagnostic only', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceNavigation, 'function');
  const { page, frame, observation, listeners } = nativeOperationFixture();const error = Error('page.goto: privacy load timeout');let time = 0, attempts = 0;const targetURL = 'https://guide.test/privacy.html';
  const request = { isNavigationRequest: () => true, frame: () => frame, url: () => targetURL, method: () => 'GET', resourceType: () => 'document' };
  page.goto = async (_url, options) => { attempts++;page.emit('request', request);time += options.timeout;throw error; };
  await assert.rejects(noScriptPolicy.performResilienceNavigation(page, { name: 'BFCache park', method: 'goto', targetURL }, { now: () => time, snapshot: async () => { time += 25;page.url = () => targetURL;page.emit('load');return { url: targetURL, readyState: 'complete' }; } }), candidate => candidate === error);
  const trace = observation.navigations[0];assert.equal(attempts, 1);assert.equal(trace.status, 'error');assert.equal(trace.elapsedMs, 30_000);assert.equal(trace.diagnosticElapsedMs, 25);assert.equal(trace.error, error.message);
  assert.equal(trace.failureNetwork.pendingRequests[0].url, targetURL);assert.equal(trace.failureSnapshot.readyState, 'complete');assert.equal(trace.events.at(-1).phase, 'diagnostic');assert.equal(trace.events.at(-1).elapsedMs, 30_025);
  assert.equal(listeners.get('load').size, 0);assert.equal(listeners.get('request').size, 1);
});

test('BFCache passive native navigation traces are bounded without suppressing the operation result', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceNavigation, 'function');
  const { page } = nativeOperationFixture();page.goBack = async () => { for (let i = 0; i < 105; i++) page.emit('load');return null; };
  const trace = await noScriptPolicy.performResilienceNavigation(page, { name: 'BFCache Back', method: 'goBack', targetURL: page.url() });
  assert.equal(trace.status, 'navigated');assert.equal(trace.events.length, 100);assert.equal(trace.droppedEvents, 5);
});

test('BFCache Back rejection preserves its original error and detaches listeners after a stalled diagnostic', async () => {
  assert.equal(typeof noScriptPolicy.performResilienceNavigation, 'function');
  const { page, observation, listeners } = nativeOperationFixture();const error = Error('page.goBack: native commit timeout');let time = 0, cleared = false;
  page.goBack = async options => { assert.deepEqual(options, { waitUntil: 'commit', timeout: 30_000 });time += options.timeout;throw error; };
  await assert.rejects(noScriptPolicy.performResilienceNavigation(page, { name: 'BFCache Back', method: 'goBack', targetURL: page.url() }, {
    now: () => time, snapshot: () => new Promise(() => {}), setTimer(fn, ms) { assert.equal(ms, 5000);queueMicrotask(() => { time += ms;fn(); });return 1; }, clearTimer(timer) { assert.equal(timer, 1);cleared = true; }
  }), candidate => candidate === error);
  const trace = observation.navigations[0];assert.equal(trace.status, 'error');assert.equal(trace.error, error.message);assert.equal(trace.elapsedMs, 30_000);assert.equal(trace.diagnosticElapsedMs, 5000);assert.match(trace.snapshotError, /5000ms/);assert.equal(cleared, true);
  for (const type of ['response', 'framenavigated', 'load', 'close']) assert.equal(listeners.get(type).size, 0);
  assert.equal(listeners.get('request').size, 1);
});

test('only explicit Chromium software-rendering resilience cases receive a 30-second readiness budget', () => {
  const timeout = options => noScriptPolicy.resilienceReadyTimeout?.(options) ?? 10_000;
  assert.equal(timeout({ browserName: 'chromium', gpu: false }), 30_000);
  for (const options of [{ browserName: 'chromium', gpu: true }, { browserName: 'chromium', gpu: null }, { browserName: 'chromium', gpu: 0 }, { browserName: 'chromium', gpu: 'false' }, { browserName: 'chromium' }, { browserName: 'webkit', gpu: false }, { browserName: 'firefox', gpu: false }, { gpu: false }, {}]) assert.equal(timeout(options), 10_000);
});

test('registered resilience context metadata follows browser proxies and auxiliary pages; unknown pages stay strict', () => {
  assert.equal(typeof noScriptPolicy.registerResilienceReadinessScope, 'function');
  assert.equal(typeof noScriptPolicy.resilienceReadinessForPage, 'function');
  const native = { browserType() { return { name: () => 'chromium' }; } }, browser = new Proxy(native, { get(target, key) { const value = target[key]; return typeof value === 'function' ? value.bind(target) : value; } });
  const context = {}, observation = {}, scope = noScriptPolicy.registerResilienceReadinessScope(context, { browser, gpu: false, observation });
  const page = {};scope.registerPage(page);
  for (const registered of [page, { context: () => context }]) assert.equal(noScriptPolicy.resilienceReadinessForPage(registered).timeoutMs, 30_000);
  for (const unknown of [{}, { context: () => ({}) }, { context() { throw Error('unavailable context'); } }]) assert.equal(noScriptPolicy.resilienceReadinessForPage(unknown).timeoutMs, 10_000);
  assert.equal(observation.readinessPolicy.browserName, 'chromium');assert.equal(observation.readinessPolicy.timeoutMs, 30_000);
  const webkitContext = {};noScriptPolicy.registerResilienceReadinessScope(webkitContext, { browser: { browserType: () => ({ name: () => 'webkit' }) }, gpu: false, observation: {} });
  assert.equal(noScriptPolicy.resilienceReadinessForPage({ context: () => webkitContext }).timeoutMs, 10_000);
  for (const browser of [{}, { browserType() { throw Error('unavailable browser'); } }]) {
    const context = {};noScriptPolicy.registerResilienceReadinessScope(context, { browser, gpu: false, observation: {} });
    assert.equal(noScriptPolicy.resilienceReadinessForPage({ context: () => context }).timeoutMs, 10_000);
  }
});

function virtualReadiness({ timeoutMs, lateFirstReply = false, neverReady = false }) {
  let time = 0, calls = 0;
  const first = { ready: false, components: { bodyIdentity: true, routerIdentity: true, completedMarker: false, renderedMainText: true, deadlineNode: false } };
  const last = { ready: true, components: { bodyIdentity: true, routerIdentity: true, completedMarker: true, renderedMainText: true, deadlineNode: true } };
  const observation = {};
  return { observation, run: () => noScriptPolicy.waitForResilienceReady({ timeoutMs, observation, label: 'virtual route', now: () => time, pause: async ms => { time += ms; }, sample: async () => { calls++; if (lateFirstReply) time += calls === 1 ? 14_000 : 50; return neverReady || calls === 1 ? first : last; } }) };
}

test('a late first false browser reply can settle under software readiness allowance while the original budget fails', async () => {
  assert.equal(typeof noScriptPolicy.waitForResilienceReady, 'function');
  const software = virtualReadiness({ timeoutMs: 30_000, lateFirstReply: true });
  await software.run();
  assert.equal(software.observation.status, 'ready');assert.equal(software.observation.elapsedMs, 14_100);assert.equal(software.observation.maxBrowserReplyMs, 14_000);
  assert.equal(software.observation.firstSample.state.components.completedMarker, false);assert.equal(software.observation.lastSample.state.components.completedMarker, true);
  const original = virtualReadiness({ timeoutMs: 10_000, lateFirstReply: true });
  await assert.rejects(original.run(), /Timed out waiting for virtual route/);
  assert.equal(original.observation.status, 'timeout');assert.equal(original.observation.sampleCount, 1);assert.equal(original.observation.elapsedMs, 14_000);
});

test('a never-ready route still rejects at the 30-second software budget', async () => {
  assert.equal(typeof noScriptPolicy.waitForResilienceReady, 'function');
  const fixture = virtualReadiness({ timeoutMs: 30_000, neverReady: true });
  await assert.rejects(fixture.run(), /Timed out waiting for virtual route/);
  assert.equal(fixture.observation.status, 'timeout');assert.equal(fixture.observation.elapsedMs, 30_000);
  assert.equal(fixture.observation.lastSample.state.components.deadlineNode, false);
});

test('readiness diagnostics retain a failed native reply duration and the original error', async () => {
  let time = 0;const error = Error('native execution disconnected'), observation = {};
  await assert.rejects(noScriptPolicy.waitForResilienceReady({ sample: async () => { time = 14_000;throw error; }, label: 'native reply', timeoutMs: 30_000, observation, now: () => time, pause: async () => {} }), candidate => candidate === error);
  assert.equal(observation.status, 'error');assert.equal(observation.elapsedMs, 14_000);assert.equal(observation.maxBrowserReplyMs, 14_000);assert.equal(observation.error, error.message);
});

test('native route anchor evaluation forwards only the selected explicit software action allowance', async () => {
  assert.equal(typeof noScriptPolicy.activateResilienceRoute, 'function');
  for (const [browserName, gpu, timeout] of [['chromium', false, 30_000], ['chromium', true, 10_000], ['webkit', false, 10_000], [null, false, 10_000]]) {
    const context = {}, observation = {};noScriptPolicy.registerResilienceReadinessScope(context, { browser: { browserType: () => ({ name: () => browserName }) }, gpu, observation });
    let forwarded, activations = 0;
    const page = { context: () => context, locator(selector) { return { first: () => ({ evaluate: async (fn, arg, options) => { forwarded = { selector, arg, options };fn({ click() { activations++; } }); } }) }; } };
    await noScriptPolicy.activateResilienceRoute(page, 'mth141');
    assert.deepEqual(forwarded, { selector: '[data-course-link="mth141"]', arg: undefined, options: { timeout } });
    assert.equal(activations, 1);assert.equal(observation.routeActions[0].status, 'activated');assert.equal(observation.routeActions[0].timeoutMs, timeout);
  }
});

test('an absent route anchor still rejects at the selected limit and retains its passive failure evidence', async () => {
  assert.equal(typeof noScriptPolicy.activateResilienceRoute, 'function');
  const context = {}, observation = {}, error = Error('locator.evaluate: route anchor missing');let time = 0;
  noScriptPolicy.registerResilienceReadinessScope(context, { browser: { browserType: () => ({ name: () => 'chromium' }) }, gpu: false, observation });
  const page = { context: () => context, locator() { return { first: () => ({ evaluate: async (_fn, _arg, options) => { time += options.timeout;throw error; } }) }; } };
  await assert.rejects(noScriptPolicy.activateResilienceRoute(page, 'mth141', { now: () => time, snapshot: async () => ({ targetPresent: false, courseLinks: [] }) }), candidate => candidate === error);
  const trace = observation.routeActions[0];assert.equal(trace.status, 'error');assert.equal(trace.timeoutMs, 30_000);assert.equal(trace.elapsedMs, 30_000);assert.equal(trace.failureSnapshot.targetPresent, false);assert.equal(trace.error, error.message);
});

test('a blocked passive browser snapshot preserves Node request/error evidence and the original action failure', async () => {
  const context = {}, observation = {}, error = Error('native action failed'), telemetry = [{ type: 'requestfailed', message: 'observed diagnostic' }], handlers = {};
  const scope = noScriptPolicy.registerResilienceReadinessScope(context, { browser: { browserType: () => ({ name: () => 'chromium' }) }, gpu: false, observation, telemetry: () => telemetry });
  const page = { context: () => context, on(type, callback) { handlers[type] = callback; }, locator() { return { first: () => ({ evaluate: async () => { throw error; } }) }; } };
  scope.registerPage(page);handlers.request({ url: () => 'https://guide.test/pending.mjs', method: () => 'GET', resourceType: () => 'script' });
  await assert.rejects(noScriptPolicy.activateResilienceRoute(page, 'mth141', { snapshot: async () => { throw Error('snapshot unavailable'); } }), candidate => candidate === error);
  const trace = observation.routeActions[0];assert.equal(trace.snapshotError, 'snapshot unavailable');assert.ok(trace.failureNetwork, 'Node evidence remains available when the browser reply is blocked');assert.equal(trace.failureNetwork.pendingRequests[0].url, 'https://guide.test/pending.mjs');assert.deepEqual(trace.failureNetwork.telemetry, telemetry);
});

const noScriptPreloadExpected = (event, policy) => noScriptPolicy.expectedNoScriptPreloadEvent?.(event, policy) ?? false;
function disabledModuleFixture(base = '/') {
  const documentURL = 'http://127.0.0.1:3000' + base + 'mth140/', target = new URL('../assets/app/router.mjs?v=exact', documentURL).href;
  return { event: { type: 'requestfailed', requestUrl: target, method: 'GET', message: 'csp' }, policy: { javaScriptEnabled: false, documentURL, declaredPreloads: [target], requests: [{ url: target, method: 'GET', resourceType: 'script' }], cspPolicies: ["default-src 'self'; script-src 'self' 'unsafe-inline'"] } };
}

test('explicitly disabled scripts classify only the exact declared same-origin modulepreload policy failure', () => {
  for (const base of ['/', '/tmu-course-guides/']) {
    const { event, policy } = disabledModuleFixture(base);
    assert.equal(noScriptPreloadExpected(event, policy), true);
    assert.equal(noScriptPreloadExpected(event, { ...policy, cspPolicies: [] }), true, 'disabled scripts are a native policy even without authored CSP');
  }
});

test('no-JS policy classification rejects enabled scripts, real CSP restrictions and other error types', () => {
  const { event, policy } = disabledModuleFixture();
  for (const javaScriptEnabled of [true, undefined]) assert.equal(noScriptPreloadExpected(event, { ...policy, javaScriptEnabled }), false);
  for (const csp of ["script-src 'none'", "default-src 'none'", "script-src 'self'; script-src-elem 'none'", "script-src 'self' 'nonce-proof' 'strict-dynamic'", "script-src 'self'; sandbox allow-same-origin", "script-src 'self'; img-src 'self', script-src 'none'"]) assert.equal(noScriptPreloadExpected(event, { ...policy, cspPolicies: [csp] }), false, csp);
  for (const type of ['console', 'pageerror', 'http']) assert.equal(noScriptPreloadExpected({ ...event, type }, policy), false, type);
  for (const message of ['net::ERR_FAILED', 'CSP', 'Refused to load script because it violates Content Security Policy']) assert.equal(noScriptPreloadExpected({ ...event, message }, policy), false, message);
  assert.equal(noScriptPreloadExpected({ ...event, method: 'POST' }, policy), false);
});

test('no-JS classification binds the exact versioned URL to an observed Script request', () => {
  const { event, policy } = disabledModuleFixture('/tmu-course-guides/');
  for (const requestUrl of [event.requestUrl.replace('v=exact', 'v=other'), event.requestUrl.split('?')[0], event.requestUrl.replace('router.mjs', 'unknown.mjs')]) assert.equal(noScriptPreloadExpected({ ...event, requestUrl }, policy), false, requestUrl);
  for (const resourceType of ['font', 'stylesheet', 'image']) assert.equal(noScriptPreloadExpected(event, { ...policy, requests: [{ ...policy.requests[0], resourceType }] }), false, resourceType);
  assert.equal(noScriptPreloadExpected(event, { ...policy, declaredPreloads: [] }), false);
  assert.equal(noScriptPreloadExpected(event, { ...policy, requests: [] }), false);
  assert.equal(noScriptPreloadExpected(event, { ...policy, declaredPreloads: event.requestUrl }), false, 'declarations require measured URL arrays');
  assert.equal(noScriptPreloadExpected(event, { ...policy, cspPolicies: undefined }), false, 'missing header/meta policy evidence is not no-CSP proof');
  assert.equal(noScriptPreloadExpected(event, { ...policy, requests: null }), false);
  for (const target of ['https://external.test/router.mjs?v=exact', new URL('../assets/fonts/archivo-latin.woff2', policy.documentURL).href, new URL('../assets/hub.css', policy.documentURL).href]) {
    const fixture = { ...policy, declaredPreloads: [target], requests: [{ url: target, method: 'GET', resourceType: 'script' }] };
    assert.equal(noScriptPreloadExpected({ ...event, requestUrl: target }, fixture), false, target);
  }
  assert.equal(noScriptPreloadExpected(event, { ...policy, documentURL: 'invalid' }), false);
});

test('resilience checks register all seven names with mobile WebKit dimensions', () => {
  assert.deepEqual(Object.keys(RESILIENCE_CHECKS), ['webkit', 'nojs', 'bfcache', 'failures', 'crosstab', 'clock', 'forward']);
  assert.equal(IPHONE.viewport.width, 390);
  assert.equal(IPHONE.hasTouch, true);
  assert.equal(IPHONE.deviceScaleFactor, 3);
});

test('a missing WebKit binary reports a skip with no passing assertions', async () => {
  const report = await webkit({ playwright: { webkit: { launch: async () => { throw Error('Executable does not exist'); } } } });
  assert.equal(report.assertions.length, 0);
  assert.equal(report.skipped.length, 1);
  assert.match(report.skipped[0].reason, /Executable does not exist/);
});

test('clock oracle uses canonical CEN end-of-day deadlines and advances at Toronto midnight', () => {
  const seed = seedDeadlines('cen100', ['whmis', 'failure'], 1), copy = structuredClone(seed);
  const before = Date.parse('2026-10-15T03:59:30Z'), after = Date.parse('2026-10-15T04:00:30Z');
  const first = expectedTarget('cen100', seed, before), next = expectedTarget('cen100', seed, after);
  assert.equal(first.id, 'whmis');
  assert.equal(first.at, Date.parse('2026-10-15T04:00:00Z'));
  assert.equal(expectedChip(first, before, true), '0m left');
  assert.equal(next.id, 'failure');
  assert.equal(expectedChip(first, after), 'Due time passed');
  assert.deepEqual(seed, copy, 'fixtures are read-only and cannot change product records');
});

test('DST repeated Toronto hour and a backwards jump use elapsed absolute time', () => {
  const seed = seedDeadlines('mth140', ['quiz-3', 'quiz-4'], 31);
  const before = Date.parse('2026-11-01T05:59:30Z'), after = Date.parse('2026-11-01T06:00:30Z');
  const target = expectedTarget('mth140', seed, before);
  assert.equal(target.id, 'quiz-3');
  assert.equal(expectedTarget('mth140', seed, after).at, target.at);
  const near = target.at - 30 * 60_000;
  assert.equal(expectedChip(target, near), '30m');
  assert.equal(expectedChip(target, near - 60 * 60_000), '1h 30m');
  assert.ok(!expectedChip(target, target.at + 60_000).includes('-'));
});

test('intentional HTTP404 diagnostics allow only that exact request URL', () => {
  const target = 'http://127.0.0.1:3000/tmu-course-guides/cen10o/';
  const fixture = { target, mode: '404' };
  assert.equal(expectedFailureEvent({ type: 'http', requestUrl: target, status: 404 }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: target }, message: 'Failed to load resource: the server responded with a status of 404 (Not Found)' }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'http', requestUrl: target, status: 500 }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'http', requestUrl: target + 'other', status: 404 }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'pageerror', message: 'TypeError in coursework' }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: target }, message: 'Unexpected coursework exception' }, fixture), false);
});

test('machine-only datetime and placeholder text do not count as readable assessment dates', () => {
  const date = '2026-10-23';
  assert.equal(readableDate(date, { datetime: date, text: '' }), false);
  assert.equal(readableDate(date, { datetime: date, text: 'Date placeholder' }), false);
  assert.equal(readableDate(date, { datetime: date, text: 'Oct 24' }), false);
  assert.equal(readableDate(date, { datetime: date, text: 'Fri, Oct 23, 2026' }), true);
  assert.equal(readableDate(date, { datetime: date, text: date }), true);
});

test('offline injection allows only exact previously warmed URL diagnostics', () => {
  const resource = 'http://127.0.0.1:3000/assets/scenes/posters/mth140-wide.webp?v=one';
  const fixture = { mode: 'offline', offlineURLs: new Set([resource]) };
  assert.equal(expectedFailureEvent({ type: 'requestfailed', requestUrl: resource, message: 'net::ERR_INTERNET_DISCONNECTED' }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: resource }, message: 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED' }, fixture), true);
  assert.equal(expectedFailureEvent({ type: 'requestfailed', requestUrl: resource + 'other', message: 'net::ERR_INTERNET_DISCONNECTED' }, fixture), false);
  assert.equal(expectedFailureEvent({ type: 'console', location: { url: resource }, message: 'Unexpected exception' }, fixture), false);
});
