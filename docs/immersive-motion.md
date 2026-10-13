# Course scenes and interface motion

Subject-header baseline — October 12, 2026. Static HTML and native ES modules are served directly by GitHub Pages. Prebuilt vendor bundles are committed. The Night Shift section below records the branch architecture and separates it from planned book work.

## Night Shift

**Scope:** `night-shift` at `f4c8342`, before this documentation-only change. The [Stage 1b report](qa/night-shift/stage1b.md) re-verifies the router and lifecycle changes in the earlier work-in-progress snapshots. It records Chromium results at both deployment bases, not Safari/iOS or completed book verification. Historical passes in the [QA index](qa/night-shift/README.md) apply to the revisions those reports name, not automatically to every later change.

### Persistent shell and route lifecycle

The four real documents are Desk (`/`), `/cen100/`, `/mth140/` and `/mth141/`, relative to the deployment base. `assets/app/router.mjs` handles eligible same-origin navigation without replacing the document. `route-boot.mjs` mounts direct loads. The router coordinates outgoing cleanup, destination styles and content, title/body metadata, history, scroll restoration, hashes and focus. Failed or unsupported swaps fall back to ordinary navigation; modified clicks and new tabs remain native.

Route modules expose `mount({root, route, signal, direct})` and `unmount()`. They release route-owned listeners, observers, timers, dialogs and scene resources before another route mounts. `assets/route-lifecycle.mjs` supplies the scope and DOM-restoration helpers. The hub, motion controller, shared core and dock persist and rebind to the route. Core's `route()`, `meta()` and `isMath()` read the current route; Desk is an explicit mode, not an implicit CEN100 page.

The single persistent WebGL stage and camera travel between Desk and books are **planned**, not supplied by the router. At this snapshot, `assets/app/` contains the router and direct-load boot; `assets/book/` contains the week model and page-bend math, not a book renderer.

### Loading and ownership

`core.vendor()` lazily imports `night-vendor.mjs` (ScrollTrigger, SplitText and Lenis) and registers the plugins against the same `gsap-3.15.0.mjs` URL used by the guide. Keep one GSAP core and one cached vendor promise. `layout.css` is eager; optional effects load after first paint. The current boot feature list is `hero` and `scroll`.

Use one clock per owner: GSAP drives DOM animation and Lenis; the scene owns its render scheduler. Never double-step the same animation or throttle the shared ticker for one effect. View effects register cleanup through `core.track(scope, disposer)` and are disposed before rebinding; shell services must not acquire a second copy on a route change. `core.openItem()` remains the shared path to real assessment details, including hidden/past items, rather than duplicating guide state.

### Saved Pause motion versus temporary holds

**Pause motion** uses `guide-motion-paused` through the existing controller. It stops the scene and ambient loops, not deadline updates or explicit navigation. `core.hold(reason)` / `release(reason)` are temporary, independently named holds: they never write that saved preference. Releasing one hold cannot clear another. Ambient work also requires a visible document and the motion gate to permit it.

The device's reduced-motion preference takes precedence. `?motion=full` is page-local, not a saved preference; `?motion=off` forces motion off. Stage 1b notes that `?motion=` and `?tier=` currently persist across in-app routes for the life of the document; that QA-flag behaviour is deferred. The planned palette must hold while open, release before handing off to another modal, and leave saved Pause motion untouched.

### Tiers, watchdog and visibility

The core exposes high/mid/low tiers, a diagnostic `?tier=` override, and `night-tier` notifications. Its shared-ticker watchdog observes sustained slow frames only while ambient motion is allowed and can lower a tier; hidden/held intervals and large gaps reset sampling. These are adaptation mechanisms, not evidence of a guaranteed frame rate. Stage 1b still records steady idle GSAP-watchdog and ScrollTrigger rAF activity on Desk after a course visit; do not describe that path as fully idle. Its Chromium stability checks report flat route-resource counts and no live WebGL context on Desk after cleanup.

**Planned Stage 3 work:** profile the representative MTH140 book before certifying its quality settings. The book specification calls for bounded textures and live sheets, on-demand rendering on mid-tier/touch devices, optional high-tier effects, and a poster plus full DOM timeline at low tier or renderer failure. Downgrades must release unused GPU resources without losing week selection, focus or completion. No physical-device smoothness, heat or battery result is claimed here.

### Motion hierarchy and content safety

The [plan](../NIGHT-SHIFT-PLAN.md) makes the paused composition the first gate. Reading and coursework actions come first; a deliberate page turn or navigation is secondary; ambient detail is last. Only one ambient pulse is allowed, in priority order: next deadline, Today, then an unset-section cue. The planned book's urgency highlight is static; it must not add a competing 3D pulse.

**Never hide content that is already visible to start a delayed effect.** No loading cover, replayed intro or full-page wipe may gate coursework. Late-loaded effects leave visible headings and paragraphs readable; reveal effects belong below the fold. The intended touch experience retains native vertical scrolling and semantic week controls. Reduced motion removes the planned pin/scrub/camera travel; motion off changes state immediately. These are implementation and verification rules, not a claim that unfinished book interactions have passed them.

### Planned books and remaining tasks

- **Stage 2:** MTH140's mint linen sketchbook, elastic band, cream/daylight paper, pencil curves and curved paper pop-ups; paused dark/light layouts first.
- **Stage 3:** profile and verify that representative book, its tiers, lifecycle and fallback before expanding it.
- **Stage 4:** CEN100's salmon technical manual with blueprint pages and box-like folds, and MTH141's lavender graph notebook with faceted/V-fold pop-ups. These are distinct constructions, not recolours.

The [semester-book spec](book/semester-book-spec.md) defines the shared renderer/state/DOM contracts. Its illustrative copy and generic date-only wording must be read with the later [interface copy](copy/interface-copy.md) and [deadline report](qa/toronto-deadline-results.md), including the CEN100 end-of-day exception.

**Not merged at this snapshot:** the ⌘K/Ctrl+K command palette ([Task F](codex/task-f-palette.md)) and the paper-sound replacement ([Task H](codex/task-h-build-sound-cleanup.md)). The existing sound service is opt-in and off by default, but still provides tick/pop/chime/whoosh; planned page-turn, cover-open/close, set-down and unfold sounds must also be off by default and motion-gated. Boot no longer loads backdrop/warp, but their remaining files/snippets are not yet fully removed. Do not describe these tasks or the planned 3D Desk as released features.

## Subject-header baseline responsibilities

- `assets/course-header.mjs` and its stylesheet create the responsive title/artwork stage and pause control.
- `assets/course-scene.mjs` owns the WebGL2 renderer, camera, lifecycle, quality adaptation and poster fallback. It uses Three.js, not WebGPU.
- `assets/scenes/circuit.mjs`, `calculus.mjs` and `algebra.mjs` create the subject scenes. The historical filename `circuit.mjs` now contains the planetary gearbox.
- `assets/scenes/drag.mjs` owns pointer rotation and decaying release velocity. `framing.mjs` owns course camera framing and portrait/landscape poster selection.
- `assets/guide-motion.mjs` and its stylesheet coordinate GSAP/Flip interface transitions. GSAP is bundled locally; Motion is not the current interface engine.

The pre-router course changes used departure and entrance animations; router-owned navigation supersedes that path. Section changes move the content; assignment sheets, search, tools, study expansion, disclosures and completion updates have coordinated transitions. Native scrolling, DOM state and focus handling remain part of the guide. Header pause is independent of interface motion.

## Subject-header baseline lifecycle

Idle animation runs without a click when motion is enabled. Dragging the artwork rotates it directly; releasing continues with inertia. Arrow keys rotate and Home resets focused artwork. Paused artwork allows page scrolling. Device reduced motion is respected; `?motion=full` is a page-local request, not a remembered preference, and `?motion=off` forces the static mode. Neither overrides the device's reduced-motion setting.

Hidden and offscreen scenes stop rendering. Back/Forward restoration wakes eligible scenes. GPU context loss, render exceptions or shader failure restore the corresponding poster. Adaptive quality lowers rendering cost after sustained slow frames. Interaction cleanup releases pointer capture and removes listeners.

## Maintenance

Build commands and evidence limitations are in [visual-overhaul.md](visual-overhaul.md). The [UI bundle README](../tools/ui-build/README.md) describes GSAP playback and workflow checks. Test both enabled and reduced motion, rapid repeated opening, keyboard focus, Back/Forward and saved inputs when changing transitions. Use real GPU browser review for scene changes; DOM tests cannot validate their appearance.

No analytics or external rendering service is used. See [privacy-audit.md](privacy-audit.md).
