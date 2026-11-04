// Select the document scroll root used for Safari's edge-to-edge layout.
// The historical name describes the root, not who handles touch gestures:
// _app keeps Lenis syncTouch enabled while motion is on in either layout.
// Decide before hydration; do not collect or transmit device information.
export function nativeIOSScroll() {
  return typeof document !== 'undefined' && document.documentElement?.dataset?.scrollMode === 'document';
}
// The opt-in browser-scrolled page (?scroll=fast, see _document): main is a real scroller while motion is
// on in the contained layout. Lenis still moves it; _app keeps keys, middle-click and the calendar as before.
export function scrollTrial() {
  if (typeof document === 'undefined') return false;
  const { dataset } = document.documentElement;
  return dataset.scrollTrial === 'fast' && dataset.motion === 'on' && dataset.scrollMode !== 'document';
}
export function scrollRoot() {
  if (typeof window === 'undefined') return null;
  return nativeIOSScroll() ? window : document.querySelector('main');
}
export function scrollTop() {
  if (typeof window === 'undefined') return 0;
  return nativeIOSScroll() ? window.scrollY : document.querySelector('main')?.scrollTop || 0;
}
export function scrollViewport() {
  return nativeIOSScroll() ? { top: 0, bottom: window.innerHeight } : document.querySelector('main')?.getBoundingClientRect();
}
