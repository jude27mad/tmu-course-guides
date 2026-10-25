# Safari scroll continuity

## Report

The owner's 25 October 2026, 14:39 Toronto recording was made after PR #76
deployed. It shows repeated scroll reversals around the companion statement and
footer, with Safari's toolbar expanding and collapsing. Passing the earlier
rapid-scroll/finite-physics checks did not establish smooth physical-device
rendering.

Production baseline: `629ee8e505aded320a155f65577b243258aee9c4`.

## Investigation

- `Footer.jsx` rebuilds its GSAP context on every window-height change, temporarily
  restoring automatic height and the initial uncover transform. The footer's
  layout is in `svh`, but the dependency tracks Safari's changing visible viewport.
- `Background.jsx` reconstructs its uniforms and ShaderMaterial on window resize.
  Its JSX also supplies a new constructor-arguments object on every render.
  This resets the slow drift and replaces a GPU resource unnecessarily.
- The fluid's `useMaterials.jsx` reconstructs all eight simulation materials when
  the canvas dimensions change. Its cleanup disposes them when size changes,
  although only uniforms depend on those dimensions.
- The game canvas accepts the default scroll measurement subscription. Its own
  event handler already computes input relative to the stage. Position-only
  measurements therefore cause scene updates without changing its drawing size.

The open fluid allocation PRs (#37 and #62) propose vector reuse and unrolled
render-loop operations already present in this baseline. They do not fix these
resize lifetimes.

Visual review of the first fix exposed a separate blank badge window during
re-entry. In the installed Drei 9.122.0 `View`, the draw callback calculates the
current offscreen flag but gates drawing on the previous React state, and a
layout effect can clear the returning window. The physics can remain perfectly
valid while that first returning frame draws nothing.

`BadgeViewport.jsx` uses R3F's existing scene portals, the existing shared
renderer, and the same badge camera/materials to draw from current DOM bounds
in that frame. `BadgeWorld` still owns exactly one Rapier world. Registry entries
carry each mounted position's appearance; the DOM badge no longer needs its own
view tunnel or visibility subscription. No dependency patch, additional canvas,
or additional physics engine is introduced. The directory retains its clipping.

The rapid-scroll recording still exposed a second alignment issue after the
first-return draw passed: a fixed canvas stays in screen coordinates while
native scrolling moves the badge's DOM window between renderer frames. Browser
documentation describes this asynchronous compositor/main-thread split. The
shared badge surface therefore belongs to the scrolling document on iOS. Before
painting, it is positioned around the current viewport; between paints, its
pixels travel with the page. When all badges leave that region, its last painted
surface stays at that document position until needed again. An absolute clipped
wrapper keeps the viewport-sized surface from extending the document's scroll
range. The fluid and background remain viewport effects.

## Verification

The test-only commit `fd574cbc9304ff2fd04dd15f7b634bd2d04a517f` reproduced the
regression in [Pages run 40223200144](https://github.com/jude27mad/tmu-course-guides/actions/runs/40223200144).
The new check failed on the real production code, with no page errors; the
other 16 route/motion cases passed.

| Observation during the same resize/scroll sequence | Before fix |
| --- | ---: |
| Footer writes that return through automatic height | 11 |
| New fluid simulation materials rendered | 7 |
| Background material retained | No |
| Game canvas updates for position alone | 1 |

The first fix (`85589369`) passed all 17 cases and reduced all reset/update counts
to zero while retaining the background material. Its recordings revealed the
separate badge blank described above. A first-return-frame check then failed on
`4655471a`: the badge was confirmed outside the viewport, returned fully into
view, but the next real renderer frame made **zero** badge draw calls. The test
advances the existing renderer deterministically; it does not replace physics,
inject forces, or rely on a CI frame-rate threshold.

The native-scroll alignment assertion then failed on `b1856293`: scrolling
40 px between renderer frames moved the badge window by -40 px while its fixed
painted surface moved 0 px. Its first-return draw already passed. This isolates
the compositor alignment problem from physics or the earlier visibility gate.

`site/scripts/check-route-filter-motion.mjs` adds two focused iPhone WebKit checks
to the existing Pages workflow. The first also pauses renderer frames and checks
that a native scroll moves the painted surface and its badge window together.
The resize check observes the real React Three Fiber stores
through React's test-installed instrumentation hook; production gains no debug
globals. It records footer style resets, background-material identity, newly
rendered fluid materials, and game-canvas position-only size updates while
alternating toolbar-sized viewport heights and scroll direction.

The fix retains the footer timeline across native iOS height-only changes,
keeps background geometry/material and fluid materials alive, updates uniforms
for actual canvas dimensions, and turns off the game's redundant scroll-bound
measurement. Width/orientation changes, desktop height changes, and expanded
credits still update the footer layout. Input retains its live stage bounds.
No physics constants, touch brush settings, shaders, spacing, or motion quality
settings are retuned.

The existing checks remain responsible for actual fluid input, multitouch,
statement opacity and 3D transforms, slicing, finite badge bodies, course
switching, saved records, reduced motion, native scrolling, horizontal overflow,
Safari edge appearance, and navigation. The route suite already records videos
and screenshots for visual review. No extra workflow or local application test
installation is needed.

Linux WebKit has no animated iOS Safari toolbar. Resizing its viewport exercises
the relevant resize handlers but is not a claim about physical iPhone frame
rate, heat, or battery use. Review the exported implementation on the same
iPhone with repeated swipes and toolbar reversals before calling that device
issue resolved.

## Official references

- [R3F constructor arguments](https://r3f.docs.pmnd.rs/api/objects): changing `args`
  reconstructs an object. Use properties for changing uniforms.
- [R3F performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls): repeated
  material/geometry creation carries setup and compilation costs.
- [R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas): resize options forward to
  react-use-measure; scroll measurement is enabled by default.
- [react-use-measure source, installed version 2.1.7](https://github.com/pmndrs/react-use-measure/blob/v2.1.7/src/index.ts):
  bounds equality includes position as well as dimensions.
- [Drei View source, installed version 9.122.0](https://github.com/pmndrs/drei/blob/v9.122.0/src/web/View.tsx):
  the frame callback draws using the previous `isOffscreen` state, and the layout
  effect clears on visibility changes. The badge-specific viewport removes that
  asynchronous gate while keeping the existing renderer and geometry.
- [GSAP ScrollTrigger configuration](https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()/):
  mobile height refreshes can jump when start/end values are recalculated.
  Avoiding an application's own animation teardown is also necessary.
- [Browser scrolling and main-thread effects](https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html):
  native scrolling can move visible content before JavaScript receives the
  updated scroll position; relying on script to reposition a fixed visual
  surface can make it lag behind the document.
