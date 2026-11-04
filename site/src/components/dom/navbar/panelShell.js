import { nativeIOSScroll, scrollTop } from '@src/utils/scrollRoot';
import gsap from 'gsap';
import { TOKENS } from '@src/lib/palette.mjs';

// Giats's menu: the page shrinks, slides left and dims, uncovering the dark
// artwork behind it, and the panel's rows slide in from the left. Phones and
// desktop share it; only the page's dimming and the header's lift differ, as in
// the original. Menu and Search share the shell so switching between them keeps
// scroll locked.
export const PANEL_DEFAULTS = { duration: 0.92, ease: 'expo.inOut' };
// The page's edge while it is shrunk behind a panel.
const PAGE_EDGE = `2px solid ${TOKENS.page}`;
const PAGE_RADIUS = '1.3888888889vw';

// In document mode main is as tall as the page. While it is shrunk it scales
// about the middle of the screen and is clipped to the part on screen
// (global.scss), so it reads as Giats's card rather than a strip running past
// both screen edges.
function fitShrunkPage() {
  const root = document.documentElement;
  const main = document.querySelector('main');
  if (!main) return;
  const scrolled = scrollTop();
  gsap.set(main, { transformOrigin: `50% ${scrolled + window.innerHeight / 2}px` });
  // Layout geometry, not the box on screen: main may already be transformed.
  let top = 0;
  for (let node = main; node; node = node.offsetParent) top += node.offsetTop;
  root.style.setProperty('--page-clip-top', `${Math.max(0, scrolled - top)}px`);
  root.style.setProperty('--page-clip-bottom', `${Math.max(0, top + main.offsetHeight - scrolled - window.innerHeight)}px`);
}

// A transformed main also holds its fixed paper caps (global.scss), which would
// frame the shrunk page instead of covering the reach under Safari's bars; they
// stand down until main is restored. The page can scroll while it is shrunk (a
// swipe during the close, a pick on the current course moving the workspace),
// the screen can rotate and the page can change height (a page arriving from
// Menu or Search fills in its saved work), so the card is refitted until then.
let shrunkResize = null;
export function markPageShrunk(shrunk) {
  const root = document.documentElement;
  window.removeEventListener('scroll', fitShrunkPage);
  window.removeEventListener('resize', fitShrunkPage);
  shrunkResize?.disconnect();
  shrunkResize = null;
  if (!shrunk) {
    delete root.dataset.pageShrunk;
    root.style.removeProperty('--page-clip-top');
    root.style.removeProperty('--page-clip-bottom');
    return;
  }
  fitShrunkPage();
  window.addEventListener('scroll', fitShrunkPage, { passive: true });
  window.addEventListener('resize', fitShrunkPage, { passive: true });
  const main = document.querySelector('main');
  if (main && typeof ResizeObserver === 'function') {
    shrunkResize = new ResizeObserver(() => fitShrunkPage());
    shrunkResize.observe(main);
  }
  root.dataset.pageShrunk = '';
}

export function buildShellTimeline({ isMobile }) {
  const fluidCanvas = document.getElementById('fluidCanvas');
  const layout = document.getElementById('layout');
  const scrollbar = document.getElementById('scrollbar');
  const header = document.querySelector('header');
  const main = document.querySelector('main');

  const ios = nativeIOSScroll();
  const moving = [main, header];
  const tl = gsap.timeline({
    paused: true,
    defaults: PANEL_DEFAULTS,
    onStart: () => {
      gsap.set(moving, { willChange: 'transform, opacity' });
      if (ios) markPageShrunk(true);
    },
    onReverseComplete: () => {
      gsap.set(moving, { willChange: 'auto' });
      if (ios) {
        gsap.set(main, { clearProps: 'transform,transformOrigin,left,border,borderRadius' });
        markPageShrunk(false);
      }
    },
  });

  if (fluidCanvas) tl.to(fluidCanvas, { duration: 0, opacity: 0 }, 0);
  tl.to(main, { borderRadius: PAGE_RADIUS, border: PAGE_EDGE, scale: 0.9, pointerEvents: 'none', left: '-40vw' }, 0);
  // How far the page has shrunk, on the page's own ease (0 at the tap, 1 open).
  // Safari shows the page under its bars and, past the page's ends, one flat
  // colour; both follow it (global.scss): the card's reach under the bars
  // (--panel-cover), and the flat colour, from the page's to the panel's ink
  // (--panel-ink). Reversing returns both, and so does a page change chosen in
  // the panel (growPageBack).
  if (ios) tl.fromTo(document.documentElement, { '--panel-cover': 0, '--panel-ink': 0 }, { '--panel-cover': 1, '--panel-ink': 1 }, 0);
  // Keep the canvas/grain shell full-height so it cannot expose bands above and below the page.
  tl.to(layout, { opacity: isMobile ? 0.05 : 0.3 }, 0);
  if (scrollbar) tl.to(scrollbar, isMobile ? { opacity: 0 } : { opacity: 0, right: '46vw', scale: 0.9 }, 0);
  // This timeline is also prepared during route entry. Eager overwrite would
  // cancel the route's header reveal even while this menu timeline is paused.
  // Phones fade the header without hiding it: the full-screen panel covers it,
  // and hiding and restoring it can drop keyboard focus on iPhone Safari.
  tl.to(header, { [isMobile ? 'opacity' : 'autoAlpha']: 0, left: '-40vw', top: isMobile ? '6vw' : '3vw', scale: 0.9, overwrite: 'auto' }, 0);

  return tl;
}

// Choosing another page in Menu or Search (the hand-off). The panel's rows fade
// where they stand while the page behind them, still the dim card the shell made
// of it, changes; then the new page comes forward out of that card to full size
// as the dark recedes, the way a close brings the page back. The rows never sit
// over a half-shown page, and the old page never shows again. Web Animations: the
// browser can play them on its compositor while the arriving page mounts. In ms.
// `rows`: the panel's rows fading, from the tap. `out`: the shortest fade of the
// old page where it still shows, dim beside the panel (wide screens). `lit`: how soon the new page is lit,
// before it moves much, and `light`: how soon the dark has receded. `grow`: the
// card's return to full size. The header and the 3D layer come in as it settles.
export const HANDOFF = {
  rows: 200,
  out: 140,
  lit: 200,
  light: 380,
  grow: 700,
  header: { delay: 410, duration: 290 },
  scene: { delay: 450, duration: 250 },
};
// The card's curve: a brief ease out of where it is, as it lights up, then a
// sweep that settles softly. As a CSS curve for the Web Animations and as a GSAP
// ease for the tween beside them, so the two keep time.
const GROW_CURVE = [0.3, 0, 0.1, 1];
// GSAP's power2.in and power2.out as CSS curves.
const HANDOFF_EASE = {
  in: 'cubic-bezier(0.32, 0, 0.67, 0)',
  out: 'cubic-bezier(0.33, 1, 0.68, 1)',
  grow: `cubic-bezier(${GROW_CURVE.join(', ')})`,
};

// A CSS cubic-bezier(x1, y1, x2, y2) as a function of progress (for GSAP).
export function cubicBezier(x1, y1, x2, y2) {
  // One coordinate of the curve from (0, 0) to (1, 1) at parameter t.
  const at = (a1, a2, t) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // x(t) rises from 0 to 1, so halving finds the t for this x.
    let low = 0;
    let high = 1;
    let t = x;
    for (let step = 0; step < 30; step += 1) {
      const value = at(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return at(y1, y2, t);
  };
}

// The rows leave first, at the tap, drifting the way they came in. Cancel the
// returned animation to show them again (a page that could not open, or once
// the panel is hidden).
export function fadePanelRows(panel) {
  const rows = panel?.firstElementChild;
  if (!rows?.animate) return null;
  return rows.animate({ opacity: [1, 0], transform: ['none', 'translateX(-1.5rem)'] }, { duration: HANDOFF.rows, easing: HANDOFF_EASE.in, fill: 'forwards' });
}

// Grows the arriving page from wherever the shell left the card (a pick made
// while the panel was still opening starts part way) back to full size. Returns
// the animations, which hold their end state until cancelled, and on iPhone and
// iPad a paused tween that brings back, with the card, its reach under Safari's
// bars and Safari's colour past the page's ends. The new page opens at its top,
// which is light on every page.
export function growPageBack({ main, layout, header, scene }) {
  const root = document.documentElement;
  const ios = nativeIOSScroll() && 'pageShrunk' in root.dataset;
  // The card on the new page: one screen, at the top.
  if (ios) markPageShrunk(true);
  const style = getComputedStyle(main);
  const x = (parseFloat(style.left) || 0) + (Number(gsap.getProperty(main, 'x')) || 0);
  const y = Number(gsap.getProperty(main, 'y')) || 0;
  const scale = Number(gsap.getProperty(main, 'scaleX')) || 1;
  const radius = style.borderTopLeftRadius;
  const dim = Number(getComputedStyle(layout).opacity);

  // What the animations end on, underneath them. The card's light edge goes at
  // once (it is dim here); its corners round off as it grows.
  gsap.set(main, { clearProps: 'left,border,borderRadius', opacity: 1, pointerEvents: 'auto', willChange: 'opacity, transform' });
  gsap.set(layout, { opacity: 1 });
  gsap.set(header, { left: 0, top: 0, scale: 1, autoAlpha: 1 });

  const grow = { duration: HANDOFF.grow, easing: HANDOFF_EASE.grow, fill: 'both' };
  const out = (timing) => ({ ...timing, easing: HANDOFF_EASE.out, fill: 'both' });
  const anims = [
    main.animate({ transform: [`translate(${x}px, ${y}px) scale(${scale})`, 'none'] }, grow),
    main.animate({ borderRadius: [radius, '0px'] }, grow),
    main.animate({ opacity: [0, 1] }, out({ duration: HANDOFF.lit })),
    layout.animate({ opacity: [dim, 1] }, out({ duration: HANDOFF.light })),
    // The header returns once the page is nearly in place, so it never floats
    // over a card that is still moving.
    header.animate({ opacity: [0, 1] }, out(HANDOFF.header)),
  ];
  // The shared 3D layer (course badges) follows the page's box on the main
  // thread; it comes in as the card settles, so it cannot trail the card.
  if (scene) anims.push(scene.animate({ opacity: [0, 1] }, out(HANDOFF.scene)));

  let edges = null;
  if (ios) {
    root.dataset.footerBottom = 'light';
    edges = gsap.fromTo(root, { '--panel-cover': 1, '--panel-ink': 1 }, { '--panel-cover': 0, '--panel-ink': 0, duration: HANDOFF.grow / 1000, ease: cubicBezier(...GROW_CURVE), paused: true });
  }
  return { anims, edges };
}

// The panel fades in while its lists and rows slide in from the left, each
// nested row from its own list's slide (Giats's cascade).
export function buildPanelTimeline(panel, items) {
  gsap.set(panel, { pointerEvents: 'none', autoAlpha: 0 });
  gsap.set(items, { clearProps: 'transform,opacity,visibility' });
  gsap.set(items, { x: '-100%' });
  return gsap.timeline({ paused: true, defaults: PANEL_DEFAULTS }).to(panel, { autoAlpha: 1, pointerEvents: 'auto' }, 0).to(items, { x: 0, stagger: 0.016 }, 0);
}

// First focusable element inside `root` (for moving focus into an opened panel).
export const firstFocusable = (root) => root?.querySelector('input, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');

// Keep keyboard navigation inside the open modal, including its close control.
export function trapPanelFocus(event, root) {
  if (event.key !== 'Tab' || !root) return;
  const targets = Array.from(root.querySelectorAll('input:not([disabled]), a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(
    (node) => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden',
  );
  const first = targets[0];
  const last = targets[targets.length - 1];
  if (!first) return;
  if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}
