# Task R2 — Assignment list and calendar data (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/rr-data-layer` from the latest `origin/main`.

**Read first:**
- `docs/codex/remove-repetition/README.md` (the rules for every task)
- Sections A, C2 and C3 and Stage 4 of `docs/plans/remove-repetition.md`
- `site/src/lib/README.md`

This is groundwork with no visible change. Write pure functions plus tests: no React, no DOM, no storage writes.

## Add `site/src/lib/assignments.mjs`

Export both functions from `site/src/lib/index.js`, wrap them in `fast()` (`site/src/lib/perf.mjs`) like the other public functions, and document them in `site/src/lib/README.md`.

### `assignmentList(courseId, { now, items })`

`items` defaults to `deadlines(courseId, { now })`.

**Entries**
- One entry per content item, never one per deadline row:
  - CEN100: `CEN.allItems` (17 items, anchors `assignment-<id>`).
  - MTH140 and MTH141: the course's assessments (6 and 7, anchors `assessment-<id>`).
- The anchors must equal those in `courseInfo()`.
- Group deadline rows by `row.item` for CEN100 and by `row.id` for math.

**Each entry has**
- `id`, `courseId`, `anchor`, `title`, `list` (`'team'`, `'you'` or `null`)
- `rows`: all the item's deadline rows, including reminders
- `records`: the rows with `markable: true`
- `recorded`: the number of records done
- `lead`, `done`, `pastDue`, `group`

**How each field is set**
- `lead` is the earliest record not yet done, in the existing sort order. If every record is done, it is the last record.
- `done` is true only when there is at least one record and every record is done. Reminders and other non-markable rows never hold an item back.
- `pastDue` is true when any record has `overdue: true`. The existing `overdue` already excludes reminders and done records.

**Groups**, decided in this order:
1. `done` if done;
2. `pastDue` if past due, whatever week its date is in;
3. otherwise by the lead's `date || week` in Toronto weeks, the same way `buckets()` in `site/src/lib/deadlines.mjs` does it: `thisWeek`, `nextWeek` or `later`;
4. undated (pending) items go to `later`.

Within a group, sort by the lead's `sortKey`, then by content order.

**Returns** `{ pastDue, thisWeek, nextWeek, later, done, entries, today, focus }`:
- `today` is Toronto `YYYY-MM-DD`.
- `focus` is `{ pastDue, thisWeek, nextWeek, later, done }`:
  - `pastDue`: the earliest past-due lead date;
  - `thisWeek`: today;
  - `nextWeek`: next Monday;
  - `later`: the first dated lead in `later`;
  - `done`: null.
  - Any focus value is null when its group has no date.

### `calendarEvents(courseId, items)`

One event per dated deadline row, so an item with several dated records gives several events, all linking to the same entry anchor.

**Each event:** `{ id: '<courseId>:<rowId>', rowId, anchor, title, qualifier, style, allDay, start, end }`
- `start` and `end` are epoch milliseconds for timed events and `YYYY-MM-DD` for all-day events.
- Never produce an exact date or time from uncertain data.

Mapping:

| Row data | Event |
|---|---|
| `precision:'exact'` with `target.endOfDay` | Point event at `target.at - 60000` (11:59 PM on the due day), `style:'due'`. Subtract the minute **only** when `endOfDay` is set. |
| `precision:'exact'` with `target.end`, a math lab quiz | `style:'window'`: the lab window from start to end. If the assessment has `quizSecondHour: true` in the course data (`site/src/lib/vendor/course-data.mjs`, e.g. MTH140 `quiz-2`), the title reads "<title> · in your lab's second hour" and the qualifier says the quiz is in the second hour. Never compute a quiz start time. |
| `precision:'exact'` with `target.end`, otherwise (e.g. midterms) | Timed event, start to end, `style:'due'`. |
| `precision:'exact'` without an end | Point event, start = end, `style:'due'`. |
| `precision:'day'` | All-day on `date`, `style:'day'`, qualifier "Time not posted". |
| `precision:'week'` | All-day from `week` to `weekEnd`, `style:'week'`, title "Quiz week · <title>". Qualifier "Date depends on your lab section", or "Date needs confirmation" when `target.holiday`. |
| `precision:'pending'` or `'empty'` | No event. |
| Reminder rows (`kind:'reminder'`) | Included, `style:'reminder'`. |
| Done rows | `style:'done'`. |

Section-specific rows (the CEN100 `failure-lab` reminder exists only for Section 29) appear only when `deadlines()` returns them. Do not add your own section logic.

## Tests

**New file `site/tests/assignments.test.mjs`.** Use the fixed-time helpers in `site/tests/helpers.mjs`.

*Partition*
- At several fixed times and saved states, every content item appears in exactly one group: CEN 17, MTH140 6, MTH141 7.
- Anchors are unique and equal to the `courseInfo()` anchors.

*Grouping*
- Past due takes priority over the week groups, including an item that passed earlier in the current week.
- Multi-record items:
  - `y6` leads with notebook-1, then notebook-2 once the first is recorded.
  - `y1` has 4 records.
- Reminders never block done: `failure` recorded means `m3` is done.
- Week edges: Sunday 23:59 versus Monday 00:00 Toronto.
- `focus` values.

*Calendar events*
- `outline` lands on Oct 2 at 23:59 Toronto, not Oct 3.
- No row without `endOfDay` loses a minute.
- `notebook-1` is Nov 4 at 15:00 EST. Also check 31 Oct and 2 Nov, around the 1 Nov 2026 clock change.
- MTH140 Section 3:
  - Quiz 2 is a window event with the second-hour title and no other start time;
  - the midterm runs 18:30–20:30.
- With no section saved:
  - quiz weeks are week events with the qualifier;
  - holiday weeks say "Date needs confirmation".
- Pending items give no events.
- `failure-lab` appears only for Section 29.
- Several events point to one anchor.
- Done rows get `style:'done'`.

**`site/tests/blocked.test.mjs`:** both new functions work with blocked storage.

Run everything listed in the README rules.

## Finish

Write `docs/codex/remove-repetition/reports/r2-data-layer.md`. Include a table of every event `calendarEvents` produces for MTH140 with no section and with Section 3 at one fixed time, so Claude can check the labels. Push `codex/rr-data-layer`. Never push to `main`.
