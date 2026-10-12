# Codex tasks A–E verification

Base: latest `night-shift` when work started, `858e7b779a017d20a6a73adaf9cf3e5153050bc5`.
The integrated result is on `codex/ns-router`; focused task commits are retained in its history.
The A–D task branches include the integrated lifecycle dependencies for usable direct loads. E remains the focused four-file logic branch.

## Results

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | PASS: 150 tests, no failures, skips or cancellations. |
| `node --test tests/scene-*.cjs` | PASS: both scene test files. |
| `tools/ui-build`: `npm test` | PASS: GSAP assertions, three Desk cases, all six course × motion workflows, real route navigation at both deployment bases. |
| Real route lifecycle | PASS: 20 Desk → CEN100 → MTH140 → MTH141 → Desk round trips with flat live listener/observer counts and persistent shell, dock and workspace. |
| Animated shared lifecycle | PASS: 20 paused and 20 fine-pointer animated round trips, including scoped frame cancellation. |
| Shader startup | PASS: direct route capture and subsequent navigation work while scene compilation remains pending; teardown aborts and disposes the outgoing scene. |
| `tools/ui-build`: `npm run build` | PASS: both vendor files byte-identical to the base. |
| Native browser route check | PASS: project-base Desk → CEN100 → MTH140 → Desk retains its shell ID, with no runtime exceptions; same-route `index.html` aliases retain the shell. |

Existing assertions were preserved. The workflow harness imports one shared module graph, matching native ES-module caching rather than evaluating separate copies of shell services for every script.

## Initial failures and their resolution

- `a project-base server 404s outside the base, serves the Desk at its root and redirects bare directories`; `the default root server still serves the site at /`: initial sandbox `listen EPERM`. Re-ran with localhost network access; both pass.
- `tests/subject-headers.test.mjs`: initially missing `tools/scene-build/node_modules/three`. Installed the pinned development dependencies; `animated art and basis tips remain visible at extreme drag rotations` and `the moving tangent endpoints fit in addition to the ribbon surface` pass. The historical missing-dependency scene failures documented in `baseline-tests.md` also pass.
- `tools/ui-build/test.cjs`: `reveal.progress() > 0 && reveal.progress() < 1` and `Flip produces an intermediate transform` failed intermittently during wall-clock sampling. A trace measured 441 ms of synchronous jsdom CSS initialization while GSAP's ticker remained at its previous frame. The harness now feeds GSAP's actual animation-frame callbacks and `Date.now()` from one 60 Hz clock, without seeking timelines or altering assertions/durations.
- Course workflow `math drawer closes` (MTH141, motion on), and later `drawer closes` (CEN100, motion on): replaced fixed 750 ms sleeps with bounded waits for the close state; the original close assertions remain intact.

No unresolved failures remain. jsdom's existing `[csstree-match] BREAK after 15000 iterations` diagnostic still appears; commands exit successfully.

## Contracts and source findings

- E: `semesterWeeks`, `weekIndexFor`, `currentWeekIndex`, `recordsForCourse`, `popupRank`, `findWeek`; `bendPoint`, `bendBounds`, `bendHit`, `PAGE_BEND_GLSL` and the exported bend constants.
- A–C: route-specific modules expose `mount(ctx)` / `unmount()`; shell services persist. Core exposes route-aware `route()`, `meta()`, `isMath()` with documented legacy live bindings.
- D: `bootDocument`, `createRouter`, ordered module mounting, base-aware routing, cancellation-safe history, focus, head synchronization and normal-navigation fallback.
- Reading-week audit found no dated reading week in the supplied schedules. The MTH141 source description mentions a study-week instruction without dates; no reading week was invented.
- Quiz Mondays and announced make-up dates remain unchanged. A section's lab start is not promoted to an exact quiz time in book records; dated quizzes use day precision unless the assessment publishes a time.
- CEN schedule IDs remain separate from item handles. `calendar:false` reminders are excluded. CEN's final exam uses `item:y9`, `open:'y9'`, null date/time and pending precision; its displayed Dec 9 exam-period placeholder is not treated as an exam date.
- Combined quiz-category and multi-part item weights are not divided into invented per-record grades. CEN final presentations/report retain large-pop-up categories while their spreads remain teaching weeks.
- Bend bounds are `{min:[x,y,z], max:[x,y,z]}` in local coordinates with y in `[0,height]`; picking reports physical distance for nonunit rays and uses the renderer's matching x subdivision count.

## Scope notes

No CSS, course-data, vendor or poster files changed. Necessary changes beyond the original narrow file lists were lifecycle cleanup in the existing hero/scroll effects and scene startup, canonical schedule loading in the colour preview, source-reader assertions, shared test harnesses and these documentation references.

Claude's remaining work is the book/Desk renderer, shader integration, composition, visual styling and motion design.
