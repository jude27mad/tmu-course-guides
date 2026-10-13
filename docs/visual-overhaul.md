# Subject headers and visual verification

Subject-header baseline: October 12, 2026. This supersedes the October 11 abstract signal engine, liquid-metal vortex and optical crystal. The Night Shift section records later branch work and planned replacements; the verification below belongs to this subject-header baseline.

## Artwork

| Course | Current scene | Meaning |
| --- | --- | --- |
| CEN100 | Planetary gearbox with 24/18/60-tooth sun, planet and fixed ring | Coupled engineering motion with involute gear teeth |
| MTH140 | Flowing mint function ribbons and analytic tangent | A curve's local direction and continuous change |
| MTH141 | Sphere and basis transformed by 3×3 matrices | Linear maps, deformation and rank-two projection |

The folded-page logo is an original vector mark. The original salmon, mint and lavender identities remain. Titles and artwork have separate responsive zones; rotation-aware framing keeps the subject within its stage. Headers are visual introductions; interactive study exercises remain in Study.

## Interaction and rendering

Scenes animate continuously when motion is enabled. Mouse/touch dragging directly changes orientation; release adds decaying inertia. Focused artwork supports arrow-key rotation and Home reset. Pause, device reduced motion and the remembered motion preference control animation. Paused artwork permits normal page scrolling.

The production renderer uses locally bundled Three.js 0.186.1 and WebGL2. Matching portrait/landscape WebP posters appear before the first successful frame and remain when WebGL2 is unavailable. Context loss and shader/render errors stop the GPU scene and restore its poster. One frame owner sleeps offscreen, while hidden and when paused; adaptive quality reduces work on sustained slow frames.

Scripts, fonts and artwork are self-hosted. No remote model service or runtime CDN is required. The static pages run without a deployment build step.

## Verification

The subject-header and privacy changes passed 48 Node tests and six course/motion UI workflows, including real timed GSAP playback in the DOM harness. Coverage includes scene math, finite geometry, drag/inertia, pause/visibility lifecycle, fallback, source data and preserved guide interactions.

Responsive layout checks used phone, tablet and desktop viewport widths, including 320–1920 CSS pixels. GPU-capable remote browser captures were used for subject-header visual review; captures are in `docs/qa/subject-headers/`. The ordinary review browser lacked WebGL and exercised fallback rendering. DOM tests use a stub renderer and do not prove visual quality or GPU performance. No sustained physical iPhone, iPad, Android or desktop frame-rate certification is claimed.

## Rebuild and checks

```sh
npm ci --prefix tools/scene-build
npm run build --prefix tools/scene-build
npm ci --prefix tools/ui-build
node --test tests/*.test.mjs tests/scene-lifecycle.cjs tests/scene-rendering.cjs
npm test --prefix tools/ui-build
```

Keep poster imagery aligned with the production scene and camera. The older offline Mitsuba export/render scripts are tooling, not proof of live GPU output. Review actual browser pixels when changing geometry, lighting, camera or materials.

See [motion architecture](immersive-motion.md), [math studio](math-studio.md), [privacy review](privacy-audit.md) and [release history](../CHANGELOG.md).

## Design references

Subject references include Bartosz Ciechanowski's [Mechanical Watch](https://ciechanow.ski/mechanical-watch/) and [Gears](https://ciechanow.ski/gears/), and 3Blue1Brown's linear-transformation explanations. The selected mint Calculus concept informed the ribbon art direction.

Interaction references include [Bruno Simon's public portfolio source](https://github.com/brunosimon/folio-2025), [Active Theory](https://activetheory.net/work), [Locomotive](https://locomotive.ca/en) and [GSAP timelines](https://gsap.com/docs/v3/GSAP/Timeline/). These are references, not dependencies or claims that this site reproduces their engines.

## Night Shift

**Branch snapshot:** `night-shift` at `f4c8342`. The [Stage 1b report](qa/night-shift/stage1b.md) re-verifies the earlier router-review snapshots in Chromium, with Safari/iOS and listed follow-ups still open. This is not approval of the unbuilt book stages. The subject scenes documented above remain in use until replacement books are built and checked.

### Present versus planned

| Area | Status at this snapshot |
| --- | --- |
| Editorial layout, live deadline card, dock and semester timeline | Integrated; current deadline semantics are in the [deadline report](qa/toronto-deadline-results.md). |
| Root Desk and CEN100 move | Integrated DOM directory at `/` and guide at `/cen100/`; the still Desk illustration is not an interactive 3D Desk. Old CEN-specific root hashes forward with query/hash preserved. |
| Persistent shell and no-reload routing | Integrated; Stage 1b records Chromium round-trip verification at both bases. Safari/iOS remains untested. Native direct links and normal-navigation fallback are retained. |
| Week model and page-bend math | Integrated logic groundwork; not evidence of rendered pages, pop-ups or shader integration. |
| Command palette and paper sounds | Planned in Tasks F/H, not merged here. Existing sound is opt-in/off by default; the new paper gestures are not implemented. |
| Animated backdrop and course-switch wipe | Retired from boot loading; complete file/snippet cleanup remains planned. |
| Book renderer, new book posters and shared WebGL stage | Planned. No book visual or performance gate has passed in the evidence reviewed here. |
| 3D Desk and in-world camera transitions | Planned Stage 5 work, separate from the existing router. |

The external `cen100-guide` forwarder change is also [recorded as unapplied](qa/night-shift/forwarder.md); this repository's old-root hash handling does not prove that other repository was changed.

### Composition and motion rules

The first book gate is a finished paused layout in dark and light, not an animation demonstration. Keep the course title, actual date/precision label, next action and coursework access readable without WebGL. Dark mode uses a night-desk treatment; light mode needs its own daylight treatment rather than a dark hero inserted into a light page.

Reading and useful controls have priority over page turns and camera movement; ambient detail is last. Follow the one-pulse priority (next deadline, Today, unset-section cue). Book urgency uses static ink/glow, not a second pulse. Never cover or hide visible content to wait for an intro or late-loaded module. Preserve a first-focusable Skip to coursework link and a real-text week/assessment mirror; these are acceptance requirements for the future book, not current accessibility certification.

The persistent shell/router mounts and unmounts route-owned effects. A single GSAP core supplies the lazy ScrollTrigger/SplitText/Lenis vendor; temporary modal holds do not overwrite saved Pause motion. Existing high/mid/low tiers and the watchdog provide adaptation hooks. Stage 3 must measure the actual book cost before its budgets or smoothness are described as achieved. See [motion architecture](immersive-motion.md#night-shift).

### Course-book identities — planned Stages 2–4

| Course | Planned object and pages | Planned pop-up language | Stage |
| --- | --- | --- | --- |
| MTH140 | Mint linen sketchbook, elastic band, cream paper with a daylight variant and pencil curves | Curved arches and flowing folds | Stage 2 representative book; Stage 3 profiling |
| CEN100 | Salmon technical manual, debossed schematic cover and blueprint pages | Box-like, mechanically articulated folds | Stage 4 |
| MTH141 | Lavender graph-paper notebook and square grid | Faceted planes and V-folds | Stage 4 |

All three use the same week/data contracts, while construction, marks and unfolding differ. Assessment size follows final → midterm → quiz/lab → minor; real weights are only a secondary visual cue and are never rewritten. Completion/Undo changes the student's recorded state, not a verified submission.

The [build spec](book/semester-book-spec.md) defines MTH140's paused-frame, engine/DOM and input gates. Fine-pointer scroll scrubbing is bounded; touch keeps native vertical scrolling and uses horizontal gestures or week buttons. Reduced/off modes and renderer failure must retain week selection, readable assessment details and the flat timeline. New posters must come from the matching renderer, without stale baked deadline text. These are planned requirements, not descriptions of delivered book assets.

### Evidence and review limits

The [QA index](qa/night-shift/README.md) separates Stage 0 baselines, Stage 1 checks, A–E integration and the final Stage 1b review. Stage 1b records 210/210 root tests, passing UI workflows and Chromium route/fallback checks; steady idle Desk rAF activity and other follow-ups remain open. The separate [Toronto deadline report](qa/toronto-deadline-results.md) records 43/43 boundary checks in each of Toronto, UTC and Los Angeles and 200/200 root tests on its stated clean-checkout combination. These are separate reports with different scopes, not fresh test runs for this documentation change.

Chromium/SwiftShader layout captures and DOM lifecycle tests are not physical iPhone/iPad performance evidence. Real-device smoothness, heat, battery, WebKit review and the planned book/Desk visual matrix remain unverified. The [device checklist](qa/device-checklist.md) is a test protocol, not a completed result sheet.
