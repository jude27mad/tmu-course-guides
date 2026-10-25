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

`site/scripts/check-route-filter-motion.mjs` adds one focused iPhone WebKit check
to the existing Pages workflow. It observes the real React Three Fiber stores
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
- [GSAP ScrollTrigger configuration](https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()/):
  mobile height refreshes can jump when start/end values are recalculated.
  Avoiding an application's own animation teardown is also necessary.

