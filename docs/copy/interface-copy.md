# Interface copy

Source of truth for visible text and screen-reader labels across the Desk, course book, docked bar, command palette, sound control and 3D fallback. Drafted with ChatGPT and adopted 13 October 2026. Tone: restrained and premium — short labels, clear actions, no promotional language, no invented certainty about deadlines. `{…}` is dynamic content.

**Two rules override the draft:**
- **End of day (owner, 13 Oct 2026).** A CEN100 submission with a date and no posted time is due by the end of that Toronto day: it counts down to 11:59 PM Toronto, labelled "Due by end of day". Every other dated item without a time keeps "Time not posted" and never gets an invented time.
- **Status labels.** Resolver status labels follow `docs/qa/toronto-deadline-test-cases.md` (Happening now, Due time passed, Time not posted, Date passed (time not posted), Select lab section, Holiday schedule unconfirmed, Date pending). The visible strings below are what students read around them.

## Desk homepage

| Element | Visible text | Screen-reader label |
| --- | --- | --- |
| Page title | TMU Course Guides | TMU Course Guides |
| Term | Fall 2026 | Fall semester, 2026 |
| Upcoming section | Next across your courses | Next across your courses |
| Empty deadline state | No upcoming deadlines | No upcoming deadlines to show |
| Course card | CEN100 / MTH140 / MTH141 | Open {code} guide, {course name} |
| Live countdown | {days}d {hours}h left | {days} days and {hours} hours remaining until {assessment} |

## Course book

| Element | Visible text | Screen-reader label |
| --- | --- | --- |
| First week | Week 1 · Sep 8–13 | Week 1, September 8 to 13. Partial first week |
| Standard week | Week {n} · {date range} | Week {n}, {start date} to {end date} |
| Final partial week | Week 16 · Dec 21 | Week 16, December 21. Final day of the semester |
| Today marker | Today | Today, {date}. Semester week {n} |
| Current week action | Go to today | Go to the week containing today |
| Assessment heading | Next assessment | Next assessment |
| No assessment | Nothing scheduled | No assessments scheduled for this week |
| Previous button | Previous week | Previous week |
| Next button | Next week | Next week |
| Week navigation tick | {n} | Week {n}, {date range}. Show this week |
| Turn-page hint | Drag or swipe to turn | Drag or swipe to turn pages. You can also use the week buttons |

## Assessment pop-ups

| Element | Visible text | Screen-reader label |
| --- | --- | --- |
| Exact date and time | {date} · {time} | {assessment}, {full date} at {time}, Toronto time |
| End-of-day submission (CEN100) | {date} · by 11:59 PM | {assessment}, due by the end of {full date}, Toronto time |
| Quiz week, section missing | Choose section for quiz date | Select your lab section to see the quiz date |
| Known date, time missing | Time not posted | Date is {date}. Exact time has not been posted |
| Date pending | Date pending | Assessment date has not been announced |
| Completed assessment | Completed | {assessment} marked complete in this browser |

## Docked top bar

| Element | Visible text | Screen-reader label |
| --- | --- | --- |
| Current course | {course code} | Current course: {course code}. Change course |
| Desk link | Desk | Go to Course Desk |
| Search action | Search ⌘K | Search the guide. Shortcut: Command K |
| Countdown | {days}d {hours}h | Next deadline, {assessment}, in {days} days and {hours} hours |
| Section selected | Section {n} | Section {n}. Change section |
| Section not selected | Choose section | Choose your course section |
| Motion enabled | Pause motion | Pause motion |
| Motion paused | Play motion | Play motion |

## Command palette

| Element | Visible text | Screen-reader label |
| --- | --- | --- |
| Search placeholder | Search courses, weeks, topics… | Search courses, assessments, weeks, and topics |
| Group headings | Courses · Assessments · Weeks · Topics · Actions | Courses · Assessments · Semester weeks · Study topics · Actions |
| Search suggestion | Search the guide for "{query}" | Search the guide for {query} |
| Empty results | No results for "{query}" | No results for {query}. Try another search |
| Clear search | Clear | Clear search |
| Close palette | Close | Close search |

## Accessibility and sound

| Element | Visible text | Screen-reader label |
| --- | --- | --- |
| Skip link (course pages) | Skip to coursework | Skip to coursework |
| Skip link (Desk) | Skip to courses | Skip to courses |
| Sound enabled | Sound on | Sound on. Turn sound off |
| Sound disabled | Sound off | Sound off. Turn sound on |

## 3D errors and fallback

| Element | Visible text | Screen-reader label |
| --- | --- | --- |
| 3D unavailable heading | Book view unavailable | Three-dimensional book view unavailable |
| Fallback explanation | Use the week controls to browse. | The book could not load. Weeks and assessments remain available through the week controls |
| Retry button | Try again | Try loading the 3D book again |
| Static fallback | Week view | Static semester week view |

## Countdown format

- One day or more: `{d}d {h}h` (`2d 11h`); under a day: `{h}h {mm}m` (`5h 07m`); under an hour: `{m}m` (`29m`). The Desk adds "left" (`2d 11h left`). A precise countdown appears only when the time is known (or for an end-of-day CEN100 submission).

## Wording rules

- Use "Choose section", not "Configure preferences".
- Use "Time not posted" for a dated item without a time, except the end-of-day rule above. Never an assumed midnight.
- Use "Completed" only for a completion the student recorded; it must not imply a verified submission.
- Use "Week 1 · Sep 8–13" for the partial opening week and "Week 16 · Dec 21" for the final day, without extending either beyond the semester.
- Use Toronto time for every deadline.
- Keep controls descriptive: "Previous week", not an unlabelled arrow.
- No "Congratulations", "You're crushing it", "Epic" or similar achievement language.
- Error messages state what is unavailable and what still works.

## Accessibility notes

- Keep visible wording concise; give screen readers the context. Headings use proper heading elements rather than redundant ARIA labels.
- Week ticks expose the current week with `aria-current`; don't change their accessible names on every update.
- Never announce countdowns every second; a polite live region updates at most once a minute or on a meaningful status change. Search results announce their count; changing weeks announces the selected week.
- The 3D fallback keeps a usable week navigator and assessment details when WebGL or animation is unavailable — important for reduced-motion users.
