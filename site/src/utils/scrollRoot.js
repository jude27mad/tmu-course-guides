// Select the document scroll root used for Safari's edge-to-edge layout.
// The historical name describes the root, not who handles touch gestures:
// _app keeps Lenis syncTouch enabled while motion is on in either layout.
// Decide before hydration; do not collect or transmit device information.
export function nativeIOSScroll() {
  return typeof document !== 'undefined' && document.documentElement?.dataset?.scrollMode === 'document';
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
