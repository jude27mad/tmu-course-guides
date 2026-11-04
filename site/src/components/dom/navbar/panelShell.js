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
// swipe during the close, a pick on the current course moving the workspace)
// and the screen can rotate, so the card is refitted until then.
export function markPageShrunk(shrunk) {
  const root = document.documentElement;
  window.removeEventListener('scroll', fitShrunkPage);
  window.removeEventListener('resize', fitShrunkPage);
  if (!shrunk) {
    delete root.dataset.pageShrunk;
    root.style.removeProperty('--page-clip-top');
    root.style.removeProperty('--page-clip-bottom');
    return;
  }
  fitShrunkPage();
  window.addEventListener('scroll', fitShrunkPage, { passive: true });
  window.addEventListener('resize', fitShrunkPage, { passive: true });
  root.dataset.pageShrunk = '';
}

// Leaving for another page from an open panel (iPhone, iPad): the paper rises
// over the shrunk page, and Safari's colour past the page's ends rises to it
// rather than staying the panel's ink until the next page arrives. The next
// page opens at its top, which is light on every page. The shell's paused
// timeline keeps the card itself; it is rebuilt once the paper covers it.
export function fadePanelEdges(duration) {
  const root = document.documentElement;
  if (!('pageShrunk' in root.dataset)) return;
  root.dataset.footerBottom = 'light';
  gsap.to(root, { '--panel-ink': 0, duration, ease: 'power2.out' });
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
  // (--panel-ink, apart so a page change can lift it alone: fadePanelEdges).
  // Reversing returns both.
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
