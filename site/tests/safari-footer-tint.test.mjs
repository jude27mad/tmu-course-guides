import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const navbar = readFileSync(new URL('../src/components/dom/navbar/Index.jsx', import.meta.url), 'utf8');
test('browser surface follows footer at the bottom of the scroll viewport, not only the menu', () => {
  assert.ok(navbar.includes("scroller.addEventListener('scroll', schedule"));
  assert.ok(navbar.includes("footerRect.top < scrollerRect.bottom - 1"));
  assert.ok(navbar.includes("setBrowserSurfaces(overlay ? 'dark' : 'light', overlay || darkFooter ? 'dark' : 'light')"));
  assert.ok(navbar.includes("scroller.removeEventListener('scroll', schedule)"));
});

test('on iPhone the bottom is dark once the footer fills most of the area under Safari\'s bar', () => {
  // Safari stops the document's end above its bottom bar, so at the end the footer's
  // bottom never reaches the viewport's: requiring it left the end paper (a white box).
  const documentMode = navbar.slice(navbar.indexOf('const darkFooter = nativeIOSScroll()'), navbar.indexOf("setBrowserSurfaces(overlay ? 'dark'"));
  assert.match(documentMode, /\? !!footerRect && footerRect\.top < scrollerRect\.bottom - FOOTER_UNDER_BAR\s*:/);
  assert.match(navbar, /const FOOTER_UNDER_BAR = 40;/);
});
