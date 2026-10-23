# R2 — Assignment list and calendar data

Branch: `codex/rr-data-layer`, started from `origin/main` at `e51b2e18bcc3fdce87753fcad3135455a3a8fc14`.

## Changes

- Added pure `assignmentList` and `calendarEvents` in `site/src/lib/assignments.mjs`, wrapped both in `fast()`, exported them through the public API, and documented their contracts in the library README.
- Assignment entries follow content order and canonical anchors (17 CEN100, 6 MTH140, 7 MTH141), with markable-record leads, overdue-first grouping, completion counts, stable group ordering, and Toronto focus dates.
- Calendar events preserve resolved precision, full lab windows, second-hour quiz wording, inclusive day/week endpoints, reminder/done styles, and section filtering supplied by `deadlines()`.
- Added 22 assignment/calendar tests and expanded blocked-storage coverage. No visible changes, storage writes/formats, deadline/grading calculations, vendor edits, dependency changes, or generated `next/` changes.

## Validation

Tests and the production build used Node 22, matching CI. npm installs used `--cache /tmp/r2-npm-cache` because the default home cache is unwritable.

| Check | Result |
|---|---|
| `cd site && npm ci` | Passed |
| `cd site && npm test` | Passed: 111 tests, 0 failures, 0 skipped |
| `cd site && npm run build` (includes ESLint) | Passed; 8 static pages generated |
| `npm ci --prefix tools/scene-build` | Passed |
| `npm ci --prefix tools/ui-build` | Passed |
| `node --test tests/*.test.mjs tests/scene-*.cjs` | 383 passed, 1 pre-existing failure, 0 skipped; see below |
| `git diff --check` and allowed-file scope check | Passed |
| Independent read-only review | No findings; assignments tests independently passed 22/22 |

Build warnings are in unchanged files: hook dependencies in `Fluid.jsx`, `useOpts.jsx`, and `Portal.jsx`; a console statement in `usePointerEvents.jsx`; and outdated Browserslist data. No warnings were suppressed.

## MTH140 event labels at a fixed time

Clock: **2026-10-12 12:00 America/Toronto** (`2026-10-12T16:00:00.000Z`). Empty saved completion state in both cases. Tables contain every returned event in order. `rowId` is the event ID suffix after `mth140:`. Timed start/end values show the actual epoch milliseconds plus UTC ISO for inspection. All-day ranges include their end date. A dash in the qualifier column means the actual empty string `''`.

### No section saved — 5 events

| Event ID / anchor | Title | Qualifier | Style | All day | Start | End |
|---|---|---|---|---|---|---|
| `mth140:quiz-1` / `assessment-quiz-1` | Quiz week · Lab Quiz 1 | Date depends on your lab section | week | true | 2026-09-28 | 2026-10-02 |
| `mth140:quiz-2` / `assessment-quiz-2` | Quiz week · Lab Quiz 2 | Date depends on your lab section | week | true | 2026-10-12 | 2026-10-16 |
| `mth140:midterm` / `assessment-midterm` | Midterm Test | — | due | false | 1792794600000 (2026-10-23T22:30:00.000Z) | 1792801800000 (2026-10-24T00:30:00.000Z) |
| `mth140:quiz-3` / `assessment-quiz-3` | Quiz week · Lab Quiz 3 | Date depends on your lab section | week | true | 2026-11-09 | 2026-11-13 |
| `mth140:quiz-4` / `assessment-quiz-4` | Quiz week · Lab Quiz 4 | Date depends on your lab section | week | true | 2026-11-23 | 2026-11-27 |

### Section 3 saved — 5 events

| Event ID / anchor | Title | Qualifier | Style | All day | Start | End |
|---|---|---|---|---|---|---|
| `mth140:quiz-1` / `assessment-quiz-1` | Lab Quiz 1 | Lab window | window | false | 1790596800000 (2026-09-28T12:00:00.000Z) | 1790604000000 (2026-09-28T14:00:00.000Z) |
| `mth140:quiz-2` / `assessment-quiz-2` | Lab Quiz 2 · in your lab's second hour | Quiz is in your lab's second hour | window | false | 1792411200000 (2026-10-19T12:00:00.000Z) | 1792418400000 (2026-10-19T14:00:00.000Z) |
| `mth140:midterm` / `assessment-midterm` | Midterm Test | — | due | false | 1792794600000 (2026-10-23T22:30:00.000Z) | 1792801800000 (2026-10-24T00:30:00.000Z) |
| `mth140:quiz-3` / `assessment-quiz-3` | Lab Quiz 3 | Lab window | window | false | 1794229200000 (2026-11-09T13:00:00.000Z) | 1794236400000 (2026-11-09T15:00:00.000Z) |
| `mth140:quiz-4` / `assessment-quiz-4` | Lab Quiz 4 | Lab window | window | false | 1795438800000 (2026-11-23T13:00:00.000Z) | 1795446000000 (2026-11-23T15:00:00.000Z) |

With Section 3, Quiz 2 uses the confirmed **October 19 08:00–10:00 Toronto make-up lab window**. No 09:00 quiz start is computed. The midterm is **October 23 18:30–20:30 Toronto** in both tables. All Section 3 quiz windows are 08:00–10:00 Toronto; November UTC offsets reflect EST. The undated final produces no event in either case.

## Limits and open questions

- **Pre-existing root failure:** `tests/fix-header.test.mjs:92`, “Mark done and Undo reach the book from the committed record, though guide-completion fires before the save (§6.10)”. Line 96 expects `/^quiz-2:false:/` but gets `midterm:false:null`. Its jsdom fixture uses the live clock; on October 20 it selects week 7's midterm, while the assertion assumes week 6's Quiz 2. The same isolated test fails identically in an untouched `git archive origin/main` at `e51b2e1`. Freezing only that temporary archived fixture to October 13 makes it pass. The repository test was left unchanged.
- **Resolved environment issue:** Chromium was initially absent. The rail browser test starts its server before browser launch, outside `try/finally`, so the failed launch also left that initial run waiting on an open server. Installed the matching headless browser under `/tmp/r2-pw-browsers`, verified launch, then reran the entire root command with `PLAYWRIGHT_BROWSERS_PATH=/tmp/r2-pw-browsers`. The rail browser test passed in the final run. No tests were weakened, skipped, or deleted.
- The current course data has no unresolved holiday quiz row or scheduled October 31/November 2 event. Those calendar branches use explicitly labelled synthetic supplied rows in tests; the actual November 4 notebook deadline is also checked before and after the clock change. These fixtures do not alter course data or invent published dates.
- No unresolved R2 data-layer questions. Browser interactions and calendar-library adaptation remain outside this groundwork task.
