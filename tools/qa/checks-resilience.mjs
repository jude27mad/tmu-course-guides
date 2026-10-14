import { SCHEDULE } from '../../assets/cen-schedule.mjs';
import { COURSES } from '../../assets/course-data.mjs';
import { compact, overall, parts, readSaved, resolveTarget } from '../../assets/night/targets.mjs';
import { CHECKS, ROUTES } from './checks.mjs';
import { collectPageErrors } from './runtime.mjs';

const data = course => course === 'cen100' ? SCHEDULE : COURSES[course];
const url = (env, route, tail = '') => env.origin + env.base + (route === 'desk' ? '' : route + '/') + tail;
const result = () => ({ assertions: [], observations: { cases: [] }, skipped: [] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assertion = (out, name, pass, actual, expected) => out.assertions.push({ name, pass: Boolean(pass), actual, expected });

export const IPHONE = Object.freeze({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

export function seedDeadlines(course, unfinished, section = 0) {
  const seed = {};
  for (const id of ROUTES.slice(1)) {
    const records = id === 'cen100' ? SCHEDULE.filter(row => row.calendar !== false) : COURSES[id].assessments;
    const completed = Object.fromEntries(records.filter(row => id !== course || !unfinished.includes(row.id)).map(row => [row.id, true]));
    seed[id === 'cen100' ? 'cen100-personal-plan-v1' : id + '-progress-v1'] = { completed, notes: {}, targets: {}, checks: {}, topics: {} };
  }
  if (section) seed[course === 'cen100' ? 'cen100-contact-choice-v1' : course + '-section-v1'] = course === 'cen100' ? { section, group: 1 } : section;
  return seed;
}

export function expectedTarget(course, seed, now) {
  const storage = { getItem: key => seed[key] === undefined ? null : typeof seed[key] === 'string' ? seed[key] : JSON.stringify(seed[key]) };
  return resolveTarget({ course, data: data(course), ...readSaved(course, data(course), storage), now });
}

export function expectedChip(target, now, desk = false) {
  const chip = compact(target, now);
  return desk && target.precision === 'exact' && parts(target, now).ms > 0 ? chip + ' left' : chip;
}

export function readableDate(date, authored) {
  if (authored.datetime !== date || !authored.text?.trim()) return false;
  if (authored.text.includes(date)) return true;
  const formatted = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  const [month, day] = formatted.split(' ');
  return new RegExp(`\\b${month}[,.]?\\s+${day}\\b`, 'i').test(authored.text);
}

export function expectedFailureEvent(event, { target, mode, offlineURLs = new Set() }) {
  // Each allowlist is limited to the URL and diagnostic deliberately injected by this case.
  if (mode === '404') return (event.requestUrl || event.location?.url) === target && (event.type === 'http' && event.status === 404 || event.type === 'console' && /^Failed to load resource: the server responded with a status of 404/.test(event.message));
  if (mode === 'offline') return ['requestfailed', 'console'].includes(event.type) && offlineURLs.has(event.requestUrl || event.location?.url) && /ERR_INTERNET_DISCONNECTED|NS_ERROR_OFFLINE|Internet connection appears to be offline/.test(event.message);
  return false; // Synthetic fetch responses/rejections should produce no browser errors.
}

function cspAllowsSelfScript(policy) {
  if (typeof policy !== 'string') return false;
  if (policy.includes(',')) return policy.split(',').every(cspAllowsSelfScript);
  const directives = new Map();
  for (const directive of policy.split(';')) {
    const [name, ...sources] = directive.trim().toLowerCase().split(/\s+/);
    if (name && !directives.has(name)) directives.set(name, sources);
  }
  // Sandbox may introduce script or opaque-origin restrictions; none is authored here.
  if (directives.has('sandbox')) return false;
  const sources = directives.get('script-src-elem') ?? directives.get('script-src') ?? directives.get('default-src');
  return !sources || sources.includes("'self'") && !sources.includes("'none'") && !sources.includes("'strict-dynamic'");
}

/** Chromium also reports its explicit script-disabled policy as exact `csp`.
 * Bind that diagnostic to authored hints and observed Script requests; actual
 * CSP restrictions and every enabled-JavaScript case remain unexpected. */
export function expectedNoScriptPreloadEvent(event, { javaScriptEnabled, documentURL, declaredPreloads, requests, cspPolicies } = {}) {
  if (javaScriptEnabled !== false || event?.type !== 'requestfailed' || event.method !== 'GET' || event.message !== 'csp' || typeof event.requestUrl !== 'string') return false;
  if (!Array.isArray(declaredPreloads) || !Array.isArray(requests) || !Array.isArray(cspPolicies) || !cspPolicies.every(cspAllowsSelfScript) || !declaredPreloads.includes(event.requestUrl)) return false;
  if (!requests.some(request => request?.url === event.requestUrl && request.method === 'GET' && request.resourceType === 'script')) return false;
  try {
    const target = new URL(event.requestUrl), document = new URL(documentURL);
    return /^https?:$/.test(target.protocol) && target.origin === document.origin && !target.hash && /\.(?:mjs|js)$/i.test(target.pathname);
  } catch { return false; }
}

async function until(fn, label, timeout = 10_000) {
  const end = Date.now() + timeout;
  do { if (await fn()) return; await sleep(50); } while (Date.now() < end);
  throw Error('Timed out waiting for ' + label);
}

export const resilienceReadyTimeout = ({ browserName, gpu } = {}) => browserName === 'chromium' && gpu === false ? 30_000 : 10_000;
const contextReadiness = new WeakMap(), pageReadiness = new WeakMap();
const defaultReadiness = Object.freeze({ browserName: null, gpu: null, timeoutMs: 10_000 });
export function registerResilienceReadinessScope(context, { browser, gpu, observation, telemetry = () => [] }) {
  let browserName = null;
  try { browserName = browser.browserType?.()?.name?.() ?? null; } catch {}
  const policy = Object.freeze({ browserName, gpu: gpu ?? null, timeoutMs: resilienceReadyTimeout({ browserName, gpu }) });
  observation.readinessPolicy = policy;observation.readiness = [];observation.routeActions = [];observation.interactionActions = [];observation.navigations = [];
  const pendingByPage = new WeakMap();
  const scope = { policy, waits: observation.readiness, actions: observation.routeActions, interactions: observation.interactionActions, navigations: observation.navigations, telemetry, pending(page) { return [...(pendingByPage.get(page)?.values() ?? [])]; }, registerPage(page) {
    if (pageReadiness.has(page)) return;
    pageReadiness.set(page, scope);const pending = new Map();pendingByPage.set(page, pending);
    page.on?.('request', request => pending.set(request, { url: request.url(), method: request.method(), resourceType: request.resourceType(), startedAt: Date.now() }));
    page.on?.('requestfinished', request => pending.delete(request));page.on?.('requestfailed', request => pending.delete(request));
  } };
  contextReadiness.set(context, scope);
  return scope;
}
function readinessScope(page) {
  const scope = pageReadiness.get(page);if (scope) return scope;
  try { const contextScope = contextReadiness.get(page.context?.());contextScope?.registerPage(page);return contextScope; } catch { return undefined; }
}
export const resilienceReadinessForPage = page => readinessScope(page)?.policy ?? defaultReadiness;

/** The poll budget bounds scheduling; an in-flight native browser reply may
 * overrun it. Preserve do-first/true-result behavior and record that overhead. */
export async function waitForResilienceReady({ sample, label, timeoutMs = 10_000, observation = {}, now = Date.now, pause = sleep }) {
  const started = now(), end = started + timeoutMs;
  Object.assign(observation, { label, timeoutMs, status: 'running', sampleCount: 0, maxBrowserReplyMs: 0, firstSample: null, lastSample: null });
  try {
    do {
      const requested = now();let state, replied;
      try { state = await sample(); }
      finally { replied = now();observation.sampleCount++;observation.maxBrowserReplyMs = Math.max(observation.maxBrowserReplyMs, replied - requested); }
      const replyMs = replied - requested;
      const recorded = { elapsedMs: replied - started, replyMs, state };
      observation.firstSample ??= recorded;observation.lastSample = recorded;
      if (state.ready) { observation.status = 'ready';return observation; }
      if (replied >= end) break;
      await pause(Math.min(50, end - replied));
    } while (now() < end);
    observation.status = 'timeout';throw Error('Timed out waiting for ' + label);
  } catch (error) {
    if (observation.status !== 'timeout') observation.status = 'error';
    observation.error = error.message;throw error;
  } finally { observation.elapsedMs = now() - started; }
}

async function ready(page, route) {
  const scope = readinessScope(page), policy = scope?.policy ?? defaultReadiness, observation = { route, policy };
  scope?.waits.push(observation);
  await waitForResilienceReady({ label: route + ' mounted route and deadlines', timeoutMs: policy.timeoutMs, observation, sample: () => page.evaluate(route => {
    const bodyRoute = document.body.dataset.page || document.body.dataset.course, routerRoute = window.TMURouter?.route, completedRoute = window.__qaRouteCompleted;
    const mainTextLength = document.querySelector('main[data-route-region]')?.innerText.trim().length ?? 0;
    const deadlineNode = Boolean(route === 'desk' ? document.querySelector('[data-course-card="cen100"] [data-desk-next]:not([hidden])') : document.querySelector('.ns-count'));
    const components = { bodyIdentity: bodyRoute === route, routerIdentity: routerRoute === route, completedMarker: completedRoute === route, renderedMainText: mainTextLength > 20, deadlineNode };
    return { ready: Object.values(components).every(Boolean), components, actual: { bodyRoute, routerRoute, completedRoute, mainTextLength, deadlineNode } };
  }, route) });
}

async function initialize(context, env, seed = {}) {
  await context.addInitScript(env.instrument);
  await context.addInitScript(seed => {
    document.addEventListener('route-changed', event => { window.__qaRouteCompleted = event.detail?.route; });
    window.__qaPageshow = [];
    window.__qaStorageEvents = [];
    addEventListener('pageshow', event => window.__qaPageshow.push({ persisted: event.persisted, at: Date.now() }));
    addEventListener('storage', event => window.__qaStorageEvents.push({ key: event.key, oldValue: event.oldValue, newValue: event.newValue, trusted: event.isTrusted }));
    try { for (const [key, value] of Object.entries(seed)) if (localStorage.getItem(key) === null) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch {}
  }, seed);
}

async function runCase(env, out, name, fn, { seed, options, browser = env.browser, init, expected = () => false, fixedTime, clock } = {}) {
  const observation = { name };
  out.observations.cases.push(observation);
  let context;
  const collectors = [];
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Toronto', ...options });
    const readiness = registerResilienceReadinessScope(context, { browser, gpu: env.gpu, observation, telemetry: () => collectors.flatMap(collector => collector.events) });
    await initialize(context, env, seed);
    if (init) await context.addInitScript(init.fn, init.arg);
    const newPage = async () => {
      const page = await context.newPage();
      readiness.registerPage(page);
      page.setDefaultTimeout(10_000);
      collectors.push(collectPageErrors(page, { expected }));
      if (fixedTime) await page.clock.setFixedTime(new Date(fixedTime));
      if (clock) await page.clock.install({ time: new Date(clock) });
      return page;
    };
    await fn(await newPage(), observation, context, newPage);
  } catch (error) {
    assertion(out, name + ': execution', false, error.stack || String(error), 'case completes');
  } finally {
    observation.telemetry = collectors.flatMap(collector => collector.events);
    // Disabled-script requests precede DOM inspection of their declared hints.
    if (options?.javaScriptEnabled === false) for (const event of observation.telemetry) event.expected = Boolean(expected(event));
    assertion(out, name + ': unexpected browser errors', observation.telemetry.every(event => event.expected), observation.telemetry.filter(event => !event.expected), []);
    for (const collector of collectors) collector.detach();
    await context?.close();
  }
}

async function routeActionFailureSnapshot(page, route, scope) {
  let timer;
  try {
    const state = await Promise.race([page.evaluate(route => {
      const main = document.querySelector('main[data-route-region]'), style = main && getComputedStyle(main);
      const target = document.querySelector(`[data-course-link="${route}"]`), courseLinks = [...document.querySelectorAll('[data-course-link]')].map(anchor => ({ course: anchor.dataset.courseLink, href: anchor.href, connected: anchor.isConnected }));
      return { url: location.href, bodyRoute: document.body.dataset.page || document.body.dataset.course, routerRoute: window.TMURouter?.route, completedRoute: window.__qaRouteCompleted, targetPresent: Boolean(target), targetCount: document.querySelectorAll(`[data-course-link="${route}"]`).length, target: target && { href: target.href, connected: target.isConnected, html: target.outerHTML }, courseLinkCount: courseLinks.length, courseLinks, mainTextLength: main?.innerText.trim().length ?? 0, wrapper: style && { opacity: style.opacity, display: style.display, visibility: style.visibility, transform: style.transform, filter: style.filter } };
    }, route), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Passive route-action snapshot exceeded 5000ms')), 5000); })]);
    return { ...state, pendingRequests: scope?.pending(page) ?? [], telemetry: scope?.telemetry() ?? [] };
  } finally { clearTimeout(timer); }
}

export async function activateResilienceRoute(page, route, { now = Date.now, snapshot = routeActionFailureSnapshot } = {}) {
  const scope = readinessScope(page), policy = scope?.policy ?? defaultReadiness, started = now();
  const trace = { route, selector: `[data-course-link="${route}"]`, policy, timeoutMs: policy.timeoutMs, status: 'running' };scope?.actions.push(trace);
  try {
    await page.locator(trace.selector).first().evaluate(anchor => anchor.click(), undefined, { timeout: policy.timeoutMs });
    trace.elapsedMs = now() - started;trace.status = 'activated';return trace;
  } catch (error) {
    trace.elapsedMs = now() - started;trace.status = 'error';trace.error = error.message;
    trace.failureNetwork = { pendingRequests: scope?.pending(page) ?? [], telemetry: scope?.telemetry() ?? [] };
    const diagnosticStarted = now();
    try { trace.failureSnapshot = await snapshot(page, route, scope); } catch (diagnosticError) { trace.snapshotError = diagnosticError.message; }
    trace.diagnosticElapsedMs = now() - diagnosticStarted;throw error;
  }
}

async function clickRoute(page, route) {
  await activateResilienceRoute(page, route);
  await ready(page, route);
}

/** Diagnostics must never turn an operation failure into an unbounded wait. */
export async function boundedResilienceDiagnostic(task, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(task), new Promise((_, reject) => {
      timer = setTimer(() => reject(Error('Passive native-operation snapshot exceeded 5000ms')), 5000);
    })]);
  } finally { clearTimer(timer); }
}

const nativePageURL = page => { try { return page.url?.() ?? null; } catch { return null; } };
async function nativeOperationFailureSnapshot(page, { selector = null, targetURL = null }) {
  return page.evaluate(({ selector, targetURL }) => {
    const main = document.querySelector('main[data-route-region]'), style = main && getComputedStyle(main), target = selector && document.querySelector(selector);
    return { url: location.href, expectedURL: targetURL, readyState: document.readyState, title: document.title, fontsStatus: document.fonts?.status ?? null,
      bodyRoute: document.body?.dataset.page || document.body?.dataset.course, routerRoute: window.TMURouter?.route, completedRoute: window.__qaRouteCompleted,
      mainTextLength: main?.innerText.trim().length ?? 0, wrapper: style && { opacity: style.opacity, display: style.display, visibility: style.visibility, transform: style.transform, filter: style.filter },
      targetPresent: Boolean(target), targetCount: selector ? document.querySelectorAll(selector).length : null, target: target && { tag: target.tagName, href: target.href ?? null, value: target.value ?? null, disabled: target.disabled ?? null, connected: target.isConnected, html: target.outerHTML.slice(0, 1000) },
      dialogs: [...document.querySelectorAll('dialog')].map(dialog => ({ id: dialog.id, open: dialog.open })),
      navigationTiming: performance.getEntriesByType('navigation').map(entry => ({ name: entry.name, type: entry.type, duration: entry.duration, responseStart: entry.responseStart, responseEnd: entry.responseEnd, domContentLoadedEventEnd: entry.domContentLoadedEventEnd, loadEventEnd: entry.loadEventEnd })) };
  }, { selector, targetURL });
}

async function recordNativeOperationFailure(trace, page, scope, error, started, { now, snapshot, setTimer, clearTimer }) {
  trace.elapsedMs = now() - started;trace.status = 'error';trace.error = error?.message ?? String(error);
  // Save Node-side evidence before asking a possibly stalled browser to reply.
  trace.failureNetwork = { pendingRequests: [], telemetry: [] };
  for (const [source, collect] of [['pendingRequests', () => scope?.pending(page) ?? []], ['telemetry', () => scope?.telemetry() ?? []]]) {
    try { trace.failureNetwork[source] = collect(); }
    catch (diagnosticError) { (trace.failureNetwork.errors ??= []).push({ source, message: diagnosticError?.message ?? String(diagnosticError) }); }
  }
  const diagnosticStarted = now();
  try { trace.failureSnapshot = await boundedResilienceDiagnostic(() => snapshot(page, trace), { setTimer, clearTimer }); }
  catch (diagnosticError) { trace.snapshotError = diagnosticError?.message ?? String(diagnosticError); }
  trace.diagnosticElapsedMs = now() - diagnosticStarted;
}

/** Preserve each cross-tab action's native method and locator strictness. */
export async function performResilienceInteraction(page, { name, selector, method, first = false, value }, { now = Date.now, snapshot = nativeOperationFailureSnapshot, setTimer, clearTimer } = {}) {
  if (!['evaluate-click', 'click', 'selectOption'].includes(method)) throw Error('Unsupported resilience interaction: ' + method);
  const scope = readinessScope(page), policy = scope?.policy ?? defaultReadiness, started = now(), options = { timeout: policy.timeoutMs };
  const trace = { name, selector, method, first, ...(method === 'selectOption' ? { value } : {}), sourceURL: nativePageURL(page), policy, options, timeoutMs: policy.timeoutMs, status: 'running' };scope?.interactions.push(trace);
  try {
    const locator = page.locator(selector), target = first ? locator.first() : locator;
    if (method === 'evaluate-click') await target.evaluate(element => element.click(), undefined, options);
    else if (method === 'click') await target.click(options);
    else await target.selectOption(value, options);
    trace.elapsedMs = now() - started;trace.status = 'activated';return trace;
  } catch (error) {
    await recordNativeOperationFailure(trace, page, scope, error, started, { now, snapshot, setTimer, clearTimer });throw error;
  }
}

function observeNativeNavigation(page, trace, started, now) {
  const listeners = [], record = (type, details = {}) => {
    if (trace.events.length >= 100) { trace.droppedEvents++;return; }
    trace.events.push({ type, elapsedMs: now() - started, phase: trace.status === 'error' ? 'diagnostic' : 'operation', ...details });
  };
  const listen = (type, handler) => { page.on?.(type, handler);listeners.push([type, handler]); };
  const mainRequest = request => { try { return request.isNavigationRequest() && request.frame() === page.mainFrame(); } catch { return false; } };
  listen('request', request => { if (mainRequest(request)) record('request', { url: request.url(), method: request.method() }); });
  listen('response', response => { if (mainRequest(response.request())) record('response', { url: response.url(), status: response.status() }); });
  listen('requestfinished', request => { if (mainRequest(request)) record('requestfinished', { url: request.url() }); });
  listen('requestfailed', request => { if (mainRequest(request)) record('requestfailed', { url: request.url(), message: request.failure()?.errorText ?? null }); });
  listen('framenavigated', frame => { if (frame === page.mainFrame()) record('commit', { url: frame.url() }); });
  listen('domcontentloaded', () => record('domcontentloaded', { url: nativePageURL(page) }));
  listen('load', () => record('load', { url: nativePageURL(page) }));
  listen('pageerror', error => record('pageerror', { url: nativePageURL(page), message: error.message }));
  listen('crash', () => record('crash', { url: nativePageURL(page) }));
  listen('close', () => record('close', { url: nativePageURL(page) }));
  return () => { for (const [type, handler] of listeners) page.off?.(type, handler); };
}

/** Only BFCache's parking/Back calls use this per-operation budget. */
export async function performResilienceNavigation(page, { name, method, targetURL }, { now = Date.now, snapshot = nativeOperationFailureSnapshot, setTimer, clearTimer } = {}) {
  if (!['goto', 'goBack'].includes(method)) throw Error('Unsupported resilience navigation: ' + method);
  const scope = readinessScope(page), policy = scope?.policy ?? defaultReadiness, started = now(), options = { waitUntil: method === 'goto' ? 'load' : 'commit', timeout: policy.timeoutMs };
  const trace = { name, method, sourceURL: nativePageURL(page), targetURL, policy, options, timeoutMs: policy.timeoutMs, status: 'running', events: [], droppedEvents: 0 };scope?.navigations.push(trace);
  const detach = observeNativeNavigation(page, trace, started, now);
  try {
    const response = method === 'goto' ? await page.goto(targetURL, options) : await page.goBack(options);
    trace.elapsedMs = now() - started;trace.status = 'navigated';trace.resultURL = nativePageURL(page);trace.response = response ? { url: response.url(), status: response.status() } : null;return trace;
  } catch (error) {
    await recordNativeOperationFailure(trace, page, scope, error, started, { now, snapshot, setTimer, clearTimer });throw error;
  } finally { detach(); }
}

async function snapshot(page, course) {
  return page.evaluate(course => {
    const text = selector => document.querySelector(selector)?.textContent.trim() ?? null;
    const card = course === 'cen100' ? '#nextsign' : '#next-assessment';
    return { route: document.body.dataset.page || document.body.dataset.course, shell: document.documentElement.dataset.shellId, heading: text('main[data-route-region] h1'), content: document.querySelector('main[data-route-region]')?.innerText.trim().length || 0,
      desk: { title: text(`[data-course-card="${course}"] .desk-course-title`), chip: text(`[data-course-card="${course}"] .desk-chip`), when: text(`[data-course-card="${course}"] .desk-course-when`), section: text(`[data-course-card="${course}"] .desk-course-section`), today: text('[data-desk-today]') },
      overall: { title: text('[data-desk-overall] .desk-next-title'), when: text('[data-desk-overall] .desk-count-when'), word: text('[data-desk-overall] .desk-word'), digits: [...document.querySelectorAll('[data-desk-overall] .desk-unit')].map(el => ({ unit: ({days:'d',hrs:'h',min:'m'})[el.querySelector('i')?.textContent.trim()], text: el.querySelector('b')?.textContent })) },
      card: { title: text(course === 'cen100' ? '#nextsign .next-open .t' : '#next-assessment h2'), id: document.querySelector('[data-quick-complete]')?.dataset.quickComplete ?? document.querySelector(card)?.dataset.nextId ?? null, key: document.querySelector('.ns-count')?.dataset.key, when: text('.ns-count-when'), digits: [...document.querySelectorAll('.ns-count [data-unit]')].map(el => ({ unit: el.dataset.unit, text: el.textContent })) },
      dock: { title: text('.ns-dock [data-ns-title]'), chip: text('.ns-dock [data-ns-chip]'), section: text('.ns-dock [data-ns-section]') },
      hud: { title: text('.ns-hud [data-ns-title]'), chip: text('.ns-hud [data-ns-chip]') },
      counts: { main: document.querySelectorAll('main[data-route-region]').length, dock: document.querySelectorAll('.ns-dock').length, card: document.querySelectorAll('.ns-count').length, hud: document.querySelectorAll('.ns-hud').length, heading: document.querySelectorAll('main[data-route-region] h1').length, itemIds: [...document.querySelectorAll('[id^="assessment-"], [id^="guide-item-"]')].map(el => el.id) }, pageshow: window.__qaPageshow, storageEvents: window.__qaStorageEvents };
  }, course);
}

function checkSurfaces(out, name, state, course, seed, now) {
  const target = expectedTarget(course, seed, now), chip = expectedChip(target, now, state.route === 'desk');
  if (state.route === 'desk') {
    assertion(out, name + ': Desk target title', state.desk.title === target.title, state.desk.title, target.title);
    assertion(out, name + ': Desk chip uses current clock', state.desk.chip === chip, state.desk.chip, chip);
    assertion(out, name + ': Desk published dates', state.desk.when === target.when, state.desk.when, target.when);
    const winner = overall(ROUTES.slice(1).map(id => expectedTarget(id, seed, now)), now);
    assertion(out, name + ': Desk overall current target/date', state.overall.title === winner?.title && state.overall.when === winner?.when, state.overall, winner);
    if (winner?.precision === 'exact' && parts(winner, now).ms > 0) {
      const values = parts(winner, now);
      assertion(out, name + ': Desk overall countdown current/nonnegative', state.overall.digits.length === 3 && state.overall.digits.every(row => /^\d+$/.test(row.text) && Number(row.text) === values[row.unit]), state.overall.digits, values);
    } else assertion(out, name + ': Desk overall current state', state.overall.word === (winner?.range || compact(winner, now)), state.overall.word, winner?.range || compact(winner, now));
  } else {
    assertion(out, name + ': course card target', state.card.title?.includes(target.title) && state.card.id === target.id, state.card, { title: target.title, id: target.id });
    assertion(out, name + ': course card published dates', state.card.when === target.when, state.card.when, target.when);
    assertion(out, name + ': dock target and current chip', state.dock.title === target.title && state.dock.chip === chip, state.dock, { title: target.title, chip });
    assertion(out, name + ': HUD target and current chip', state.hud.title === target.title && state.hud.chip === chip, state.hud, { title: target.title, chip });
    const invalid = state.card.digits.filter(row => !/^\d+$/.test(row.text) || Number(row.text) < 0);
    assertion(out, name + ': countdown digits never negative', invalid.length === 0, invalid, []);
    if (target.precision === 'exact' && parts(target, now).ms > 0) {
      const values = parts(target, now);
      assertion(out, name + ': card digits use current clock', state.card.digits.length >= 3 && state.card.digits.filter(row => row.unit !== 's').every(row => Number(row.text) === values[row.unit]), state.card.digits, values);
    }
  }
  return target;
}

export async function webkit(env) {
  const out = result();
  let browser;
  try {
    browser = await env.playwright.webkit.launch({ headless: true });
  } catch (error) {
    out.skipped.push({ feature: 'Playwright WebKit routes, deadlines and layout', reason: 'WebKit could not launch; install its browser and OS dependencies. ' + error.message });
    return out;
  }
  const interrupt = () => { void browser.close().catch(() => {}); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    for (const descriptor of [{ name: 'iPhone 390px touch DPR3', options: { ...env.playwright.devices['iPhone 13'], ...IPHONE } }, { name: 'desktop 1440px', options: { viewport: { width: 1440, height: 900 } } }]) {
      // Preserve the original route/deadline assertions and change only their browser/context.
      const adapted = new Proxy(browser, { get(target, property) { return property === 'newContext' ? options => target.newContext({ ...options, ...descriptor.options }) : typeof target[property] === 'function' ? target[property].bind(target) : target[property]; } });
      for (const check of ['routes', 'deadlines']) {
        env.progress?.(`${descriptor.name}: existing ${check} check`);
        const report = await CHECKS[check]({ ...env, browser: adapted });
        out.assertions.push(...report.assertions.map(row => ({ ...row, name: descriptor.name + ' ' + check + ': ' + row.name })));
        out.observations.cases.push({ name: descriptor.name + ' ' + check, ...report.observations });
        out.skipped.push(...report.skipped);
      }
    }
    // The original layout matrix also covers 1024px; 390px receives the iPhone descriptor.
    const layoutBrowser = new Proxy(browser, { get(target, property) { return property === 'newContext' ? options => target.newContext(options.viewport?.width === 390 ? { ...env.playwright.devices['iPhone 13'], ...options, ...IPHONE } : options) : typeof target[property] === 'function' ? target[property].bind(target) : target[property]; } });
    const report = await CHECKS.layout({ ...env, browser: layoutBrowser });
    out.assertions.push(...report.assertions.map(row => ({ ...row, name: 'WebKit layout: ' + row.name })));
    out.observations.cases.push({ name: 'WebKit existing layout matrix (390 touch DPR3; 1024 and 1440 desktop)', ...report.observations });
    out.skipped.push(...report.skipped);
    out.observations.browser = { name: 'WebKit', version: browser.version(), iphone: IPHONE };
  } finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); await browser.close(); }
  return out;
}

export async function nojs(env) {
  const out = result();
  for (const route of ROUTES) {
  const scriptPolicy = { javaScriptEnabled: false, documentURL: url(env, route), declaredPreloads: [], cspPolicies: [], requests: [], failures: [], completedScripts: [], executedMarkers: [] };
  await runCase(env, out, route + ': no JavaScript', async (page, observation) => {
    observation.scriptPolicy = scriptPolicy;
    const requestInfo = request => ({ url: request.url(), method: request.method(), resourceType: request.resourceType() });
    page.on('request', request => { if (request.resourceType() === 'script') scriptPolicy.requests.push(requestInfo(request)); });
    page.on('requestfailed', request => { if (request.resourceType() === 'script') scriptPolicy.failures.push({ ...requestInfo(request), message: request.failure()?.errorText }); });
    page.on('requestfinished', request => { if (request.resourceType() === 'script') scriptPolicy.completedScripts.push(request.url()); });
    const response = await page.goto(url(env, route));
    const declared = await page.evaluate(() => ({ documentURL: location.href, declaredPreloads: [...document.querySelectorAll('link[rel~="modulepreload"][href]')].map(link => link.href), cspPolicies: [...document.querySelectorAll('meta[http-equiv]')].filter(meta => meta.httpEquiv.toLowerCase() === 'content-security-policy').map(meta => meta.content), executedMarkers: ['TMURouter', 'TMUHub', 'GuideMotion', 'CourseWorkspace', '__qaRouteCompleted'].filter(name => Object.hasOwn(window, name)) }));
    Object.assign(scriptPolicy, declared);
    const headerPolicy = (await response.allHeaders())['content-security-policy'];
    if (headerPolicy) scriptPolicy.cspPolicies.push(headerPolicy);
    const blockedURLs = [...new Set(scriptPolicy.failures.map(request => request.url))].sort(), declaredURLs = [...new Set(scriptPolicy.declaredPreloads)].sort();
    assertion(out, route + ': disabled scripts block exactly declared modulepreload URLs', JSON.stringify(blockedURLs) === JSON.stringify(declaredURLs) && scriptPolicy.failures.every(request => expectedNoScriptPreloadEvent({ type: 'requestfailed', requestUrl: request.url, method: request.method, message: request.message }, scriptPolicy)), { blockedURLs, failures: scriptPolicy.failures }, declaredURLs);
    const pendingScriptCount = scriptPolicy.requests.length - scriptPolicy.failures.length - scriptPolicy.completedScripts.length;
    assertion(out, route + ': no application script completes, remains pending or sets an application marker', scriptPolicy.completedScripts.length === 0 && pendingScriptCount === 0 && scriptPolicy.executedMarkers.length === 0, { completedScripts: scriptPolicy.completedScripts, pendingScriptCount, executedMarkers: scriptPolicy.executedMarkers }, { completedScripts: [], pendingScriptCount: 0, executedMarkers: [] });
    observation.reading = await page.evaluate(() => {
      const main = document.querySelector('main[data-route-region]');
      const nativeHidden = el => {
        if (el.closest('[hidden],dialog:not([open])')) return true;
        for (let parent = el.closest('details:not([open])'); parent; parent = parent.parentElement?.closest('details:not([open])')) if (!parent.querySelector(':scope > summary')?.contains(el)) return true;
        return false;
      };
      const styleHidden = el => { for (let node = el; node; node = node.parentElement) { const s = getComputedStyle(node); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true; } return false; };
      const visible = el => !nativeHidden(el) && !styleHidden(el) && (el.getClientRects().length > 0 || el.matches('option:checked') && el.closest('select')?.getClientRects().length > 0);
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT), readable = [], hidden = new Set();
      while (walker.nextNode()) { const node = walker.currentNode, parent = node.parentElement; if (!node.textContent.trim() || parent.closest('script,style')) continue; if (visible(parent)) readable.push(node.textContent.trim()); else if (!nativeHidden(parent) && styleHidden(parent)) hidden.add(parent); }
      const readableText = readable.join(' ');
      const hiddenContent = [...hidden].map(el => ({ tag: el.tagName, id: el.id, class: el.className, text: el.textContent.trim().slice(0,100) }));
      const leafText = element => { const reader = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), text = []; while (reader.nextNode()) if (visible(reader.currentNode.parentElement)) text.push(reader.currentNode.textContent.trim()); return text.join(' '); };
      const readableTimes = [...main.querySelectorAll('time[datetime]')].filter(visible).map(el => ({ datetime: el.getAttribute('datetime'), text: leafText(el) }));
      const coursework = [...main.querySelectorAll('[data-nojs-assessment]')].filter(visible).map(el => ({ id: el.dataset.nojsAssessment, text: leafText(el) }));
      const links = [...document.querySelectorAll('a[href]')].filter(visible).map(el => ({ href: el.getAttribute('href'), resolved: el.href, text: el.textContent.trim(), onclick: el.getAttribute('onclick') }));
      return { heading: main.querySelector('h1')?.textContent.trim(), headingVisible: !!main.querySelector('h1') && visible(main.querySelector('h1')), readableText, readableTimes, coursework, visibleLists: [...main.querySelectorAll('[data-nojs-coursework],#assessment-list,#teamlist,#youlist,.desk-courses')].filter(visible).map(el => ({ id: el.id, count: el.querySelectorAll('li,article').length })), hiddenContent, htmlHeld: document.documentElement.matches('html.ns-held'), links };
    });
    const state = observation.reading;
    assertion(out, route + ': readable heading without JavaScript', state.headingVisible && Boolean(state.heading), state.heading, 'visible nonempty heading');
    assertion(out, route + ': readable coursework list', state.visibleLists.some(list => list.count > 0), state.visibleLists, 'visible nonempty coursework/course list');
    assertion(out, route + ': no waiting hold or hidden content', !state.htmlHeld && !state.hiddenContent.length, { htmlHeld: state.htmlHeld, hiddenContent: state.hiddenContent }, { htmlHeld: false, hiddenContent: [] });
    for (const course of ROUTES.slice(1).filter(course => route === 'desk' || course !== route)) {
      const expected = new URL(url(env, course)).pathname;
      const matching = state.links.filter(link => new URL(link.resolved).pathname.replace(/index\.html$/, '') === expected);
      assertion(out, route + ': plain ' + course + ' href', matching.some(link => link.href && !/^javascript:/i.test(link.href) && !link.onclick), matching, expected);
    }
    if (route !== 'desk') {
      const records = route === 'cen100' ? SCHEDULE.filter(row => row.calendar !== false) : COURSES[route].assessments;
      const missing = records.filter(row => !(state.coursework.length ? state.coursework.find(item => item.id === row.id)?.text : state.readableText)?.includes(row.title.replace(/ due$/, ''))).map(row => ({ id: row.id, title: row.title }));
      assertion(out, route + ': every coursework title readable', !missing.length, missing, []);
      const dates = [...new Set(records.flatMap(row => [row.date, row.week].filter(Boolean)))];
      const missingDates = dates.filter(date => !state.readableTimes.some(authored => readableDate(date, authored)) && !state.readableText.includes(date));
      assertion(out, route + ': published assessment dates readable', !missingDates.length, { missingDates, readableTimes: state.readableTimes }, dates);
      if (records.some(row => !row.date && !row.week)) assertion(out, route + ': unresolved dates remain honest', /Date pending|not (?:yet )?(?:posted|announced)|await/i.test(state.readableText), state.readableText.slice(-1500), 'pending date wording');
    }
  }, { options: { javaScriptEnabled: false }, expected: event => expectedNoScriptPreloadEvent(event, scriptPolicy) });
  }
  return out;
}

export async function failures(env) {
  const out = result();
  for (const mode of ['500', 'timeout', 'aborted', 'missing-region']) {
    const target = url(env, 'mth141', `?motion=off&qa_failure=${mode}#assessment-midterm`);
    await runCase(env, out, 'fetch ' + mode, async (page, observation) => {
      await page.goto(url(env, 'desk', '?motion=off')); await ready(page, 'desk');
      const shell = await page.evaluate(() => document.documentElement.dataset.shellId), documents = [];
      page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
      await page.evaluate(target => { const anchor = document.createElement('a'); anchor.href = target; anchor.textContent = 'QA destination'; document.body.append(anchor); anchor.click(); }, target);
      await until(() => page.url() === target, mode + ' full-navigation fallback', mode === 'timeout' ? 14_000 : 10_000);
      await ready(page, 'mth141');
      observation.after = await snapshot(page, 'mth141'); observation.documentRequests = documents;
      assertion(out, mode + ': one normal navigation to requested query/hash URL', documents.length === 1 && documents[0] === target.split('#')[0] && page.url() === target, { documents, url: page.url() }, [target.split('#')[0]]);
      assertion(out, mode + ': recovery replaces failed shell and stays usable', observation.after.shell !== shell && observation.after.heading && observation.after.content > 20, observation.after, 'new document with course content');
    }, { expected: event => expectedFailureEvent(event, { target, mode }), init: { arg: { target, mode }, fn: ({ target, mode }) => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        if (new URL(typeof input === 'string' ? input : input.url, location.href).href !== target.split('#')[0]) return nativeFetch(input, options);
        if (mode === '500') return Promise.resolve(new Response('Injected failure', { status: 500 }));
        if (mode === 'aborted') return Promise.reject(new DOMException('QA injected abort', 'AbortError'));
        if (mode === 'missing-region') return Promise.resolve(new Response('<!doctype html><title>Unexpected document</title><body data-course="mth141">No route region</body>', { headers: { 'Content-Type': 'text/html' } }));
        return new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('QA timeout abort', 'AbortError')), { once: true }));
      };
    } } });
  }
  for (const kind of ['getters', 'methods']) for (const route of ROUTES) await runCase(env, out, route + ': denied localStorage and sessionStorage ' + kind, async (page, observation) => {
      await page.goto(url(env, route, '?motion=off')); await ready(page, route);
      const state = await snapshot(page, route === 'desk' ? 'cen100' : route);
      assertion(out, kind + ' denied: ' + route + ' direct route readable', state.heading && state.content > 20, state, 'usable route');
      const next = route === 'mth141' ? 'desk' : 'mth141';
      await clickRoute(page, next);
      assertion(out, kind + ' denied: ' + route + ' navigates', new URL(page.url()).pathname === new URL(url(env, next)).pathname, page.url(), url(env, next));
      observation.navigation = { route, next };
  }, { init: { arg: kind, fn: kind => {
    const denied = () => { throw new DOMException('QA denied storage', 'SecurityError'); };
    for (const key of ['localStorage', 'sessionStorage']) if (kind === 'getters') Object.defineProperty(window, key, { configurable: true, get: denied }); else for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) Object.defineProperty(window[key], method, { configurable: true, value: denied });
  } } });
  const offlineURLs = new Set();
  await runCase(env, out, 'offline after warm load', async (page, observation, context) => {
    page.on('request', request => { if (!observation.offline) offlineURLs.add(request.url()); });
    await page.goto(url(env, 'desk', '?motion=off')); await ready(page, 'desk');
    for (const route of [...ROUTES.slice(1), 'desk']) await clickRoute(page, route);
    const shell = await page.evaluate(() => document.documentElement.dataset.shellId);
    await page.waitForLoadState('networkidle');
    observation.offline = true;
    await context.setOffline(true);
    observation.routes = [];
    try {
      for (const route of ['cen100', 'mth140', 'mth141', 'desk']) {
        await clickRoute(page, route); const state = await snapshot(page, route === 'desk' ? 'cen100' : route); observation.routes.push(state);
        assertion(out, 'offline cached navigation to ' + route, state.shell === shell && state.content > 20 && new URL(page.url()).pathname === new URL(url(env, route)).pathname, state, 'same shell, requested route and usable content');
      }
    } finally { await context.setOffline(false); }
    observation.method = 'Real context offline after loading every route and its modules; does not claim an unvisited cold route is available offline.';
    observation.expectedOfflineRequestURLs = [...offlineURLs];
  }, { expected: event => expectedFailureEvent(event, { mode: 'offline', offlineURLs }) });
  const missing = url(env, 'desk', 'cen10o/?qa_failure=404');
  await runCase(env, out, 'misspelt route', async (page, observation) => {
    await page.goto(url(env, 'desk', '?motion=off')); await ready(page, 'desk');
    const responseReady = page.waitForResponse(response => response.url() === missing && response.request().isNavigationRequest());
    await page.evaluate(target => { const anchor = document.createElement('a'); anchor.href = target; anchor.textContent = 'Misspelt route'; document.body.append(anchor); anchor.click(); }, missing);
    const response = await responseReady;
    await until(() => page.url() === missing, 'missing URL committed');
    await page.waitForLoadState('load');
    observation.response = { status: response?.status(), url: page.url(), text: await page.locator('body').innerText(), router: await page.evaluate(() => window.TMURouter?.route ?? null) };
    assertion(out, 'misspelt route reaches native HTTP404 without route claim', response?.status() === 404 && page.url() === missing && /not found|404/i.test(observation.response.text) && !observation.response.router, observation.response, 'HTTP404 at original URL with readable not-found response');
    observation.limit = 'Local preview returns its native Not found response; the repository has no custom 404 document. GitHub Pages hosted 404 presentation is not verified here.';
  }, { expected: event => expectedFailureEvent(event, { target: missing, mode: '404' }) || expectedFailureEvent(event, { target: env.origin + '/favicon.ico', mode: '404' }) });
  return out;
}

export async function clock(env) {
  const out = result();
  const fixtures = [
    { name: 'Toronto midnight / CEN end-of-day expiry', course: 'cen100', unfinished: ['whmis', 'failure'], section: 1, before: '2026-10-15T03:59:30Z', after: '2026-10-15T04:00:00Z' },
    { name: 'Nov 1 Toronto DST fall-back', course: 'mth140', unfinished: ['quiz-3', 'quiz-4'], section: 31, before: '2026-11-01T05:59:30Z', after: '2026-11-01T06:00:00Z' },
    { name: 'one backwards wall-clock jump', course: 'cen100', unfinished: ['integrity', 'whmis'], section: 1, before: '2026-10-14T18:30:00Z', after: '2026-10-14T17:30:00Z' }
  ];
  for (const fixture of fixtures) for (const route of ['desk', fixture.course]) {
    const seed = seedDeadlines(fixture.course, fixture.unfinished, fixture.section);
    await runCase(env, out, fixture.name + ' on ' + route, async (page, observation) => {
      await page.goto(url(env, route, '?motion=off')); await ready(page, route);
      // Pause after mount so assertions observe exact simulated instants instead of
      // real execution time slipping across a minute display boundary.
      await page.clock.pauseAt(new Date(fixture.before));
      observation.before = await snapshot(page, fixture.course);
      checkSurfaces(out, fixture.name + ' before ' + route, observation.before, fixture.course, seed, await page.evaluate(() => Date.now()));
      await page.clock.setSystemTime(new Date(fixture.after));
      await page.clock.runFor(60_000);
      await sleep(50);
      const now = await page.evaluate(() => Date.now());
      observation.after = await snapshot(page, fixture.course); observation.clock = { before: fixture.before, jump: fixture.after, observed: new Date(now).toISOString(), timezone: 'America/Toronto', allowedUpdateMs: 60_000 };
      checkSurfaces(out, fixture.name + ' within one minute ' + route, observation.after, fixture.course, seed, now);
      if (route === 'desk') {
        const toronto = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric' }).format(new Date(now));
        assertion(out, fixture.name + ': Desk Toronto day current', observation.after.desk.today?.includes(toronto), observation.after.desk.today, toronto);
      }
    }, { seed, clock: new Date(+new Date(fixture.before) - 120_000).toISOString(), init: { fn: () => { window.TMU_BOOT_OPTIONS = { autoPrefetch: false }; } } });
  }
  return out;
}

export async function crosstab(env) {
  const out = result();
  const now = '2026-10-13T16:00:00Z';
  for (const course of ROUTES.slice(1)) {
  const seed = seedDeadlines(course, course === 'cen100' ? ['integrity', 'whmis'] : course === 'mth140' ? ['quiz-2', 'midterm', 'quiz-3'] : ['midterm', 'quiz-3'], course === 'cen100' ? 1 : 31);
  await runCase(env, out, course + ': native cross-tab completion, Undo and section changes', async (sender, observation, _context, newPage) => {
    const receiver = await newPage();
    await sender.goto(url(env, course, '?motion=off')); await ready(sender, course);
    await receiver.goto(url(env, 'desk', '?motion=off')); await ready(receiver, 'desk');
    const progressKey = course === 'cen100' ? 'cen100-personal-plan-v1' : course + '-progress-v1', sectionKey = course === 'cen100' ? 'cen100-contact-choice-v1' : course + '-section-v1';
    const mark = () => performResilienceInteraction(sender, { name: 'cross-tab Mark done', selector: '[data-quick-complete]', method: 'evaluate-click', first: true });
    const undo = () => performResilienceInteraction(sender, { name: 'cross-tab Undo', selector: '#undo-complete', method: 'evaluate-click' });
    const inspect = async (name, currentSeed, route) => {
      const expected = expectedTarget(course, currentSeed, +new Date(now));
      await until(() => receiver.evaluate(({ course, title, route }) => document.querySelector(route === 'desk' ? `[data-course-card="${course}"] .desk-course-title` : '.ns-dock [data-ns-title]')?.textContent.trim() === title, { course, title: expected.title, route }), name + ' storage propagation');
      const state = await snapshot(receiver, course);
      observation[name] = state;
      checkSurfaces(out, name, state, course, currentSeed, +new Date(now));
      assertion(out, name + ': trusted native storage event', state.storageEvents.some(event => event.key === progressKey && event.trusted), state.storageEvents, 'browser storage event on progress key');
    };
    const marked = structuredClone(seed); marked[progressKey].completed[expectedTarget(course, seed, +new Date(now)).id] = true;
    await mark(); await inspect('Desk Mark done', marked, 'desk');
    await undo(); await inspect('Desk Undo', seed, 'desk');
    await clickRoute(receiver, course);
    const shell = await receiver.evaluate(() => document.documentElement.dataset.shellId);
    await mark(); await inspect('course card/dock Mark done', marked, course);
    await undo(); await inspect('course card/dock Undo', seed, course);
    const changed = structuredClone(seed), changedSection = course === 'cen100' ? 2 : 32, originalSection = course === 'cen100' ? 1 : 31, sectionSelect = course === 'cen100' ? '#contact-section' : '#section-select';
    changed[sectionKey] = course === 'cen100' ? { section: changedSection, group: 1 } : changedSection;
    await performResilienceInteraction(sender, { name: 'cross-tab open section', selector: '.workspace-section', method: 'click' });
    await performResilienceInteraction(sender, { name: 'cross-tab change section', selector: sectionSelect, method: 'selectOption', value: String(changedSection) });
    await until(() => receiver.locator(sectionSelect).inputValue().then(value => value === String(changedSection)), 'other tab selected section');
    observation.sectionCourse = await snapshot(receiver, course);
    checkSurfaces(out, 'course card/dock section change', observation.sectionCourse, course, changed, +new Date(now));
    assertion(out, 'other tab dock section label', observation.sectionCourse.dock.section?.includes(String(changedSection)), observation.sectionCourse.dock.section, 'Section ' + changedSection);
    assertion(out, 'section propagated by trusted native event', observation.sectionCourse.storageEvents.some(event => event.key === sectionKey && event.trusted), observation.sectionCourse.storageEvents, sectionKey);
    assertion(out, 'cross-tab updates preserve receiver shell', observation.sectionCourse.shell === shell, observation.sectionCourse.shell, shell);
    await clickRoute(receiver, 'desk');
    await performResilienceInteraction(sender, { name: 'cross-tab restore section', selector: sectionSelect, method: 'selectOption', value: String(originalSection) });
    await until(() => receiver.evaluate(({course,section}) => document.querySelector(`[data-course-card="${course}"] .desk-course-section`)?.textContent.includes(String(section)), {course,section:originalSection}), 'Desk section storage update');
    observation.sectionDesk = await snapshot(receiver, course);
    checkSurfaces(out, 'Desk section change', observation.sectionDesk, course, seed, +new Date(now));
    assertion(out, 'Desk section text re-read through storage', observation.sectionDesk.desk.section?.includes(String(originalSection)), observation.sectionDesk.desk.section, 'Section ' + originalSection);
    observation.method = 'Exactly two real pages in one context; UI actions write storage in sender and native trusted storage events update receiver. No synthetic StorageEvent.';
  }, { seed, fixedTime: now });
  }
  return out;
}

export async function bfcache(env) {
  const out = result();
  let nativeBrowser;
  try { nativeBrowser = await env.playwright.chromium.launch({ ...env.launchOptions, ignoreDefaultArgs: ['--disable-back-forward-cache'] }); }
  catch (error) { out.skipped.push({ feature: 'native BFCache', reason: 'BFCache-enabled Chromium could not launch: ' + error.message }); }
  if (nativeBrowser) try {
    for (const route of ROUTES) {
      const course = route === 'desk' ? 'cen100' : route, seed = seedDeadlines(course, course === 'cen100' ? ['integrity', 'whmis'] : ['midterm', 'quiz-3'], course === 'cen100' ? 1 : 31);
      seed.__qaResilienceNow = '2026-10-13T16:00:00Z';
      await runCase({ ...env, instrument: () => {} }, out, route + ': native document Back / BFCache', async (page, observation) => {
      const course = route === 'desk' ? 'cen100' : route;
      await page.goto(url(env, route, '?motion=off')); await ready(page, route);
      observation.before = await snapshot(page, course);
      await performResilienceNavigation(page, { name: 'BFCache park', method: 'goto', targetURL: env.origin + env.base + 'privacy.html' });
      const changed = structuredClone(seed), progressKey = course === 'cen100' ? 'cen100-personal-plan-v1' : course + '-progress-v1';
      changed[progressKey].completed[expectedTarget(course, seed, +new Date(seed.__qaResilienceNow)).id] = true;
      await page.evaluate(({ key, progress }) => { localStorage.setItem(key, JSON.stringify(progress)); localStorage.setItem('__qaResilienceNow', '2026-10-13T17:00:00Z'); }, { key: progressKey, progress: changed[progressKey] });
      await performResilienceNavigation(page, { name: 'BFCache Back', method: 'goBack', targetURL: url(env, route, '?motion=off') }); await ready(page, route);
      observation.after = await snapshot(page, course);
      observation.navigation = await page.evaluate(() => performance.getEntriesByType('navigation').map(entry => ({ type: entry.type, notRestoredReasons: entry.notRestoredReasons?.toJSON?.() ?? null })));
      assertion(out, route + ': Back page usable', observation.after.heading && observation.after.content > 20, observation.after, 'readable route');
      const persisted = observation.after.pageshow.some(event => event.persisted);
      if (!persisted) {
        out.skipped.push({ feature: route + ': native persisted BFCache restoration', reason: 'The browser performed a document Back without pageshow.persisted. Shell retention/resume cannot be claimed.', navigation: observation.navigation });
        return;
      }
      assertion(out, route + ': persisted Back preserves shell', observation.after.shell === observation.before.shell, { before: observation.before.shell, after: observation.after.shell }, observation.before.shell);
      assertion(out, route + ': persisted Back doubles nothing', JSON.stringify(observation.after.counts) === JSON.stringify(observation.before.counts), observation.after.counts, observation.before.counts);
      checkSurfaces(out, route + ': native restored deadlines re-resolve clock and saved completion', observation.after, course, changed, await page.evaluate(() => Date.now()));
      // A successful navigation after native restoration catches suspended router/listener state.
      const next = route === 'desk' ? course : 'desk'; await clickRoute(page, next);
      assertion(out, route + ': router usable after native restoration', await page.evaluate(() => document.documentElement.dataset.shellId) === observation.before.shell, page.url(), 'same shell navigates');
      observation.method = 'Actual cross-document privacy.html navigation followed by browser Back; persisted is observed, never synthesized. The public TMU_BOOT_OPTIONS.autoPrefetch=false prevents preview-only Cache-Control:no-store prefetch responses from excluding BFCache; native Date offset leaves timers unchanged.';
    }, { browser: nativeBrowser, seed, init: { fn: () => {
      // Preview's no-store prefetched HTML makes Chromium reject BFCache. The supported
      // boot option isolates native restore from that local-server cache policy.
      window.TMU_BOOT_OPTIONS = { autoPrefetch: false };
      // A Date offset keeps native timers/rAF intact. The away document updates it.
      const NativeDate = Date;
      const now = () => { const iso = localStorage.getItem('__qaResilienceNow'); return iso ? NativeDate.parse(iso) + (NativeDate.now() - window.__qaNativeClockStart) : NativeDate.now(); };
      window.__qaNativeClockStart = NativeDate.now();
      window.Date = new Proxy(NativeDate, { construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [now()], newTarget); }, apply() { return new NativeDate(now()).toString(); }, get(target, key, receiver) { return key === 'now' ? now : Reflect.get(target, key, receiver); } });
    } } });
    }
  } finally { await nativeBrowser.close(); }
  // A separate explicit handler test exercises stale clock/storage recomputation even when the
  // automation browser cannot retain a document. This is never labelled native BFCache evidence.
  for (const route of ['desk', 'cen100', 'mth140', 'mth141']) {
    const course = route === 'desk' ? 'cen100' : route;
    const unfinished = course === 'cen100' ? ['integrity', 'whmis'] : ['midterm', 'quiz-3'];
    const seed = seedDeadlines(course, unfinished, course === 'cen100' ? 1 : 31);
    await runCase(env, out, route + ': persisted pageshow handler (synthetic)', async (page, observation) => {
      await page.goto(url(env, route, '?motion=off')); await ready(page, route);
      observation.before = await snapshot(page, course);
      await page.clock.setSystemTime(new Date('2026-10-13T17:00:00Z'));
      await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await sleep(100);
      observation.after = await snapshot(page, course);
      checkSurfaces(out, route + ': persisted handler re-resolves deadlines', observation.after, course, seed, await page.evaluate(() => Date.now()));
      assertion(out, route + ': handler preserves shell and singleton content', observation.after.shell === observation.before.shell && JSON.stringify(observation.after.counts) === JSON.stringify(observation.before.counts), observation.after, 'same shell and counts');
      observation.method = 'Synthetic PageTransitionEvent(persisted:true) exercises product resume handlers only. It is not native BFCache evidence.';
    }, { seed, clock: '2026-10-13T16:00:00Z' });
  }
  return out;
}

export async function forward(env) {
  const out = result();
  const hashes = ['#assignment-y4', '#assignments', '#course-info', '#guide-tools', '#guide-search', '#workspace-timeline', '#nextsign', '#board', '#course-main', '#t-team', '#p-you', '#t-rules', '#guide-item-m3'];
  for (const root of ['', 'index.html']) for (const hash of hashes) await runCase(env, out, root + ' legacy ' + hash, async (page, observation) => {
    const query = '?motion=off&tier=low&utm_source=old%20guide&x=a%2Fb&x=two', source = url(env, 'desk', root + query + hash), destination = url(env, 'cen100', query + hash), documents = [];
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
    await page.goto(source); await ready(page, 'cen100');
    observation.navigation = { source, destination, actual: page.url(), documents };
    assertion(out, 'old root ' + root + hash + ': preserves entire query/hash', page.url() === destination, page.url(), destination);
    assertion(out, 'old root ' + root + hash + ': forwards exactly once', documents.length === 2 && new URL(documents[0]).pathname === new URL(source).pathname && new URL(documents[1]).pathname === new URL(destination).pathname, documents, 'one source request, one CEN request');
  });
  for (const query of ['?motion=off', '?theme=light&tier=low&v=old&utm_source=Desk', '?redirect=https%3A%2F%2Fexample.test%2Fcen100%2F', '?section=31&group=1', '?motion=off#desk-main', '?motion=off#assignment-unknown']) await runCase(env, out, 'generic Desk ' + query, async (page, observation) => {
    const documents = []; page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
    const source = url(env, 'desk', query); await page.goto(source); await ready(page, 'desk');
    observation.navigation = { source, actual: page.url(), documents };
    assertion(out, 'generic options stay Desk: ' + query, page.url() === source && documents.length === 1, observation.navigation, { actual: source, documentRequests: 1 });
  });
  out.observations.queryInventory = 'The historical CEN guide has no CEN-specific query keys. Query-only options stay on Desk; recognized CEN hashes carry every query byte to CEN.';
  return out;
}

export const RESILIENCE_CHECKS = { webkit, nojs, bfcache, failures, crosstab, clock, forward };
Object.assign(CHECKS, RESILIENCE_CHECKS);
