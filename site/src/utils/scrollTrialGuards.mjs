// The opt-in browser-scrolled page (?scroll=fast) makes main a real scroller. Lenis still takes every
// wheel and touch it handles today; these decide the input it leaves alone, which today goes nowhere
// because main is not user-scrollable, so that it still goes nowhere instead of moving main natively.

// Keys whose default action can scroll the nearest user-scrollable box.
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']);

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

// A scroll key Lenis did not take (the key handler in _app takes plain keys from the page, links and main),
// pressed with focus on the page or inside main. _app locks main for that key's own default action, as
// main is locked today: a field or control still does what the key does there (caret, value, picker, an
// inner list), and anything left over scrolls nothing, instead of moving main natively.
export function lockKey(event, main, active) {
  if (event.defaultPrevented || !main || !SCROLL_KEYS.has(event.key)) return false;
  const doc = main.ownerDocument;
  if (!active || active === doc.body || active === doc.documentElement) return true;
  return main.contains(active);
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

// A middle-button press that would start the browser's autoscroll on main. Links still open in a new tab,
// a box inside main that can scroll (a long note) still autoscrolls, as today, and on Linux, where a middle
// click pastes into a text field (and Chrome has no autoscroll), fields keep it.
export function blockAutoscroll(event, platform = '', main = null) {
  if (event.button !== 1 || event.defaultPrevented) return false;
  const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  if (target?.closest?.('a[href]')) return false;
  const ways = [
    [1, 'y'],
    [-1, 'y'],
    [1, 'x'],
    [-1, 'x'],
  ];
  if (ways.some(([delta, axis]) => innerScroller(target, main, delta, axis))) return false;
  return !(/^Linux/.test(platform) && target?.closest?.('input, textarea, [contenteditable]:not([contenteditable="false"])'));
}
