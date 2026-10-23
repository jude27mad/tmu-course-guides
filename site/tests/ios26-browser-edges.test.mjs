import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('Safari transparency is not replaced by opaque fixed edge colour samples', () => {
  const page = read('../src/pages/_app.page.jsx');
  const css = read('../src/styles/global.scss');
  assert.doesNotMatch(page, /data-safari-edge=/);
  assert.doesNotMatch(css, /--safari-edge-(top|bottom)/);
  assert.doesNotMatch(css, /background-clip:\s*text/);
  assert.match(page, /data-safari-blend="top"/);
  assert.match(page, /data-safari-blend="bottom"/);
  assert.ok(page.indexOf('data-safari-blend="top"') < page.indexOf('id="layout"'));
  assert.ok(page.indexOf('data-safari-blend="bottom"') > page.indexOf('<Component'));
  assert.match(css, /\.safari-toolbar-blend\s*\{[^}]*position:\s*sticky;[^}]*background(?:-color)?:\s*transparent;/);
  assert.match(css, /bottom:\s*-2px/);
});

test('Safari browser surface state remains compatible with menus and the dark footer', () => {
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
