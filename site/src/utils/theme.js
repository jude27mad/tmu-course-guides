import { DEFAULT_PALETTE } from '@src/lib/courses.mjs';
import { TOKENS } from '@src/lib/palette.mjs';
import { useStore } from '@src/store';

import { useEffect } from 'react';

// The original theme mapping, now using the same Desk palette on every course.
// A palette keeps the original project shape:
//   { primary, secondary, accentColor, fillColor, menuColor, menuFontColor, fluidColor, accent }
// primary -> --black (ink), secondary -> --white (paper), the rest map 1:1.
// Course records and generated 3D textures consume this same shared definition.
export { DEFAULT_PALETTE };

const VARIABLES = [
  ['--black', 'primary'],
  ['--white', 'secondary'],
  ['--accentColor', 'accentColor'],
  ['--fillColor', 'fillColor'],
  ['--menuColor', 'menuColor'],
  ['--menuFontColor', 'menuFontColor'],
  ['--accent', 'accent'],
];

function setThemeColor(color) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && color && document.documentElement.dataset.browserSurface !== 'dark') meta.setAttribute('content', color);
}

// Safari 26 samples real fixed-edge computed colors rather than theme-color.
// The menu changes both bars; a dark footer only changes the bottom bar.
let sampleRefreshFrame = 0;
export function setBrowserSurfaces(topMode, bottomMode = topMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const topDark = topMode === 'dark';
  const bottomDark = bottomMode === 'dark';
  const top = topDark ? 'dark' : 'light';
  const bottom = bottomDark ? 'dark' : 'light';
  const changed = root.dataset.browserSurface !== top || root.dataset.browserBottom !== bottom;
  root.dataset.browserSurface = top;
  root.dataset.browserBottom = bottom;
  root.style.setProperty('--safari-edge-top', topDark ? TOKENS.ink : DEFAULT_PALETTE.secondary);
  root.style.setProperty('--safari-edge-bottom', bottomDark ? TOKENS.ink : DEFAULT_PALETTE.secondary);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', topDark ? TOKENS.ink : DEFAULT_PALETTE.secondary);
  if (changed && root.dataset.scrollMode === 'document') {
    if (sampleRefreshFrame) cancelAnimationFrame(sampleRefreshFrame);
    root.setAttribute('data-safari-edge-refresh', '');
    sampleRefreshFrame = requestAnimationFrame(() => {
      sampleRefreshFrame = requestAnimationFrame(() => {
        root.removeAttribute('data-safari-edge-refresh');
        sampleRefreshFrame = 0;
      });
    });
  }
}

// The fixed artwork reaches under Safari's bars (--edge-bleed-* in global.scss).
// Its upward reach is shown once the page has scrolled at least that far, and its
// downward reach unless the end of a light-ending page is that close.
export function setEdgeBleed({ scrollTop, maxScroll, endsDark }) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const top = parseFloat(style.getPropertyValue('--edge-bleed-top')) || 0;
  const bottom = parseFloat(style.getPropertyValue('--edge-bleed-bottom')) || 0;
  root.dataset.edgeTop = scrollTop >= top ? 'open' : 'closed';
  root.dataset.edgeBottom = endsDark || maxScroll - scrollTop >= bottom ? 'open' : 'closed';
}

// Compatibility for callers requiring the same color at both ends.
export function setBrowserSurface(mode) {
  setBrowserSurfaces(mode, mode);
}

// Sets the CSS variables on <html> and the fluid tint. Safe to call on the server (no-op).
export function applyPalette(palette) {
  if (typeof document === 'undefined' || !palette) return;
  const full = { ...DEFAULT_PALETTE, ...palette };
  const root = document.documentElement;
  VARIABLES.forEach(([name, key]) => root.style.setProperty(name, full[key]));
  setThemeColor(full.secondary);
  useStore.getState().setFluidColor(full.fluidColor);
}

// Back to the original default palette (removes the inline overrides, so colors.scss wins again).
export function resetPalette() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  VARIABLES.forEach(([name]) => root.style.removeProperty(name));
  setThemeColor(DEFAULT_PALETTE.secondary);
  useStore.getState().setFluidColor(DEFAULT_PALETTE.fluidColor);
}

// Fluid tint only (the store's setFluidColor), for callers that do not import the store.
export function setFluidColor(color) {
  useStore.getState().setFluidColor(color || DEFAULT_PALETTE.fluidColor);
}

// Applies `palette` while the calling page is mounted (like the original project page:
// set on mount, reset on unmount, i.e. after the exit transition has covered the page).
export function usePalette(palette) {
  const key = palette ? VARIABLES.map(([, k]) => palette[k]).join('|') + palette.fluidColor : '';
  useEffect(() => {
    if (!palette) return undefined;
    applyPalette(palette);
    return () => resetPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
