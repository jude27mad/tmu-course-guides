# Night Shift Stage 1 (part 2): shared deadline resolver and the Desk directory

Recorded 2026-10-12 on `night-shift`, on top of `a6e4413`, with Node `v22.22.0` and Playwright Chromium (SwiftShader). Nothing was pushed or deployed. Plan revision 2 (§12) was read during this work. Its Stage 1 scope is unchanged, so `desk.mjs` was written to the §12 route contract (`mount(ctx)`/`unmount()`). The lifecycle conversion of `boot.mjs`, `deadline.mjs` and `core.mjs` belongs to Codex Task C and was not started here.

## Resolver: `assets/night/targets.mjs`

- `resolveTarget({course, data, section, completed, now, id})` returns one target object: `{course, id, title, kind, open, precision, at, end, date, week, weekEnd, range, when, label, cta, note}`.
  - `precision` is one of `exact`, `day`, `week`, `pending` or `empty`.
  - `data` is the CEN100 `SCHEDULE` or `COURSES[course]`.
  - `id` describes that record instead of choosing one.
  - It is pure: it touches no DOM and writes no storage.
- CEN100 rules reproduce the guide's `eventPassed`, `sortEvents`, `itemDeadlines` and `upcomingSchedule` unchanged:
  - A timed row passes at its Toronto time.
  - A date-only row stays eligible for its whole Toronto day.
  - `"23:59"` is a sort key only.
  - Completion follows `cleanPlan()`: only calendar rows with value `1` or `true` count.
  - A `calendar:false` row is dropped when every calendar row of its item is completed.
- Math uses `schedule.mjs` `upcoming()` with the saved lab section and `cleanProgress()` completion.
  - Once nothing dated is left, an open undated final is `pending`.
  - With nothing left at all, the state is `empty`. No deadline is invented.
- Readers `readSection`, `readCompleted` and `readSaved` use the existing keys and validation:
  - CEN sections are 1–39; a math section must have a lab.
  - They only call `getItem`. Denied storage, corrupt JSON or a stale value all read as "nothing saved".
- `overall(targets, now)` orders targets across courses:
  - exact by start, with an ended item keeping its place for 2 h after it ends;
  - date-only at the end of its Toronto day;
  - quiz week from its Monday;
  - pending last; empty is excluded.
  - Only an `exact` result can carry a timer.
- `parts`, `compact` and `sentence` moved here from `deadline.mjs`, which still re-exports `parts` and `compact`. `compact` adds `Nothing scheduled` for `empty`.

## Behaviour changes on course pages (deliberate)

- **Selection:** `deadline.mjs` resolves through `targets.mjs`. The guide card's own item, if it names one, is passed as `id`, so the countdown never contradicts the card around it. The rules are identical, so the two can differ only until the guide's next 60-second refresh.
- **Section source:** the section comes from the live control (`#section-select` or `#contact-section`), falling back to storage.
- **MTH140 Quiz 2 (second-hour quiz):** still counts down to the lab start. Its label is now `Your lab starts · quiz in its second hour` instead of `Your lab quiz starts`, which was the imprecision noted in the inventory.
- **Week ranges across a month:** these now read `Nov 30–Dec 4` instead of `Nov 30–4`.
- **Nothing dated ahead:**
  - When the guide shows its "No dated assessment ahead" card, the HUD and dock show the pending final or the empty state. Before, they showed nothing.
  - No countdown block is inserted into that card.
- **Dock:** a `Desk` link sits directly after the course identity and points to the site base. On screens 480 px or narrower, the dock title is visually hidden (still read by screen readers), because the bar is otherwise squeezed to one letter.
- **Boot:**
  - `FEATURES` is now `['hero','scroll']`. warp and backdrop are retired, and palette and feel don't exist yet. Their files are kept for Stage 6.
  - A stale `ns-warp-in` cover class is removed at boot.
  - The three `night/*.css` 404s are gone.
- **Cache strings:** `boot.mjs`, `layout.css` and `hub.js` are `?v=20261012-desk2` on all four pages.

## Desk

- **Modes:** `core.mjs` treats `body[data-page=desk]` as Desk mode: `course` is `'desk'`, `META` is `null`, there is no CEN default, and `openItem` is a no-op. `boot.mjs` in Desk mode mounts `desk.mjs` only and never waits for `CourseWorkspace`.
- **Static page (`index.html`):**
  - Skip link first, then the title `TMU Course Guides · Fall 2026`.
  - The overall next deadline.
  - A still desk illustration (CSS only), with the empty `<div class="desk-stage" data-desk-stage>` mount point above it.
  - Three course entries with plain links to `cen100/`, `mth140/` and `mth141/`, and the privacy link. These work without JavaScript.
- **What `desk.mjs` adds:**
  - Each course's next deadline, its uncertainty label and any timetable caveat.
  - The saved section (math also shows the lab day, time and room).
  - The section call to action (`<course>/#course-info`).
  - The overall next deadline: a d/h/m countdown only for `exact` with time remaining, beside the actual date and Toronto time, plus a link to the item (`#assignment-<item>` or `#assessment-<id>`).
- **Refresh:** it repaints on wall-clock minute boundaries. It also re-resolves on `visibilitychange`, `pageshow`, `focus` and `storage` events for the course keys. It writes nothing.
- **Styles (`desk.css`):** layout.css tokens, course accents mirroring `COURSE_META` (a test guards against drift), dark night lamp and light daytime desk, a 44 px minimum on Desk controls, and visible focus.

## Results

| Check | Result |
|---|---|
| `node --test tests/targets.test.mjs` | 14/14 pass, including ≈1,600 frozen-clock cases matching the CEN guide's own `upcomingSchedule` (evaluated from `cen100/index.html`) |
| `node --test tests/*.test.mjs` | 74 tests: 72 pass. The 2 failures are the baseline `subject-headers` cases. |
| `node --test tests/*.test.mjs tests/scene-*.cjs` (before the final edits) | 80 tests: 72 pass, 8 fail. These are the same 8 as the baseline (6 `scene-rendering.cjs`, 2 `subject-headers`). |
| `tools/ui-build` `npm test` | Passes in full. Three Desk runs on a frozen 2026-10-12 12:00 Toronto clock: completed records with motion off, sections with motion on, and a fresh browser with motion off. All six course × motion workflows pass, including the new dock Desk-link and resolved-target checks. The baseline runtime-error failure is fixed. |
| Chromium, `--base /tmu-course-guides/`, Desk at 1440/1024/390 × dark/light | No horizontal overflow, no console errors, no failed requests. No visible control under 44 px. Skip link is the first Tab stop. The stage mount point is empty. |
| JavaScript disabled, 390 px | Directory links present and navigate natively. No empty deadline rules are shown. |
| Docked CEN100 at 1440 and 390 | Desk link is 44 px and the bar has no overflow. |

Captures are in the scratchpad `shots/` folder, not the repo.

## Not done or not verified

- The router and the persistent shell (Stage 1b), and `mount()`/`unmount()` for `boot.mjs`, `deadline.mjs` and `core.mjs`. These belong to Codex Tasks C and D.
- The legacy `cen100-guide` forwarder edit (see `forwarder.md`).
- WebKit and real devices.
- A capture after programmatic `window.scrollTo` came out blank in SwiftShader, even though the DOM hit-test found the content. The same scroll done with the mouse wheel rendered normally. This was treated as a capture artefact.
