// Assembles what GitHub Pages publishes (.github/workflows/pages.yml): the static export built for the
// main address, plus small pages that forward the previous website's addresses and the old /next/ preview
// to their pages in this design. Nothing else from the repository is published; the previous website's
// files stay in the repository, where its tests still run.
// Usage, after `SITE_BASE_PATH=/tmu-course-guides npm run build`:
//   node scripts/pages-site.mjs build --out out --dest <folder> [--base /tmu-course-guides]
//   node scripts/pages-site.mjs check <folder> [--base /tmu-course-guides]
// --base defaults to SITE_BASE_PATH and must match the build.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOKENS } from '../src/lib/palette.mjs';

// The old pages' guide mark, as in src/pages/_document.page.jsx.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='3' fill='%23102a2d'/%3E%3Cpath d='M8 15 17 10v21l-9 5zm12-1 12-6v21l-12 6zm-9-6 9-5 4 4-9 5z' fill='%23f5e5d4'/%3E%3C/svg%3E";

// A destination is a folder path on this site: /seg/seg/ with plain URL characters only, so it can be
// written into the page without escaping.
const DEST = /^\/(?:[A-Za-z0-9._~-]+\/)*$/;

// Addresses that must keep working: the previous website's pages and the targets of the
// jude27mad/cen100-guide forwarder (docs/qa/night-shift/forwarder.md).
export const KEPT_ADDRESSES = ['', 'cen100/', 'mth140/', 'mth141/', 'privacy.html', 'colour-preview.html', 'next/'];

// Repository content that must never be published.
const PRIVATE = ['assets', 'tests', 'tools', 'docs', 'site', 'node_modules', '.github', 'README.md', 'package.json'];

export function normalizeBase(base) {
  if (base == null) throw new Error('No base path: pass --base or set SITE_BASE_PATH.');
  const value = base === '/' ? '' : String(base).replace(/\/+$/, '');
  if (value && !DEST.test(`${value}/`)) throw new Error(`Invalid base path: ${base}`);
  return value;
}

// The folders of the export that hold a page (out/<route>/index.html), apart from the 404 page.
export function exportedRoutes(out) {
  return readdirSync(out, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== '404')
    .filter((entry) => existsSync(join(out, entry.name, 'index.html')))
    .map((entry) => entry.name)
    .sort();
}

// Published file -> address it forwards to.
export function planForwarders({ base, routes }) {
  const root = `${normalizeBase(base)}/`;
  return [
    { file: 'privacy.html', dest: `${root}privacy/` },
    { file: 'colour-preview.html', dest: `${root}cen100/` },
    { file: 'next/index.html', dest: root },
    ...routes.map((route) => ({ file: `next/${route}/index.html`, dest: `${root}${route}/` })),
  ];
}

// The page keeps the visitor's query and hash, as assets/legacy-route.js does. Its address is fixed, so a
// query or hash can't take it anywhere else. Without JavaScript the refresh goes to the page itself.
export function forwarderHtml(dest) {
  if (!DEST.test(dest) || dest.includes('//')) throw new Error(`Invalid forwarding address: ${dest}`);
  const script = `location.replace(${JSON.stringify(dest)}+location.search+location.hash)`;
  const hash = createHash('sha256').update(script).digest('base64');
  const csp = ["default-src 'none'", `script-src 'sha256-${hash}'`, "style-src 'unsafe-inline'", 'img-src data:', "base-uri 'none'", "form-action 'none'"].join('; ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TMU Course Guides</title>
<link rel="icon" href="${FAVICON}">
<script>${script}</script>
<noscript><meta http-equiv="refresh" content="0; url=${dest}"></noscript>
<style>body{margin:0;padding:2rem 1rem;font:1rem/1.5 system-ui,sans-serif;color:${TOKENS.ink};background:${TOKENS.page}}a{color:inherit}</style>
</head>
<body>
<p>This page has moved. <a href="${dest}">Open TMU Course Guides</a>.</p>
</body>
</html>
`;
}

export function assemble({ out, dest, base }) {
  if (!existsSync(join(out, 'index.html'))) throw new Error(`${out} has no index.html: run \`next build\` first.`);
  if (existsSync(dest) && readdirSync(dest).length) throw new Error(`${dest} is not empty; refusing to write into it.`);
  cpSync(out, dest, { recursive: true });
  const forwarders = planForwarders({ base, routes: exportedRoutes(out) });
  for (const { file, dest: to } of forwarders) {
    const path = join(dest, file);
    if (existsSync(path)) throw new Error(`The export already has ${file}; a forwarder would replace it.`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, forwarderHtml(to));
  }
  return forwarders;
}

function walk(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    found.push(path);
    if (entry.isDirectory()) walk(path, found);
  }
  return found;
}

// The local file a site address serves, as GitHub Pages resolves it (a folder serves its index.html).
function servedFile(dir, address) {
  return join(dir, address === '' || address.endsWith('/') ? `${address}index.html` : address);
}

// Every problem with a publish folder; an empty list means it is ready.
export function checkSite({ dir, base }) {
  const root = normalizeBase(base);
  const problems = [];
  if (!existsSync(dir)) return [`${dir} does not exist.`];
  const top = readdirSync(dir);
  for (const name of PRIVATE) if (top.includes(name)) problems.push(`${name} must not be published.`);
  for (const name of ['index.html', '404.html']) if (!top.includes(name)) problems.push(`Missing ${name}.`);

  let bytes = 0;
  for (const path of walk(dir)) {
    const file = relative(dir, path).split(sep).join('/');
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      problems.push(`${file} is a symbolic link.`);
      continue;
    }
    bytes += stat.size;
    if (!stat.isFile() || !file.endsWith('.html')) continue;
    const html = readFileSync(path, 'utf8');
    if (html.includes('id="__NEXT_DATA__"')) {
      if (!html.includes(`"${root}/_next/static/`)) problems.push(`${file} was not built for ${root || '/'}.`);
      if (html.includes(`${root}/next/`)) problems.push(`${file} links to the old /next/ preview.`);
      continue;
    }
    const target = /location\.replace\(("[^"]*")\+location\.search\+location\.hash\)/.exec(html);
    if (!target || !html.includes('<meta name="robots" content="noindex">')) {
      problems.push(`${file} is neither a page of this design nor a forwarder.`);
      continue;
    }
    const to = JSON.parse(target[1]);
    if (!to.startsWith(`${root}/`) || !existsSync(servedFile(dir, to.slice(root.length + 1)))) {
      problems.push(`${file} forwards to ${to}, which is not published.`);
    }
  }
  for (const address of KEPT_ADDRESSES) {
    if (!existsSync(servedFile(dir, address))) problems.push(`${root}/${address} would not be found.`);
  }
  if (bytes > 1e9) problems.push(`The site is ${bytes} bytes; GitHub Pages allows 1 GB.`);
  return problems;
}

function options(args) {
  const named = {};
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) named[args[i].slice(2)] = args[(i += 1)];
    else rest.push(args[i]);
  }
  return { named, rest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2);
  const { named, rest } = options(args);
  const base = normalizeBase(named.base ?? process.env.SITE_BASE_PATH);
  if (command === 'build') {
    const forwarders = assemble({ out: resolve(named.out || 'out'), dest: resolve(named.dest), base });
    for (const { file, dest } of forwarders) console.log(`${file} -> ${dest}`);
  } else if (command === 'check') {
    const problems = checkSite({ dir: resolve(rest[0] || named.dir), base });
    for (const problem of problems) console.error(problem);
    if (problems.length) process.exit(1);
    console.log('Publish folder OK.');
  } else {
    console.error('Usage: node scripts/pages-site.mjs build --out out --dest <folder> | check <folder> [--base <path>]');
    process.exit(2);
  }
}
