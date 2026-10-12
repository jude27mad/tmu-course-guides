# Night Shift Stage 1 gate: verification and fixes

Recorded 2026-10-12 on `night-shift` at `858e7b7` (Stage 1 work in progress: Desk directory and Desk mode), plus the one `desk.css` fix below, which is not committed. Node `v22.22.0`, Playwright `1.56.1`, Chromium under `/opt/pw-browsers` with SwiftShader. Preview servers: port 4340 (`/`) and port 4341 (`--base /tmu-course-guides/`). Both were stopped afterwards. Nothing was pushed, merged or deployed.

## Result

Stage 1 passes the gate.

- No new test failure compared with `baseline-tests.md`.
- Root forwarding, no-loop, history and link checks pass under both bases.
- Seeded progress survives every route.
- The Desk agrees with each course page's card at both frozen clocks.
- The Desk works without JavaScript and without WebGL.

One defect was found and fixed: the Desk skip link was 43 px tall.

## 1. Suites, compared with the Stage 0 baseline

| Check | Baseline (`406c4a4`) | Now |
|---|---|---|
| `tools/ui-build` `npm run build` | Byte-identical vendors | **Byte-identical.** `gsap-3.15.0.mjs` hash `e6ede5ab…a5ea` and `night-vendor.mjs` hash `66bcd0ad…c03b` are unchanged, and `git status` shows no vendor change. |
| `tools/ui-build` `npm test` | Exit 1: all 6 course × motion cases failed on the `night/{warp,palette,feel}.css` 404s | **Exit 0.** `test.cjs` passes. All 3 Desk runs pass (off/completed, on/sections, off/fresh). All 6 course × motion cases pass with CEN at `cen100/`. |
| Root `node --test tests/*.test.mjs tests/scene-*.cjs` | 49 tests: 41 pass, 8 fail | **81 tests: 73 pass, 8 fail.** The 8 have the same names as the baseline failures, now numbered 50–55, 66 and 67. They have the same cause: `tools/scene-build/node_modules` (`three`) is not installed. |

The 8 failing tests:

- 6 in `scene-rendering.cjs`:
  - context loss
  - unsupported rendering
  - shader link failure
  - adaptive GPU scheduling
  - touch drag
  - pause mid-drag
- 2 in `subject-headers.test.mjs`:
  - extreme drag rotations
  - tangent endpoints

Results per file:

| File | Pass | Fail |
|---|---|---|
| `cen-schedule.test.mjs` (new) | 4 | 0 |
| `challenges.test.mjs` | 3 | 0 |
| `composition.test.mjs` | 6 | 0 |
| `course-scenes.test.mjs` | 9 | 0 |
| `future-look.test.mjs` | 2 | 0 |
| `header-geometry.test.mjs` | 4 | 0 |
| `lab-math.test.mjs` | 6 | 0 |
| `legacy-route.test.mjs` (new) | 10 | 0 |
| `preview-server.test.mjs` (new) | 4 | 0 |
| `schedule.test.mjs` | 7 | 0 |
| `subject-headers.test.mjs` | 3 | 2 (baseline) |
| `targets.test.mjs` (new) | 14 | 0 |
| `scene-lifecycle.cjs` | 1 | 0 |
| `scene-rendering.cjs` | 0 | 6 (baseline) |

Both suites were run again after the `desk.css` fix, with the same results.

## 2. Routing (Chromium, `/` and `/tmu-course-guides/`)

**Method:** each case opened `privacy.html`, then navigated to the root URL in a fresh page. The script recorded main-frame document requests, the final URL, `history.length`, the workspace view and item state, and every console error, page error, failed request and HTTP status of 400 or higher.

**Forwarded (23 cases per base):** each one landed on `<base>cen100/` with the raw query and hash intact.

- Each case made exactly **two** document requests (the root, then `cen100/`).
- `history.length` grew by one, so `location.replace` worked.
- Back returned to `privacy.html`, not to a re-forwarding root.

| Root URL | Result on `cen100/` |
|---|---|
| `#assignment-y4`, `?motion=off#assignment-m3`, `?a=1&b=two%20words&motion=off#assignment-y4`, `index.html#assignment-y9` | Assignments view, with that item expanded |
| `index.html?tier=low&utm_source=x%20y#guide-item-m3`, `#assignment-z99` (unknown id), `#assignments` | Assignments view |
| `#course-info`, `#guide-tools`, `#workspace-timeline` | Course info view |
| `?to=https://example.com/#course-info` and its encoded form | Course info view. The query is carried along but never used as a destination. |
| `#guide-search` | Search opened and focused |
| `#nextsign`, `#board`, `#course-main`, `#t-team`, `#t-you`, `#t-rules`, `#p-team`, `#p-you`, `#p-rules`, `#guide-item-y9` | Landed once |

**Stayed on the Desk (25 cases per base):** each made one document request and kept its URL.

- `''`, `index.html`, `?motion=off`, `?motion=full`, `index.html?motion=off`
- `?tier=low`, `?theme=dark`, `?v=123`, `?utm_source=x`, `?to=https://example.com/`, `?to=cen100/`
- `#`, `#top`, `#desk-main`
- `#study`, `#math-lab`, `#math-tools`, `#math-main`, `#topic-limits`, `#assessment-midterm`
- `#Assignment-y4`, `#assignment-Y4`, `#assignment-y4x`, `#ASSIGNMENTS`, `?motion=off#study`

**No loop:**

- `cen100/#assignment-y4`, `cen100/?motion=off#course-info` and `cen100/index.html#assignment-y4` each made one document request and kept their URL.
- `cen100` without a slash got a 301 to `cen100/`.
- `/tmu-course-guides?motion=off#assignment-y4` (no trailing slash) went through a 301 to `/tmu-course-guides/` and then forwarded once to `cen100/?motion=off#assignment-y4`, which opened y4.
- `mth140#assessment-midterm` went through a 301 and opened the midterm.

**Links:**

- On the Desk, `cen100/`, `mth140/` and `mth141/`:
  - The hub brand and the Desk switcher link go to `<base>`. The CEN, MTH140 and MTH141 switcher links go to `<base><course>/`.
  - `aria-current` marks the Desk on the Desk and the current course on each course page.
  - Privacy goes to `<base>privacy.html`.
- On each course page, the dock's Desk link goes to `<base>`.
- The CEN "What's changed" links go to `<base>mth140/` and `<base>mth141/`.
- Privacy's "← Course guides" goes to `<base>`.
- The colour preview's "Open the main guide" goes to `<base>cen100/`.
- Every same-origin link on these 6 pages returned 200 (6 unique targets per base).
- Click-throughs were checked under both bases: Desk → CEN, CEN hub → Desk, MTH140 dock → Desk, MTH141 hub → CEN, privacy → Desk, colour preview → CEN.

**Errors:** no console errors, page errors, HTTP 4xx/5xx or failed requests on the Desk, `cen100/`, `mth140/`, `mth141/`, `privacy.html` or `colour-preview.html`, under either base.

27 requests were cancelled (`net::ERR_ABORTED`). Each one was cancelled by navigation that the test itself started:

- The root Desk's font request was cut off by its own `location.replace`.
- Lazy hero, scroll and vendor loads were cut off by `goBack` or a fast click-through.

## 3. Storage and deadlines (frozen clocks)

**Method:** `context.clock.install` at **2026-10-13 12:00** and **2026-10-22 12:00 Toronto**. Each clock was run with two scenarios, seeded and fresh, under both bases. The run went privacy (seed) → Desk → `cen100/` → `mth140/` → `mth141/` → Desk. A full `localStorage` snapshot was diffed after every page.

The seeded scenario used real keys in the exact shapes the guides write them:

- `cen100-contact-choice-v1`: `{"section":29,"group":9}`
- `cen100-personal-plan-v1`: integrity and whmis completed, a y4 note and a y4 target date
- `cen100-g9-ticks`: two ticks
- `cen100-hide-completed-v1`: `false`
- `cen100-last-seen-update-v1`
- `mth140-section-v1`: `2` (a Monday lab)
- `mth140-progress-v1`: a check, quiz-1 done, a note, a target and a topic
- `mth140-last-seen-update-v1`
- `mth141-section-v1`: `13`
- `mth141-progress-v1`: quizzes 1 and 2 done, and a note
- `tmu-guide-theme-v1`: `light`
- `guide-motion-paused`: `true`
- `tmu-guide-sound-v1`: `false`

**Saved state read correctly:**

- CEN: section 29 and group 9 in the pickers. The integrity and whmis records are checked, and the y4 note, target date and tick are present.
- MTH140: section 2, quiz-1 done and the note.
- MTH141: section 13, quizzes 1 and 2 done and the note.

**Nothing overwritten or reset:**

- After the full round trip, every seeded value was byte-identical.
- The Desk wrote nothing, before or after visiting the guides.
- `cen100/` wrote nothing. Its on-load profile rewrite produced the same string.
- The only new keys were `mth140-view-v1` and `mth141-view-v1`, each set to `"assessments"` on a math page load. This happens at baseline too: `workspace.mjs` `show()` clicks the tab, and `showTab(..., remember)` saves it (see `inventory.md` §1). Stage 1 did not cause it.

**The Desk matches each course card.** In all 12 course × clock × scenario combinations, the Desk entry and the course page's card target (shown in the dock title and `.ns-count`) had the same title, the same `when` text, label and precision, and the same countdown chip. The check allowed the minutes to differ, since the clock keeps running, but the chips were identical in every run. The guide's own card named the same record.

| Clock | Scenario | CEN100 | MTH140 | MTH141 | Desk overall |
|---|---|---|---|---|---|
| Oct 13 | seeded | Failure Analysis Part 1 in lab (Section 29) · Wed Oct 14 · day precision | Lab Quiz 2 · Mon Oct 19 · 10:00 AM · POD367 · "Your lab starts · quiz in its second hour" (Thanksgiving make-up) | Midterm Test · Fri Oct 16 · 6:30 PM Toronto | CEN Failure Analysis (end of Oct 14) |
| Oct 13 | fresh | **Academic Integrity Quiz · Wed Oct 14 · 3:00 PM Toronto** | Lab Quiz 2 · quiz week Oct 12–16, section CTA, no timer | Midterm Test · Fri Oct 16 · 6:30 PM | MTH140 quiz week (counted from its Monday) |
| Oct 22 | seeded | Personal Reflection 1 · Wed Oct 28 · day precision | **Midterm Test · Fri Oct 23 · 6:30 PM Toronto** | Lab Quiz 3 · Mon Nov 2 · 2:00 PM · EPH111 | MTH140 midterm, countdown |
| Oct 22 | fresh | Personal Reflection 1 · Wed Oct 28 | **Midterm Test · Fri Oct 23 · 6:30 PM Toronto** | Lab Quiz 3 · quiz week Nov 2–6, section CTA, no timer | MTH140 midterm, countdown |

The plan's fixtures hold:

- CEN integrity quiz: 2026-10-14 15:00 Toronto.
- MTH140 midterm: 2026-10-23 18:30 Toronto.

No console errors and no failed requests were recorded. One lazy `night-vendor.mjs` request was cancelled when the script moved to the next page.

## 4. Desk

**Settled captures** at 1440 and 390 px, in dark and light (auto theme, Oct 13 clock, fresh browser): the script waited for fonts, then for no wrapper transform, filter or opacity, then 1.5 s.

- No horizontal overflow.
- No visible control under 44 px (after the fix below).
- No empty deadline slot showing.
- No console errors or warnings, and no failed requests.
- No `<canvas>`.
- Skip is the first Tab stop.
- Body background: `#0f1619` in dark, `rgb(242,240,234)` in light.

Reviewed captures:

- `…/scratchpad/shots/stage1-desk-1440-dark.png`
- `…/scratchpad/shots/stage1-desk-1440-light.png`
- `…/scratchpad/shots/stage1-desk-390-dark.png`
- `…/scratchpad/shots/stage1-desk-390-light.png`

They are internal only and not in the repo.

**JavaScript disabled (1440 and 390):**

- The three course links (`cen100/`, `mth140/`, `mth141/`) and Privacy are visible.
- There is no overflow, no empty slot and no error.
- `#assignment-y4` stays on the Desk, and its plain CEN100 link navigates to `cen100/`.

**WebGL unavailable** (`--disable-webgl --disable-3d-apis --disable-gpu`; `getContext('webgl2')` returned null): the Desk renders the same directory and deadlines, with no canvas and no errors.

## Fix made

**`assets/night/desk.css`:** the focused Desk skip link measured 43 px tall (content-box padding with `line-height: normal`), under the plan's 44 px minimum. It is now `display:inline-flex; align-items:center; box-sizing:border-box; min-height:44px`. It is unchanged visually, and the Tab order is unchanged. No cache string was bumped, because `desk.css` has not been deployed. Both suites were run again afterwards.

## Still open

- **Legacy `jude27mad/cen100-guide` forwarder:** the edit to its destination (`/tmu-course-guides/cen100/`) is not made. The exact change is in `forwarder.md`, and it needs the other repository. Plan §10 Stage 1 lists it.
- **Stage 1b:** the router and persistent shell (plan §12) are not started.
- **Baseline failures:** the 8 root failures need `tools/scene-build` dependencies installed. They are unchanged from Stage 0.
- **Font request before forwarding:** on a forwarded root URL, the Desk document starts its font request before `location.replace` commits, and that request is then cancelled. Whether the Desk paints for a frame first was not measured.
- **Course-page controls under 44 px:** on course pages (not the Desk), the first Tab stop on `mth140/` is the hub brand, at 30.6 px tall. This is current course-page behaviour, outside this gate's Desk check, and was not changed.
- **Empty band on the Desk at 1440 px:** the "Next across your courses" card stretches to the height of the still-desk illustration, which leaves an empty band between the title and the countdown. This is cosmetic, and the Stage 5 Desk scene replaces that illustration.
- **Not verified:** WebKit, real devices and real-GPU review. These captures come from SwiftShader in Chromium.
