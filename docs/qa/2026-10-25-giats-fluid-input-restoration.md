# Complete Giats fluid input restoration

Supersedes the fluid-input compatibility exceptions retained in PR #78.
The user requested the exact original fluid and explicitly requested no tests.

Source: [Giats portfolio, commit 1e0b7b0bfc0dce086a91c8d742c3c13cff6cf270](https://github.com/Giats2498/giats-portfolio/tree/1e0b7b0bfc0dce086a91c8d742c3c13cff6cf270).
The existing MIT licence and attribution remain.

The supplied 6.73-second recording shows an initial trail, its disappearance
while scrolling continues, a second trail during the reverse swipe, and its
disappearance. A recording does not expose the individual browser input events.

Source review found no fluid inactivity timeout, debounce, visibility-based
pause, or frame-budget cutoff. The fluid canvas used an always-running frame
loop. The background's 12 Hz timer, shared-scene demand driver, scrollbar fade,
footer game scheduling, and navigation timers do not own the fluid canvas.
The explicit Pause/reduced-motion setting unmounts the fluid; opening a menu
hides it, as in the original menu. Neither is a timed normal-scroll cutoff.

PR #78 left the input path different: iOS selected document scrolling,
disabled Lenis syncTouch, discarded touch pointermove, and forwarded touchmove
through a custom adapter. A separate virtualScroll filter also rejected
multi-touch gestures. Lenis 1.3.4's onVirtualScroll returns to native scrolling
when syncTouch is disabled; the original instead keeps touch scrolling under
Lenis, on main, alongside the fluid's pointermove listener.

The complete fluid directory now comes directly from the pinned source,
including the original pointer hook and both effect files. The extra gesture
filter is removed. The fluid Canvas properties and EffectComposer defaults,
Lenis constructor options, contained main viewport and stable 100svh sizing,
and original selection/callout behavior are restored. iPhone/iPad no longer
switch to the native document-scroll alternative. This also restores the
original contained-scroller behavior of Safari's browser chrome.

The guide's explicit Pause/reduced-motion control remains outside the copied
fluid code. No automatic timer was added. Course content and badge physics are
unchanged. No automated tests or browser interaction checks were run for this
change, as requested. The source comparison is not a physical-phone validation.
