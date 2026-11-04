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

The fourth report's premise was wrong for the artwork. The values under the bar follow the artwork, not Safari's bar. At the same screen position they grew lighter downward in one screenshot and darker in another. Where the faded artwork above the line can be traced back, it matches the value under the bar: at one point the fade read 27 at 39px above the bar, which puts the artwork at 31, and the bar showed 31. So Safari does show the artwork's reach (`--edge-bleed-bottom`) under its bottom bar. #67's fade to ink over the 96px above the bar therefore darkened the artwork only down to the bar and drew the line there. The body stays ink, as the fallback inside a dark panel wherever the artwork is not painted.

Two independent readings of the screenshots confirmed this; one matched the shader's own per-pixel noise under the bar to the rows of the canvas reaching past the layout viewport. A reading of WebKit's source explains the fourth report: WebKit cuts what a fixed element paints itself (the grain's CSS background) at the layout viewport, but a WebGL canvas inside a fixed element keeps its reach. Past the ends of the document, WebKit clips all content and Safari shows only the root's flat colour.

That last case is where #67's fade was right: at the end of a page that ends in the dark footer, Safari stops the page's end at the bar, and under the bar it shows the root's flat ink, not the artwork. The fade therefore stays, but only there: the navbar sets `html[data-edge-end='dark']` while the end of a dark-ending page is at the bar (at rest or bouncing past it), and only then the fixed fade above the bar is shown (opacity 0 otherwise, 0.2s transition).

Under the bar Safari still shifts the colour a little (green about 2 levels below red, blue about 5 above). That is the bar's own material; on the paper it is invisible.

## A black box past the page, and the Menu cutting the page at the bars (3 November 2026, sixth report)

Two iPhone reports, after Giats's menu (#105):

- At the end of each of the three course pages, the area under the bottom bar was a flat black box under a page that ends in paper. (A fix for this, `claude/blend-safari-bars`, was paused on 28 October and never merged.)
- A screen recording of the Desk: the moment Menu was pressed, the area under the bottom bar (and under the status bar) turned dark while the page still filled the screen, and it stayed dark until the close had fully finished.

Measured on the recording (30 fps, 440x956pt): under the toolbar the page read 237 until the frame of the tap, then 23 in the very next frame, while the page above it was still full size and 237; on the close it stayed 44 to 52 until the last frame of the animation, then returned to 237 at once. The status bar was 23 throughout, at rest included.

Causes:

- Past the ends of the document Safari paints one flat colour, the root's with the body's blended over it (`LocalFrameView::documentBackgroundColor`), so an opaque body wins. #67 made the body the ink in document mode, so that colour was the ink: under the toolbar past the end of every page that ends light, and under the status bar at the top of every page.
- The shell marks the page shrunk at its first frame, and from then the shrunk page's clip (`html[data-page-shrunk] #main`) cut it at the layout viewport. Safari shows the page under its bars, so the part under both bars vanished at the tap, while the page was still full size, and the dark artwork behind it showed instead. The clip went only once the close had finished. The navbar also turned the root and the body to the ink at the tap.

Change, document mode only:

- The body is clear, so the root alone decides the colour past the page's ends: `#f1f1f1` at rest, the ink at a dark end or with a panel open, as before. The dark panels keep their ink fallback (no WebGL, or before the artwork's first frame) on the app's root element (`.root`, app.module.scss), which covers the same area as the body but is not blended into that colour.
- The shell tweens `--panel-cover` on the root from 0 to 1, on the same timeline as the page's shrink (0.92 s, `expo.inOut`), so reversing returns it. At the tap the clip still reaches `--edge-bleed-*` (160px, beyond either bar) past the layout viewport; the reach shrinks to nothing and the corners round as the page shrinks, so the card's edges move in from past the screen's edges, as on Giats's site, and back out on the close. While the page is shrunk, the colour past its ends is `color-mix()` from the page's colour to the ink by the same amount (`--panel-ink`, tweened beside `--panel-cover`). Where the dark footer was under the toolbar before the tap it was the ink, and stays so: the navbar keeps that reading (`data-footer-bottom`) from before the tap until the page is restored, because the shell's 2px page border lengthens the document by a few pixels and moved "the end" (`data-edge-end`) off the bar, which turned that colour to paper at the Desk's end in a first version.
- Leaving for another page from an open panel, the paper rises over the shrunk page; `fadePanelEdges` lifts the colour past the ends to it at the same time (only `--panel-ink`: `--panel-cover` would widen the still visible card). Before, it stayed the ink until the next page arrived.

In a Chromium iPhone emulation (440x796 layout viewport, 62px and 98px bars):

- Under the toolbar at the Desk's top, the page covers the band at the tap and at the end of the close (before: 2% of it). The open card and its colours are unchanged.
- At the end of CEN100 the colour past the end is `#f1f1f1` at rest (before: the ink). With Search opening it moves from 241 to 24 as the page shrinks, and back on the close; the page fills the band under the status bar until it shrinks.

This assumes Safari repaints the colour past the page's ends when the root's computed colour changes, as it does for the other root colour switches here; if it updated it only lazily, the colour would still end right, a little late. The physical check remains: the Desk at its top and mid-page, the end of a course page, Menu and Search opened and closed, and a page change from the open menu.

## A dark box rising under the toolbar at a dark end (4 November 2026, seventh report)

An iPhone screenshot of the area under the bottom toolbar on the Desk, Courses, Privacy and Website updates, the four pages that end in the dark footer: lit artwork at the top of the band and, below a hard horizontal line, a flat dark box, which rose from the bottom of the screen while scrolling down to the end. Course pages, which end light, did not show it.

Cause: past the document's end Safari paints one flat colour, the ink on these pages (`data-browser-bottom='dark'`). During the last stretch of scrolling (as long as the toolbar is tall) the document's end crosses the area under the toolbar, where Safari shows the page and, through the transparent footer, the artwork's reach. The artwork met the flat ink at the document's end in a hard line. The fade added in the fifth report is fixed, so it could only be shown once the end was at the bar (`data-edge-end`, within 1px of the end), and it faded in over 0.2 s then; before that, nothing blended the two.

Change, document mode only:

- The page fades into the ink over its own last 120px: an `::after` on the footer's wrapper (`<footer>` in Layout.jsx, layout.module.scss), behind the footer's content and above the artwork. The wrapper ends the document and is not moved; the footer inside it is (its reveal). Being part of the page, the fade moves with the page under the toolbar, and it reaches exactly the colour past the end (`var(--black)`), so the end crosses the bar without an edge.
- The fixed fade (`.background::after`) is now an exact copy of the page's own (same `--dark-end-fade` and `--dark-end-fade-height`, global.scss). It replaces the page's own, in the same frame and without a transition, only while the page bounces past its end (`html[data-edge-past='end']`, set by `setEdgeBleed` when the scroll position is 1px or more past the end; Pause motion's native scrolling, since Lenis never overscrolls). Then the artwork shows between the page's end and the bar, and the copy keeps it shaded into the ink at the bar, as before; back at rest both lie in the same place. A first version swapped whenever the end was at the bar (`data-edge-end`): a review found that the scroll handler runs a frame or more after the page moves, so when scrolling up from the end the page's own fade was still hidden while the end was already back under the toolbar, and a lit strip showed there. `data-edge-end` is unchanged and still read by the browser checks.
- The fade is eased (smoothstep stops), so neither of its ends draws a line. The grain over it moves the ink by less than one level (24 to 24.7 on average), against Safari's flat 24.

In a Chromium emulation of Safari's geometry (440x796 layout viewport, a 98px toolbar band below it in which the page and the artwork's reach are drawn, and past the document's end a filler with the root's flat colour that covers everything; SwiftShader WebGL), scrolling each of the four pages from 140px short of its end to the end in 5 to 20px steps, motion on:

- Before: a step of 14 to 15 levels at the document's end (the artwork at 31 to 39 against the ink's 24) at every position while the end was under the toolbar; nothing at rest at the end.
- After: at most 1.8 levels at every position, the grain's own noise, on all four pages. The page's own fade ends exactly at the document's end (0px apart at every position) and is the one shown at rest at the end.

Pause motion holds the artwork still, darker near the bottom of the screen, so the step there was 2 to 3 levels before and is under 2 after. Bounces of 20, 50 and 90px past the end (the page moved up while fixed layers stay, with `data-edge-past='end'` as Safari's scroll position past the end sets it) show no step at the page's end or at the bar in either build (at most 2 levels). This remains an emulation; the physical check is scrolling slowly to the end of the Desk, Courses, Privacy and Website updates, with motion on and with Pause motion, with the toolbar expanded and minimized.

## Automated checks

- `site/tests/fluid-edge-colour.test.mjs`: no inline background on the fluid canvas, the CSS rule that gives it black only outside document mode, guard height, width and offsets, and the ink rule. It fails on the old source.
- `site/tests/under-safari-bars.test.mjs`: the reach of the artwork, grain and panel backdrop, the shader remap, the paper caps, and the switch itself (evaluated from `setEdgeBleed`'s source): 480px from either end, sooner for a dark panel.
- `site/scripts/check-ios-document.mjs` (WebKit, iPhone emulation, all six routes, normal and reduced motion): transparent sticky guards with `pointer-events: auto` across the middle half of each edge (WebKit samples the midpoint; the corners stay open to taps), no extra document height, preserved scrolling, no viewport-sized fixed layer with a visible background (the open panels' own ink excepted), `#fluidCanvas` transparent, the artwork reaching at least 100px past both edges, the top cap following the scroll and the first dark panel, and the skip link invisible until focused. On an iPad Pro 11 (both motion settings) it opens and closes the menu and leaves through it, and requires the caps hidden while the page is shrunk and back once it is restored.
- `check-route-filter-motion.mjs` requires the open phone menu to receive input at all four viewport corners. Its document-shell check requires a clear body, and `iphone-shell-under-bars` samples every frame of a Menu cycle at the Desk's top and Search cycles at CEN100's end and at, and 40px short of, the Desk's dark end. It reads the clip the browser applies: while the page is still full size, it must reach under both bars (62px and 98px) wherever the document does, and the colour past its ends must stay the page's (the ink at the dark end); open, the card lies between the bars on the ink; closed, the page's colour returns. Both fail on the build before the sixth report's change, and the dark-end cases on its first version.
- `site/tests/under-safari-bars.test.mjs` pins the clear body and the ink on `.root`, the clip's reach and corners, the `--panel-cover` tween beside the page's own, and the colour mix while the page is shrunk. Since the seventh report it also pins the dark end's fade: the shared eased gradient ending in `var(--black)`, the page's own fade on the footer's wrapper (absolute, behind the content) and the fixed copy without a transition, which replaces it only past the end (`data-edge-past='end'`, evaluated from `setEdgeBleed`'s source); they fail on the previous styles.
- Existing Pages checks exercise touch fluid, saved work, navigation and glass controls; desktop still asserts `#fluidCanvas` is `rgb(0, 0, 0)`.

Linux WebKit does not render iPhone Safari's native browser UI. Passing these tests is evidence of correct page geometry, not proof that the toolbar blending is fixed. Physical acceptance remains: real content is visible behind Safari controls during scrolling, not merely a different solid bar colour; the Desk top, the dark footer, a course page, menu and search open and closed, the Guide tools dialog, expanded and collapsed controls, and route changes all need to be checked after a reload. Known approximations: under the toolbar at the very end of the dark footer Safari shows the flat ink colour, which is a few levels darker than the footer's lit gradient; and on iPad the top bar may read the ink background for about one screen while the footer is being revealed.
