# Shorter course views — verification record

Date: October 23, 2026. Isolated branch: `codex/shorter-course-views`. [Draft PR #36](https://github.com/jude27mad/tmu-course-guides/pull/36). No PR merge or production publish.

## What changed

Courses now open in Work, with Open / All / Done filters and a single detail per assignment. Schedule, Study (math only) and Course info have focused views. One course image, a short header and compact ending replace the repeated photos, overview sections and pinned scroll sequences. At 390 × 844, the first assignment's bottom edge was at 794 CSS pixels.

Requirements, preparation checks, submission records, notes and targets remain in the detail. Optional sources and course reference material use native disclosures. Instructional copy is at least 16px. Checklist IDs, storage formats and backup/import APIs are unchanged. Notes save on every edit rather than after a debounce.

The Giats shell, fonts, motion, Desk palette and touch-fluid effects remain. Tablet header controls now have a 44px minimum height and readable labels.

## Reconciliation and concurrency

- Started at `7b47c97`; rebased onto `2ec8624`, retaining the concurrently merged search normalization (#31) and Safari viewport fix (#35). Main then advanced to `d6e5624` with fluid allocation optimization (#32); that change was integrated into the draft branch and the combined site tests, build and touch checks rerun.
- `docs/plans/remove-repetition.md` remains historical. Its data/deep-link contracts are retained; its older long-scroll and pinned-calendar decisions are superseded by the owner's focused-view brief.
- Reused R2 assignment/calendar model (`ef64a8a`) and R3 deep-link groundwork (`401fe0c`). Selected relevant R1 search/section/content fixes. R5's old layout assumptions were replaced with focused-view browser checks.
- Read R4's calendar evaluation without merging its disposable spike. Fluid optimization PR #32 was subsequently integrated unchanged from main.

## Calendar decision

Schedule-X fits React 18.2 and the static Next.js export without a framework migration. Pinned calendar/calendar-controls/events-service/theme-default 4.9.1, React adapter 4.1.0, Preact 10.29.8, signals 2.11.3 and temporal-polyfill 0.3.2 have compatible installed peers (`npm ls --all` exits 0). Runtime packages are MIT; the transitive temporal-spec type declarations are ISC. Complete notices ship in `site/public/licenses/Calendar-dependencies.txt`.

The calendar is dynamically imported only when displayed. The production build adds approximately 71 KiB of gzip JavaScript and 5.5 KiB of gzip CSS to that path. A blocked-chunk test verifies the deadline list still works and can open an assignment; Work never requests those chunks.

The phone default is an agenda. Wider containers use the month grid; ResizeObserver switches the calendar layout at 700px. Agenda/calendar choices, selected date and date range survive opening a detail. Calendar events and list rows use the same assignment anchors. Toronto exact times, quiz weeks, lab windows, holiday qualifications and pending dates keep their original precision. Undated work remains in the independent list.

Temporal constructors are shared with the event adapter. Only a missing global Temporal is supplied; Intl and Date formatting are left intact. This also avoids the incompatibility observed between the all-globals polyfill and Playwright's fake clock prototype.

Primary documentation used: [React integration](https://schedule-x.dev/docs/frameworks/react) and [calendar configuration](https://schedule-x.dev/docs/calendar/configuration).

## Verification

Results below cover the review fixes and the concurrent changes retained from main. The GitHub integration published the exact verified tree (matching Git tree SHA), since shell Git has no write credentials. Original local commit history is retained in a separate local branch.

| Check | Result |
|---|---|
| Site Node tests | 203 passed; 0 failed, 0 skipped |
| Production build with `SITE_BASE_PATH=/tmu-course-guides` | Passed |
| Focused course-view browser scenarios | 23 passed; 0 failed; no application errors |
| Local GitHub Pages/legacy URL checks | 34 passed |
| Giats palette, fluid and touch checks | 29 passed |
| Root Node/scene tests | 384 passed; 0 failed, 0 skipped |
| Root UI vendor build and integration tests | Passed |

The browser harness covers compact opening, single detail, immediate note persistence, targets/checklist reload, multi-submission completion, list filter/scroll/focus restoration, rapid animated view switching, Schedule/grading opener focus, every math topic's lecture-hour estimate, legacy hashes, cross-course keyboard search, backup/import, calendar event clicks/resizing/failed chunks, section selection, no-JavaScript information and responsive type sizes.

Widths inspected: 360, 390, 430, 768, 834, 1024 and 1440 CSS pixels. Enlarged-layout testing uses a 720 × 500 CSS viewport at 2× rendering, equivalent to the reflow area of a 1440 × 1000 screen at 200% zoom. This is not a claim of testing a browser's native zoom UI.

An intermittent saved-pause test failure was traced to the gesture starting on the loading overlay during its reveal. Capturing all pointer targets confirmed native panning and a pointer-cancel outside `main`; the original probe only listened inside `main`. The harness now waits for the swipe point to hit course content before sending input, with the original native-panning assertion retained. The final 29-check run and eight additional saved-pause repetitions passed; none of the repetitions intercepted native touch input.

All browser checks used headless Chromium 153 with SwiftShader where needed. Touch checks send Chromium touch input through CDP. These are browser-emulation results, **not physical iPhone/iPad/Android or native Safari testing**.

## Independent review

A fresh reviewer found a stale-hash navigation loop, missing Schedule/grading opener focus IDs and omitted topic lecture-hour estimates. All three received reproducing browser tests before fixes. The hour-estimate omission was treated as a required content-preservation fix. Final green results are recorded above after the fix pass.

No requirement or storage format was intentionally dropped. The main remaining validation gap is physical-device/native-Safari testing. The build retains existing lint warnings in pointer/portal code and a Browserslist data-age notice; no new lint error is accepted.

## Reproduce

From `site/`:

```sh
npm ci
npm test
SITE_BASE_PATH=/tmu-course-guides npm run build
PLAYWRIGHT_PATH=/path/to/playwright node scripts/verify-course-views.mjs
PLAYWRIGHT_PATH=/path/to/playwright npm run test:touch
node scripts/pages-site.mjs build --out out --dest /tmp/tmu-pages-review --base /tmu-course-guides
PLAYWRIGHT_PATH=/path/to/playwright node scripts/check-pages-site.mjs --local /tmp/tmu-pages-review
```

`QA_CHROMIUM_PATH` optionally selects an installed browser. `QA_REPORT_DIR` selects the browser report directory. Use a fresh generated destination for the Pages assembly.

## Screenshots

| View | Screenshot |
|---|---|
| Phone Work, 390px | [CEN100 opening](cen100-work-390.png) |
| Desktop Work, 1440px | [MTH141 Work](mth141-work-1440.png) |
| Tablet detail, 834px | [MTH141 assignment](mth141-detail-834.png) |
| Desktop calendar, 1440px | [MTH140 Schedule](mth140-calendar-1440.png) |
| 200% equivalent reflow | [CEN100 detail](cen100-detail-200-percent-reflow.png) |

[Focused browser results](course-views-results.json) list each scenario and its outcome.
