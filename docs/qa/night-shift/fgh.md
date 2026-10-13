# Night Shift: merging Codex Tasks F, G and H

Recorded 2026-10-13 on `night-shift`. Merged `31ec407` (`origin/integrate-fgh`: Task F command palette, Task G QA harness in `tools/qa`, Task H Three.js addons, paper sounds and the retired warp/backdrop, already merged together on an earlier router work-in-progress) into the verified Stage 1b head `f4c8342`, which is what `origin/main` serves.

Environment:
- Node `v22.22.0`, Playwright `1.56.1`, Chromium 141 (`chromium-1194`) with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`).
- Preview servers on 4430 (`/`) and 4431 (`--base /tmu-course-guides/`); the QA harness starts its own. All were stopped afterwards.
- Scratch scripts and logs are in the session scratchpad under `fgh/` (`bcheck.mjs` browser checks, `bump-tokens.mjs`, `qa-fails.cjs`, QA logs).
- The MTH140 book worktree (`integrate-fgh`) was not touched.

## Result

**GO for the merge**, with the open items at the end. Every Codex feature works on top of the verified router, both suites pass, and the browser checks pass at both bases. The QA harness passes routes and deadlines at both bases; its remaining failures exist without this merge (they reproduce on `f4c8342`, see "QA harness").

## Commits

| Commit | What |
|---|---|
| `babfe1a` | Merge (`--no-ff`). One conflict, the `workflow-check.cjs` entry point: kept Task F's `checkPalette()` and Stage 1b's motion-on route pass at the project base. Router, route-boot and lifecycle code are the Stage 1b versions (the Codex side never touched them). |
| `fa9660a` | Palette and weeks imports on the shared module URLs; cache tokens bumped to `20261013-shift2`. |
| `dc02373` | Interface copy applied to the palette. |
| `7f7aaef` | Inline guide-mark favicon (removes the `/favicon.ico` 404). |
| `bc1285f` | QA harness deadline check aligned with the interface copy and the page's own module instance. This is an orchestrator snapshot titled "Palette/QA integration work in progress (not verified; do not deploy)" that already reached `origin/night-shift`, so it was not rewritten; its content is the final, verified harness change described below. |
| this file | Results. |

## Defects found in the merged code, and fixes

| Defect | Effect | Fix |
|---|---|---|
| `palette.mjs` imported `./core.mjs`, `./targets.mjs` and `../cen-schedule.mjs` without their `?v=` tokens, and `boot.mjs` imported `./palette.mjs` bare. | In a browser (not in jsdom, which strips queries) the palette ran a **second `core.mjs` instance**: its holds, route, `isMath()`, sound state and `openItem` were separate from the shell's. `tests/asset-urls.test.mjs` failed. | Same URLs as the rest of the shell; boot loads palette like the other features (`asset('./palette.mjs?v='+VERSION)`). |
| `book/weeks.mjs` imported `../course-data.mjs` bare (now in the route graph through the palette). | Second `course-data` instance. | `?v=20261012-assessments2`, the URL everything else uses. |
| Changed files under URLs the deployed site served (core, boot, layout.css, the Three bundle and everything importing them). | Mixed old/new code from a browser cache. | Token bump, below. |
| No icon declared. | Chromium requests `/favicon.ico`, which is outside the Pages project base; the preview server 404s it and it is logged as a console error (QA routes/modes). | The existing guide mark as a `data:` icon in every page. No request, base-independent. |

## 1. Cache tokens

New token `20261013-shift2`, applied by `bump-tokens.mjs` (mirrors `tests/asset-urls.test.mjs`; repeats until no changed file is requested under a deployed URL; 3 passes):

- **Route documents** (`index.html`, `cen100/`, `mth140/`, `mth141/`): `night/core.mjs`, `night/boot.mjs`, `night/layout.css`, and on the courses `course-header.mjs`.
- **Night Shift modules**: `core.mjs` from boot, deadline, timeline, desk, hero, scroll and palette; `deadline`, `timeline` and `desk` from boot.
- **`VERSION`** in `night/core.mjs` → `20261013-shift2`: hero and scroll changed (their core import), so the lazily loaded feature URLs had to move. Palette (new) and the unchanged `night-vendor.mjs`, `hero.css`, `scroll.css` load under it too.
- **Three bundle** `vendor/three-0.186.1.mjs` (changed by Task H) from `course-scene.mjs`, `scenes/future-look.mjs` and `scenes/primitives.mjs`; then `scenes/{circuit,calculus,algebra}.mjs` (they import primitives), `course-scene.mjs` and `course-header.mjs`.
- `tests/scene-capture.html` follows `course-scene.mjs`.

`tests/asset-urls.test.mjs` (one URL per file, same shell in all four documents, no changed file under a deployed URL) failed on the merge and passes now. In the browser, every module and stylesheet loads under exactly one URL, and the changed ones under `shift2`.

The Three bundle rebuilds byte-identically from `tools/scene-build/vendor-entry.mjs` (sha256 `c1f72522…a501`, 596,033 → 621,214 bytes, as Task H recorded). Not touched by this work: `assets/scenes/future-geometry.mjs` still imports `primitives.mjs?v=20261012-future1`, but nothing loads that file.

## 2. Palette wording (docs/copy/interface-copy.md)

| Element | Before (Task F) | Now |
|---|---|---|
| Search placeholder | none | "Search courses, weeks, topics…" |
| Field's accessible name | "Search commands and course work" (visible label) | "Search courses, assessments, weeks, and topics" (visually hidden label) |
| Group headings | Assessments, Weeks, Views, Places, Math topics, Actions, "Search the guide" | Courses · Assessments · Weeks · Topics · Actions; groups announced as Courses · Assessments · Semester weeks · Study topics · Actions. Desk/course places and the current course's views are under Courses. |
| Search suggestion | `Search the guide for "{query}"`, always, also `for ""` and disabled on the Desk | `Search the guide for "{query}"`, read as "Search the guide for {query}"; only once there is a query and only where the guide search exists |
| Empty results | nothing | visible `No results for "{query}"`; the live region says "No results for {query}. Try another search" |
| Result count | "N commands. Use arrow keys…" on every render | "{n} results" for a search; quiet for the defaults on open |
| Clear | none | "Clear", labelled "Clear search"; empties the field and returns focus to it |
| Close | "Close", labelled "Close command palette" | "Close", labelled "Close search" |
| Sound action | "Sound on" when off (the action) | "Sound off" with hint "Turn sound on", labelled "Sound off. Turn sound on" (and the reverse), per the Accessibility and sound table |
| Dialog heading | "Go to…" | "Search" (matches the dock's Search action; the copy has no title row) |

`tests/palette.test.mjs` now parses the Command palette table of the copy document and compares it with the palette's exported `COPY` and `GROUPS`, and checks that every group the index produces has a heading from the copy. `workflow-check.cjs` checks the rendered wording, Clear, empty results, group labels, no guide-search row on the Desk, and the sound toggle.

## 3. Suites

| Check | Result |
|---|---|
| Root `node --test tests/*.test.mjs tests/scene-*.cjs` | **228 tests, 228 pass, 0 fail.** (The merge alone: 227, 225 pass; the 2 failures were `asset-urls`.) Includes Codex's `palette` (now 6), `sound` (10), `three-vendor` (2). |
| `tools/ui-build` `npm test` | **Exit 0.** `test.cjs` passes; palette check; 3 Desk runs; 6 course × motion runs; routes at `/` (motion off, 20 round trips), `/tmu-course-guides/` (off, 1) and `/tmu-course-guides/` (on, 1). |
| `tools/ui-build` `npm run build` | TODO |
| `tools/qa` unit tests (`checks`, `runtime`) | 24/24 pass. `instrument.test.mjs` (browser): TODO |

No test was weakened. Changed expectations: palette group names (`Math topics` → `Topics`, `Places`/`Views` → `Courses`, now asserted), the sound label (state instead of action, now with its accessible label), End on an empty query (the guide-search row now needs a query; End reaches "Open D2L", and the row is asserted after typing). The QA deadline expectations are described below.

## 4. QA harness (`node tools/qa/run.mjs`, both bases)

TODO

## 5. Browser checks (`bcheck.mjs`, Chromium, both bases)

TODO

## Still open

TODO
