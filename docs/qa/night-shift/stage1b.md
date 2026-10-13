# Night Shift Stage 1b: router review fixes and re-verification

Recorded 2026-10-13 on `night-shift`. Reviewed: `872b1db`, the merge of Codex's integrated branch (`54963d9`) into the verified Stage 1 head (`f620a7e`). Behaviour baseline: `f620a7e`, which is also what `origin/main` serves (the commits since then only touch docs).

Environment:
- Node `v22.22.0`, Playwright `1.56.1`, Chromium with SwiftShader.
- Preview servers on port 4420 (`/`) and port 4421 (`--base /tmu-course-guides/`). Both were stopped afterwards.
- Scratch scripts and logs are in the session scratchpad under `s1b/fix/`. The reviewers' browser scripts were reused from `s1b/fix/rv/`, pointed at these ports.

I made no commits. While I worked, the orchestrating session committed snapshots of the working tree as "Router review work in progress (not verified; do not deploy)" (`d3260b9`, `6d66b75`, `0a8b972`, `99c46e3`). HEAD is now `99c46e3`, and those snapshots contain every change listed here.

## Result

**GO for the router and persistent-world work, with three conditions:**

1. Replace the "do not deploy" work-in-progress commits with a final commit.
2. Review the deadline changes in `96f9201` and `8164c3d` separately (see "Not part of this review" below).
3. Run the Safari/iOS pass from `docs/qa/device-checklist.md`. WebKit could not be tested here.

What was fixed and verified:
- All 5 blockers and all 4 distinct majors are fixed. Each was reproduced first, then re-checked in Chromium at both bases. Three major reports duplicated other findings; the cache-string major is the same issue as the cache-busting blocker.
- 11 minors are fixed. 4 are accepted or deferred with reasons.
- Both suites pass:
  - root: 210 of 210
  - `tools/ui-build` `npm test`: exit 0, with a new motion-on route pass
- `npm run build` leaves the vendor files byte-identical.
- In the browser round trip (Desk → CEN100 → MTH140 → MTH141 → Desk → Back ×3 → Forward ×2), at both bases:
  - the document never reloads (same shell id, no document requests)
  - there are no console errors and no failed requests
  - Mark done fires `guide-completion` once, and Undo once
  - seeded saved data is byte-identical, except `mth140-view-v1`, which the baseline also rewrites

## Findings and disposition

Several findings came from more than one reviewer. Duplicates are grouped.

### Blockers

| Finding | Confirmed | Fix | Verified |
|---|---|---|---|
| Stylesheets lost on Back/Forward after a reload. `prepareHead` re-appended kept `<link>`s, so their relative `href` re-resolved against the new history URL and returned 404. | Yes (code + `reloadfwd`/`reloadback`). | `router.mjs`: loaded sheets are never moved or re-inserted. Existing nodes are matched against the URL the document was loaded from. Incoming sheets get absolute `href`s and are inserted at their final cascade position. A kept node that is out of order gets a fresh copy instead of being moved. | `reloadfwd` and `reloadback` at `/` and `/tmu-course-guides/`: every sheet has rules, there are no 404s, and a later swap still works. Unit test: "head sync never moves a loaded sheet… survives a reload followed by Back/Forward". |
| CEN100 leaked one WebGL context per visit ("Too many active WebGL contexts" after about 16 visits). | Yes. `circuit.mjs`'s `MeshStandardMaterial` makes three's page-wide DFG lookup texture hold every past renderer. | `course-scene.mjs` `dispose()`: dispose the shared lookup texture (dropping its per-renderer listeners), then call `renderer.forceContextLoss()`. | `glleak` (CDP `queryObjects` after GC), 18 Desk→MTH140→CEN100 trips: 0 live WebGL2 contexts and 0 canvases on the Desk after every trip (was 1 more per trip). Heap is flat at about 7 MB, and there is no context warning. `header-route-abort.test.mjs` now asserts one context loss and one lookup-texture release. |
| History flooding: every scroll event called `replaceState`. Chromium throttled it, so the URL stayed `/cen100/` while MTH140 showed. | Yes (`flood5`). | Scroll events only update memory. `history.state` is written at most once a second while scrolling, before every navigation, on `pagehide`, and when the page becomes hidden. This stays well under Chromium's 200 per 10 s and WebKit's 100 per 30 s. | `flood5`: URL, route and reload all agree on MTH140. 10 s of continuous scrolling makes 10 history writes, with no throttling message. Unit test: "scrolling keeps positions in memory and writes history at most once a second…". |
| Cache busting: changed files kept their deployed `?v=` URLs, so a browser with a mixed cache got an empty guide. | Yes. | Every asset whose bytes differ from `origin/main` and that was requested under a URL the deployed site served now uses `?v=20261013-shift1`, in every HTML file and importing module (list below). Night Shift `VERSION` was bumped so `hero`/`scroll` load under new URLs. `math-guide` now imports `schedule.mjs` through the same URL as everything else (one module instance). | `stale2.mjs` answers every URL the deployed site served with the deployed bytes, as a fresh HTTP cache would. The full sequence renders (CEN 17 items, MTH140 6, MTH141 7) with one document and no errors. New `tests/asset-urls.test.mjs` fails on `872b1db` and passes now. |
| All-or-nothing boot: one failed decorative module removed all coursework. | Yes. | `route-boot.mjs`: on a direct load, each shell module and each route module is imported and mounted independently. A module that fails to import, lacks `mount`/`unmount`, or throws in `mount` is reported with `console.warn` and skipped, and only that module is unmounted. Router swaps keep the all-or-nothing rule with a full-load fallback. | `resil.cjs`: blocking `course-header`, `editorial`, `workspace`, `night/boot`, `visuals.js` or `guide-motion` one at a time still gives CEN 17 tiles with "Next up" and MTH140 6 assessments. Unit test covers mount, import and contract failures. |

### Majors

| Finding | Fix | Verified |
|---|---|---|
| Scroll lost on reload and on Back from another document (two reports). | The router writes the position on a timer and on `pagehide`. `route-boot` calls the new `router.restoreDirect()`: on a `reload`/`back_forward` load it re-applies the saved position until the growing layout allows it (about 1 s, and it stops on wheel/touch/key/pointer input). | `scrollrestore`, matching the baseline on CEN100: reload 1792 (baseline 1792); privacy → Back 3184 (baseline 3184). MTH140 1599 after reload, and the Desk 602/602. Note: Chromium drops a `replaceState` made during `pagehide` for a reload, so the 1 s timer is what covers reloads. |
| `#assessment-<id>` direct load no longer opened the sheet; math modules were mounted before `visuals.js` (two reports). | `mth140/` and `mth141/index.html` list `visuals.js` before `math-guide.mjs`, the baseline execution order. This also restores `#math-lab` placement after the semester rail. | `assess.mjs` at 1280 and 390 px is identical to the baseline: sheet open, scrollY 0. `frag.mjs` `mth140/#assessment-quiz-2`: sheet open, direct and swapped. |
| Unstyled frames during head sync; destination sheets restyled the outgoing page. | Incoming sheets load with `media="not all"` at their final position. At commit they are switched on through the CSSOM (`sheet.media.mediaText`), because changing the attribute made Chromium drop the sheet for one frame. The authored media is remembered for later matching. Nothing loaded is moved. | `fouc.cjs` over 10 swaps: 0 frames with a missing sheet, Times New Roman or a transparent body (before: 1–2 per 10). `bleed2.mjs`: the outgoing page is pixel-identical while the destination's sheets load (Desk→MTH140, MTH140→Desk, CEN100→MTH141). |
| Direct-load fragment scroll and focus lost for content mounted after parsing (also a minor in the other review). | New `revealFragment()` (`router.mjs`), used after a direct mount and after a swap. It opens closed `<details>` ancestors and lets their observers run, so `#calendar-tools` switches to Course info as before. It then skips hidden targets, scrolls into view, holds the target in place for about 1 s while header art and docking settle, and on direct loads focuses a focusable target. | `frag.mjs`, direct vs baseline: `#guide-item-m3` 1836/1886 (target at top in both), `#calendar-tools` 1303/1305 in Course info, `#guide-search` 787/788 with focus, `#topic-limits` in view, `#math-lab` focused. After a swap: 1836, 1305, 789, 1826, 867. |

### Minors

| Finding | Disposition |
|---|---|
| Same-route Back/Forward ran hash handlers one extra time. | **Fixed.** Same-route pops no longer dispatch a synthetic `hashchange`; the browser's own event reaches the guide once. The router skips its bookkeeping for that event, matched by URL. `evcount`: CEN `workspace-changed` ×2 and MTH140 events/writes ×2 per Back, identical to the baseline. |
| Outgoing route reacted to a cross-route `popstate` (wrote `mth140-view-v1="topics"` for MTH141's URL). | **Fixed** in `workspace.mjs`: it ignores `popstate` when `TMURouter.routeFor(location.href)` is another route. `routeFor` is a new public helper. I did not stop propagation in the router, so other listeners and the tests still see `popstate`. `deeplink` case C: only `mth141-view-v1` is written. |
| CEN `#assignment-<id>` opened a sheet after a swap but not on a direct load. Synthetic `hashchange` after a cross-route mount (two reports). | **Fixed.** No `hashchange` follows a route swap. Modules read the hash at mount, as on a direct load, and the browser's `hashchange` for a cross-route traversal is held back. Push swaps scroll to the top *before* mounting, as a fresh page would. Both paths now open the tile in place, with no sheet. |
| Back/Forward scroll clamped while the layout was still growing. | **Fixed** by the same re-apply loop. Scroll events during the restore are ignored. `popscroll2`: restored 900 at `route-changed` (was 567); later scroll anchoring moved it to 1065 as header art arrived above, keeping the same content in view. |
| Hub utilities order changed (`D2L ↗` before `Auto theme`). | **Fixed** in `hub.js`: the theme button is prepended, and only when it is not already there. `util2.mjs`: "Auto theme \| D2L ↗" on direct loads and after Desk→course, as at baseline. |
| `TMURouter.navigate()` accepted any URL. | **Fixed.** `navigate()` resolves `false` for anything that is not one of the four routes, and `fallback()` only assigns same-origin `http(s)` URLs. Unit test covers `https://example.com/`, `javascript:`, `data:`, `privacy.html` and non-route paths. |
| Persistent document over future deploys. | **Fixed.** The router compares the destination document's shell scripts (`data-shell-module` scripts, now including `hub.js`, plus `route-boot.mjs`), resolved with their `?v=`, against the running shell. A mismatch triggers a real document load. Unit test: "a destination from another deploy… gets a real document load". |
| Harness strips query strings, so it cannot see duplicate module instances or version mixes. | **Fixed** with a static test instead of changing the harness. `tests/asset-urls.test.mjs` checks three things: one URL per file across the shared route graph (including Night Shift's `VERSION`-loaded features); the four documents name the same shell; and changed files never reuse a URL the deployed site served. The deployed ref defaults to `origin/main`, can be set with `DEPLOYED_REF`, and the test is skipped if the ref is missing. |
| `workflow-check` coverage gaps. | **Mostly fixed.** Added: real clicks on the sidebar course link, the dock's Desk link and the hub brand; a CEN `#assignment-y4` move (tile opens, no sheet); a full `localStorage` snapshot that must be byte-identical before and after the click/deep-link moves and the round trips; and a motion-on route pass at the project base. Still stubbed in jsdom: stylesheet loading and idle prefetch (covered by router unit tests and the Playwright runs above). The project base still runs 1 round trip. |
| Workspace wrapper left in place on the Desk. | **No change.** Hub and main boxes measure identical at 1280 and 390 px. `workflow-check` deliberately asserts that the same `.course-workspace` element survives every route (shell identity). Unwrapping would be a design change, not a fix. Left as a latent risk for future Desk CSS. |
| Desk now loads `guide-motion.mjs`; `core.isMath` became a function. | **Accepted and documented.** No Desk stylesheet uses `data-motion`. The `guide-motion-level` removal is the retired key the course pages already removed at baseline. `core.mjs` now has a comment explaining that `isMath` changed from a boolean (f620a7e) to an accessor, and that `if(isMath)` is always true. Every in-repo caller uses `isMath()`, and `shared-lifecycle.test.mjs` pins the accessor. |
| `?motion=`/`?tier=` page-local overrides persist across in-app routes. | **Open (deferred).** These are QA flags that students only get from a shared link. The jsdom route checks rely on `?motion=off` lasting for the whole session, so a fix needs a harness change. |
| Idle rAF loops on the Desk after a course visit (GSAP ticker watchdog and ScrollTrigger's `_rafBugFix`). | **Open.** The rate is steady, not growing. I tried removing the watchdog listener on the Desk, but GSAP's auto-sleep then made `shared-lifecycle.test.mjs`'s exact frame count timing-dependent, so I reverted it rather than loosen the test. A proper fix needs coordinated `ScrollTrigger.disable()`/`enable()` around course mounts; best done with Task H. |

## Tests changed, and why none was weakened

- `router.test.mjs`, "back and forward … destination hashes fire after mounts": asserted the extra post-swap `hashchange` that the review found wrong (direct loads dispatch none). It now asserts the destination reads `#assessment-quiz-1` at mount, and that no `hashchange` is delivered for swaps or cross-route traversals.
- `router.test.mjs`, "a failed direct mount releases already mounted modules…": asserted the all-or-nothing boot (blocker above). It is replaced by "a failed direct-load module is reported and skipped…". That test covers mount, import and contract failures, the surviving modules and their signal, router start, and reverse-order unmount when leaving.
- New in `router.test.mjs`:
  - head sync after reload + Back/Forward
  - throttled history writes and `pagehide`
  - Back/Forward restore after layout growth
  - one `popstate`/`hashchange` per same-route Back
  - `navigate()` URL filter
  - shell signature
  - direct-load restore and fragment reveal
- New `tests/asset-urls.test.mjs` (3 tests).
- `header-route-abort.test.mjs`: added context-loss and lookup-texture assertions.
- `workflow-check.cjs`: additions listed above.

## Cache tokens

New token: `20261013-shift1`. It was applied by a scratch script (`s1b/fix/bump_tokens.py`), which repeats until no changed file is requested under a deployed URL.

- **HTML:**
  - `index.html`, `cen100/`, `mth140/`, `mth141/`: `hub.js`, `night/core.mjs`, `night/boot.mjs`, `night/layout.css`, `visuals.js`, `editorial.mjs`, `workspace.mjs`, `course-header.mjs`, `math-guide.mjs`, `math-labs.mjs`
  - `colour-preview.html`: `cen-schedule.mjs`
  - `tests/scene-capture.html`: `course-scene.mjs`
- **Module imports:**
  - `cen-schedule.mjs`, from `cen-guide.mjs`, `cen-schedule.js` and `night/targets.mjs`
  - `course-scene.mjs`, from `course-header.mjs`
  - `lab-composition.mjs` and `lab-challenges.mjs`, from `math-labs.mjs`
  - `core.mjs`, `deadline.mjs`, `timeline.mjs`, `desk.mjs` and `targets.mjs`, from the Night Shift modules
  - `VERSION`, in `night/core.mjs`

New, never-deployed files (`app/*.mjs`, `route-lifecycle.mjs`, `guide-motion.mjs` at its bare URL) are safe as they are. The new test makes any later change to them take a token.

There is one residual risk this cannot remove. Old HTML still in a browser's cache could fetch an *evicted* subresource and receive new bytes, because GitHub Pages ignores query strings. That risk is inherent to Pages and existed before this branch.

## Final results

| Check | Result |
|---|---|
| Root `node --test tests/*.test.mjs tests/scene-*.cjs` | **210 tests, 210 pass, 0 fail.** Includes 26 router tests, 3 asset-URL tests and other workers' new `deadline-boundaries` tests. |
| `tools/ui-build` `npm test` | **Exit 0.** `test.cjs` passes. 3 Desk runs and 6 course × motion runs pass. Route runs pass at `/` (motion off, 20 round trips), `/tmu-course-guides/` (off, 1) and `/tmu-course-guides/` (on, 1). |
| `tools/ui-build` `npm run build` | Exit 0; `git status` shows no vendor change. |
| Browser round trip (`nav.mjs`) at `/` and `/tmu-course-guides/` | All 11 steps OK at both bases: same shell id, no document requests, correct URL/title/route/`aria-current`, focus and announcement, no console errors, no failed or 4xx requests. |
| Features after swap vs direct (`func.mjs`, CEN100/MTH140/MTH141) | No reload, no errors. Mark done gives one `guide-completion` and Undo one. Search, sections, views, sheet, dock and theme match the baseline (only countdown times and animation timing differ). |
| Saved data (`saved.mjs`, both bases) | Seeded keys are byte-identical. Only `mth140-view-v1` changes, exactly as on the baseline. |
| 20-trip stability (`stability.mjs`) | Per-route listener, observer, interval, dialog, canvas and DOM counts are flat. At most one live WebGL context, and none on the Desk. |
| Fallbacks (`fallback.mjs`, `fallbackE.mjs`, `links.mjs`) | Fetch abort, 500, missing region, module 404, a throwing mount, `reloadRequired` and an aborted stylesheet each give one clean document load. Back afterwards is styled. Rapid clicks and Back/Forward stay consistent. Modified clicks, targets, `download`, `rel=external` and other origins stay native. |

## Not part of this review

- **`96f9201`, "Count dated CEN100 submissions down to the end of their Toronto day"**: a dated submission with no posted time now counts down to 11:59 PM Toronto, which `f620a7e` did not do. **`8164c3d`** adds "interface copy" changes to the Desk and dock (chip text, aria-labels, live-region sentences). Other workers committed both on this branch during the review. They change displayed deadlines and copy relative to the baseline, so they need their own sign-off. My only edits to those files were import-token changes.
- WebKit (Safari/iOS) was not available here. These points are worth checking on a device:
  - the throttled history writes
  - CSSOM sheet activation
  - non-matching-media stylesheet loading
  - `pagehide` persistence

## Still open

1. `?motion=`/`?tier=` persist across in-app routes (minor, deferred).
2. Idle GSAP-ticker and ScrollTrigger rAF loops on the Desk after a course visit (minor; needs the ScrollTrigger lifecycle work in Task H).
3. The workspace wrapper stays on the Desk (no visible effect; asserted as shell identity).
4. After a swap to `cen100/#assignment-<id>`, the opened tile ends about 540 px down the viewport. A direct load, like the baseline, leaves it about 386 px above the top. Behaviour is the same (inline, no sheet); only the position differs.
5. Future deploys must keep `tests/asset-urls.test.mjs` green against the deployed ref.
