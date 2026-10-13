# Night Shift: merging Codex Tasks F, G and H

Recorded 2026-10-13 on `night-shift`.

What was merged: `31ec407` (`origin/integrate-fgh`). It holds three Codex tasks, already merged together on an earlier router work-in-progress:
- Task F: the command palette.
- Task G: the QA harness in `tools/qa`.
- Task H: Three.js addons, paper sounds, and removal of the old warp cover and backdrop.

It was merged into the verified Stage 1b head `f4c8342`, which is what `origin/main` serves.

Environment:
- Node `v22.22.0`, Playwright `1.56.1`.
- Chromium 141 (`chromium-1194`) with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`).
- Preview servers on port 4430 (`/`) and port 4431 (`--base /tmu-course-guides/`). The QA harness starts its own. All were stopped afterwards.
- Scratch scripts and logs are in the session scratchpad under `fgh/`:
  - `bcheck.mjs`: browser checks
  - `bump-tokens.mjs`: cache-token bump
  - `qa-fails.cjs` and `qa-table.cjs`: QA report summaries
  - QA run logs
- Comparison runs:
  - `base-wt`: a scratch worktree at the merge commit `babfe1a`, before any fix
  - `main-tree`: a `git archive` export of `f4c8342`, run with the final harness
- The MTH140 book worktree (`integrate-fgh`) was not touched.

## Result

**GO for the merge**, with the open items listed at the end.
- Every Codex feature works on top of the verified router.
- Both suites pass.
- The browser checks pass at both bases.
- The QA harness passes routes and deadlines at both bases. Its remaining failures also occur on `f4c8342` without this merge (see section 4).

## Commits

| Commit | What |
|---|---|
| `babfe1a` | The merge (`--no-ff`). The only conflict was the `workflow-check.cjs` entry point. I kept Task F's `checkPalette()` and Stage 1b's motion-on route pass at the project base. Router, route-boot and lifecycle code are the Stage 1b versions; the Codex branches never touched them. |
| `fa9660a` | Palette and weeks imports moved onto the shared module URLs. Cache tokens bumped to `20261013-shift2`. |
| `dc02373` | Interface copy applied to the palette. |
| `7f7aaef` | Inline guide-mark favicon, which removes the `/favicon.ico` 404. |
| `bc1285f` | QA harness deadline check aligned with the interface copy and with the page's own module instance. This is an orchestrator snapshot titled "Palette/QA integration work in progress (not verified; do not deploy)". It had already reached `origin/night-shift`, so I did not rewrite it. Its content is the final, verified harness change described in section 4. |
| `faa2eff` | An orchestrator commit of an early draft of this file. |
| `2407a79` | Palette week rows use the copy's week wording. |
| (this commit) | Final version of this file, and its entry in the QA index. |

Other work merged into `night-shift` during this run: `ebdc856` (pure Desk summaries, not loaded by any page) and `5a40dca` (docs). After those merges, the root suite passes 241 of 241 and `tools/ui-build` `npm test` exits 0.

## Defects found in the merged code, and fixes

| Defect | Effect | Fix |
|---|---|---|
| `palette.mjs` imported `./core.mjs`, `./targets.mjs` and `../cen-schedule.mjs` without their `?v=` tokens. `boot.mjs` imported `./palette.mjs` bare. | In a real browser the palette ran a **second `core.mjs` instance**, so its holds, route, `isMath()`, sound state and `openItem` were separate from the shell's. jsdom strips query strings, so the jsdom checks missed it. `tests/asset-urls.test.mjs` caught it and failed. | The palette now imports the same URLs as the rest of the shell. Boot loads it like the other features: `asset('./palette.mjs?v='+VERSION)`. |
| `book/weeks.mjs` imported `../course-data.mjs` bare. It is now in the route graph through the palette. | A second `course-data` instance. | It now imports `?v=20261012-assessments2`, the URL everything else uses. |
| Files this merge changed were still requested under URLs the deployed site had served: core, boot, `layout.css`, the Three bundle, and everything that imports them. | A browser holding cached copies could mix old and new code. | Token bump; see section 1. |
| No page declared an icon. | Chromium requests `/favicon.ico`. On GitHub Pages that URL is outside the project base, and the preview server returns 404, which is logged as a console error. The QA `routes` and `modes` checks report it. This also happens on `f4c8342`. | Every page now names the existing guide mark as a `data:` icon. There is no request, and the icon is the same at every base and after in-app route changes. |

## 1. Cache tokens

New token: `20261013-shift2`. It was applied by `bump-tokens.mjs`, which mirrors `tests/asset-urls.test.mjs`. The script repeats until no changed file is requested under a deployed URL; it took 3 passes.

- **Route documents** (`index.html`, `cen100/`, `mth140/`, `mth141/`): `night/core.mjs`, `night/boot.mjs`, `night/layout.css`, and on the course pages `course-header.mjs`.
- **Night Shift modules:**
  - `core.mjs`, as imported by boot, deadline, timeline, desk, hero, scroll and palette
  - `deadline`, `timeline` and `desk`, as imported by boot
- **`VERSION`** in `night/core.mjs`, now `20261013-shift2`. Hero and scroll changed (their core import), so the lazily loaded feature URLs had to move. The palette (new), and the unchanged `night-vendor.mjs`, `hero.css` and `scroll.css`, now load under it too.
- **Three bundle** `vendor/three-0.186.1.mjs` (changed by Task H), in this order:
  1. as imported by `course-scene.mjs`, `scenes/future-look.mjs` and `scenes/primitives.mjs`
  2. then `scenes/{circuit,calculus,algebra}.mjs`, which import primitives
  3. then `course-scene.mjs` and `course-header.mjs`
- `tests/scene-capture.html` now uses the new `course-scene.mjs` URL.

`tests/asset-urls.test.mjs` checks three things: one URL per file, the same shell in all four documents, and no changed file under a deployed URL. It failed on the merge and passes now.

In the browser, at both bases:
- every module and stylesheet loads under exactly one URL
- the changed files load under `shift2`

The Three bundle rebuilds byte-identically from `tools/scene-build/vendor-entry.mjs`: sha256 `c1f72522…a501`, 596,033 → 621,214 bytes, as Task H recorded.

Not touched: `assets/scenes/future-geometry.mjs` still imports `primitives.mjs?v=20261012-future1`, but nothing loads that file.

## 2. Palette wording (docs/copy/interface-copy.md)

| Element | Before (Task F) | Now |
|---|---|---|
| Search placeholder | None | "Search courses, weeks, topics…" |
| Field's accessible name | "Search commands and course work" (a visible label) | "Search courses, assessments, weeks, and topics" (a visually hidden label) |
| Group headings | Assessments, Weeks, Views, Places, Math topics, Actions, "Search the guide" | Visible: Courses · Assessments · Weeks · Topics · Actions. Announced: Courses · Assessments · Semester weeks · Study topics · Actions. The Desk and course links, and the current course's views, are under Courses. |
| Search suggestion | `Search the guide for "{query}"`, shown always, including as `for ""` and as a disabled row on the Desk | `Search the guide for "{query}"`, read as "Search the guide for {query}". Shown only once there is a query, and only where the guide search exists. |
| Empty results | Nothing | Visible: `No results for "{query}"`. The live region says "No results for {query}. Try another search". |
| Result count | "N commands. Use arrow keys…" on every render | "{n} results" for a search. Nothing is announced for the default list on open. |
| Clear | None | "Clear", labelled "Clear search". Empties the field and returns focus to it. |
| Close | "Close", labelled "Close command palette" | "Close", labelled "Close search" |
| Week rows | "Week 9", with the hint "2026-11-02 – 2026-11-08" | "Week 9 · Nov 2–8", read as "Week 9, November 2 to 8". The first week is "Week 1 · Sep 8–13" (read with "Partial first week"). The last is "Week 16 · Dec 21" (read with "Final day of the semester"). This follows the Course book table. `book/weeks.mjs` is unchanged. |
| Sound action | "Sound on" while sound is off (the action) | "Sound off", with the hint "Turn sound on" and the label "Sound off. Turn sound on", and the reverse when on. This follows the Accessibility and sound table. |
| Dialog heading | "Go to…" | "Search". It matches the dock's Search action; the copy has no title row. |

Tests:
- `tests/palette.test.mjs` parses the Command palette table of the copy document and compares it with the palette's exported `COPY` and `GROUPS`. It also checks that every group the index produces has a heading from the copy, and checks the week wording.
- `workflow-check.cjs` checks the rendered wording, Clear, empty results, group and week labels, that the Desk has no guide-search row, and the sound toggle.

## 3. Suites

| Check | Result |
|---|---|
| Root `node --test tests/*.test.mjs tests/scene-*.cjs` | **241 tests, 241 pass, 0 fail**, after the concurrent `desk-data` merge; 229 of 229 before it. The merge alone gave 227 tests with 225 passing; the 2 failures were in `asset-urls`. The count includes Codex's `palette` (now 7 tests), `sound` (10) and `three-vendor` (2). |
| `tools/ui-build` `npm test` | **Exit 0.** `test.cjs` passes. Also passing: the palette check, 3 Desk runs, 6 course × motion runs, and route runs at `/` (motion off, 20 round trips), `/tmu-course-guides/` (off, 1) and `/tmu-course-guides/` (on, 1). |
| `tools/ui-build` `npm run build` | Exit 0. Vendors are byte-identical (`gsap` `e6ede5ab…`, `night-vendor` `66bcd0ad…`) and `git status` is clean. |
| `tools/qa` tests | `checks` and `runtime`: 24 of 24. `instrument` (in the browser): 14 of 14. |

No test was weakened. These expectations changed:
- Palette group names: `Math topics` is now `Topics`, and `Places` and `Views` are now `Courses`. The new names are asserted.
- The sound label now shows the state instead of the action, and its accessible label is asserted too.
- End on an empty query: the guide-search row now needs a query, so End reaches "Open D2L". The row is asserted after typing.
- QA deadline expectations; see the next section.

## 4. QA harness (`node tools/qa/run.mjs`, both bases)

### Harness changes (`bc1285f`)

The deadline check was written before two later changes: the interface copy, and the `?v=` tokens on route modules. On the merge, 29 of its 128 assertions failed at each base, all for harness reasons:
- **Countdowns.** The copy's format is `{d}d {h}h`, then `{h}h {mm}m` under a day, then `{m}m` under an hour, and the Desk adds "left". The harness expected `1d 2h 59m`. The exact instant now reads "Happening now".
- **Quiz week without a section.** The copy says "Choose section for quiz date".
- **Resolved target.** The check imported `assets/night/deadline.mjs` bare. That evaluated a second instance that was never mounted, so it always returned `null`. The check now follows `boot.mjs`'s own import of `deadline.mjs`, so it reads the instance the page runs. Resource timing is unavailable here, because the installed clock replaces `performance`.

Every assertion is kept. `checks.test.mjs` covers the copy's examples (`2d 12h`, `5h 07m`, `29m`) and the boundaries.

### Results: passing assertions / total

| Check | `f4c8342` (main), `/` · project | Merge `babfe1a`, `/` · project | Final, `/` · project |
|---|---|---|---|
| routes | 59/60 · 59/60 (favicon 404) | 59/60 · 59/60 (favicon 404) | **60/60 · 60/60** |
| stability | 45/46 · 45/46, palette skipped (wrapper) | 45/45 · 44/45 (rAF +1) | 45/45 · 45/46 (wrapper); rerun 44/46 (wrapper, rAF +1) · **45/45** |
| frames | 24/25 · 24/26 (wrapper) | 24/25 · 24/26 (wrapper) | 24/25 · 24/25 (wrapper) |
| deadlines | 119/128 · 119/128 (old harness lookup) | 99/128 · 99/128 | **128/128 · 128/128** |
| modes | 187/188 · 187/190 (favicon, wrapper) | 187/191 · 187/191 (favicon, wrapper) | 188/190 · 187/191; rerun 188/189 · 187/189 (wrapper, one transient each) |
| layout | 258/288 · 258/288 | 258/288 · 258/288 | 258/288 · 258/288 (identical to main) |

The `main` run used the final harness. Its 9 deadline failures per base are the bare-import lookup, which was fixed after that copy of the harness was taken.

### Remaining failures

None of these comes from the merge:

- **"route wrapper settles"** (frames, modes, stability warm-up). After a direct load, `main[data-route-region]` is caught at about 96–99.99% of `enterPage`'s 0.35 s rise, for example `translate3d(0, 0.0001px, 0)`, inside the harness's 1.6 s + 2 s window. The route that fails changes from run to run, and `main` shows the same failure.

  On course pages SwiftShader renders at about 4–10 fps: frame p95 is 117–267 ms, and 89–100% of frames take over 33 ms. GSAP's lag smoothing advances only 33 ms per long frame, so the rise outlasts the window. This is a software-renderer timing diagnostic, not a frozen tween. It is worth re-checking on a GPU (`--gpu`).
- **layout, 30 per base, identical on `main`.** These are product issues that predate Night Shift's palette:
  - controls under 44 px: the sidebar brand link is 30.6 px tall, the footer "Privacy" link 12 px, the CEN "All" filter 40 px wide, and others
  - on math pages, the first tab stop is the sidebar brand, not the skip link. `hub.js` prepends the sidebar before the skip link on course pages.
- **One-off transients in `modes`**, each seen once in about four runs:
  - a running CSS animation with duration 0 on `.eyebrow`/`.ns-hud` under `?motion=off`
  - one extra WebGL frame (5 draw calls) on MTH140 under `?motion=off`, from a late header render, not a loop
- **`stability` `raf.pending` +1**, intermittent; it also occurred on the merge before any fix. Recurring rAF loops stay at 2 (the known GSAP ticker and ScrollTrigger loops; Stage 1b open item 2). The extra callback is a single one in flight at the snapshot, not growth per cycle.

Listener, observer, canvas, WebGL, GSAP and ScrollTrigger counts stay flat across 20 round trips, 20 view changes, **20 palette open/close cycles** and 10 Mark done/Undo cycles at both bases.

## 5. Browser checks (`bcheck.mjs`, Chromium, both bases)

**55 of 55 pass at `/` and 55 of 55 at `/tmu-course-guides/`.** The route sequence is Desk (direct load) → CEN100 (Desk card) → MTH140 (via the palette's course entry) → MTH141 (sidebar) → Back ×3 / Forward → Desk (brand link).

| Behaviour | Result |
|---|---|
| ⌘K / Ctrl+K and the Search buttons | Ctrl+K opens the palette on every route, including after each in-app switch and after Back and Forward. ⌘K (Meta+K) also opens it. The header Search button opens it on every course route. The dock Search button opens it on every course route once the dock is showing (after scrolling down). The Desk has no Search button; see "Still open". |
| "midterm" + Enter, hidden and in another view | MTH140 with the midterm completed, Hide completed on, and the Study view open. The palette lists "Midterm Test · Fri Oct 23 · 6:30 PM Toronto". Enter switches to Assignments, clears Hide completed, opens the real `#assessment-midterm` in the sheet and focuses its Close button. Closing the sheet leaves no hold and no open dialog. |
| "week 9" without the book | Desk: the row "Week 9 · Nov 2–8" is disabled with "Open a course to choose a week", and Enter does nothing. CEN100: the timeline scrolls and focuses the first item that week (Nov 4). MTH140, which has no items that week: the timeline scrolls to the week and takes focus. No `book-open-week` listener exists yet. |
| Esc returns focus | To the sidebar theme button, the header Search button and the dock Search button, on each route. |
| Palette survives route changes and re-indexes | The same `<dialog>` element persists across every route. The index follows the route: CEN100 "integrity" finds the Academic Integrity Quiz; MTH141 "midterm" shows Fri Oct 16; after the round trip the Desk shows no Assessments group. `palette.css` is a persistent shell sheet with its rules applied. |
| Sound | Off by default: no `tmu-guide-sound-v1` key, and no `AudioContext` is created at any point. The palette toggle turns sound on (`true`) and off (`false`), and its label follows the state. |
| Warp/backdrop | No `ns-warp-in` class, no `night-warp` session key, and no requests for warp or backdrop files. `data-ns-failed` is empty, so no feature failed to load. The source has no references outside docs and the plan. |
| No reload when switching courses | Exactly one document request for the whole sequence. The shell id is unchanged, and the page has one navigation entry. |
| Console errors, page errors and failed requests | None, including the favicon. |

## Still open

1. **The Desk has no visible Search button.** The palette is reachable there only by ⌘K/Ctrl+K. The dock, which carries "Search ⌘K", is hidden on the Desk, and the header Search button exists only on course pages. A Desk entry point would need a design decision.
2. **Route wrapper settlement under SwiftShader**, and the pre-existing **layout** findings (44 px targets; skip link order on math pages). See section 4. Neither comes from this merge. They need a GPU run and a product decision respectively.
3. **Programmatic scrolling on math pages.** `math.css` sets `html{scroll-behavior:smooth}`. With Lenis active, `window.scrollTo(0, y)` from a script never arrives. `f4c8342` behaves the same, and wheel, keyboard and anchor scrolling work. This only affected my test scripts, which now scroll with the wheel.
4. **Stage 1b open items still apply:**
   - `?motion=`/`?tier=` persist across in-app routes
   - idle GSAP ticker and ScrollTrigger rAF loops (Task H did not take on the ScrollTrigger lifecycle)
   - the workspace wrapper on the Desk
   - the CEN deep-link tile position
   - Safari/iOS has not been tested
5. **Docs written at `f4c8342` predate this merge.** The new `CHANGELOG.md` entry and `docs/immersive-motion.md` say the palette and paper sounds are not merged, and that backdrop and warp files remain. Update them when this merge is released.
6. **Possible conflict with the book worktree.** `assets/book/weeks.mjs` changed one import line (`course-data.mjs?v=20261012-assessments2`). The MTH140 book work branches from `31ec407`, so expect a trivial conflict there if it edits that line. Any later change to a deployed asset needs a new token; `tests/asset-urls.test.mjs` enforces this.
