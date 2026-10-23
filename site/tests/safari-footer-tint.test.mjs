import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const navbar = readFileSync(new URL('../src/components/dom/navbar/Index.jsx', import.meta.url), 'utf8');
test('browser surface follows footer at the bottom of the scroll viewport, not only the menu', () => {
  assert.ok(navbar.includes("scroller.addEventListener('scroll', schedule"));
  assert.ok(navbar.includes("footerRect.top < scrollerRect.bottom - 1"));
  assert.ok(navbar.includes("setBrowserSurface(overlay || darkFooter ? 'dark' : 'light')"));
  assert.ok(navbar.includes("scroller.removeEventListener('scroll', schedule)"));
});
