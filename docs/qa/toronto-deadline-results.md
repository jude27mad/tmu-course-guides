# Toronto deadline boundary tests: results

Run on 13 October 2026, Node v22.22.0, branch `night-shift` (base `7868f6a`). Fixtures: [`toronto-deadline-test-cases.md`](toronto-deadline-test-cases.md) and [`toronto-deadline-test-cases.json`](toronto-deadline-test-cases.json), unchanged. Test adapter: [`tests/deadline-boundaries.test.mjs`](../../tests/deadline-boundaries.test.mjs).

## Result

| Run | Tests | Pass | Fail |
| --- | ---: | ---: | ---: |
| `TZ=America/Toronto node --test tests/deadline-boundaries.test.mjs` (40 fixtures + wall-clock check) | 41 | 41 | 0 |
| `TZ=UTC …` | 41 | 41 | 0 |
| `TZ=America/Los_Angeles …` | 41 | 41 | 0 |
| Full root suite: `node --test tests/*.test.mjs tests/scene-*.cjs` (includes the 40 fixtures, the wall-clock check and one sub-run per time zone above) | 201 | 201 | 0 |
| `tools/ui-build`: `npm run build` (vendor output byte-identical) and `npm test` | GSAP playback check, 3 Desk workflows, 6 course × motion workflows, 2 persistent-route workflows | all passed | 0 |

No fixture expectation and no existing test expectation was changed. Official course records (`assets/course-data.mjs`, `assets/cen-schedule.*`) and storage keys were not touched.

## How the adapter maps the fixtures

The adapter only translates fixture records into the shapes the site already uses; every expected value comes from site code.

| Fixture | Site input | Checked through |
| --- | --- | --- |
| `exact` | a target with the fixture's absolute instant (`Date.parse` keeps the `-04:00`/`-05:00`/`Z` offset, so the repeated DST hour stays two instants) | `parts()` countdown, `status()`, `targetDate()` |
| `date_only`, `pending` | targets of precision `day` / `pending`, the shapes `resolveTarget()` returns for those records | `status()`, `parts()` (no clock digits) |
| `quiz_week` | a one-lab course in `course-data.mjs`'s record shape, resolved by `resolveTarget()`: fixture week → its Monday, section weekday → lab day, `postedTime` → lab start time, `overrideDate` → `mondayMakeupDate` | the full math resolver path (`resolveAssessment()`, Thanksgiving rule, lab timing) |
| `nowWeek`, `deadlineWeek` | Toronto date of `now` (`today()`) and of the target (`targetDate()`) | `termWeek()` |

A second test converts every exact instant to Toronto wall-clock time and back through `timestamp()` (how course records store times); inside the repeated 01:00–01:59 hour on November 1 it must return one of the two valid instants. Each time-zone run is a separate Node process with `TZ` set, so host-local date handling would show up as a failure.

## Before the fixes

The cases first failed only because the contract functions did not exist. A diagnostic against the existing resolver (same result in all three time zones, so no host-time-zone bug was found):

| Cases | Existing behaviour | Cause |
| --- | --- | --- |
| T17–T21 | Threw `Cannot read properties of null (reading 'split')` | A quiz lab with no published start or end time was converted with `timestamp(date, null)`. |
| T02, T06, T35, T37 | "Due time passed" at the deadline instant | `parts()` treated `left <= 0` as passed unless a known end time was still ahead. |
| T01, T36, T37, T39, T40 | Week 1 or Week 16 outside the term | Only the book's spread index existed, which deliberately clamps to the first/last spread. |
| T11–T16, T40 | No contract status label | Status wording lived only in chips ("Tomorrow", "Quiz week", "Date passed"); the contract's labels had no source. |

The remaining 23 cases (exact countdowns, UTC/Toronto date flips and every DST fall-back case) already matched.

## Fixes (`assets/night/targets.mjs`, `assets/book/weeks.mjs`)

1. **Quiz labs without times:** a lab with no published start now gives the quiz a date and "Time not posted", never a countdown; a missing end time no longer throws. Real Fall 2026 labs all have times, so their countdowns are unchanged.
2. **The exact instant:** `parts()` reports the instant itself as live ("Happening now"); after it, only a known start/end window stays live, otherwise "Due time passed".
3. **`status(target, now)`:** the single source of the contract's labels — Happening now, Due time passed, Time not posted, Date passed (time not posted), Select lab section, Holiday schedule unconfirmed, Date pending — and `null` while a countdown runs. `compact()` uses it for a passed date without a time and for the Thanksgiving quiz week.
4. **`targetDate(target)`:** the Toronto date a target falls on, or `null` while unresolved.
5. **`termWeek(date)`:** the 1-based term week (Monday-anchored, partial Week 1 from Sep 8), `null` before Sep 8 or after Dec 21. The book keeps `weekIndexFor()`, which still clamps to a spread.

## Owner's rule: dated submissions are due by end of day (added 13 October 2026)

After the fixture run, the owner set the rule for CEN100 submissions that have a date but no posted time: they are due **by the end of that Toronto day**. `resolveTarget()` now gives every CEN100 schedule row titled "… due" without a time an exact target at **11:59 PM Toronto**, labelled "Due by end of day" (shown as "Wed Oct 21 · by 11:59 PM Toronto"), with the normal countdown. Dated in-class events without a time (Midterm Design Review, First Final Presentation, Final Presentation and Innovation Showcase, and the lab and sign-up reminders) keep their date only with "Time not posted · check D2L". Course records are unchanged; the rule lives in the resolver. The synthetic `date_only` fixtures still describe records without that rule and still pass.

Two existing assertions encoded the old rule and were updated for the new requirement, not to pass: `tests/targets.test.mjs` "a dated submission without a time counts down to 11:59 PM Toronto; a dated in-class event keeps its date only" (formerly "a date without a time is day precision…"), and in "Toronto/UTC date boundaries decide eligibility and day counts", WHMIS at 11:30 PM Toronto now shows `0h 29m` instead of `Today`, and the Toronto day-count check uses the dated Midterm Design Review.

After this change: root suite 201/201; the deadline fixtures and resolver tests pass under America/Toronto, UTC and America/Los_Angeles (55/55 each); all 12 `tools/ui-build` workflows pass on a clean checkout of this commit.

## Visible changes on the site

- At the exact deadline minute the countdown says "Happening now" instead of "Due time passed".
- A past date without a posted time reads "Date passed (time not posted)" instead of "Date passed".
- The Thanksgiving quiz-week chip reads "Holiday schedule unconfirmed" instead of "Quiz week"; its existing confirmation warning text is unchanged.
- CEN100 submissions with a date and no posted time count down to 11:59 PM Toronto, labelled "Due by end of day".
