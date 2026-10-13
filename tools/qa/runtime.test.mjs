import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectPageErrors, DEFAULT_PLAYWRIGHT_PATH, EnvironmentError, parseCli, resolveLaunchOptions, resolvePlaywright, ROOT, runHarness, SOFTWARE_GL_ARGS, startPreview, stopPreview } from './runtime.mjs';

const names = ['routes', 'stability', 'frames', 'deadlines', 'modes', 'layout'];
const passed = () => ({ assertions: [{ name: 'fixture is valid', pass: true }], observations: {}, skipped: [] });

async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tmu-qa-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('CLI defaults to every check at both deployment bases', () => {
  assert.deepEqual(parseCli([], { checks: names, env: {} }), { checks: names, bases: ['/', '/tmu-course-guides/'], gpu: false, help: false });
});

test('CLI selects checks and one normalized base; GPU flag and environment agree', () => {
  assert.deepEqual(parseCli(['layout', 'routes', 'layout', '--base', '/tmu-course-guides', '--gpu'], { checks: names, env: {} }), { checks: ['layout', 'routes'], bases: ['/tmu-course-guides/'], gpu: true, help: false });
  assert.equal(parseCli(['--base=/'], { checks: names, env: { QA_GPU: '1' } }).gpu, true);
  assert.equal(parseCli([], { checks: names, env: { QA_GPU: 'true' } }).gpu, false);
  assert.equal(parseCli(['--help'], { checks: names, env: {} }).help, true);
});

test('CLI rejects unknown checks/options, missing bases and unsafe URL paths', () => {
  for (const argv of [['typo'], ['--wat'], ['--base'], ['--base', '--gpu'], ['--base', 'relative'], ['--base', '/a/../'], ['--base', '/a?b'], ['--base', '/a#b'], ['--base', '/a\\b'], ['--base', '/', '--base', '/second/']]) {
    assert.throws(() => parseCli(argv, { checks: names, env: {} }), EnvironmentError, argv.join(' '));
  }
});

test('Playwright resolution supports actual package directories and entry files', async t => {
  const directory = await temporary(t);
  const entry = path.join(directory, 'entry.cjs');
  await writeFile(entry, 'module.exports = {chromium:{launch(){}, executablePath(){return "/fixture/browser"}}};\n');
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ main: 'entry.cjs' }));
  for (const modulePath of [directory, entry]) {
    const resolved = resolvePlaywright({ env: { PLAYWRIGHT_PATH: modulePath } });
    assert.equal(resolved.modulePath, modulePath);
    assert.equal(resolved.playwright.chromium.executablePath(), '/fixture/browser');
  }
});

test('Playwright resolution tries the default or override then Node fallback', () => {
  const playwright = { chromium: { launch() {} } }, attempts = [];
  const requireModule = name => { attempts.push(name); if (name === 'playwright') return playwright; throw Error('Unavailable fixture'); };
  assert.equal(resolvePlaywright({ env: {}, requireModule }).playwright, playwright);
  assert.deepEqual(attempts, [DEFAULT_PLAYWRIGHT_PATH, 'playwright']);
  attempts.length = 0;
  assert.equal(resolvePlaywright({ env: { PLAYWRIGHT_PATH: '/missing/package' }, requireModule }).source, 'node resolution fallback');
  assert.deepEqual(attempts, ['/missing/package', 'playwright']);
  assert.throws(() => resolvePlaywright({ env: {}, requireModule: () => ({}) }), /Set PLAYWRIGHT_PATH/);
});

test('Chromium launch selects explicit, bundled, or system executable and exact GL args', () => {
  const playwright = { chromium: { executablePath: () => '/bundled/chromium' } };
  const system = resolveLaunchOptions(playwright, { env: {}, exists: value => value === '/usr/bin/chromium' });
  assert.equal(system.options.executablePath, '/usr/bin/chromium');
  assert.deepEqual(system.options.args, SOFTWARE_GL_ARGS);
  assert.equal(system.options.headless, true);
  const bundled = resolveLaunchOptions(playwright, { env: {}, exists: () => true });
  assert.equal(bundled.options.executablePath, '/bundled/chromium');
  const override = resolveLaunchOptions(playwright, { env: { QA_CHROMIUM_PATH: '/explicit/chromium' }, gpu: true, exists: () => true });
  assert.equal(override.options.executablePath, '/explicit/chromium');
  assert.deepEqual(override.options.args, []);
  assert.deepEqual(resolveLaunchOptions(playwright, { env: { QA_GPU: '1' }, exists: () => true }).options.args, []);
  assert.throws(() => resolveLaunchOptions(playwright, { env: { QA_CHROMIUM_PATH: '/bad/chromium' }, exists: () => false }), /QA_CHROMIUM_PATH does not exist/);
  assert.throws(() => resolveLaunchOptions(playwright, { env: {}, exists: () => false }), /Chromium is unavailable/);
});

class FakePage extends EventEmitter {
  constructor(context) { super(); this.owner = context; }
  url() { return 'http://fixture/cen100/'; }
  context() { return this.owner; }
}
class FakeContext extends EventEmitter {
  constructor(browser) { super(); this.browser = browser; this.allPages = []; this.closed = false; }
  pages() { return this.allPages; }
  async newPage() { const page = new FakePage(this); this.allPages.push(page); this.emit('page', page); return page; }
  async close() { this.closed = true; }
}
class FakeBrowser extends EventEmitter {
  constructor() { super(); this.contexts = []; this.closed = false; }
  async newContext() { const context = new FakeContext(this); this.contexts.push(context); return context; }
  async newPage() { return (await this.newContext()).newPage(); }
  async close() { this.closed = true; for (const context of this.contexts) await context.close(); this.emit('closed'); }
  version() { return 'fixture Chromium'; }
}

function fakeRuntime(reportsRoot, checks, overrides = {}) {
  const browsers = [], servers = [], signals = new EventEmitter();
  const playwright = { chromium: { async launch() { const browser = new FakeBrowser(); browsers.push(browser); return browser; }, executablePath: () => '/fixture/chromium' } };
  const options = {
    argv: [], checks, reportsRoot, signalTarget: signals, env: {}, log() {},
    loadPlaywright: () => ({ playwright, modulePath: '/fixture/playwright', source: 'fixture' }),
    launchConfig: () => ({ options: { headless: true, executablePath: '/fixture/chromium', args: SOFTWARE_GL_ARGS }, executableSource: 'fixture' }),
    startServer: async ({ base }) => { const server = { base, origin: `http://fixture-${servers.length}`, stopped: false, async stop() { this.stopped = true; } }; servers.push(server); return server; },
    inspectBrowser: async () => ({ actualMode: 'SwiftShader', webgl: { renderer: 'fixture SwiftShader' }, frameInterpretation: 'Software-renderer diagnostics.' }),
    ...overrides
  };
  return { options, browsers, servers, signals };
}

test('error collection records every error type and only explicitly expected events are classified', () => {
  const page = new FakePage();
  const collector = collectPageErrors(page, { expected: event => event.type === 'console' && event.message === 'intentional fixture diagnostic' });
  const consoleMessage = (type, message) => ({ type: () => type, text: () => message, location: () => ({ lineNumber: 1 }) });
  page.emit('console', consoleMessage('warning', 'warning'));
  page.emit('console', consoleMessage('error', 'intentional fixture diagnostic'));
  page.emit('console', consoleMessage('error', 'unexpected diagnostic'));
  page.emit('pageerror', Error('script failed'));
  page.emit('requestfailed', { url: () => 'http://fixture/missing.js', method: () => 'GET', failure: () => ({ errorText: 'net::ERR_FAILED' }) });
  page.emit('response', { status: () => 404, url: () => 'http://fixture/missing.svg' });
  assert.equal(collector.events.length, 5);
  assert.deepEqual(collector.unexpected.map(event => event.type), ['console', 'pageerror', 'requestfailed', 'http']);
  collector.detach();
  assert.equal(page.listenerCount('console'), 0);
});

test('runner writes both bases into each check report and cleans isolated servers/browsers', async t => {
  const runtime = fakeRuntime(await temporary(t), { routes: passed, layout: passed });
  const result = await runHarness(runtime.options);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(runtime.servers.map(server => server.base), ['/', '/tmu-course-guides/']);
  assert.ok(runtime.servers.every(server => server.stopped));
  assert.ok(runtime.browsers.every(browser => browser.closed));
  assert.equal(runtime.signals.listenerCount('SIGINT'), 0);
  const report = JSON.parse(await readFile(path.join(result.directory, 'routes.json'), 'utf8'));
  assert.deepEqual(report.cases.map(item => item.base), ['/', '/tmu-course-guides/']);
  assert.equal(report.status, 'passed');
  assert.match(await readFile(path.join(result.directory, 'summary.md'), 'utf8'), /SwiftShader/);
});

test('assertion failures and exceptions exit 1, retain telemetry, continue checks, and close extra browsers', async t => {
  const runtime = fakeRuntime(await temporary(t), {
    routes: async ({ browser, playwright }) => {
      const page = await (await browser.newContext()).newPage();
      page.emit('console', { type: () => 'error', text: () => 'exception telemetry', location: () => ({}) });
      const extra = await playwright.chromium.launch();
      await (await extra.newContext()).newPage();
      throw Error('Deliberate check exception');
    },
    layout: () => ({ assertions: [{ name: 'overflow absent', pass: false, actual: 42, expected: 0 }], observations: {}, skipped: [] }),
    frames: passed
  });
  const result = await runHarness(runtime.options);
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.failures, 4);
  assert.equal(result.summary.checks[2].status, 'passed');
  assert.ok(runtime.browsers.every(browser => browser.closed && browser.contexts.every(context => context.closed)));
  const routes = JSON.parse(await readFile(path.join(result.directory, 'routes.json'), 'utf8'));
  assert.equal(routes.cases[0].observations.runnerErrors[0].message, 'exception telemetry');
  assert.equal(routes.cases[0].error.message, 'Deliberate check exception');
  assert.match(await readFile(path.join(result.directory, 'routes.md'), 'utf8'), /check completed without exception/);
  assert.equal(JSON.parse(await readFile(path.join(result.directory, 'summary.json'), 'utf8')).exitCode, 1);
});

test('selected base alone runs; malformed check output fails while explicit skips are retained', async t => {
  const runtime = fakeRuntime(await temporary(t), { routes: () => ({}), frames: () => ({ assertions: [], skipped: [{ reason: 'fixture unsupported' }] }) }, { argv: ['--base', '/'] });
  const result = await runHarness(runtime.options);
  assert.equal(result.exitCode, 1);
  assert.equal(runtime.servers.length, 1);
  assert.deepEqual(result.summary.checks.map(check => check.status), ['failed', 'skipped']);
});

test('reports preserve measurements shared between assertion actual values and observations', async t => {
  const measurement = { frameCount: 300, intervals: [16, 17, 16] };
  const circular = {}; circular.self = circular;
  const runtime = fakeRuntime(await temporary(t), { frames: () => ({ assertions: [{ name: 'frames sampled', pass: true, actual: measurement }], observations: { measurement, circular }, skipped: [] }) }, { argv: ['--base', '/'] });
  const result = await runHarness(runtime.options);
  const report = JSON.parse(await readFile(path.join(result.directory, 'frames.json'), 'utf8'));
  assert.deepEqual(report.cases[0].assertions[0].actual, measurement);
  assert.deepEqual(report.cases[0].observations.measurement, measurement);
  assert.equal(report.cases[0].observations.circular.self, '[Circular]');
});

test('malformed observations fail only their check and frozen result containers remain supported', async t => {
  const runtime = fakeRuntime(await temporary(t), {
    routes: () => ({ assertions: [{ name: 'fixture passed', pass: true }], observations: 'invalid' }),
    frames: () => ({ assertions: [{ name: 'fixture passed', pass: true }], observations: [] }),
    layout: () => Object.freeze({ assertions: Object.freeze([{ name: 'immutable fixture', pass: true }]), observations: Object.freeze({}), skipped: Object.freeze([]) })
  }, { argv: ['--base', '/'] });
  const result = await runHarness(runtime.options);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.summary.checks.map(check => check.status), ['failed', 'failed', 'passed']);
  assert.match(result.summary.checks[0].cases[0].error.message, /observations value must be an object record/);
});

test('invalid CLI and environment startup failures exit 2 and still write reports', async t => {
  const reportsRoot = await temporary(t);
  const invalid = fakeRuntime(path.join(reportsRoot, 'invalid'), { routes: passed }, { argv: ['--unknown'], loadPlaywright: () => { throw Error('should not load'); } });
  const invalidResult = await runHarness(invalid.options);
  assert.equal(invalidResult.exitCode, 2);
  assert.equal(invalid.servers.length, 0);
  assert.match(await readFile(path.join(invalidResult.directory, 'summary.md'), 'utf8'), /Unknown option/);
  const missing = fakeRuntime(path.join(reportsRoot, 'missing'), { routes: passed }, { loadPlaywright: () => { throw new EnvironmentError('Playwright missing fixture'); } });
  const missingResult = await runHarness(missing.options);
  assert.equal(missingResult.exitCode, 2);
  assert.equal(JSON.parse(await readFile(path.join(missingResult.directory, 'routes.json'), 'utf8')).status, 'not-run');
});

test('browser startup failure closes the already spawned preview server', async t => {
  const runtime = fakeRuntime(await temporary(t), { routes: passed }, { loadPlaywright: () => ({ playwright: { chromium: { launch: async () => { throw Error('browser refused fixture'); } } } }) });
  const result = await runHarness(runtime.options);
  assert.equal(result.exitCode, 2);
  assert.ok(runtime.servers.every(server => server.stopped));
  assert.match(result.summary.errors[0].message, /browser refused/);
});

test('SIGTERM closes active resources and writes partial reports without starting later checks', async t => {
  let runtime;
  let laterRan = false;
  runtime = fakeRuntime(await temporary(t), {
    routes: async ({ browser }) => { await (await browser.newContext()).newPage(); runtime.signals.emit('SIGTERM'); return passed(); },
    layout: () => { laterRan = true; return passed(); }
  });
  const result = await runHarness(runtime.options);
  assert.equal(result.exitCode, 143);
  assert.equal(result.summary.status, 'interrupted');
  assert.equal(laterRan, false);
  assert.ok(runtime.servers.every(server => server.stopped));
  assert.ok(runtime.browsers.every(browser => browser.closed));
  assert.equal(runtime.signals.listenerCount('SIGTERM'), 0);
  assert.equal(JSON.parse(await readFile(path.join(result.directory, 'summary.json'), 'utf8')).exitCode, 143);
});

test('SIGINT during server startup retains the interrupted report and removes signal handlers', async t => {
  let runtime;
  runtime = fakeRuntime(await temporary(t), { routes: passed }, { startServer: async ({ signal }) => {
    runtime.signals.emit('SIGINT');
    assert.equal(signal.aborted, true);
    throw new EnvironmentError('Preview startup interrupted fixture');
  } });
  const result = await runHarness(runtime.options);
  assert.equal(result.exitCode, 130);
  assert.equal(runtime.browsers.length, 0);
  assert.equal(runtime.signals.listenerCount('SIGINT'), 0);
  assert.equal(JSON.parse(await readFile(path.join(result.directory, 'summary.json'), 'utf8')).status, 'interrupted');
});

test('report-write failure rejects after closing active resources and removing signal handlers', async t => {
  const directory = await temporary(t), reportsRoot = path.join(directory, 'file-not-directory');
  await writeFile(reportsRoot, 'fixture');
  const runtime = fakeRuntime(reportsRoot, { routes: passed });
  await assert.rejects(runHarness(runtime.options), /ENOTDIR|EEXIST/);
  assert.ok(runtime.servers.every(server => server.stopped));
  assert.ok(runtime.browsers.every(browser => browser.closed));
  assert.equal(runtime.signals.listenerCount('SIGINT'), 0);
});

function getStatus(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
}

test('preview lifecycle serves the requested project base and stop releases its socket', async t => {
  const server = await startPreview({ root: ROOT, base: '/tmu-course-guides/' });
  t.after(() => server.stop());
  assert.ok(server.port > 0);
  assert.equal(await getStatus(server.origin + '/tmu-course-guides/'), 200);
  assert.equal(await getStatus(server.origin + '/'), 404);
  await server.stop();
  assert.notEqual(server.child.exitCode ?? server.child.signalCode, null);
  await assert.rejects(getStatus(server.origin + '/tmu-course-guides/'), /ECONNREFUSED|ECONNRESET/);
});

test('preview failure and an already aborted startup do not leave a child running', async t => {
  const directory = await temporary(t);
  await assert.rejects(startPreview({ root: directory, timeoutMs: 2_000 }), /Preview server failed to start/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(startPreview({ root: ROOT, signal: controller.signal }), /interrupted/);
  await stopPreview(undefined);
});
