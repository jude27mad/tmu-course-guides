# Task A — CEN100 guide as a route module (start after Stage 1 lands)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-cen-module` from the latest `night-shift`. Read `docs/codex/README.md` (shared rules and the **route lifecycle contract**) and `NIGHT-SHIFT-PLAN.md` Section 12 first.

## Goal

The CEN100 guide's large inline classic `<script>` in `cen100/index.html` becomes an ES module, `assets/cen-guide.mjs`, that follows the route lifecycle contract (`mount(ctx)` / `unmount()`), so the router can swap CEN100 in and out without a page reload. User-visible behaviour must not change at all.

## Owns

`cen100/index.html` (script block, script tags and the minimum markup changes needed), new `assets/cen-guide.mjs`, `assets/cen-schedule.js`/`.mjs` only if needed, new tests. Do not restyle anything.

## Steps

1. Characterise first: read the inline script fully. List every global it defines (functions called from inline `onclick`/`onchange` attributes, `window.*` assignments, `SCHEDULE`/`window.CEN_SCHEDULE`, `KEY="cen100-g9-ticks"` and other storage keys, timers, document/window listeners, `CourseVisuals.update` calls, `course-open-item` handling, hash routing). Add tests that pin the current behaviour you will preserve (pure helpers extracted into the module can be unit-tested; DOM behaviour is covered by `tools/ui-build/workflow-check.cjs`).
2. Move the code into `assets/cen-guide.mjs`. Replace inline event-handler attributes with listeners attached in `mount` using `ctx.signal`. Keep every ID, class, storage key and event name. Keep `window.CEN_SCHEDULE` (set in `mount`, removed in `unmount`).
3. Execution order matters: the inline script currently runs during parsing, **before** `workspace.mjs`, `editorial.mjs`, `course-header.mjs` and the Night Shift modules. Preserve the effective order by listing `cen-guide.mjs` first among the `data-route-module` scripts and making the bootstrap mount modules in document order. Check what the later modules expect to already exist (rendered tiles, `#nextsign[data-schedule]`, `CourseVisuals.update` having run).
4. `unmount()` removes everything: listeners (via the signal), intervals/timeouts, observers, dialogs it opened, and its globals. Mounting again after unmount must produce the same DOM and state as a fresh load.
5. Direct loads keep working through `assets/app/route-boot.mjs` (if Task D has not landed yet, add a minimal stand-in exactly as the contract describes and note it).
6. Update `tools/ui-build/workflow-check.cjs` so the CEN100 workflows load the module version (the harness bundles each module script separately with esbuild; make sure `cen-guide.mjs` mounts there) and add an assertion that mount → unmount → mount leaves no duplicate listeners (for example, one click on Mark done produces exactly one `guide-completion`).

## Done when

All six course × motion workflows pass, root tests pass with no new failures, the CEN page behaves identically on a direct load, and mount/unmount/mount is clean. Summarise globals removed or moved.
