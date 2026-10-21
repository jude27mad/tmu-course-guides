import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

import { assemble, checkSite, exportedRoutes, forwarderHtml, normalizeBase, planForwarders } from '../scripts/pages-site.mjs';

const BASE = '/tmu-course-guides';
const ROUTES = ['cen100', 'courses', 'mth140', 'mth141', 'privacy'];

const nextPage = (base = BASE) =>
  `<!DOCTYPE html><html><head><script src="${base}/_next/static/chunks/main.js" defer=""></script></head>` +
  `<body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{"buildId":"test"}</script></body></html>`;

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'pages-site-'));
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), body);
  }
  return dir;
}

function exportFixture(base = BASE) {
  const files = { 'index.html': nextPage(base), '404.html': nextPage(base), '404/index.html': nextPage(base), '_next/static/chunks/main.js': '' };
  for (const route of ROUTES) files[`${route}/index.html`] = nextPage(base);
  return fixture(files);
}

function published(base = BASE) {
  const out = exportFixture(base);
  const dest = join(mkdtempSync(join(tmpdir(), 'pages-dest-')), 'site');
  assemble({ out, dest, base: BASE });
  return { out, dest };
}

// Runs a forwarder's script against a fake location and returns the address it replaces the page with.
function forwardFrom(html, { search = '', hash = '' } = {}) {
  const script = /<script>(.*)<\/script>/.exec(html)[1];
  let replaced;
  vm.runInNewContext(script, { location: { search, hash, replace: (to) => (replaced = to) } });
  return replaced;
}

test('normalizeBase', () => {
  assert.equal(normalizeBase('/tmu-course-guides'), '/tmu-course-guides');
  assert.equal(normalizeBase('/tmu-course-guides/'), '/tmu-course-guides');
  assert.equal(normalizeBase('/'), '');
  assert.equal(normalizeBase(''), '');
  assert.throws(() => normalizeBase(undefined), /No base path/);
  assert.throws(() => normalizeBase('tmu course'), /Invalid base path/);
});

test('exportedRoutes lists page folders only', () => {
  const out = exportFixture();
  try {
    assert.deepEqual(exportedRoutes(out), ROUTES);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('planForwarders maps every old address to its page in the new design', () => {
  assert.deepEqual(planForwarders({ base: BASE, routes: ROUTES }), [
    { file: 'privacy.html', dest: '/tmu-course-guides/privacy/' },
    { file: 'colour-preview.html', dest: '/tmu-course-guides/cen100/' },
    { file: 'next/index.html', dest: '/tmu-course-guides/' },
    { file: 'next/cen100/index.html', dest: '/tmu-course-guides/cen100/' },
    { file: 'next/courses/index.html', dest: '/tmu-course-guides/courses/' },
    { file: 'next/mth140/index.html', dest: '/tmu-course-guides/mth140/' },
    { file: 'next/mth141/index.html', dest: '/tmu-course-guides/mth141/' },
    { file: 'next/privacy/index.html', dest: '/tmu-course-guides/privacy/' },
  ]);
  // No forwarder replaces a page of the new design.
  const files = planForwarders({ base: BASE, routes: ROUTES }).map(({ file }) => file);
  assert.equal(files.includes('index.html'), false);
  for (const route of ROUTES) assert.equal(files.includes(`${route}/index.html`), false);
});

test('forwarderHtml is a small, unindexed page that works with and without JavaScript', () => {
  const html = forwarderHtml('/tmu-course-guides/privacy/');
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.ok(html.includes('<noscript><meta http-equiv="refresh" content="0; url=/tmu-course-guides/privacy/"></noscript>'));
  assert.ok(html.includes('<a href="/tmu-course-guides/privacy/">'));
  const script = /<script>(.*)<\/script>/.exec(html)[1];
  const hash = createHash('sha256').update(script).digest('base64');
  assert.ok(html.includes(`script-src 'sha256-${hash}'`), 'the policy allows exactly this script');
  assert.ok(html.includes("default-src 'none'"));
  for (const bad of ['https://evil.example/', '//evil.example/', '/tmu-course-guides//x/', '/no-slash', '/a b/', '/"/', 'relative/']) {
    assert.throws(() => forwarderHtml(bad), /Invalid forwarding address/, bad);
  }
});

test('the forwarder keeps the query and hash but never leaves its address', () => {
  const html = forwarderHtml('/tmu-course-guides/cen100/');
  assert.equal(forwardFrom(html), '/tmu-course-guides/cen100/');
  assert.equal(forwardFrom(html, { search: '?motion=off', hash: '#assignment-m2' }), '/tmu-course-guides/cen100/?motion=off#assignment-m2');
  for (const tail of [{ hash: '#//evil.example/x' }, { search: '?//evil.example' }, { hash: '#javascript:alert(1)' }]) {
    const to = new URL(forwardFrom(html, tail), 'https://jude27mad.github.io/tmu-course-guides/next/cen100/');
    assert.equal(to.origin, 'https://jude27mad.github.io');
    assert.equal(to.pathname, '/tmu-course-guides/cen100/');
  }
});

test('assemble copies the export and adds the forwarders', () => {
  const { out, dest } = published();
  try {
    assert.equal(readFileSync(join(dest, 'index.html'), 'utf8'), nextPage());
    assert.equal(forwardFrom(readFileSync(join(dest, 'privacy.html'), 'utf8')), '/tmu-course-guides/privacy/');
    assert.equal(forwardFrom(readFileSync(join(dest, 'next/mth140/index.html'), 'utf8')), '/tmu-course-guides/mth140/');
    assert.deepEqual(checkSite({ dir: dest, base: BASE }), []);
    assert.throws(() => assemble({ out, dest, base: BASE }), /not empty/);
  } finally {
    rmSync(out, { recursive: true, force: true });
    rmSync(dirname(dest), { recursive: true, force: true });
  }
});

test('assemble refuses to replace a file of the export', () => {
  const out = exportFixture();
  writeFileSync(join(out, 'privacy.html'), nextPage());
  const dest = join(mkdtempSync(join(tmpdir(), 'pages-dest-')), 'site');
  try {
    assert.throws(() => assemble({ out, dest, base: BASE }), /already has privacy\.html/);
  } finally {
    rmSync(out, { recursive: true, force: true });
    rmSync(dirname(dest), { recursive: true, force: true });
  }
});

test('checkSite rejects anything that is not the new design', () => {
  const cases = [
    ['a build for another address', (dest) => writeFileSync(join(dest, 'cen100/index.html'), nextPage('/tmu-course-guides/next')), /cen100\/index\.html was not built for \/tmu-course-guides/],
    ['a link to the old preview', (dest) => writeFileSync(join(dest, 'courses/index.html'), nextPage() + '<a href="/tmu-course-guides/next/">'), /links to the old \/next\/ preview/],
    [
      'a page of the previous design',
      (dest) => writeFileSync(join(dest, 'mth140/index.html'), '<!doctype html><title>MTH140</title><script src="../assets/hub.js"></script>'),
      /mth140\/index\.html is neither/,
    ],
    ['repository folders', (dest) => mkdirSync(join(dest, 'assets')), /assets must not be published/],
    ['a missing 404 page', (dest) => rmSync(join(dest, '404.html')), /Missing 404\.html/],
    ['a forwarder to nowhere', (dest) => writeFileSync(join(dest, 'next/x.html'), forwarderHtml('/tmu-course-guides/gone/')), /forwards to \/tmu-course-guides\/gone\/, which is not published/],
    ['a lost old address', (dest) => rmSync(join(dest, 'colour-preview.html')), /colour-preview\.html would not be found/],
  ];
  for (const [name, spoil, problem] of cases) {
    const { out, dest } = published();
    try {
      spoil(dest);
      const problems = checkSite({ dir: dest, base: BASE });
      assert.ok(
        problems.some((text) => problem.test(text)),
        `${name}: ${problems.join(' | ')}`,
      );
    } finally {
      rmSync(out, { recursive: true, force: true });
      rmSync(dirname(dest), { recursive: true, force: true });
    }
  }
});
