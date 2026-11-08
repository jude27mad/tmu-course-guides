import { DEFAULT_PALETTE } from '@src/lib/courses.mjs';
import { DARK, DARK_QUERY, TOKENS } from '@src/lib/palette.mjs';
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

// The page's light colour as Safari shows it beside the page. On iPhone and iPad
// it is painted flat, without the film grain the page is seen through (global.scss).
const lightEdge = (paper) => (document.documentElement.dataset.scrollMode === 'document' ? TOKENS.pageUnderGrain : paper);
// The same for the dark page (dark mode follows the device setting; styles/colors.scss).
const darkEdge = () => (document.documentElement.dataset.scrollMode === 'document' ? DARK.pageUnderGrain : DARK.page);
// _document has one theme-color meta per scheme, and the browser uses the one whose media matches. Both are
// kept current, so a device switching scheme mid-visit finds the right colour already in place.
const edgeFor = (meta, paper) => (/dark/.test(meta.getAttribute('media') || '') ? darkEdge() : lightEdge(paper));
const themeMetas = () => document.querySelectorAll('meta[name="theme-color"]');

function setThemeColor(color) {
  themeMetas().forEach((meta) => {
    if (color && document.documentElement.dataset.browserSurface !== 'dark') meta.setAttribute('content', edgeFor(meta, color));
  });
}

// Safari samples the colours at its bars again only when something on the page changes; a two-frame attribute
// change asks it to.
let sampleRefreshFrame = 0;
function refreshSafariEdges() {
  const root = document.documentElement;
  if (root.dataset.scrollMode !== 'document') return;
  if (sampleRefreshFrame) cancelAnimationFrame(sampleRefreshFrame);
  root.setAttribute('data-safari-edge-refresh', '');
  sampleRefreshFrame = requestAnimationFrame(() => {
    sampleRefreshFrame = requestAnimationFrame(() => {
      root.removeAttribute('data-safari-edge-refresh');
      sampleRefreshFrame = 0;
    });
  });
}

// Safari 26 samples real fixed-edge computed colors rather than theme-color.
// The menu changes both bars; a dark footer only changes the bottom bar.
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
  themeMetas().forEach((meta) => meta.setAttribute('content', topDark ? TOKENS.ink : edgeFor(meta, DEFAULT_PALETTE.secondary)));
  if (changed) refreshSafariEdges();
}

// The device's scheme can change during a visit (at sunset, say). The styles follow at once and both theme-color
// metas are already current; Safari is asked to sample its bars' colours again. Returns the unsubscribe.
export function watchColorScheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    const root = document.documentElement;
    if (root.dataset.browserSurface) setBrowserSurfaces(root.dataset.browserSurface, root.dataset.browserBottom || root.dataset.browserSurface);
    refreshSafariEdges();
  };
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

// The fixed artwork reaches under Safari's bars (--edge-bleed-* in global.scss),
// and paper covers that reach above the start of a page and below the end of a
// page that ends light. The paper stays until the page is 480px from its start
// or end, so a fast fling, scrolled by Safari ahead of this script, still finds
// it in place. It steps aside sooner where a dark panel is that close (the
// cards start 173px into /courses/): the panel shows the artwork through its
// ink, and would turn grey over the paper under the bar. The rest of every page
// is opaque, so the paper is never seen inside a page.
const EDGE_SWITCH = 480;
export function setEdgeBleed({ scrollTop, maxScroll, endsDark, darkFromStart = Infinity, darkFromEnd = Infinity }) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const top = scrollTop >= Math.min(EDGE_SWITCH, darkFromStart) ? 'open' : 'closed';
  const bottom = endsDark || maxScroll - scrollTop >= Math.min(EDGE_SWITCH, darkFromEnd) ? 'open' : 'closed';
  if (root.dataset.edgeTop !== top) root.dataset.edgeTop = top;
  if (root.dataset.edgeBottom !== bottom) root.dataset.edgeBottom = bottom;
  // Safari stops a page's end at its bottom bar. Past the end it shows the root's
  // flat colour under the bar, not the artwork: the ink, on a page that ends dark.
  // Such a page fades into that ink over its last stretch (layout.module.scss).
  // This flag no longer drives the styles (see there); the browser checks read it.
  const end = endsDark && maxScroll - scrollTop < 1 ? 'dark' : 'none';
  if (root.dataset.edgeEnd !== end) root.dataset.edgeEnd = end;
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
  // Only a colour that differs from the stylesheet's is written inline. An inline value would also hold in dark
  // mode, where colors.scss redefines the page's colours; every course uses the default palette, so the
  // stylesheet decides in both.
  VARIABLES.forEach(([name, key]) => {
    if (full[key] === DEFAULT_PALETTE[key]) root.style.removeProperty(name);
    else root.style.setProperty(name, full[key]);
  });
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
