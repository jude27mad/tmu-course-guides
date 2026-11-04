// The opt-in browser-scrolled page (?scroll=fast) makes main a real scroller. Lenis still takes every
// wheel and touch it handles today; these decide the input it leaves alone, which today goes nowhere
// because main is not user-scrollable, so that it still goes nowhere instead of moving main natively.

// Vertical scrolling keys and the direction each one moves.
const DIRECTION = { ArrowDown: 1, ArrowUp: -1, PageDown: 1, PageUp: -1, Home: -1, End: 1 };

// Elements whose native default action uses these keys (caret, value, radio choice): never touched.
// Scripted widgets (tabs, sliders, menus) are not listed: their handlers run either way, and a key
// they leave unhandled scrolls nothing today.
export const OWN_KEYS =
  'input:not([type="button"]):not([type="checkbox"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="color"]):not([type="file"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

// Single-line fields use the arrows, Home and End for the caret or value, but not Page Up/Down.
const SINGLE_LINE = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"]';

// Shortcuts that scroll to an end or by a page. Others with a modifier belong to the browser
// (Ctrl+Page Up/Down switch tabs, Alt+Home opens the home page) and are never touched.
function scrollShortcut({ key, ctrlKey, metaKey, altKey }) {
  if (!ctrlKey && !metaKey && !altKey) return true;
  if (ctrlKey && !metaKey && !altKey) return key === 'Home' || key === 'End';
  if (metaKey && !ctrlKey && !altKey) return key === 'ArrowUp' || key === 'ArrowDown';
  if (altKey && !ctrlKey && !metaKey) return key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown';
  return false;
}

// Whether a box the user can scroll still has room in this direction.
export function canScroll(element, delta, axis = 'y') {
  if (!element || typeof element.scrollHeight !== 'number' || !delta) return false;
  const view = element.ownerDocument?.defaultView;
  const style = view?.getComputedStyle?.(element);
  const overflow = axis === 'y' ? style?.overflowY : style?.overflowX;
  if (overflow !== 'auto' && overflow !== 'scroll') return false;
  if (axis === 'y') {
    if (element.scrollHeight <= element.clientHeight) return false;
    return delta > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0;
  }
  if (element.scrollWidth <= element.clientWidth) return false;
  return delta > 0 ? element.scrollLeft + element.clientWidth < element.scrollWidth - 1 : element.scrollLeft > 0;
}

// Any box from `from` up to (not including) `stop` that can take this scroll.
function innerScroller(from, stop, delta, axis) {
  for (let node = from; node && node !== stop; node = node.parentElement) if (canScroll(node, delta, axis)) return node;
  return null;
}

// A key that today scrolls nothing: Lenis did not take it (the key handler in _app takes plain keys from
// the page, links and main), focus is not in something that uses the key, and no inner box scrolls.
export function blockKey(event, main, active) {
  if (event.defaultPrevented || !main) return false;
  const delta = DIRECTION[event.key];
  if (!delta || !scrollShortcut(event)) return false;
  const doc = main.ownerDocument;
  const start = active && active !== doc.body && active !== doc.documentElement && active !== main ? active : null;
  if (start && !main.contains(start)) return false;
  if (start?.closest?.(OWN_KEYS)) {
    const paging = (event.key === 'PageUp' || event.key === 'PageDown') && !event.ctrlKey && !event.metaKey;
    if (!paging || !start.matches?.(SINGLE_LINE)) return false;
  }
  return !innerScroller(start, main, delta, 'y');
}

// A wheel inside a region Lenis leaves alone ([data-lenis-prevent], the Schedule calendar) that no box
// in the region can take. Horizontal wheels keep their path to the browser's back gesture.
export function blockWheel(event, main) {
  if (event.defaultPrevented || event.ctrlKey || !main) return false;
  const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  const region = target?.closest?.('[data-lenis-prevent]');
  if (!region || region === main || !main.contains(region)) return false;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return false;
  return !innerScroller(target, region.parentElement, event.deltaY, 'y');
}

// A middle-button press that would start the browser's autoscroll. Links still open in a new tab, and on
// Linux, where a middle click pastes into a text field (and Chrome has no autoscroll), fields keep it.
export function blockAutoscroll(event, platform = '') {
  if (event.button !== 1 || event.defaultPrevented) return false;
  const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  if (target?.closest?.('a[href]')) return false;
  return !(/^Linux/.test(platform) && target?.closest?.('input, textarea, [contenteditable]:not([contenteditable="false"])'));
}
