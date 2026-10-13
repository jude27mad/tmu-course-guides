# Fall 2026 Toronto deadline boundary tests

> **Status:** Reference acceptance-test specification, not proof that the website currently passes. These are synthetic edge-case records, **not university-published assessments**. Do not add their dates to real course data or present them as official deadlines.

**Repository scope:** The deadline and week-index logic serving the Desk and course guides. The application code and its existing tests are not modified by this documentation change.

## Calendar and interpretation contract

- **Time zone:** `America/Toronto`. Convert explicit instants to Toronto local dates for week assignment and date-only comparisons. Never use the testing computer's local time zone or a UTC calendar date as the course calendar date.
- **Term:** Tuesday, September 8 through Monday, December 21, 2026 **inclusive**. Week numbering is 1-based and anchored to Monday, September 7: Week 1 = September 8–13 (partial), Week 2 = September 14–20, …, Week 16 includes December 21 only within the term. Dates before September 8 and after December 21 have a `null` week index. The calendar does not magically extend for exams.
- **`nowWeek` and `deadlineWeek`:** The week containing the Toronto-local `now` date and the week containing the resolved Toronto-local deadline date, respectively. A pending or unresolved deadline has `deadlineWeek: null`. A dated event outside the defined term also has `deadlineWeek: null` even when it has a valid countdown.
- **Exact instants:** Each ISO string with `Z`, `-04:00`, or `-05:00` specifies an absolute instant. For a future exact deadline, the countdown is based on the real instant difference, normalized into 24-hour `days`, remaining `hours`, and `minutes` with seconds truncated (not rounded). At the exact instant, display `Happening now`; afterward, `Due time passed`. The exact-instant label describes the reference zero point; a wider UI grace period would require an explicit contract revision.
- **Date without a posted time:** Show `Time not posted` through the entire Toronto calendar date and before it. Beginning at 00:00 **the next Toronto date**, show `Date passed (time not posted)`. Do not fabricate 00:00, 23:59, a lab start, or a countdown for an unposted time.
- **Pending dates:** Show `Date pending`; do not assign a deadline week or countdown.
- **Quiz-week dates:** Resolve a student's lab weekday from the selected section only; until then show `Select lab section`. A resolved weekday alone does **not** establish a precise quiz start time. Only `postedTime` permits an exact countdown. The canonical quiz-week value `week: 6` refers to the Monday-anchored week beginning October 12, 2026. A Monday lab on Thanksgiving (October 12) is **not** automatically assumed to meet; without a confirmed override, show `Holiday schedule unconfirmed` and leave `deadlineWeek` unresolved. With an explicit `overrideDate` of October 19, use Week 7.
- **DST fall-back:** At 02:00 EDT on Sunday, November 1, 2026, Toronto clocks return to 01:00 EST. The two 01:15 times in cases T23–T28 refer to distinct instants depending on `-04:00` or `-05:00`. Calculate countdowns using timestamps, not local wall-clock subtraction. Crossing the transition may produce 25 elapsed hours across two apparent same-hour days.
- **After the term:** Keep an exact post-term deadline visible and calculate its countdown normally; do not attach it to a nonexistent Week 17. Exam-related examples beyond December 21 are deliberately hypothetical; do not infer official exam schedules from them.

## Coverage map

| Cases | What they verify |
| --- | --- |
| T01–T06 | Partial first week, start instant, week rollover at Monday midnight |
| T07–T10 | UTC timestamps crossing or not crossing Toronto-local calendar days |
| T11–T21 | Date-only rules, Thanksgiving, missing section, confirmed quiz reschedule, posted vs unposted lab times |
| T22–T33 | DST fall-back repeated hour, true elapsed hours, local Sunday–Monday rollover, pending dates |
| T34–T40 | Final semester week, Dec 21 boundary, UTC/local flips, post-term deadlines |

## How to execute the suite

1. **Keep all 40 cases as data.** The fenced array below is mirrored in [`toronto-deadline-test-cases.json`](toronto-deadline-test-cases.json). The standalone JSON is the machine-readable source for a future parameterized test; maintain both together if editing fixtures.
2. **Build a thin test adapter** in a new `tests/deadline-boundaries.test.mjs`. Map the fixture's `deadline.type`, `now`, and lab-section fields onto the site's date/time resolution logic. The repo currently has `assets/schedule.mjs` and `tests/schedule.test.mjs`; do not assume those existing functions already accept this fixture schema or implement every proposed label.
3. **Inject the clock.** Pass each `now` value as an instant to the resolver. Do **not** adjust the operating-system clock, alter university deadlines, or wait for a real deadline to occur.
4. **Assert the entire `expected` object**, checking `nowWeek`, `deadlineWeek`, and `resolvedDate` when provided; check either exact countdown components or the exact status label. A mismatched component or missing label is a failing case.
5. **Check date-only and unknown states first** (T11–T21, T33, T40); then precise deadline math (T01–T10); then the repeated DST hour (T22–T32); finally the semester end (T34–T39). Keep fixes in the resolver, not ad-hoc corrections in page rendering.
6. **Run tests under different machine time zones** to expose accidental host-local calculations. From the repository root, after creating the adapter:

   ```sh
   node --test tests/schedule.test.mjs
   TZ=UTC node --test tests/deadline-boundaries.test.mjs
   TZ=America/Los_Angeles node --test tests/deadline-boundaries.test.mjs
   TZ=America/Toronto node --test tests/deadline-boundaries.test.mjs
   ```

7. **Verify UI wiring** after the data-level tests pass: compare the same pending/exact deadline on Desk, course page and dock. Ensure `Mark done` and `Undo` update all affected displays without independently recalculating or inventing due times. On iPhone/iPad, confirm status labels and countdowns remain readable.
8. **Report results by case ID**: pass/fail, actual week/date/time/label, expected value, browser/runtime, and relevant code change. Avoid marking the suite as passed until an executable test adapter has actually run against the implementation.

## Complete JSON fixture array (40 cases)

```json
[
  {
    "id": "T01",
    "now": "2026-09-07T23:59:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-08T00:00:00-04:00"
    },
    "expected": {
      "nowWeek": null,
      "deadlineWeek": 1,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 1
      }
    }
  },
  {
    "id": "T02",
    "now": "2026-09-08T00:00:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-08T00:00:00-04:00"
    },
    "expected": {
      "nowWeek": 1,
      "deadlineWeek": 1,
      "label": "Happening now"
    }
  },
  {
    "id": "T03",
    "now": "2026-09-08T00:01:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-08T00:00:00-04:00"
    },
    "expected": {
      "nowWeek": 1,
      "deadlineWeek": 1,
      "label": "Due time passed"
    }
  },
  {
    "id": "T04",
    "now": "2026-09-08T01:00:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-13T23:00:00-04:00"
    },
    "expected": {
      "nowWeek": 1,
      "deadlineWeek": 1,
      "countdown": {
        "days": 5,
        "hours": 22,
        "minutes": 0
      }
    }
  },
  {
    "id": "T05",
    "now": "2026-09-13T23:59:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-14T00:00:00-04:00"
    },
    "expected": {
      "nowWeek": 1,
      "deadlineWeek": 2,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 1
      }
    }
  },
  {
    "id": "T06",
    "now": "2026-09-14T00:00:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-14T00:00:00-04:00"
    },
    "expected": {
      "nowWeek": 2,
      "deadlineWeek": 2,
      "label": "Happening now"
    }
  },
  {
    "id": "T07",
    "now": "2026-09-09T23:30:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-10T03:45:00Z"
    },
    "expected": {
      "nowWeek": 1,
      "deadlineWeek": 1,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 15
      }
    }
  },
  {
    "id": "T08",
    "now": "2026-09-13T23:00:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-14T03:30:00Z"
    },
    "expected": {
      "nowWeek": 1,
      "deadlineWeek": 1,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 30
      }
    }
  },
  {
    "id": "T09",
    "now": "2026-09-13T23:30:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-14T04:30:00Z"
    },
    "expected": {
      "nowWeek": 1,
      "deadlineWeek": 2,
      "countdown": {
        "days": 0,
        "hours": 1,
        "minutes": 0
      }
    }
  },
  {
    "id": "T10",
    "now": "2026-09-14T00:30:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-09-14T03:45:00Z"
    },
    "expected": {
      "nowWeek": 2,
      "deadlineWeek": 1,
      "label": "Due time passed"
    }
  },
  {
    "id": "T11",
    "now": "2026-10-11T23:59:00-04:00",
    "deadline": {
      "type": "date_only",
      "date": "2026-10-12"
    },
    "expected": {
      "nowWeek": 5,
      "deadlineWeek": 6,
      "label": "Time not posted"
    }
  },
  {
    "id": "T12",
    "now": "2026-10-12T00:00:00-04:00",
    "deadline": {
      "type": "date_only",
      "date": "2026-10-12"
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 6,
      "label": "Time not posted"
    }
  },
  {
    "id": "T13",
    "now": "2026-10-12T23:59:00-04:00",
    "deadline": {
      "type": "date_only",
      "date": "2026-10-12"
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 6,
      "label": "Time not posted"
    }
  },
  {
    "id": "T14",
    "now": "2026-10-13T00:00:00-04:00",
    "deadline": {
      "type": "date_only",
      "date": "2026-10-12"
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 6,
      "label": "Date passed (time not posted)"
    }
  },
  {
    "id": "T15",
    "now": "2026-10-11T12:00:00-04:00",
    "deadline": {
      "type": "quiz_week",
      "week": 6,
      "section": null
    },
    "expected": {
      "nowWeek": 5,
      "deadlineWeek": null,
      "label": "Select lab section"
    }
  },
  {
    "id": "T16",
    "now": "2026-10-12T12:00:00-04:00",
    "deadline": {
      "type": "quiz_week",
      "week": 6,
      "section": {
        "id": "MON-LAB",
        "weekday": "Monday"
      }
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": null,
      "label": "Holiday schedule unconfirmed"
    }
  },
  {
    "id": "T17",
    "now": "2026-10-12T12:00:00-04:00",
    "deadline": {
      "type": "quiz_week",
      "week": 6,
      "section": {
        "id": "MON-LAB",
        "weekday": "Monday"
      },
      "overrideDate": "2026-10-19"
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 7,
      "resolvedDate": "2026-10-19",
      "label": "Time not posted"
    }
  },
  {
    "id": "T18",
    "now": "2026-10-18T23:59:00-04:00",
    "deadline": {
      "type": "quiz_week",
      "week": 6,
      "section": {
        "id": "MON-LAB",
        "weekday": "Monday"
      },
      "overrideDate": "2026-10-19",
      "postedTime": "09:00"
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 7,
      "resolvedDate": "2026-10-19",
      "countdown": {
        "days": 0,
        "hours": 9,
        "minutes": 1
      }
    }
  },
  {
    "id": "T19",
    "now": "2026-10-15T12:00:00-04:00",
    "deadline": {
      "type": "quiz_week",
      "week": 6,
      "section": {
        "id": "THU-LAB",
        "weekday": "Thursday"
      },
      "postedTime": "17:45"
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 6,
      "resolvedDate": "2026-10-15",
      "countdown": {
        "days": 0,
        "hours": 5,
        "minutes": 45
      }
    }
  },
  {
    "id": "T20",
    "now": "2026-10-15T18:00:00-04:00",
    "deadline": {
      "type": "quiz_week",
      "week": 6,
      "section": {
        "id": "THU-LAB",
        "weekday": "Thursday"
      }
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 6,
      "resolvedDate": "2026-10-15",
      "label": "Time not posted"
    }
  },
  {
    "id": "T21",
    "now": "2026-10-16T00:01:00-04:00",
    "deadline": {
      "type": "quiz_week",
      "week": 6,
      "section": {
        "id": "THU-LAB",
        "weekday": "Thursday"
      }
    },
    "expected": {
      "nowWeek": 6,
      "deadlineWeek": 6,
      "resolvedDate": "2026-10-15",
      "label": "Date passed (time not posted)"
    }
  },
  {
    "id": "T22",
    "now": "2026-10-31T23:30:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T02:30:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "countdown": {
        "days": 0,
        "hours": 4,
        "minutes": 0
      }
    }
  },
  {
    "id": "T23",
    "now": "2026-11-01T00:45:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T01:15:00-04:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 30
      }
    }
  },
  {
    "id": "T24",
    "now": "2026-11-01T00:45:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T01:15:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "countdown": {
        "days": 0,
        "hours": 1,
        "minutes": 30
      }
    }
  },
  {
    "id": "T25",
    "now": "2026-11-01T01:45:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T01:15:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 30
      }
    }
  },
  {
    "id": "T26",
    "now": "2026-11-01T01:15:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T01:45:00-04:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "label": "Due time passed"
    }
  },
  {
    "id": "T27",
    "now": "2026-11-01T01:10:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T01:10:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "countdown": {
        "days": 0,
        "hours": 1,
        "minutes": 0
      }
    }
  },
  {
    "id": "T28",
    "now": "2026-11-01T01:59:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T01:00:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 1
      }
    }
  },
  {
    "id": "T29",
    "now": "2026-11-01T01:59:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T02:00:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 8,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 1
      }
    }
  },
  {
    "id": "T30",
    "now": "2026-11-01T23:59:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-02T00:00:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 9,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 1
      }
    }
  },
  {
    "id": "T31",
    "now": "2026-10-31T12:00:00-04:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-02T12:00:00-05:00"
    },
    "expected": {
      "nowWeek": 8,
      "deadlineWeek": 9,
      "countdown": {
        "days": 2,
        "hours": 1,
        "minutes": 0
      }
    }
  },
  {
    "id": "T32",
    "now": "2026-11-02T00:01:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-11-01T23:59:00-05:00"
    },
    "expected": {
      "nowWeek": 9,
      "deadlineWeek": 8,
      "label": "Due time passed"
    }
  },
  {
    "id": "T33",
    "now": "2026-11-02T00:00:00-05:00",
    "deadline": {
      "type": "pending"
    },
    "expected": {
      "nowWeek": 9,
      "deadlineWeek": null,
      "label": "Date pending"
    }
  },
  {
    "id": "T34",
    "now": "2026-12-20T23:59:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-12-21T00:00:00-05:00"
    },
    "expected": {
      "nowWeek": 15,
      "deadlineWeek": 16,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 1
      }
    }
  },
  {
    "id": "T35",
    "now": "2026-12-21T00:00:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-12-21T00:00:00-05:00"
    },
    "expected": {
      "nowWeek": 16,
      "deadlineWeek": 16,
      "label": "Happening now"
    }
  },
  {
    "id": "T36",
    "now": "2026-12-21T23:59:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-12-22T00:00:00-05:00"
    },
    "expected": {
      "nowWeek": 16,
      "deadlineWeek": null,
      "countdown": {
        "days": 0,
        "hours": 0,
        "minutes": 1
      }
    }
  },
  {
    "id": "T37",
    "now": "2026-12-22T00:00:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-12-22T00:00:00-05:00"
    },
    "expected": {
      "nowWeek": null,
      "deadlineWeek": null,
      "label": "Happening now"
    }
  },
  {
    "id": "T38",
    "now": "2026-12-21T20:00:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-12-22T02:00:00Z"
    },
    "expected": {
      "nowWeek": 16,
      "deadlineWeek": 16,
      "countdown": {
        "days": 0,
        "hours": 1,
        "minutes": 0
      }
    }
  },
  {
    "id": "T39",
    "now": "2026-12-21T20:00:00-05:00",
    "deadline": {
      "type": "exact",
      "at": "2026-12-22T05:00:00Z"
    },
    "expected": {
      "nowWeek": 16,
      "deadlineWeek": null,
      "countdown": {
        "days": 0,
        "hours": 4,
        "minutes": 0
      }
    }
  },
  {
    "id": "T40",
    "now": "2026-12-23T08:00:00-05:00",
    "deadline": {
      "type": "date_only",
      "date": "2027-01-04"
    },
    "expected": {
      "nowWeek": null,
      "deadlineWeek": null,
      "label": "Time not posted"
    }
  }
]
```

## Acceptance gates

- All 40 fixture expectations pass consistently with the injected clock in at least UTC and one non-Toronto system time zone.
- All exact and date-only labels respect `America/Toronto`; no off-by-one-day rollovers at midnight or local-versus-UTC shifts.
- DST fall-back is resolved with explicit offsets; same-looking local clock times do not collapse into a single instant.
- Thanksgiving lab dates are never silently invented, and an override is applied only when supplied.
- Post-term deadlines remain viewable with `deadlineWeek: null` rather than vanishing or appearing as Week 17.
- No unrelated UI, university requirements, existing progress records, or site content is changed solely to satisfy these fixtures.
