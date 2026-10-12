# Task B — Math guide lifecycle (start after Stage 1 lands)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-math-lifecycle` from the latest `night-shift`. Read `docs/codex/README.md` (shared rules and the **route lifecycle contract**) and `NIGHT-SHIFT-PLAN.md` Section 12 first.

## Goal

`assets/math-guide.mjs` and `assets/math-labs.mjs` (plus the lab helpers they import: `lab-challenges.mjs`, `lab-composition.mjs`, `lab-math.mjs`, `lab-composition-math.mjs`, `lab-challenge-data.mjs`) follow the route lifecycle contract so MTH140 and MTH141 can be swapped in and out — including directly from one math course to the other — without a page reload. No user-visible change.

## Owns

Those modules, the `data-route-module` script tags in `mth140/index.html` and `mth141/index.html`, and new tests. Do not edit CSS or the course data.

## Steps

1. Characterise: list every import-time side effect (rendering on load, `document.body.dataset.course` reads at module scope, listeners on `document`/`window`, timers, `history`/hash handling, globals, `localStorage` reads cached at module scope, unread-update badge state). Add tests pinning behaviour you will preserve.
2. Move all side effects into `mount(ctx)`; read the course from `ctx.route` (fall back to `document.body.dataset.course` only on direct load). Module-scope state must be reset per mount so MTH140 → MTH141 → MTH140 works in one document.
3. `unmount()` removes listeners (pass `ctx.signal`), timers, observers, open dialogs (lab dialog, detail sheets owned here) and DOM created outside `ctx.root`. Keep every element ID, storage key (`<course>-section-v1`, `<course>-progress-v1`, notes/targets, unread-update key), event and the release version constant.
4. The lab/canvas code must release canvases, animation frames and observers on unmount.
5. Extend `tools/ui-build/workflow-check.cjs` with a mount → unmount → mount (and MTH140 → MTH141 → MTH140) check for listener duplication and stale timers.

## Done when

All workflows and root tests pass with no new failures, direct loads behave exactly as before, and repeated mounts are clean.
