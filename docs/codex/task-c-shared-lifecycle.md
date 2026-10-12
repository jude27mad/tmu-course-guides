# Task C — Shared guide lifecycle (start after Stage 1 lands)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-shared-lifecycle` from the latest `night-shift`. Read `docs/codex/README.md` (shared rules and the **route lifecycle contract**) and `NIGHT-SHIFT-PLAN.md` Sections 7 and 12 first.

## Goal

The shared page modules work in one persistent document: route-specific parts mount/unmount; shell parts initialise once and survive navigation. No user-visible change on direct loads.

## Owns

- Route modules (mount/unmount): `assets/workspace.mjs`, `assets/editorial.mjs`, `assets/course-header.mjs` (it mounts the existing Three.js header scene via `course-scene.mjs`; on unmount it must call the scene's `dispose()`), `assets/visuals.js` (convert to an ES module or wrap it so it can unmount; keep `window.CourseVisuals` while mounted), and the Night Shift route layers `assets/night/boot.mjs`, `deadline.mjs`, `timeline.mjs` (deadline and timeline mount per route; the **dock** element and its services are shell-owned and must persist, re-binding to the new route's target).
- Shell modules (initialise once): `assets/hub.js` (sidebar, course links, theme; must update `aria-current` and saved-section labels on `route-changed`), `assets/guide-motion.mjs` (the motion preference controller and `window.GuideMotion` stay; page-specific hooks such as the nav marker, reveal observers and the old course-leave animation become route-scoped or are disabled when the router handles navigation), `assets/night/core.mjs` (services stay; `course`/`META` must become route-aware getters updated on `route-changed` instead of constants read once at import).
- Tests and `tools/ui-build/workflow-check.cjs` additions.

Do not edit `assets/night/hero.mjs`, `scroll.mjs`, `backdrop.mjs` or any CSS beyond what is strictly required; Claude is rewriting those.

## Steps

1. Characterise each module's import-time side effects, globals and listeners. Pin current behaviour with tests.
2. Apply the contract. `workspace.mjs` currently re-parents the hub sidebar and `main` into `.course-workspace` and builds the workspace nav inside the hub: split it so the persistent wrapper and sidebar are built once (shell) and the per-route panels/nav state are mounted per route.
3. `core.mjs`: export route-aware accessors (`route()`, `meta()`, `isMath()`) and keep the old named exports working for existing callers until Claude migrates them (document which ones are now live bindings).
4. `guide-motion.mjs`: keep the fast `enterPage`, the reduced-motion precedence and `setScenePaused` exactly as they are. When `window.TMURouter` handles a course link, its departure animation must stand down (it already checks `e.defaultPrevented`; make sure the router's interception order guarantees that).
5. Add workflow-check coverage: mount → unmount → mount for each shared module, and listener/observer counts flat across 20 route round trips (use the harness's jsdom; instrument `addEventListener`/`IntersectionObserver`/`MutationObserver`/`ResizeObserver` constructors to count live ones).

## Done when

All workflows and root tests pass with no new failures, direct loads are unchanged, shell parts survive simulated route swaps, and counts stay flat.
