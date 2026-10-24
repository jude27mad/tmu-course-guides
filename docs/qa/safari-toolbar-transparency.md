# Safari toolbar transparency, not flat colour matching

## Report

The owner wants page content continuing behind Safari's translucent controls. Matching a solid bar to the page colour does not meet that requirement. The prior `data-safari-edge` layers had opaque computed backgrounds and text clipping; they deliberately caused solid background extension. Remove them rather than adding another colour case.

On 24 October 2026 an iPhone showed pure `#000000` bands in the status-bar area (about 62 CSS px) and under the page at the bottom (about 98 px), around dark-grey content: the page "looked like a box". The guards below had not prevented it. The cause was found and fixed as follows.

## Cause

Safari 26.1 and later decides the colour of each inset band from one hit-test point per edge. The WebKit source (`LocalFrameView::fixedContainerEdges`, `PageColorSampler`, `WKWebView _updateFixedColorExtensionViews`) works like this:

1. The point is the middle of the edge, 4px inside the layout viewport: the 1px row `[4, 5)` from the top and `[H-4, H-3)` from the bottom. Only viewport-constrained (fixed or sticky) layers take part. The first pass ignores CSS `pointer-events`.
2. WebKit walks up from the hit node to the first fixed or sticky ancestor that qualifies. A layer that is roughly viewport-sized on both axes qualifies, and its computed `background-color` becomes the edge colour. `mix-blend-mode` and canvas pixels are never read.
3. `WKWebView` then fills the obscured inset with that colour as an opaque view, hiding the content under the bar. If no container is found, no fill is drawn and the content (or, past the end of the page, the document background) shows through the translucent bar.
4. An empty, transparent layer is classed "hidden or transparent" and never becomes the container. If it is `pointer-events: none`, WebKit repeats the whole search with such layers skipped, so a `pointer-events: none` guard cannot decide anything.
5. A colour once found is kept while its layer still has a renderer and `visibility: visible`, so it must be right from the first sample.

On iPhone (`html[data-scroll-mode='document']`) `#fluidCanvas` is a fixed, viewport-sized layer. The server render emitted `background: black` in its inline style, and React hydration keeps the server's attributes, so the `nativeIOSScroll() ? 'transparent' : 'black'` branch in `_app.page.jsx` never ran on a phone. It was the only element with a pure black background in the page (checked in 67 states), so it won at both edges. The old top guard (6px at `top: -2px`, covering `[-2, 4)` once scrolled) also ended one pixel before the sampled row, and every guard was `pointer-events: none`.

## Change

- The fluid's black base is CSS, `html:not([data-scroll-mode='document']) #fluidCanvas`, never inline style. In document mode the wrapper has no background. On desktop nothing changes; the fluid blends with `difference`, so a black base is invisible anyway.
- The transparent sticky guards stay outside the animated application root (top before it, bottom after all content), but are now 8px tall with `pointer-events: auto`, so they cover the sampled row at every scroll position and end the search with no colour. Negative margins keep them out of the flow. Six pixels at each edge no longer receive taps. While the menu or search is open (`html[data-browser-surface='dark']`) the guards use `pointer-events: none`: the panels must receive input at every edge pixel, and the bars should then take the panel's own ink.
- `html` and `body` take the ink colour while the dark footer is at the bottom edge on iPhone and iPad (`data-browser-bottom='dark'`, already set by the navbar). Past the end of the page that is what Safari shows under the toolbar. Desktop is unchanged.

The shared browser-surface state and theme-color hint remain for the menu and non-Safari compatibility. The old sampler CSS no longer consumes its opaque colour variables.

## Evidence and limitations

- WebKit engineer explanation of fixed/sticky viewport-edge background extension: https://bugs.webkit.org/show_bug.cgi?id=301756#c2
- Matt Fantinel, firsthand iPhone reproduction and transparent bottom-sticky workaround, 7 October 2026: https://fantinel.dev/blog/safari-floating-url-bar-background
- The algorithm above was read from WebKit's source on GitHub (Safari 26.0, 26.1, 26.2, 26.4 and main). Safari 26.0 treats a full-viewport opaque layer as "too large", so the black appeared from 26.1.

This is not a standardized Safari API. The source explicitly notes that a native dialog can keep the toolbar opaque while open and recover when it closes; the Guide tools dialog does the same here, by design.

## Under the bars (24 October 2026, second report)

With the black fill gone, the page showed through the bars but still looked boxed: on the dark footer a flat `#18181b` band sat under both bars with a hard line against the lit gradient, the course cards were cut where the toolbar began, a dark smudge appeared under the status bar once the page scrolled, and above the page at the very top the paper was flat `#f4f4f5` against the page's grained `#f1f1f1`.

Cause: Safari lays fixed layers out in the layout viewport between the bars, but shows the document, and any fixed layer that reaches outside that viewport, under them. This site paints its light paper with the DOM, but its dark artwork (`.background`), the course cards and badges (the shared View.Port canvas) and the grain with fixed layers. Those stopped at the layout viewport, so only the DOM and the flat document background reached under the bars. The smudge was the skip link, parked by `translateY(-200%)` just above the viewport, which Safari shows under the status bar.

Change, document mode only:

- The background canvas, the shared scene canvas, the grain (fixed again, as in the contained shell) and the mobile panel backdrop reach `--edge-bleed-top` / `--edge-bleed-bottom` (160px) past each edge, more than either bar in either address-bar layout. Inside the page nothing moves; drei computes each view from the canvas's own rectangle.
- Above the start of a page there is no page for the dark artwork to show through, so a fixed paper cap (`#main::before`, behind the page's own content) covers its upward reach until the page has scrolled 480px (`html[data-edge-top]`). Below the end of a page that ends light (the course pages) `#main::after` covers its downward reach in the same way (`html[data-edge-bottom]`). Pages that end in the dark footer keep the reach, so the footer continues under the toolbar. The 480px margin means a fast fling, which Safari scrolls ahead of the script, still finds the paper in place; the rest of every page is opaque, so the cap is never seen inside it.
- A dark panel (`[data-surface="dark"]`) shows the artwork through its ink, and over the paper it would turn grey under the bar. The cap therefore steps aside as soon as a dark panel is closer to either end than 480px: the course cards start 173px into /courses/, so there it goes at 173px. The navbar sets both flags straight from the scroll event, so a route change's reset to the top paints with its paper.
- On iPad and a landscape iPhone, Menu and Search shrink the page with a transform, which makes `main` hold its fixed caps; they would frame the shrunk page, so they stand down while `html[data-page-shrunk]` is set (by the panel shell, cleared when it reverses or when a route entry restores `main`). The loader's paper reaches under the bars too (a box-shadow), so the intro has no dark bands beside it. During a page change the caps fade with `main` into `#routePaper`, which is in the page's flow and stops at its edges, so two fixed paper strips on `#routePaper` (outside the layout viewport, never where Safari samples) cover the reach meanwhile; without them the status-bar band went dark while the rest of the screen was paper. The shared View.Port canvas starts each frame empty after one that drew, so a badge that leaves the viewport does not leave its last frame in the canvas's reach under the status bar.
- The background canvas draws its layout-viewport band exactly as before (`uUvScaleY` / `uUvOffsetY` in its shader), so the taller canvas continues the sweep under the bars instead of stretching it.
- The fluid keeps the viewport's size, because it maps touches from the viewport top.
- The panel backdrop repeats the menu panel's radial highlight, placed at the panel's top right corner, so the open menu continues under the bars without a step.
- The skip link has `opacity: 0` until it has focus.

Checked with a Chromium emulation of Safari's geometry (62px status bar, 98px or 59px toolbar, fixed layers laid out between them): the footer, card and menu steps are gone, the paper above the page has the page's texture, the course cards stay dark under the status bar, and inside the viewport the artwork matches the previous build to within its grain. Chromium's default GPU path drops the bottom of a WebGL canvas while an opaque layer overlaps the viewport top, so the emulation runs on ANGLE's SwiftShader backend. This remains an emulation; the device check below still applies.

## The flat fill past the page (24 October 2026, third report)

After #61 and #65 the iPhone still showed a box at both ends. Measured on the owner's screenshots (3x, 440x956pt):

- At the top of the Desk, the band under the status bar was flat 244 (`#f4f4f5`), with a hard edge at 61pt against the page, which reads 241 through its grain.
- At the end of a page with the dark footer, the band under the bottom bar was flat: first 244 (paper), then 24 (`#18181b`) after a bounce, against the footer's artwork (25 to 64).
- Neither band carried grain or artwork.

Safari paints these areas in one flat colour: the document's background (`underPageBackgroundColor`; with `predominantColor` unavailable, WebKit's colour extension falls back to it too). In every screenshot the band was exactly the root background the page had set. Three changes follow:

- In document mode the root background is `--pageUnderGrain` (`#f1f1f1`), the page as an iPhone shows it through the grain, and so is the light `theme-color`.
- Safari stops the document's end above its bottom bar, inside the viewport. The old dark-footer state also required the footer's bottom to reach the viewport's bottom, which never happens at the end, so the end stayed paper until a bounce. On iPhone and iPad the bottom is now dark as soon as the footer fills most of the area under the bar (its top 40px inside the viewport).
- The dark footer's last 160px fade into the ink in document mode, so the footer meets Safari's flat ink without an edge.

check-ios-document now scrolls each route to its end and back, and requires the root colour to be the ink at a dark end and `#f1f1f1` otherwise.

## What Safari paints under its bottom bar (24 October 2026, fourth report)

With #66 live, two things remained on the iPhone:

- Mid-page, a line where the bottom bar begins. Above it the paper read 241 with the grain's noise; below it, under the bar, a flat 244 (`#f4f4f5`) with no noise at all, while the text went on under the bar.
- At the end of the Desk, when the page bounced past its end, a block of artwork between the footer's end and the bar, against the footer's new flat-ink end.

Safari 26 paints the page under its bottom bar, but no fixed layer. So the fixed grain (made fixed in #61) stopped at the bar, and through the footer and the other dark panels, which show the fixed artwork, the page showed the body's colour there. That was paper, so a white box under the bar, until the dark-footer state turned it black. The fixed artwork is still painted between the page's end and the bar while the page bounces, so a footer that ended in flat ink met it in a hard edge.

- The grain is part of the page again in document mode (`position: absolute` over `#layout`, as before #61), so it continues under the bar with the page.
- In document mode the body is the ink. Only the dark panels show it, and under the bar they stay dark. (A probe painting the body magenta found it nowhere else on any route.)
- The artwork fades into the ink over the 96px above the bar (a fixed gradient at the layout viewport's bottom, which is where the bar begins), so a panel crossing the bar has no edge.
- The footer's own fade to ink from #66 is gone: while the page bounces, its artwork now runs on into the artwork below it.

## The line at the bottom bar in dark panels (24 October 2026, fifth report)

With #67 live, the paper ran under the bottom bar without a line (241 above it, 241 with Safari's slight blue below), but every dark panel had one: flat ink (24) just above the bar, lighter artwork (31 to 64) below it.

The fourth report's premise was wrong for the artwork. The values under the bar follow the artwork, not Safari's bar. At the same screen position they grew lighter downward in one screenshot and darker in another. Where the faded artwork above the line can be traced back, it matches the value under the bar: at one point the fade read 27 at 39px above the bar, which puts the artwork at 31, and the bar showed 31. So Safari does show the artwork's reach (`--edge-bleed-bottom`) under its bottom bar. #67's fade to ink over the 96px above the bar therefore darkened the artwork only down to the bar and drew the line there. The fade is gone. The body stays ink, as the fallback inside a dark panel wherever the artwork is not painted.

Under the bar Safari still shifts the colour a little (green about 2 levels below red, blue about 5 above). That is the bar's own material; on the paper it is invisible.

## Automated checks

- `site/tests/fluid-edge-colour.test.mjs`: no inline background on the fluid canvas, the CSS rule that gives it black only outside document mode, guard height, width and offsets, and the ink rule. It fails on the old source.
- `site/tests/under-safari-bars.test.mjs`: the reach of the artwork, grain and panel backdrop, the shader remap, the paper caps, and the switch itself (evaluated from `setEdgeBleed`'s source): 480px from either end, sooner for a dark panel.
- `site/scripts/check-ios-document.mjs` (WebKit, iPhone emulation, all six routes, normal and reduced motion): transparent sticky guards with `pointer-events: auto` across the middle half of each edge (WebKit samples the midpoint; the corners stay open to taps), no extra document height, preserved scrolling, no viewport-sized fixed layer with a visible background (the open panels' own ink excepted), `#fluidCanvas` transparent, the artwork reaching at least 100px past both edges, the top cap following the scroll and the first dark panel, and the skip link invisible until focused. On an iPad Pro 11 (both motion settings) it opens and closes the menu and leaves through it, and requires the caps hidden while the page is shrunk and back once it is restored.
- `check-route-filter-motion.mjs` requires the open phone menu to receive input at all four viewport corners.
- Existing Pages checks exercise touch fluid, saved work, navigation and glass controls; desktop still asserts `#fluidCanvas` is `rgb(0, 0, 0)`.

Linux WebKit does not render iPhone Safari's native browser UI. Passing these tests is evidence of correct page geometry, not proof that the toolbar blending is fixed. Physical acceptance remains: real content is visible behind Safari controls during scrolling, not merely a different solid bar colour; the Desk top, the dark footer, a course page, menu and search open and closed, the Guide tools dialog, expanded and collapsed controls, and route changes all need to be checked after a reload. Known approximations: under the toolbar at the very end of the dark footer Safari shows the flat ink colour, which is a few levels darker than the footer's lit gradient; and on iPad the top bar may read the ink background for about one screen while the footer is being revealed.
