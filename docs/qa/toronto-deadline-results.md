# Toronto deadline boundary tests: results

Run on 13 October 2026, Node v22.22.0, branch `night-shift`. Fixtures: [`toronto-deadline-test-cases.md`](toronto-deadline-test-cases.md) and [`toronto-deadline-test-cases.json`](toronto-deadline-test-cases.json), unchanged. Test adapter: [`tests/deadline-boundaries.test.mjs`](../../tests/deadline-boundaries.test.mjs).

## Result (final)

| Run | Tests | Pass | Fail |
| --- | ---: | ---: | ---: |
| `TZ=America/Toronto node --test tests/deadline-boundaries.test.mjs` (40 fixtures + 3 per-zone sub-runs) | 43 | 43 | 0 |
| `TZ=UTC …` | 43 | 43 | 0 |
| `TZ=America/Los_Angeles …` | 43 | 43 | 0 |
| Full root suite: `node --test tests/*.test.mjs tests/scene-*.cjs` | 200 | 200 | 0 |
| `tools/ui-build`: `npm run build` (vendor output byte-identical) and `npm test` — GSAP playback, 3 Desk, 6 course × motion, 2 persistent-route checks | 12 | 12 | 0 |

Measured on a clean checkout of `96f9201` plus this change, because the shared working tree also held the router review's unfinished edits. No fixture expectation was changed. Official course records (`assets/course-data.mjs`, `assets/cen-schedule.*`) and storage keys were not touched.

**Correction to the first report (`1144d4c`).** An independent review found that the three in-suite "all fixtures pass with system time zone …" tests were hollow under `node --test`: the child process inherited `NODE_TEST_CONTEXT`, skipped its tests and exited 0. The separate `TZ=… node --test` runs reported then were genuine (41/41 each), but the claim that the full suite covered all three zones was not. The sub-runs now remove `NODE_TEST_CONTEXT` and must report 40 tests run, 40 passed and 0 failed. The review also showed that only the quiz fixtures went through `resolveTarget()`; now every fixture does.

## How the adapter maps the fixtures

Every fixture becomes a one-record course in `course-data.mjs`'s own shape and is resolved by `resolveTarget()`. Every expected value comes from site code.

| Fixture | Course record | Checked through |
| --- | --- | --- |
| `exact` | an assessment with the instant's Toronto wall-clock date and time (how course data stores times); `resolveTarget()` must convert it back to the same instant. Inside the repeated 01:00–01:59 hour of 1 November wall-clock time is ambiguous and course data cannot express the `-04:00` instants, so those cases use the fixture instant directly. | `timestamp()`, `parts()` countdown with seconds truncated (30 s later the countdown is one whole minute lower), `status()`, `compact()`, `targetDate()` |
| `date_only` | an assessment with a date and no time | `status()`, the chip (day-level wording, never a clock), no clock digits |
| `pending` | an undated final | `status()`, chip |
| `quiz_week` | a quiz with one lab: fixture week → its Monday, weekday → lab day, `postedTime` → lab start time, `overrideDate` → `mondayMakeupDate` | the full math path (`resolveAssessment()`, Thanksgiving rule, lab timing), chip and section call to action |
| `nowWeek`, `deadlineWeek` | Toronto date of `now` (`today()`) and of the target (`targetDate()`) | `termWeek()` |

Real Fall 2026 labs all publish a start and end time, so the "lab without a posted time" fixtures (T17, T20, T21) exercise a path real records do not reach. It previously crashed and now resolves safely.

## Before the fixes

The cases first failed only because the contract functions did not exist. A diagnostic against the existing resolver gave the same result in all three time zones, so no host-time-zone bug was found:

| Cases | Existing behaviour | Cause |
| --- | --- | --- |
| T17–T21 | Threw `Cannot read properties of null (reading 'split')` | A quiz lab with no published start or end time was converted with `timestamp(date, null)`. |
| T02, T06, T35, T37 | "Due time passed" at the deadline instant | `parts()` treated `left <= 0` as passed unless a known end time was still ahead. |
| T01, T36, T37, T39, T40 | Week 1 or Week 16 outside the term | Only the book's spread index existed, which deliberately clamps to the first/last spread. |
| T11–T16, T40 | No contract status label | Status wording lived only in chips ("Tomorrow", "Quiz week", "Date passed"). |

The remaining 23 cases (exact countdowns, UTC/Toronto date flips and every DST fall-back case) already matched.

## Fixes (`assets/night/targets.mjs`, `assets/book/weeks.mjs`)

1. **Quiz labs without times:** a lab with no published start gives the quiz a date and "Time not posted", never a countdown; a missing end time no longer throws.
2. **The exact instant:** `parts()` reports the instant itself as live; after it, only a known start/end window stays live, otherwise "Due time passed".
3. **`status(target, now)`:** the single source of the contract's labels — Happening now, Due time passed, Time not posted, Date passed (time not posted), Select lab section, Holiday schedule unconfirmed, Date pending — and `null` while a countdown runs.
4. **`targetDate(target)`:** the Toronto date a target falls on, or `null` while unresolved.
5. **`termWeek(date)`:** the 1-based term week (Monday-anchored, partial Week 1 from Sep 8), `null` before Sep 8 or after Dec 21. The book keeps `weekIndexFor()`, which still clamps to a spread.

## Owner's rule: dated CEN100 submissions are due by end of day

After the fixture run, the owner set the rule for CEN100 submissions that have a date but no posted time: they are due **by the end of that Toronto day**. Every CEN100 schedule row titled "… due" without a time now counts down to the end of that day (zero at Toronto midnight, so the whole 11:59 PM minute stays open), labelled "Due by end of day" and shown as "Wed Oct 21 · by 11:59 PM Toronto". Dated in-class events without a time (Midterm Design Review, both final presentations, the lab and sign-up reminders) keep "Time not posted · check D2L". This deliberately overrides the fixture contract's "never invent 23:59" rule for those CEN100 rows only, at the owner's request; the generic `date_only` fixtures still pass. Course records are unchanged; the CEN100 guide's own card note ("Check D2L for submission time") is unchanged.

Two existing assertions encoded the previous rule and were updated for the new requirement: the CEN date-without-time test in `tests/targets.test.mjs` (now "a dated submission without a time counts down to 11:59 PM Toronto; a dated in-class event keeps its date only") and, in "Toronto/UTC date boundaries decide eligibility and day counts", WHMIS at 11:30 PM Toronto (now `30m` instead of `Today`), with the Toronto day-count check moved to the dated Midterm Design Review.

## What students see

- **Exact instant:** the state is "Happening now" rather than "Due time passed" at the instant itself. For deadlines without an end time that lasts one millisecond, so in practice there is no visible difference.
- **Passed date without a time:** "Date passed (time not posted)" instead of "Date passed".
- **Thanksgiving quiz week:** the chip reads "Holiday schedule unconfirmed" instead of "Quiz week"; the confirmation warning text is unchanged. Real Fall 2026 records never reach this state (MTH140 Quiz 2 has an announced make-up date).
- **CEN100 submissions with only a date:** a countdown to the end of the day, "Due by end of day".
- **Upcoming date without a time:** unchanged — "Time not posted" with a day-level chip ("Today", "Tomorrow", "In 2 days"), as the Night Shift plan specifies. A quiz week without a section still shows "Quiz week" with the section call to action. `status()` gives the contract's wording for both at the data level.
- **Phone dock:** long chips shrink with an ellipsis instead of covering the dock's buttons.

## Interface copy applied in the same change

From [`docs/copy/interface-copy.md`](../copy/interface-copy.md): countdown chips read `2d 12h`, `5h 07m` or `30m` (the Desk adds "left"); the Desk's empty state reads "No upcoming deadlines"; the quiz-week call to action reads "Choose section for quiz date"; the Desk course links, the dock's Desk link and its Search button carry the copy deck's screen-reader labels.
