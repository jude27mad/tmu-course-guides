# Fall 2026 math guide source audit

Reviewed October 12, 2026. Dates and rules are transcribed or summarized from the supplied official course files and D2L announcements. The website publishes coverage summaries and exercise references; it does not redistribute course PDFs, screenshots, test question formats, restricted test questions or solutions.

## MTH140

| Item | Result | Source |
| --- | --- | --- |
| Lab quizzes | Four quiz weeks: September 28, October 12, November 9, November 23. Quiz category 15%; lowest quiz dropped; no make-up. | Course Management Form F26, p. 3 and footnote. |
| Quiz 1 scope | Sections 2.2–2.4. Quiz in the second hour of the assigned lab. | September 22 D2L announcement. |
| Quiz 2 scope and timing | Chapter 3, Sections 3.1–3.5; after Lab 5 questions are reviewed. Tuesday–Friday sections: second hour of their October 13–16 lab. Monday sections: second hour of the October 19 lab due to Thanksgiving. | October 8 D2L “Lab 5 Questions and Quiz 2” announcement. |
| Midterm | October 23, 2026, 6:30–8:30 PM Toronto time; 40%. Exact scope and room not supplied. | Course Management Form, p. 3; FAQ C.4 says scope is posted about one week before. |
| Final | Three hours, December examination period, 45%. Exact date, time, room and scope not supplied. | Course Management Form, p. 3. |
| Instructors | All six section ranges; current staff details are on D2L. | Course Management Form, p. 1. |
| Labs | All 34 section mappings, lab days, windows and rooms. | MTH140 TAs F26 spreadsheet. |
| Course progression | Eight outline blocks, in its published order, including the alternating derivative/integration blocks. | Course Management Form, p. 5. |
| Practice | 37 section rows, all exact exercise ranges. Ungraded. | Recommended Problems MTH140 F2026, pp. 1–3. |

The FAQ's statement that two of ten quizzes are dropped conflicts with the four-quiz, one-drop outline and the September 22 announcement. The guide uses the outline and announcement, and exposes the conflict in Rules & Help.

Staff names and office-hour details are omitted from the public guide; check current D2L listings. Daytime lab entries ending at “12am” in the staffing spreadsheet are normalized to noon; this normalization is disclosed in source notes.

## MTH141

| Item | Result | Source |
| --- | --- | --- |
| Lab quizzes | Five quiz weeks: September 21, October 5, November 2, November 16, November 30. Quiz category 20%; lowest dropped; no make-up. | Course Management Form V3, pp. 3 and 5. |
| Quiz 1 scope | Sections 6.1–6.4. | September 17 D2L reminder. |
| Quiz 2 scope | 1.2.2, 1.2.3, 1.2.4, 2.1.3, 2.1.4, 2.1.5, 2.1.6; 15 minutes. | October 1 D2L reminder. |
| Midterm | October 16, 6:30–8:30 PM Toronto time; 35% of course. The official test format is available on D2L, not reproduced in this public guide. | Outline V3 p. 3 and October 5 D2L announcement. |
| Midterm scope | 6.1–6.4; 1.1–1.2.4; 2.1.1–2.1.8; 3.1.1–3.1.3 and 3.1.5–3.2.2. Section 3.1.4 is not added. | October 5 announcement. |
| Midterm logistics | Bring physical TMU ID and know your section; closed-book, no unauthorized aids; phones off and stored in bags. Follow the official D2L cover page for the remaining requirements. | October 5 D2L announcement. |
| Test room / AAS | Rooms posted a few days before. AAS users must book through Test Centre by its applicable deadline; no deadline date supplied. | October 5 announcement. |
| Sample test | D2L → Course Information → Midterm Test Materials, sample and solutions. No restricted questions published. | October 5 announcement. |
| Final | December examination period, 45%; exact schedule and duration not supplied. FAQ says post-midterm content unless otherwise announced. | Outline V3 p. 3; FAQ 4.6. |
| Study week | Lectures continue October 12–16 except Thanksgiving Monday October 12. | Outline V3 p. 3. |
| Instructors / labs | All 34 sections, independent of the MTH140 mappings. | Outline V3 p. 1 and MTH141 Labs. |
| Practice | 40 section rows from the official recommended sheet. Kuttler 2017 rev. A and Nicholson 2019 rev. A. | Recommended Problems MTH141 F26, pp. 1–3. |

The V3 outline links Kuttler 2021.A, while its recommended-problem document cites 2017 revision A. The guide displays this edition mismatch so users can confirm problem numbering through D2L. It does not silently translate exercise identifiers between editions.

## Shared date behavior

Quiz weeks are authoritative at the granularity supplied. A visitor's lab day is combined with that week to calculate a **timetable-derived day**, explicitly labelled as such. The guide does not assume that a quiz begins at the beginning of the lab. Those events are opt-in, tentative, all-day calendar entries.

MTH140 Quiz 2's week begins on Thanksgiving, October 12. The October 8 D2L announcement confirms Monday sections instead write Quiz 2 during the second hour of the October 19 lab. The guide and optional tentative calendar export use October 19, not the holiday, for those Monday sections.

Published midterm times are exported using UTC calculated from America/Toronto, including daylight-saving offsets. Other sections' Quiz 2 dates are derived from their normal lab timetable and the confirmed week. Unknown final dates are never exported. Completion records are self-reported and do not represent marks or verified D2L submissions.

## Integration and maintenance

- CEN100 remains at the original root URL; MTH140 and MTH141 use `/mth140/` and `/mth141/` within the same repository and Pages site.
- Shared header and theme: `assets/hub.js` and `assets/hub.css`.
- Source data: `assets/course-data.mjs`; schedule and calendar behavior: `assets/schedule.mjs`.
- Math rendering and progress: `assets/math-guide.mjs`; visual layout: `assets/math.css`.
- CEN100's original storage keys, assignment anchors, backups and course functionality remain in place.
- Math progress and section choices use independent keys. Theme is shared; notes and student choices are never sent to analytics.
- Math skill checks are clearly labelled as guide-created study prompts, not official rubrics or a mastery score.
- Staff contact emails are not copied into the public math data. Users obtain current contact details from D2L.
- October 12 privacy update: no active analytics beacon or SDK. Fonts are self-hosted and Content Security Policy blocks outbound reporting. Course-only staff names are omitted from public data and documentation.

Run `node --test tests/schedule.test.mjs` for deadline, timezone, section, calendar and source-data checks. Serve this static repository over HTTP for browser testing; ES modules are used by the math pages. No package installation or build is required to host it.
