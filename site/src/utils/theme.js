import { DEFAULT_PALETTE } from '@src/lib/courses.mjs';
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
  if (meta && color) meta.setAttribute('content', color);
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
