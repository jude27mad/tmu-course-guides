# Scroll continuity investigation

The owner's 25 October 2026, 14:39 Toronto recording shows repeated scroll
reversals around the companion statement and footer. Earlier finite-physics
checks did not establish smooth physical-device rendering.

## Current production and scope

Production changed during this investigation. PR #78 restored the original
Giats card motion. PR #79 then merged as `7f36065f`, restoring the complete fluid
implementation and its contained, synchronized scroller in place of native
iOS document scrolling. This branch integrates both production changes.

The final patch preserves every file in `site/src/components/canvas/fluid/`
exactly as it appears in PR #79. It also preserves that PR's fluid Canvas,
composer, pointer input, contained synchronized scrolling, and stable 100svh
layout. Outside the fluid code, Lenis leaves pinch gestures to the browser and
the existing keyboard/no-JavaScript fallbacks remain usable. The earlier experimental native
document anchoring and fluid-material changes have been removed from this PR.
No additional canvas, physics world, dependency, or workflow is introduced.

The remaining changes are:

- `BadgeViewport.jsx` draws each badge using its current DOM bounds within the
  existing shared renderer. Installed Drei 9.122.0 `View` gates drawing on the
  previous React offscreen state and clears on visibility changes; this can
  leave the first returning frame empty. The replacement keeps the same
  cameras, geometry, lights, clipping, and single Rapier world.
- `Background.jsx` keeps its geometry, material, uniforms, and drift alive.
  Actual canvas-size changes update properties rather than reconstructing GPU
  resources from a fresh constructor-arguments object.
- The shared badge and existing slicing-game canvases do not subscribe to
  redundant scroll-position measurements. Drawing and game input continue to
  use live DOM bounds. Real size changes still update the canvases immediately.
- `Footer.jsx` uses the contained scroller's actual height when deciding whether
  its reveal must be rebuilt. Toolbar-only changes to `innerHeight` should not
  reset a layout based on stable 100svh. The footer stays in normal document
  flow when motion is disabled, including while its native credit expands.
- The existing keyboard-scroll handler also handles focus inside the restored
  hidden scroller. Form controls, native disclosures, and editable content keep
  their own key behavior; the touch/fluid input path is unchanged.
- A small Lenis `virtualScroll` filter in `utils/touch-scroll.mjs` leaves a
  complete pinch gesture, including both releases, to the browser. Ordinary
  one-finger scrolling and the original fluid's multi-pointer listener retain
  their behavior. CSS permits native contained scrolling without JavaScript.
- Phone page transitions keep the existing full-width fade independently of
  the active scroll owner. They must not select the desktop loading-card
  animation merely because the scroller is contained again.

The original Giats card drop, damping, forces, and offscreen simulation remain
unchanged. Course content, typography, spacing, deadlines, saved records, the
student-built word animation, and the hidden slicing game are not redesigned.

## Evidence and verification status

Before PR #79, checks on the original production source reproduced 11 footer
resets during toolbar-sized viewport changes and a returning badge frame with
zero draw calls. The background material was also replaced during resizing.
The first-return failure was isolated from physics by advancing the real
renderer exactly one frame after the badge returned fully into view.

On the previous production base (`5ffe30c9`), all 18 route/animation cases passed
in [Pages run 40231536923](https://github.com/jude27mad/tmu-course-guides/actions/runs/40231536923).
The matching phone and desktop recordings and screenshots were visually
reviewed for badges, directory clipping, statement motion, fluid response, and
slicing together. That run still failed a Chromium credit tap in the full
footer; keyboard activation, the compact footer, and WebKit passed. Waiting for
native activation confirmed that this was a missed tap rather than merely an
immediate assertion. The subsequent reduced-motion footer change passed in
both Chromium and WebKit on the PR #79 base.

Those results do **not** verify the final PR #79-based implementation. The
production restoration changed several existing test contracts. In
[Pages run 40233118819](https://github.com/jude27mad/tmu-course-guides/actions/runs/40233118819),
the data-test stage stopped before build/browser checks with nine failures:

- the former CSS-only fluid background requirement;
- three former fluid allocation/serialization requirements;
- four checks expecting the removed native-touch adapter;
- the former dynamic-height shell requirement.

The checks now follow PR #79's active contract: real pointer sequences, shader
colour/texture values, the restored black base, and the stable contained
viewport. They no longer require the removed allocation optimization or native
touch adapter. The real browser pinch check caught Lenis intercepting zoom
after PR #79; its filter and unit tests now live outside the original fluid
folder. The original fluid source is unchanged. Pinch zoom, keyboard
scrolling, reduced motion, saved work, navigation, and control checks remain.

The dedicated iOS document-scrolling workflow and script were retired with that
architecture. The existing Pages route suite already checks iPhone WebKit,
menus, transitions, all course badges, and the companion scene; it now also
checks horizontal scrolling on those routes and during the word reveal. This
avoids creating a second contained-scroll suite. Final CI and visual review
remain required before this draft is ready.

The added first-return check now scrolls the active contained main element.
The resize-continuity check models changes to `innerHeight` while preserving the
actual 100svh layout, then verifies retained background state, no footer reset,
and no position-only game-canvas update. It no longer asserts an altered fluid
resource lifecycle. The earlier native-document canvas-alignment check was
removed together with that implementation.

On `ca12573a`, all 261 data tests and all CI jobs passed. Pages verified the
first returning badge frame (one draw), zero footer resets, retained background
material, and zero position-only game-canvas updates. It exposed remaining
phone transition, pinch, and no-JavaScript regressions; this revision repairs
those without weakening their assertions. The iPhone slicing check now sends
the pointer input used by the restored scene, still requiring its real raycaster
to register a slice. Final results belong in the pull request after verification.

Linux WebKit has no animated iOS Safari toolbar. CI recordings can verify the
application's layout and drawing behavior, but cannot certify frame pacing,
heat, or battery use on the owner's physical iPhone. A final physical-device
review is needed after deployment.

## Official references

- [R3F objects and constructor arguments](https://r3f.docs.pmnd.rs/api/objects):
  changing `args` reconstructs the object; properties update existing objects.
- [R3F performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls): repeated
  material/geometry creation adds setup and compilation work.
- [R3F Canvas resize options](https://r3f.docs.pmnd.rs/api/canvas): scroll
  measurement is enabled by default through react-use-measure.
- [react-use-measure 2.1.7 source](https://github.com/pmndrs/react-use-measure/blob/v2.1.7/src/index.ts):
  bounds equality includes position, and ResizeObserver uses the debounced
  measurement callback.
- [Drei 9.122.0 View source](https://github.com/pmndrs/drei/blob/v9.122.0/src/web/View.tsx):
  the frame callback uses the previous offscreen state; the layout effect
  clears when visibility changes.
- [GSAP ScrollTrigger configuration](https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.config()/):
  mobile height refreshes can jump as start/end values are recalculated.
  Application-owned context teardown must also be avoided when layout is stable.
- [Lenis settings](https://github.com/darkroomengineering/lenis#settings):
  `virtualScroll` can return false to leave an input event unsmoothed. The
  existing dependency supports this without modifying its source or the fluid.
