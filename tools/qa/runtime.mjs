import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_PLAYWRIGHT_PATH = '/opt/node-tools/node_modules/playwright';
export const SOFTWARE_GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const require = createRequire(import.meta.url);

export class EnvironmentError extends Error {
  constructor(message, options) { super(message, options); this.name = 'EnvironmentError'; }
}

export function parseCli(argv, { checks, env = process.env } = {}) {
  const available = Array.isArray(checks) ? checks : Object.keys(checks || {});
  const selected = [], bases = [];
  let gpu = env.QA_GPU === '1', help = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--gpu') gpu = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--base' || arg.startsWith('--base=')) {
      if (bases.length) throw new EnvironmentError('--base may only be supplied once.');
      const value = arg === '--base' ? argv[++index] : arg.slice('--base='.length);
      if (!value || !value.startsWith('/') || /[?#\\\s]/u.test(value) || value.split('/').some(part => part === '.' || part === '..')) {
        throw new EnvironmentError('--base requires an absolute URL path, for example /tmu-course-guides/.');
      }
      bases.push('/' + value.split('/').filter(Boolean).map(part => part + '/').join(''));
    } else if (arg.startsWith('-')) throw new EnvironmentError(`Unknown option: ${arg}`);
    else if (!available.includes(arg)) throw new EnvironmentError(`Unknown check: ${arg}. Choose ${available.join(', ')}.`);
    else if (!selected.includes(arg)) selected.push(arg);
  }
  return { checks: selected.length ? selected : [...available], bases: bases.length ? bases : ['/', '/tmu-course-guides/'], gpu, help };
}

export function resolvePlaywright({ env = process.env, requireModule = require } = {}) {
  const requested = env.PLAYWRIGHT_PATH || DEFAULT_PLAYWRIGHT_PATH;
  const attempts = [];
  for (const modulePath of [path.resolve(requested), 'playwright']) {
    try {
      const loaded = requireModule(modulePath);
      const playwright = loaded?.chromium ? loaded : loaded?.default;
      if (!playwright?.chromium?.launch) throw new Error('The module does not export Playwright chromium.launch.');
      return { playwright, modulePath, source: modulePath === 'playwright' ? 'node resolution fallback' : 'PLAYWRIGHT_PATH', attempts };
    } catch (error) { attempts.push({ modulePath, message: error.message }); }
  }
  throw new EnvironmentError(`Playwright could not be loaded. Set PLAYWRIGHT_PATH to its package directory or entry file, or install playwright locally. Tried ${attempts.map(item => item.modulePath).join(' and ')}.`, { cause: attempts });
}

export function resolveLaunchOptions(playwright, { env = process.env, gpu = env.QA_GPU === '1', exists = existsSync } = {}) {
  let bundledExecutable;
  try { bundledExecutable = playwright.chromium.executablePath(); } catch { /* A system executable can still be used. */ }
  const override = env.QA_CHROMIUM_PATH;
  let executablePath, executableSource;
  if (override) {
    executablePath = path.resolve(override);
    executableSource = 'QA_CHROMIUM_PATH';
    if (!exists(executablePath)) throw new EnvironmentError(`QA_CHROMIUM_PATH does not exist: ${executablePath}`);
  } else if (bundledExecutable && exists(bundledExecutable)) {
    executablePath = bundledExecutable;
    executableSource = 'Playwright bundled Chromium';
  } else if (exists('/usr/bin/chromium')) {
    executablePath = '/usr/bin/chromium';
    executableSource = 'system Chromium fallback';
  } else throw new EnvironmentError('Chromium is unavailable. Install the Playwright Chromium browser or set QA_CHROMIUM_PATH to an existing executable.');
  return { options: { headless: true, executablePath, args: gpu ? [] : [...SOFTWARE_GL_ARGS] }, executableSource, bundledExecutable };
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const describeError = error => ({ name: error?.name || 'Error', message: error?.message || String(error), ...(error?.stack ? { stack: error.stack } : {}) });

async function freePort() {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}

function requestReady(url) {
  return new Promise(resolve => {
    const request = http.get(url, response => { response.resume(); resolve(response.statusCode >= 200 && response.statusCode < 400); });
    request.once('error', () => resolve(false));
    request.setTimeout(500, () => { request.destroy(); resolve(false); });
  });
}

export async function stopPreview(child, { graceMs = 750 } = {}) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(resolve, graceMs); });
  await Promise.race([exited, timeout]);
  clearTimeout(timer);
  if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
}

export async function startPreview({ root = ROOT, base = '/', timeoutMs = 10_000, signal, spawnProcess = spawn } = {}) {
  if (signal?.aborted) throw new EnvironmentError('Preview startup interrupted.');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawnProcess(process.execPath, ['tools/preview-server.mjs', '--port', String(port), '--base', base], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', spawnError;
  const append = chunk => { output = (output + String(chunk)).slice(-20_000); };
  child.stdout?.on('data', append); child.stderr?.on('data', append);
  child.on('error', error => { spawnError = error; });
  const abort = () => { void stopPreview(child); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new EnvironmentError('Preview startup interrupted.');
      if (spawnError || child.exitCode !== null || child.signalCode !== null) throw new EnvironmentError(`Preview server failed to start: ${spawnError?.message || output.trim() || `exit ${child.exitCode}`}`);
      if (await requestReady(origin + base)) return { child, origin, base, port, output: () => output, stop: () => stopPreview(child) };
      await delay(50);
    }
    throw new EnvironmentError(`Preview server was not ready within ${timeoutMs} ms. ${output.trim()}`);
  } catch (error) {
    await stopPreview(child);
    throw error;
  } finally { signal?.removeEventListener('abort', abort); }
}

// No default allowlist: intentional errors must be identified by the owning check.
export function collectPageErrors(page, { expected = () => false } = {}) {
  const events = [];
  const add = event => events.push({ ...event, url: page.url(), expected: Boolean(expected(event)) });
  const handlers = {
    console: message => { if (message.type() === 'error') add({ type: 'console', message: message.text(), location: message.location() }); },
    pageerror: error => add({ type: 'pageerror', ...describeError(error) }),
    requestfailed: request => add({ type: 'requestfailed', requestUrl: request.url(), method: request.method(), message: request.failure()?.errorText || 'Request failed' }),
    response: response => { if (response.status() >= 400) add({ type: 'http', requestUrl: response.url(), status: response.status(), message: `HTTP ${response.status()}` }); }
  };
  for (const [event, handler] of Object.entries(handlers)) page.on(event, handler);
  return { events, get unexpected() { return events.filter(event => !event.expected); }, detach() { for (const [event, handler] of Object.entries(handlers)) page.off(event, handler); } };
}

function superviseCheck(primaryBrowser, playwright) {
  const contexts = new Set(), browsers = new Set(), pages = new WeakSet(), collectors = [], proxies = new WeakMap();
  let closing;
  const trackPage = page => { if (!pages.has(page)) { pages.add(page); collectors.push(collectPageErrors(page)); } };
  const trackContext = context => {
    if (!contexts.has(context)) { contexts.add(context); context.on('page', trackPage); for (const page of context.pages()) trackPage(page); }
    return context;
  };
  const wrapBrowser = browser => {
    if (proxies.has(browser)) return proxies.get(browser);
    const proxy = new Proxy(browser, { get(target, property) {
      if (property === 'newContext') return async (...args) => trackContext(await target.newContext(...args));
      if (property === 'newPage') return async (...args) => { const page = await target.newPage(...args); trackContext(page.context()); trackPage(page); return page; };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    proxies.set(browser, proxy); return proxy;
  };
  const wrappedChromium = new Proxy(playwright.chromium, { get(target, property) {
    if (property === 'launch') return async (...args) => { const browser = await target.launch(...args); browsers.add(browser); return wrapBrowser(browser); };
    const value = Reflect.get(target, property, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const wrappedPlaywright = new Proxy(playwright, { get(target, property) { return property === 'chromium' ? wrappedChromium : Reflect.get(target, property, target); } });
  return {
    browser: wrapBrowser(primaryBrowser), playwright: wrappedPlaywright,
    errors: () => collectors.flatMap(collector => collector.events),
    close() {
      return closing ||= (async () => {
        const errors = [];
        for (const context of contexts) try { await context.close(); } catch (error) { errors.push(describeError(error)); }
        for (const collector of collectors) collector.detach();
        for (const browser of browsers) try { await browser.close(); } catch (error) { errors.push(describeError(error)); }
        return errors;
      })();
    }
  };
}

export async function inspectBrowserEnvironment(browser, { gpu } = {}) {
  const diagnostics = { requestedMode: gpu ? 'GPU' : 'SwiftShader', chromiumVersion: browser.version() };
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    diagnostics.webgl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { available: false };
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const result = { available: true, renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR), version: gl.getParameter(gl.VERSION) };
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return result;
    });
  } catch (error) { diagnostics.probeError = describeError(error); }
  finally { await context?.close(); }
  const renderer = diagnostics.webgl?.renderer || '';
  diagnostics.actualMode = /swiftshader/i.test(renderer) ? 'SwiftShader' : /llvmpipe|softpipe|software/i.test(renderer) ? 'software' : diagnostics.webgl?.available ? 'GPU' : diagnostics.webgl?.available === false ? 'unavailable' : 'unknown';
  diagnostics.frameInterpretation = ['SwiftShader', 'software'].includes(diagnostics.actualMode) || !gpu
    ? 'Software-renderer frame numbers are diagnostics, not evidence of device smoothness.'
    : 'This Chromium renderer does not verify phone GPU pacing or Safari interaction.';
  return diagnostics;
}

function normalizeResult(value) {
  if (!value || !Array.isArray(value.assertions)) throw new Error('A check must return an assertions array.');
  for (const assertion of value.assertions) if (!assertion || typeof assertion.name !== 'string' || typeof assertion.pass !== 'boolean') throw new Error('Each assertion must have a name and a boolean pass value.');
  const skipped = value.skipped ?? [];
  if (!Array.isArray(skipped)) throw new Error('A check skipped value must be an array.');
  const observations = value.observations ?? {};
  if (typeof observations !== 'object' || Array.isArray(observations) || ![Object.prototype, null].includes(Object.getPrototypeOf(observations))) throw new Error('A check observations value must be an object record.');
  if (!value.assertions.length && !skipped.length) throw new Error('A check returned no assertions or explicit skips.');
  return { assertions: [...value.assertions], observations: { ...observations }, skipped: [...skipped] };
}

const countFailures = record => record.assertions.filter(assertion => !assertion.pass).length;
const mdText = value => String(value ?? '').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
function json(value) {
  const ancestors = [];
  return JSON.stringify(value, function (_key, item) {
    if (typeof item === 'bigint') return String(item);
    if (item instanceof Error) return describeError(item);
    if (item && typeof item === 'object') {
      while (ancestors.length && ancestors.at(-1) !== this) ancestors.pop();
      if (ancestors.includes(item)) return '[Circular]';
      ancestors.push(item);
    }
    return item;
  }, 2) + '\n';
}

function environmentMarkdown(environment) {
  const lines = [`Rendering requested: **${environment.requestedMode || 'unresolved'}**.`];
  for (const deployment of environment.deployments || []) lines.push(`- ${deployment.base}: ${deployment.actualMode}; ${mdText(deployment.webgl?.renderer || 'renderer unavailable')}. ${deployment.frameInterpretation}`);
  if (environment.chromiumPath) lines.push(`Chromium: ${environment.chromiumPath}`);
  return lines.join('\n');
}

export async function writeReports(summary, directory) {
  await mkdir(directory, { recursive: true });
  for (const check of summary.checks) {
    const report = { schemaVersion: summary.schemaVersion, check: check.name, startedAt: summary.startedAt, completedAt: summary.completedAt, environment: summary.environment, status: check.status, failures: check.failures, cases: check.cases, runErrors: summary.errors };
    const markdown = [`# QA: ${check.name}`, '', `Result: **${check.status}** (${check.failures} failed assertions).`, '', environmentMarkdown(summary.environment), '', '| Base | Result | Assertions | Skips |', '| --- | --- | ---: | ---: |'];
    for (const item of check.cases) markdown.push(`| ${mdText(item.base)} | ${item.status} | ${item.assertions.length} | ${item.skipped.length} |`);
    for (const item of check.cases) {
      for (const assertion of item.assertions.filter(assertion => !assertion.pass)) markdown.push('', `- ${mdText(item.base)}: **${mdText(assertion.name)}**${assertion.detail ? ` — ${mdText(assertion.detail)}` : ''}`);
      for (const skip of item.skipped) markdown.push('', `- Skipped at ${mdText(item.base)}: ${mdText(skip.reason || skip)}`);
    }
    if (!check.cases.length) markdown.push('', 'This check did not run. See the run errors in summary.json.');
    await Promise.all([writeFile(path.join(directory, `${check.name}.json`), json(report)), writeFile(path.join(directory, `${check.name}.md`), markdown.join('\n') + '\n')]);
  }
  const markdown = ['# QA run', '', `Result: **${summary.status}**; exit ${summary.exitCode}; ${summary.failures} failed assertions.`, '', environmentMarkdown(summary.environment), '', '| Check | Result | Bases | Failed assertions |', '| --- | --- | ---: | ---: |', ...summary.checks.map(check => `| ${check.name} | ${check.status} | ${check.cases.length} | ${check.failures} |`)];
  for (const error of summary.errors) markdown.push('', `- ${mdText(error.phase)}: ${mdText(error.message)}`);
  await Promise.all([writeFile(path.join(directory, 'summary.json'), json(summary)), writeFile(path.join(directory, 'summary.md'), markdown.join('\n') + '\n')]);
}

function updateCheckStatuses(summary, finished = false) {
  for (const check of summary.checks) {
    check.failures = check.cases.reduce((sum, record) => sum + record.failures, 0);
    check.status = check.failures ? 'failed' : !check.cases.length ? 'not-run'
      : check.cases.length === summary.selection.bases.length
        ? check.cases.every(record => record.status === 'skipped') ? 'skipped' : 'passed'
        : finished ? 'incomplete' : 'running';
  }
  summary.failures = summary.checks.reduce((sum, check) => sum + check.failures, 0);
}

export async function runHarness({ argv = process.argv.slice(2), env = process.env, checks, instrument, root = ROOT, reportsRoot = path.join(root, 'tools/qa/reports'), loadPlaywright = resolvePlaywright, launchConfig = resolveLaunchOptions, startServer = startPreview, inspectBrowser = inspectBrowserEnvironment, signalTarget = process, now = () => new Date(), log = console.log } = {}) {
  const startedAt = now().toISOString();
  const directory = path.join(reportsRoot, startedAt.replace(/[:.]/g, '-') + `-${process.pid}`);
  const summary = { schemaVersion: 1, startedAt, completedAt: null, status: 'running', exitCode: 0, failures: 0, selection: null, environment: { node: process.version, platform: process.platform, architecture: process.arch, deployments: [] }, checks: [], errors: [] };
  const resources = new Set(), abortController = new AbortController();
  let interrupted;
  const cleanup = async () => {
    const results = await Promise.allSettled([...resources].map(resource => resource.stop ? resource.stop() : resource.close()));
    return results.filter(result => result.status === 'rejected').map(result => describeError(result.reason));
  };
  const signalHandlers = {};
  for (const signal of ['SIGINT', 'SIGTERM']) {
    signalHandlers[signal] = () => { if (!interrupted) { interrupted = signal; abortController.abort(); void cleanup(); } };
    signalTarget.on(signal, signalHandlers[signal]);
  }
  try {
    const selection = parseCli(argv, { checks, env });
    summary.selection = selection;
    summary.environment.requestedMode = selection.gpu ? 'GPU' : 'SwiftShader';
    summary.checks = selection.checks.map(name => ({ name, status: 'not-run', failures: 0, cases: [] }));
    if (selection.help) {
      log(`Usage: node tools/qa/run.mjs [${Object.keys(checks).join('|')}] [--base /tmu-course-guides/] [--gpu]\nWithout --base, both / and /tmu-course-guides/ run. QA_GPU=1 enables GPU launch arguments.`);
      summary.status = 'help';
    } else {
      const resolved = await loadPlaywright({ env });
      const launch = launchConfig(resolved.playwright, { env, gpu: selection.gpu });
      Object.assign(summary.environment, { playwrightPath: resolved.modulePath, playwrightSource: resolved.source, chromiumPath: launch.options.executablePath, chromiumSource: launch.executableSource, launchArgs: launch.options.args });
      for (const base of selection.bases) {
        if (interrupted) break;
        const server = await startServer({ root, base, signal: abortController.signal });
        resources.add(server);
        let browser;
        try {
          browser = await resolved.playwright.chromium.launch(launch.options);
          resources.add(browser);
          summary.environment.deployments.push({ base, origin: server.origin, ...await inspectBrowser(browser, { gpu: selection.gpu }) });
          for (const check of summary.checks) {
            if (interrupted) break;
            const started = Date.now(), scope = superviseCheck(browser, resolved.playwright);
            // Closing the primary browser also closes contexts on an interruption.
            const scopeResource = { close: () => scope.close() };
            resources.add(scopeResource);
            const record = { base, origin: server.origin, status: 'running', assertions: [], observations: {}, skipped: [] };
            try {
              Object.assign(record, normalizeResult(await checks[check.name]({ browser: scope.browser, origin: server.origin, base, gpu: selection.gpu, instrument, launchOptions: launch.options, playwright: scope.playwright, progress:message=>log(`${check.name} ${base}: ${message}`) })));
            } catch (error) {
              record.error = describeError(error);
              record.assertions.push({ name: 'check completed without exception', pass: false, detail: error.message || String(error) });
            } finally {
              const cleanupErrors = await scope.close();
              resources.delete(scopeResource);
              record.observations.runnerErrors = scope.errors();
              if (cleanupErrors.length) { record.observations.cleanupErrors = cleanupErrors; record.assertions.push({ name: 'check resources closed', pass: false, detail: cleanupErrors.map(error => error.message).join('; ') }); }
            }
            record.durationMs = Date.now() - started;
            record.failures = countFailures(record);
            record.status = record.failures ? 'failed' : record.assertions.length ? 'passed' : 'skipped';
            check.cases.push(record);
            log(`${check.name} ${base}: ${record.status} (${record.failures} failures)`);
            updateCheckStatuses(summary);
            await writeReports(summary, directory);
          }
        } finally {
          if (browser) { await browser.close(); resources.delete(browser); }
          await server.stop(); resources.delete(server);
        }
      }
    }
  } catch (error) {
    summary.errors.push({ phase: 'startup/runtime', ...describeError(error) });
    summary.exitCode = 2;
  } finally {
    const cleanupErrors = await cleanup();
    for (const error of cleanupErrors) summary.errors.push({ phase: 'cleanup', ...error });
    if (cleanupErrors.length) summary.exitCode = 2;
    for (const [signal, handler] of Object.entries(signalHandlers)) signalTarget.off(signal, handler);
    updateCheckStatuses(summary, true);
    if (!summary.exitCode && summary.failures) summary.exitCode = 1;
    if (interrupted) { summary.exitCode = interrupted === 'SIGINT' ? 130 : 143; summary.errors.push({ phase: 'signal', message: `Interrupted by ${interrupted}; partial results retained.` }); }
    summary.status = interrupted ? 'interrupted' : summary.exitCode === 2 ? 'error' : summary.failures ? 'failed' : summary.status === 'help' ? 'help' : 'passed';
    summary.completedAt = now().toISOString();
    await writeReports(summary, directory);
  }
  log(`QA ${summary.status}. Reports: ${directory}`);
  return { exitCode: summary.exitCode, summary, directory };
}
