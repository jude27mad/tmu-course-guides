// R4 only. Run after npm run build: node scripts/spike-bundle-measurements.mjs
// Measures the actual exported chunks; a stale/mismatched export is an error.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(site, '../docs/codex/remove-repetition/reports/r4-evidence/bundles.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const loadableBytes = await readFile(resolve(site, '.next/react-loadable-manifest.json'));
const buildManifestBytes = await readFile(resolve(site, '.next/build-manifest.json'));
const loadable = JSON.parse(loadableBytes);
const buildManifest = JSON.parse(buildManifestBytes);
const calendarEntry = Object.entries(loadable).find(([key]) => key.includes('spike.page.jsx') && key.includes('CalendarProbe'));
if (!calendarEntry) throw new Error('CalendarProbe dynamic import missing from react-loadable-manifest.json');
const calendarFiles = [...new Set(calendarEntry[1].files)];
const sharedAppFiles = new Set(buildManifest.pages['/_app']);
const routeOnlyFiles = buildManifest.pages['/spike'].filter((file) => !sharedAppFiles.has(file));
if (!calendarFiles.length || !routeOnlyFiles.length) throw new Error('Empty calendar or spike file list');

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  Object.values(node).forEach((child) => {
    if (Array.isArray(child)) child.forEach((value) => walk(value, visitor));
    else if (child && typeof child === 'object') walk(child, visitor);
  });
}

function scanJavaScript(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const sites = [];
  const moduleFactories = [];
  walk(ast, (node) => {
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const { callee } = node;
      let name = null;
      if (callee.type === 'Identifier') name = callee.name;
      else if (callee.type === 'MemberExpression') name = callee.computed ? callee.property.value : callee.property.name;
      if (name === 'eval' || name === 'Function') {
        sites.push({ kind: node.type, callee: name, line: node.loc.start.line, column: node.loc.start.column, excerpt: source.slice(node.start, Math.min(node.end, node.start + 140)) });
      }
      // Webpack's registration call contains an object mapping module IDs to
      // factory functions. Inspect it statically, without executing any bundle.
      if (callee.type === 'MemberExpression' && callee.property.name === 'push') {
        const registration = node.arguments[0];
        if (registration?.type === 'ArrayExpression' && registration.elements[1]?.type === 'ObjectExpression') {
          registration.elements[1].properties.forEach((property) => {
            const factory = property.value;
            const factorySource = source.slice(factory.start, factory.end);
            moduleFactories.push({
              id: String(property.key.value ?? property.key.name),
              rawBytes: Buffer.byteLength(factorySource),
              namedMarkers: ['Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent', 'Collapsible'].filter((marker) => factorySource.includes(`"${marker}"`)),
            });
          });
        }
      }
    }
  });
  return {
    parser: 'acorn',
    scope:
      'Parsed AST: direct calls/new expressions named eval or Function, including named member access. This does not prove the absence of deliberately aliased/obfuscated dynamic code; runtime CSP observations are separate evidence.',
    evalOrFunctionSites: sites,
    moduleFactories,
  };
}

const allFiles = [...new Set([...calendarFiles, ...routeOnlyFiles])];
const measurements = await Promise.all(
  allFiles.map(async (file) => {
    const buildBytes = await readFile(resolve(site, '.next', file));
    const exportedBytes = await readFile(resolve(site, 'out/_next', file));
    if (!buildBytes.equals(exportedBytes)) throw new Error(`Stale export: .next/${file} differs from out/_next/${file}`);
    return {
      file: `site/out/_next/${file}`,
      manifestFile: file,
      rawBytes: exportedBytes.length,
      gzip9Bytes: gzipSync(exportedBytes, { level: 9 }).length,
      sha256: sha256(exportedBytes),
      ...(file.endsWith('.js') ? { scan: scanJavaScript(exportedBytes.toString('utf8')) } : {}),
    };
  }),
);
const byFile = new Map(measurements.map((measurement) => [measurement.manifestFile, measurement]));
const totals = (files) => ({
  files,
  rawBytes: files.reduce((sum, file) => sum + byFile.get(file).rawBytes, 0),
  gzip9Bytes: files.reduce((sum, file) => sum + byFile.get(file).gzip9Bytes, 0),
});
const calendarJavaScript = calendarFiles.filter((file) => file.endsWith('.js'));
const calendarCss = calendarFiles.filter((file) => file.endsWith('.css'));
const accordionCandidates = routeOnlyFiles.filter(
  (file) => !file.startsWith('static/chunks/pages/') && byFile.get(file).scan?.moduleFactories.some((factory) => factory.namedMarkers.includes('AccordionTrigger')),
);
if (accordionCandidates.length !== 1) throw new Error(`Expected one separate accordion chunk; found ${accordionCandidates.length}`);
const accordionChunk = accordionCandidates[0];
const routeFixture = routeOnlyFiles.filter((file) => file !== accordionChunk);
const data = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  zlib: process.versions.zlib,
  buildId: (await readFile(resolve(site, '.next/BUILD_ID'), 'utf8')).trim(),
  buildSources: {
    reactLoadableManifestSha256: sha256(loadableBytes),
    buildManifestSha256: sha256(buildManifestBytes),
    spikeExportHtmlSha256: sha256(await readFile(resolve(site, 'out/spike/index.html'))),
  },
  method:
    'Raw UTF-8 emitted file bytes and gzipSync(level:9), summed per individually compressed file. Export bytes verified equal to .next/static bytes. Shared /_app React/Next/site-shell chunks are excluded; this measures the incremental spike payload, not total page transfer size.',
  calendar: {
    manifestKey: calendarEntry[0],
    definition:
      'Every file associated with the next/dynamic CalendarProbe import in react-loadable-manifest.json. Includes core, React adapter, Preact/signals, Temporal polyfill, calendar controls/events service and the sample fixture wherever Webpack put them. It is not a package-only tree-shaking estimate.',
    javaScript: totals(calendarJavaScript),
    css: totals(calendarCss),
    combined: totals(calendarFiles),
  },
  accordion: {
    definition:
      'Entire separate emitted accordion/Radix-dependency chunk identified by its AccordionTrigger/AccordionContent string literals in a statically parsed Webpack module factory. Shared React is excluded. The three-panel fixture, controls, error boundary and dynamic-loader glue live in the separately reported route fixture.',
    chunk: totals([accordionChunk]),
    routeFixture: totals(routeFixture),
    allRouteIncrement: totals(routeOnlyFiles),
  },
  files: measurements,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${output}`);
console.log(`Calendar JS gzip9=${data.calendar.javaScript.gzip9Bytes}; CSS gzip9=${data.calendar.css.gzip9Bytes}; accordion chunk gzip9=${data.accordion.chunk.gzip9Bytes} bytes`);
console.log(`Direct eval/Function AST sites: ${measurements.reduce((sum, measurement) => sum + (measurement.scan?.evalOrFunctionSites.length || 0), 0)}`);
