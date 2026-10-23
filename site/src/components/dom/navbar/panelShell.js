import gsap from 'gsap';
import { TOKENS } from '@src/lib/palette.mjs';

// The original menu animation, split in two so the SEARCH panel can share it:
// - the shell (main slides left as a rounded card, the layout dims, the header
//   and scrollbar follow, the fluid hides) is one timeline owned by the navbar;
// - each panel (#menu, #search) fades in and slides its rows on its own timeline.
// Both keep the original easing and geometry with a shorter response time.
export const PANEL_DEFAULTS = { duration: 0.45, ease: 'expo.inOut' };
// The page's edge while it is shrunk behind a panel.
const PAGE_EDGE = `2px solid ${TOKENS.page}`;

export function buildShellTimeline({ isMobile }) {
  const fluidCanvas = document.getElementById('fluidCanvas');
  const layout = document.getElementById('layout');
  const scrollbar = document.getElementById('scrollbar');
  const header = document.querySelector('header');
  const main = document.querySelector('main');

  const tl = gsap.timeline({
    paused: true,
    defaults: PANEL_DEFAULTS,
    onStart: () => gsap.set([main, header], { willChange: 'transform, opacity' }),
    onReverseComplete: () => gsap.set([main, header], { willChange: 'auto' }),
  });

  if (fluidCanvas) tl.to(fluidCanvas, { duration: 0, opacity: 0 }, 0);
  tl.to(main, { borderRadius: '1.3888888889vw', border: PAGE_EDGE, scale: 0.9, pointerEvents: 'none', left: '-40vw' }, 0).to(layout, { opacity: isMobile ? 0.05 : 0.3, height: '90svh' }, 0);
  if (scrollbar) tl.to(scrollbar, { opacity: 0, right: '46vw', scale: 0.9 }, 0);
  // This timeline is also prepared during route entry. Eager overwrite would
  // cancel the route's header reveal even while this menu timeline is paused.
  tl.to(header, { autoAlpha: 0, left: '-40vw', top: isMobile ? '6vw' : '3vw', scale: 0.9, overwrite: 'auto' }, 0);

  return tl;
}

export function buildPanelTimeline(panel, items) {
  gsap.set(panel, { pointerEvents: 'none', autoAlpha: 0 });
  gsap.set(items, { x: '-100%' });
  return gsap.timeline({ paused: true, defaults: PANEL_DEFAULTS }).to(panel, { autoAlpha: 1, pointerEvents: 'auto' }, 0).to(items, { x: 0, stagger: 0.016 }, 0);
}

// First focusable element inside `root` (for moving focus into an opened panel).
export const firstFocusable = (root) => root?.querySelector('input, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
