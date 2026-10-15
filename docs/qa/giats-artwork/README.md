# Giats artwork review

Review branch: `codex/giats-artwork`, based on `main` at
`2668ada`. Work began from `1eaf4df` after fetching on 2026-10-15; main's later
documentation/release-note updates were incorporated before the final build.
This is a review export;
the live Pages `/next/` site changes only after merge and deployment.

## Implementation

- The existing moving SVG window mask now exposes one continuous canvas adapted
  from Kairo's actual signal field. Its point wave, colours, repulsion and pulse
  math are preserved. It subscribes to Giats's existing Tempus clock only while
  visible, motion is enabled and the document is visible. The backing canvas is
  capped at 2 million pixels, 2048 × 1536, and DPR 1.5. Pointer listeners are
  passive and ignore touch and interactive controls. Pause/reduced motion shows
  Kairo's own static pulse composition; no JavaScript/canvas leaves a CSS point field.
- Next Up, all three course heroes, assignment windows and checklist windows use
  one reusable image component. It retains Atelier North's `pixelateImage()`
  downsample/upscale technique (18 pixels, `progress ** 2.5`, unsmoothed upscale,
  1.5 seconds and 1.1 → 1 scale). The existing GSAP/ScrollTrigger instance and
  `main` scroller control the reveal. HTML images remain underneath the decorative
  canvas; reduced motion, initialization/drawing failure and completion expose
  the finished image. Cleanup kills timelines/triggers and removes listeners.
- Three individually verified public-domain USGS Landsat artworks are bundled
  at 1600 and 800 pixels. Lambert Glacier is also the unresolved/empty Next Up
  fallback. [Individual image credits](../../../site/public/licenses/ARTWORK-CREDITS.md)
  and [code notices/provenance](../../../site/public/licenses/README.md) accompany
  both source and exported preview. Existing Giats credits remain.
- Unused FloatingMeshes/FloatRigidBody, both marble implementations, their texture
  and mount-slot helpers, and their unused warehouse HDR were removed. Shared
  rendering/physics for the badges and pre-footer remain. No dependencies,
  deployment workflows or `site/src/lib` changes were introduced.
- Faster artwork mounting exposed a menu/route animation race: constructing a
  paused menu tween with GSAP's eager `overwrite: true` cancelled the route's
  navbar reveal. The shell now uses `overwrite: 'auto'`, which resolves conflicts
  only when it actually runs. This one-line compatibility fix preserves the
  original menu and page-transition behavior; their layout and timing are unchanged.

## Automated verification

From `site/`:

```sh
npm ci
npm test
npm run export:preview
```

- Baseline: 65 tests passed before source edits.
- Signal regression tests: 5 failures before implementation; then 5 passed.
  They cover the original field's visible static composition, resolution caps,
  single scheduler subscription, offscreen/hidden/paused cleanup, touch and
  interactive targets, unavailable Canvas2D, and the single-canvas mask wiring.
- Image regression tests: 8 failures before implementation; then 8 passed.
  They cover actual raster sampling, viewport/document pauses, completion,
  motion preferences, canvas/drawing failure, late image events, cleanup and
  local course/fallback resolution.
- Navigation compatibility regression: the real-GSAP test failed before the
  one-line fix, then passed. It checks that preparing a paused menu preserves
  the route reveal and that opening/closing the menu still hides/restores the header.
- Complete suite after implementation: **79 passed, 0 failed**. Existing course
  content, deadline boundaries, storage, completion/Undo, calendar and backup
  assertions remain unchanged.
- Export: **passed** using the repository's script; all eight static pages were
  generated and `next/` was copied from `site/out/`. No generated HTML or bundles
  were edited manually.
- Changed artwork files pass ESLint. The full build reports existing warnings
  in the fluid effect/hooks and course Portal, plus outdated Browserslist data.

The managed sandbox prevented the Node test runner's child processes from
reporting/running correctly. The successful baseline and final `npm test` runs
used the same commands with the environment's approved execution permissions.

## Browser verification

Run the actual exported preview matrix from the repository root:

```sh
node site/scripts/verify-artwork.mjs
```

The script serves `next/` at its real `/tmu-course-guides/next/` base path. It uses
Playwright (override `PLAYWRIGHT_PATH` when needed) and Chromium. The detailed
[browser results](results.md), [machine-readable observations](results.json) and
[screenshots](screenshots/) document the checked build.

Final export `lMK_JvjVNpFTFtpP9cphE`: **133 of 134 browser assertions passed**
(130 in the fresh full run, plus four explicitly recorded same-build homepage
navbar checks). There were no browser/page/HTTP errors or third-party runtime
requests. The only failed assertion is the existing saved-Pause offset below.
The rapid menu/navbar regression passes after the compatibility fix.

Saved section selection, checklist progress after reload, Mark done and Undo
passed. Five actual course-link/browser-Back round trips held live listeners at
419, active observers at 42, recurring animation-frame loops at 4, and connected
canvases at 5. Pause motion, reduced motion, canvas failure and no-JavaScript
checks all retain the real images. The hidden-document check uses a synthetic
visibility event; it does not claim to test mobile operating-system suspension.

Selected captures: [phone windows](screenshots/phone390-home.jpg),
[desktop windows](screenshots/desktop-home.jpg),
[Next Up](screenshots/desktop-next-up.jpg),
[pixel reveal in progress](screenshots/phone390-pixel-reveal.jpg),
[CEN100](screenshots/phone390-cen100.jpg),
[MTH140](screenshots/desktop-mth140.jpg), and
[MTH141](screenshots/phone430-mth141.jpg).

Viewport coverage is 390 × 844, 430 × 932, 820 × 1180 and 1440 × 900. These are
browser-emulated viewports, not physical iPhone/Safari testing. Chromium uses
software rendering; no physical-device GPU performance claim is made.

### Existing navigation limitation

The original `main` export and the artwork export both reproduce a saved-Pause
navigation issue: after Pause motion, reload, then choosing MTH140 from the menu,
the URL and course heading update but the menu shell can leave `main` shifted
left by 40vw (−576px at 1440px). The browser report retains this failed assertion
and the baseline comparison. Reloading the destination allows the independent
artwork, progress and motion checks to continue. This pre-existing offset is
separate from the eager-overwrite navbar race corrected above.

The empty/unresolved artwork mapping is covered by the focused null/unknown
course tests and the real no-JavaScript SSR fallback. No fabricated assessment
dates or completion records were used to manufacture an empty Next Up screenshot.
