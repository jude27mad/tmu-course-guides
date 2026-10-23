import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('Safari uses paintless fixed edge samplers, independently at the top and bottom', () => {
  const page = read('../src/pages/_app.page.jsx');
  const css = read('../src/styles/global.scss');
  assert.match(page, /data-safari-edge="top"/);
  assert.match(page, /data-safari-edge="bottom"/);
  assert.match(css, /background-clip:\s*text/);
  assert.match(css, /-webkit-background-clip:\s*text/);
  assert.match(css, /--safari-edge-top/);
  assert.match(css, /--safari-edge-bottom/);
});

test('Safari browser top stays paper on normal pages, while dark overlay tints both bars', () => {
  const theme = read('../src/utils/theme.js');
  const navbar = read('../src/components/dom/navbar/Index.jsx');
  assert.match(theme, /setBrowserSurfaces/);
  assert.match(navbar, /data-surface=[^\n]*dark/);
  assert.match(navbar, /setBrowserSurfaces/);
  assert.doesNotMatch(navbar, /setBrowserSurface\(overlay \|\| darkFooter/);
});

test('all active Desk and directory scroll animations follow the real scroll root', () => {
  for (const pathname of [
    '../src/pages/components/home/Index.jsx',
    '../src/pages/components/about/Index.jsx',
    '../src/pages/components/clients/Index.jsx',
    '../src/pages/components/projects/CourseCards.jsx',
    '../src/components/animationComponents/textOpacity/Index.jsx',
    '../src/components/dom/Footer.jsx',
  ]) {
    const source = read(pathname);
    assert.ok(source.includes('scrollRoot()'), `Missing actual scrolling owner in ${pathname}`);
    assert.doesNotMatch(source, /scroller:\s*document\??\.querySelector\(['"]main['"]\)/);
  }
});
