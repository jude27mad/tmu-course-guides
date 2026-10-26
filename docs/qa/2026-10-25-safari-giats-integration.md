# Safari page layout with the original Giats fluid

PR #79 restored the original fluid and also selected a contained `100svh` page
on iPhone and iPad. That disabled the `data-scroll-mode='document'` selectors
used by the Safari appearance fixes in #59 through #68. Its inline black
fluid-wrapper background also replaced the transparent Safari wrapper.

This change supersedes only that shell/input integration decision. The 19
files under `site/src/components/canvas/fluid/` remain byte-for-byte identical
to [Giats commit 1e0b7b0](https://github.com/Giats2498/giats-portfolio/tree/1e0b7b0bfc0dce086a91c8d742c3c13cff6cf270/src/components/canvas/fluid).
Every file's Git blob SHA was compared with that source. No fluid calculation,
shader, force, colour, event hook or rendering option is retuned.

## Integration

- Before first paint, iPhone/iPad select the existing document layout. Other
  platforms retain the contained layout.
- In document layout, Lenis uses `window` and `document.documentElement`.
  `syncTouch: true` remains enabled during motion, so layout selection does not
  hand ordinary swipes to native panning. The original fluid hook still receives
  `pointermove` on `main` and uses viewport-relative coordinates.
- The fluid wrapper's CSS supplies black only in contained mode. There is no
  inline background to override Safari's transparent wrapper during hydration.
  Original canvas drawing and postprocessing remain unchanged.
- Existing Safari artwork extension, grain, toolbar guards, paper caps and dark
  footer fallback become active again. The pause fallback is scoped to contained
  mode so paused document pages do not acquire a nested scrolling container.
- Footer setup measures `100svh` through a nonpainting, zero-width element.
  `ResizeObserver` updates it for genuine layout changes. Dynamic toolbar height
  alone does not rebuild the reveal. `clientHeight` excludes transition scaling.

The existing Pause/reduced-motion control, native pinch-zoom filter and physical
card parameters are preserved. No dependencies or workflows are added.

## Existing GitHub coverage

- Execute the production bootstrap for iPhone, iPad, desktop-identity iPad,
  macOS, Windows and Android, including saved Pause Motion.
- In the existing Chromium touch case, require four swipe reversals to scroll
  the document and send fluid shader inputs, with no `pointercancel` during the
  ordinary gesture. Pause and resume must retain the Safari layout.
- In existing WebKit route cases, check unclipped document layout, transparent
  fluid wrapper and toolbar guards, extended shared canvas, dark footer fallback
  and restoration of the light background at the page top.
- Retain route, badge, sideways-scroll and resize-continuity checks. The toolbar
  simulation resizes the browser viewport while holding the small-viewport ruler
  constant, modelling Safari's independent dynamic viewport changes.

Validation uses the existing GitHub workflows; no local application build or
test run is used. Linux WebKit does not render iPhone Safari's actual browser
controls. Final visual acceptance still requires the user's physical Safari:
continuous ordinary touch trails plus page artwork behind the controls.

## Browser contract

[Pointer Events](https://www.w3.org/TR/pointerevents3/#suppressing-a-pointer-event-stream)
requires pointer cancellation when the browser takes over a gesture for viewport
panning. [Lenis 1.3.4](https://github.com/darkroomengineering/lenis/blob/v1.3.4/packages/core/src/lenis.ts)
keeps synchronized touch scrolling in its own input path, including with a window
wrapper. [WebKit's explanation](https://bugs.webkit.org/show_bug.cgi?id=301756#c2)
describes solid browser-inset extensions associated with fixed/sticky layers.
The Safari appearance details are recorded in `safari-toolbar-transparency.md`.
