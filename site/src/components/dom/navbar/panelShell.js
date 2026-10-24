import { nativeIOSScroll, scrollTop } from '@src/utils/scrollRoot';
import gsap from 'gsap';
import { TOKENS } from '@src/lib/palette.mjs';

// Desktop reveals the side panel by moving the page. On phones the panel is a
// full-screen surface: only its contents animate, and the page stays in place.
// Menu and Search share the shell so switching between them keeps scroll locked.
export const PANEL_DEFAULTS = { duration: 0.45, ease: 'expo.inOut' };
// The page's edge while it is shrunk behind a panel.
const PAGE_EDGE = `2px solid ${TOKENS.page}`;

// In document mode a transformed main holds its fixed paper caps (global.scss),
// which would frame the shrunk page instead of covering the reach under
// Safari's bars. They stand down until main is restored.
export function markPageShrunk(shrunk) {
  if (shrunk) document.documentElement.dataset.pageShrunk = '';
  else delete document.documentElement.dataset.pageShrunk;
}

export function buildShellTimeline({ isMobile }) {
  const fluidCanvas = document.getElementById('fluidCanvas');
  const layout = document.getElementById('layout');
  const scrollbar = document.getElementById('scrollbar');
  const header = document.querySelector('header');
  const main = document.querySelector('main');

  const ios = nativeIOSScroll();
  const moving = isMobile ? [] : [main, header];
  const tl = gsap.timeline({
    paused: true,
    defaults: PANEL_DEFAULTS,
    onStart: () => {
      gsap.set(moving, { willChange: isMobile ? 'opacity' : 'transform, opacity' });
      if (ios && !isMobile) {
        gsap.set(main, { transformOrigin: `50% ${scrollTop() + window.innerHeight / 2}px` });
        markPageShrunk(true);
      }
    },
    onReverseComplete: () => {
      gsap.set(moving, { willChange: 'auto' });
      if (ios && !isMobile) {
        gsap.set(main, { clearProps: 'transform,transformOrigin,left,border,borderRadius' });
        markPageShrunk(false);
      }
    },
  });

  if (fluidCanvas) tl.to(fluidCanvas, { duration: 0, opacity: 0 }, 0);
  if (isMobile) {
    // Do not transform main or its ancestors: iOS scrolls the whole document,
    // and moving it exposes a clipped page through the navigation surface.
    // The full-screen panel covers the header, so leave its visibility alone;
    // hiding and restoring it can drop keyboard focus on iPhone Safari.
    if (scrollbar) tl.to(scrollbar, { opacity: 0 }, 0);
    return tl;
  }
  tl.to(main, { borderRadius: '1.3888888889vw', border: PAGE_EDGE, scale: 0.9, pointerEvents: 'none', left: '-40vw' }, 0);
  tl.to(layout, { opacity: 0.3, ...(ios ? {} : { height: '90svh' }) }, 0);
  if (scrollbar) tl.to(scrollbar, { opacity: 0, right: '46vw', scale: 0.9 }, 0);
  // This timeline is also prepared during route entry. Eager overwrite would
  // cancel the route's header reveal even while this menu timeline is paused.
  tl.to(header, { autoAlpha: 0, left: '-40vw', top: '3vw', scale: 0.9, overwrite: 'auto' }, 0);

  return tl;
}

export function buildPanelTimeline(panel, items, { isMobile = false } = {}) {
  gsap.set(panel, { pointerEvents: 'none', autoAlpha: 0 });
  if (isMobile) {
    // Animate rows once, rather than sliding both their parent lists and the
    // rows themselves across the phone. The backdrop covers the full viewport.
    gsap.set(items, { clearProps: 'transform,opacity,visibility' });
    const rows = Array.from(items).filter((item) => !item.querySelector('[data-menu-anim]'));
    gsap.set(rows, { x: 24, opacity: 0 });
    return gsap
      .timeline({ paused: true, defaults: { duration: 0.28, ease: 'power3.out' } })
      .to(panel, { autoAlpha: 1, pointerEvents: 'auto' }, 0)
      .to(rows, { x: 0, opacity: 1, stagger: { amount: 0.06 } }, 0.04);
  }
  gsap.set(items, { clearProps: 'opacity,visibility' });
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
