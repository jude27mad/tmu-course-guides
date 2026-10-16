import { useStore } from '@src/store';

// Brings the element named by location.hash (or `hash`) into view inside
// `main` (the scroller) with Lenis, under the fixed header, and moves focus to
// it for keyboard and screen-reader users. Dispatches 'guide-hash'
// ({ detail: { id, element } }) on document first, so a page can open the item
// before it is scrolled to. A modal cancels the event to keep the page still.
// Returns true when a destination was found or a modal handled the request.
export function scrollToHash({ hash, immediate = false } = {}) {
  if (typeof window === 'undefined') return false;
  const raw = (hash ?? window.location.hash ?? '').replace(/^#/, '');
  if (!raw) return false;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch (error) {
    id = raw;
  }
  const handled = !document.dispatchEvent(new CustomEvent('guide-hash', { cancelable: true, detail: { id, element: document.getElementById(id) } }));
  if (handled) return true;
  const element = document.getElementById(id);
  if (!element) return false;

  const { lenis, still } = useStore.getState();
  const header = document.querySelector('header');
  const offset = -((header?.offsetHeight || 0) + 16);
  if (lenis) {
    lenis.scrollTo(element, { offset, immediate: immediate || still, force: true, duration: 1.2, easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)) });
  } else {
    element.scrollIntoView({ block: 'start' });
  }

  if (!element.matches('a[href], button, input, select, textarea, summary, [tabindex]')) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  return true;
}

export default scrollToHash;
