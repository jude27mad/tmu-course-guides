import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('menu and search choose the same dynamic Safari browser surface', () => {
  const navbar = read('../src/components/dom/navbar/Index.jsx');
  assert.ok(navbar.includes('setBrowserSurface(isOpen ? \'dark\' : \'light\')'));
  assert.ok(navbar.includes('const isOpen = isMenuOpen || isSearchOpen'));
  const theme = read('../src/utils/theme.js');
  assert.ok(theme.includes('document.documentElement.dataset.browserSurface'));
  assert.ok(theme.includes("dark ? '#09050c' : DEFAULT_PALETTE.secondary"));
  assert.ok(theme.includes("document.documentElement.dataset.browserSurface !== 'dark'"));
});

test('page edge matches dark overlay but remains paper when closed', () => {
  const global = read('../src/styles/global.scss');
  assert.ok(global.includes("html[data-browser-surface='dark'] body"));
  assert.ok(global.includes('background-color: #09050c'));
  assert.ok(global.includes('background-color: var(--white)'));
});
