# Task O — Safari, no-JavaScript and failure-mode checks (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-resilience` from the latest `night-shift`. Read `docs/codex/README.md`, `NIGHT-SHIFT-PLAN.md` Sections 3, 7, 11 and 12, and `tools/qa/README.md` first.

The owner uses an iPhone, and no check so far has run in WebKit. This task adds the checks the plan requires but nobody has run, then fixes the functional bugs they find. **No visual changes.**

## Checks to add

Put them in a new `tools/qa/checks-resilience.mjs`, registered with one line in `tools/qa/run.mjs`, so this work cannot conflict with Task P. Each writes JSON and Markdown to the report folder like the existing checks, and each runs at both bases.

1. **webkit:** the existing routes, deadlines and layout checks in Playwright WebKit with an iPhone descriptor (390 px, touch, device scale factor 3) and at 1440 px. If WebKit cannot be installed in your environment, say so plainly and skip it. Never report it as passed.
2. **nojs:** `javaScriptEnabled:false` on every route. The main heading, the coursework list and assessment dates are readable. Course links are plain `href`s that work. No content stays hidden by a class or style that waits for JavaScript (for example `html.ns-held`, `opacity:0` or `visibility:hidden` on coursework).
3. **bfcache:** leave a route and come back with Back. On `pageshow` with `persisted`, the page is still usable, deadlines re-resolve, nothing is doubled (listeners, dock, palette) and the shell marker is unchanged.
4. **failures:** the router's destination fetch returns 500, times out, is aborted or returns HTML without a route region, so the router falls back to one normal navigation that lands on the right URL. Going offline after load still lets a route link navigate or fail into a normal navigation. `localStorage` and `sessionStorage` that throw on access leave every route usable. A misspelt route path is handled the way the site's 404 handling intends.
5. **crosstab:** two pages in one browser context. Mark done or Undo and a section change in one update the other's Desk, dock and course card through `storage` events.
6. **clock:** with `page.clock`, run forward across Toronto midnight and the 1 November DST change, and jump backwards once. Chips never show negative or stale values and update within a minute.
7. **forward:** old root CEN hash and query URLs forward exactly once to `/cen100/`, keeping the hash and query, at both bases. Generic Desk options alone stay on the Desk.

## Fix what they find

Fix functional bugs minimally in shell and route code (router, route boot and lifecycle, transition, `core.mjs`, `desk.mjs`, `palette.mjs`, workspace, guides), with a focused unit test for each fix under `tests/`.

Claude is building the book on a paused branch. Do **not** edit these files: `assets/app/stage.mjs`, `assets/app/three.mjs`, anything in `assets/book/`, `assets/course-header.mjs`, `assets/course-scene.mjs`, `assets/night/{deadline,hero,scroll,timeline}.mjs`, `assets/night/{layout,hero,scroll}.css`, `assets/scenes/*`, `mth140/index.html`. If a bug lives in one of them, report it with the failing check and a proposed patch instead.

## Finish

Write `docs/qa/night-shift/resilience.md`: every check, its result per base and browser, bugs found, fixes and anything left open. Link it from `docs/qa/night-shift/README.md`. Merge the latest `night-shift` into your branch, re-run the root suite, `tools/ui-build` and all QA checks, then merge your branch into `night-shift` and push both. Never push to `main`.
