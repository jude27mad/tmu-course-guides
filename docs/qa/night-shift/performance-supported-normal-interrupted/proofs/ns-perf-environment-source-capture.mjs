// Read-only source/driver capture for either explicit driver. Never launches a browser.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd(), output = process.argv[2], priorPath = process.argv[3];
if (!output || !process.env.PLAYWRIGHT_PATH) throw Error('Output and explicit PLAYWRIGHT_PATH are required.');
const hash = value => createHash('sha256').update(value).digest('hex');
const { resolvePlaywright, resolveLaunchOptions } = await import(pathToFileURL(path.join(root, 'tools/qa/runtime.mjs')));
const resolved = resolvePlaywright({ env: process.env });
if (resolved.source !== 'PLAYWRIGHT_PATH' || resolved.modulePath !== path.resolve(process.env.PLAYWRIGHT_PATH)) throw Error('A fallback driver is forbidden.');
const launch = resolveLaunchOptions(resolved.playwright, { env: process.env, gpu: process.env.QA_GPU === '1' });
const require = createRequire(path.join(resolved.modulePath, 'index.js'));
function identity(packagePath) {
  const realPackage = realpathSync(packagePath), directory = path.dirname(realPackage), pkg = JSON.parse(readFileSync(realPackage));
  return { name: pkg.name, version: pkg.version, realDirectory: directory, packagePath: realPackage,
    packageSHA256: hash(readFileSync(realPackage)), entryPath: realpathSync(path.join(directory, 'index.js')),
    entrySHA256: hash(readFileSync(path.join(directory, 'index.js'))) };
}
const driverIdentity = { playwright: identity(path.join(resolved.modulePath, 'package.json')), core: identity(require.resolve('playwright-core/package.json')) };
if (process.env.NS_QA_REQUIRE_VERSION && (driverIdentity.playwright.version !== process.env.NS_QA_REQUIRE_VERSION || driverIdentity.core.version !== process.env.NS_QA_REQUIRE_VERSION)) throw Error('Unexpected driver/core version.');
if (process.env.NS_QA_REQUIRE_BUNDLED === '1' && launch.executableSource !== 'Playwright bundled Chromium') throw Error('The matching bundled browser is required; system fallback is forbidden.');
const manifestPath = path.join(driverIdentity.core.realDirectory, 'browsers.json');
const manifest = JSON.parse(readFileSync(manifestPath));
const binaryPath = realpathSync(launch.options.executablePath), binaryStat = statSync(binaryPath);
const browserIdentity = { binaryPath, binarySHA256: hash(readFileSync(binaryPath)), size: binaryStat.size,
  browserManifest: { path: manifestPath, sha256: hash(readFileSync(manifestPath)),
    chromium: manifest.browsers.find(browser => browser.name === 'chromium') ?? null } };
let webkitSetup = null;
if (process.env.NS_QA_WEBKIT_DEPENDENCIES) {
  const setupPath = realpathSync(process.env.NS_QA_WEBKIT_DEPENDENCIES), setup = JSON.parse(readFileSync(setupPath));
  if (setup.status !== 'verified' || !Array.isArray(setup.links) || !setup.links.length || !Array.isArray(setup.preservedExecutables)) throw Error('Verified WebKit setup manifest required.');
  for (const link of setup.links) {
    if (realpathSync(link.destinationPath) !== link.realPath || hash(readFileSync(link.destinationPath)) !== link.sha256) throw Error('WebKit dependency link/content changed.');
  }
  for (const executable of setup.preservedExecutables) if (hash(readFileSync(executable.path)) !== executable.sha256) throw Error('WebKit wrapper/binary changed.');
  webkitSetup = { path: setupPath, sha256: hash(readFileSync(setupPath)), libraryDirectory: setup.libraryDirectory,
    links: setup.links, preservedExecutables: setup.preservedExecutables,
    declaredBrowser: manifest.browsers.find(browser => browser.name === 'webkit') ?? null,
    note: 'WebKit-only Node LD prefix also reaches the initial Chromium probe in this ordinary WebKit invocation. Unchanged bundled WebKit wrappers use their own lib:sys/lib, where approved official ELF links are verified.' };
}
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'assets', '*.html', 'cen100', 'mth140', 'mth141'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
function fingerprint(protectedOnly) {
  const digest = createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    if (protectedOnly && ['assets/app/router.mjs', 'assets/app/route-boot.mjs'].includes(file)) continue;
    const bytes = readFileSync(path.join(root, file));digest.update(file + '\0');
    digest.update(protectedOnly && file.endsWith('.html') ? bytes.toString('utf8').match(/<body\b[\s\S]*$/i)?.[0] ?? bytes : bytes);digest.update('\0');
  }
  return digest.digest('hex');
}
const sourceNames = ['checks-resilience', 'checks', 'checks-perf', 'runtime', 'instrument'];
const record = { schemaVersion: 1, recordedAt: new Date().toISOString(), root,
  repositoryCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  productFingerprint: fingerprint(false), protectedFingerprint: fingerprint(true),
  sources: sourceNames.map(name => ({ path: `tools/qa/${name}.mjs`, sha256: hash(readFileSync(path.join(root, `tools/qa/${name}.mjs`))) })),
  entryPoint: { path: 'tools/qa/run.mjs', sha256: hash(readFileSync(path.join(root, 'tools/qa/run.mjs'))) },
  environment: Object.fromEntries(['PLAYWRIGHT_PATH', 'PLAYWRIGHT_BROWSERS_PATH', 'QA_CHROMIUM_PATH', 'QA_GPU', 'QA_NAV_DIAGNOSTICS', 'QA_PERF_RECORD', 'QA_PERF_BASELINE', 'PLAYWRIGHT_LEGACY_SCREENSHOT', 'LD_LIBRARY_PATH', 'NS_QA_WEBKIT_DEPENDENCIES'].map(name => [name, process.env[name] ?? null])),
  node: process.version, platform: process.platform, architecture: process.arch,
  loader: { modulePath: resolved.modulePath, source: resolved.source }, driverIdentity, browserIdentity, webkitSetup,
  launchOptions: launch.options, executableSource: launch.executableSource,
  note: 'Actual read-only source and driver observation. This script does not launch a browser or imply resource closure; actual run/raw/CLI/closure evidence must be bound separately.' };
if (priorPath) {
  const prior = JSON.parse(readFileSync(priorPath));
  record.beforeEvidence = { path: priorPath, sha256: hash(readFileSync(priorPath)), recordedAt: prior.recordedAt };
  record.sourceUnchanged = JSON.stringify(record.sources) === JSON.stringify(prior.sources) && JSON.stringify(record.entryPoint) === JSON.stringify(prior.entryPoint) && record.productFingerprint === prior.productFingerprint && record.protectedFingerprint === prior.protectedFingerprint;
  record.driverAndLaunchUnchanged = JSON.stringify(record.driverIdentity) === JSON.stringify(prior.driverIdentity) && JSON.stringify(record.browserIdentity) === JSON.stringify(prior.browserIdentity) && JSON.stringify(record.webkitSetup) === JSON.stringify(prior.webkitSetup) && JSON.stringify(record.launchOptions) === JSON.stringify(prior.launchOptions) && JSON.stringify(record.environment) === JSON.stringify(prior.environment);
  if (!record.sourceUnchanged || !record.driverAndLaunchUnchanged) throw Error('Source, driver or launch environment changed.');
}
writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ path: output, sha256: hash(readFileSync(output)), recordedAt: record.recordedAt,
  productFingerprint: record.productFingerprint, protectedFingerprint: record.protectedFingerprint,
  driverVersion: driverIdentity.playwright.version, executableSource: launch.executableSource,
  sourceUnchanged: record.sourceUnchanged, driverAndLaunchUnchanged: record.driverAndLaunchUnchanged }, null, 2));
