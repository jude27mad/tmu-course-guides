# TMU Course Guides — Device Test Checklist

60 functional, visual, accessibility and performance checks for real devices (iPhone Safari, iPad Safari, laptop Safari/Chrome/Edge). Drafted with ChatGPT on 12 October 2026 from the Night Shift plan; run it against the live site after each merged stage. Checks for features that are not live yet are skipped, not failed.

Website: https://jude27mad.github.io/tmu-course-guides/

**How to use:** make a separate copy for each device. Complete the checks in order and tick each box only when the expected result occurs. Skip checks marked for another device. Record failures with the test number, device and a screenshot.

**Before starting:** use a normal browser tab with a working connection. Keep at least one uncompleted deadline available. Restore your original saved progress after testing.

## 1. Navigation (7)

- [ ] **01 · Desk loads correctly** [All] — Open the homepage. *Expected:* the Desk shows CEN100, MTH140 and MTH141; all three course links are visible and usable.
- [ ] **02 · Open every course** [All] — Open each course from the Desk. *Expected:* each opens the correct course page with its own heading, book and information.
- [ ] **03 · Switch courses without reloading** [All] — From CEN100 switch to MTH140, then MTH141, then back to CEN100. *Expected:* content and URL update smoothly without a full reload, blank flash or lost state.
- [ ] **04 · Browser Back and Forward** [All] — Switch courses twice, then use Back and Forward. *Expected:* the correct course returns each time, with no broken navigation or mismatched content.
- [ ] **05 · Return to Desk** [All] — Open a course and use its Desk link. *Expected:* the homepage appears with the three courses and their latest deadlines.
- [ ] **06 · Direct course links** [All] — Open /cen100/, /mth140/ and /mth141/ in fresh tabs. *Expected:* each loads on its own without visiting the Desk first.
- [ ] **07 · Orientation and resizing** [All] — Rotate the iPhone/iPad, or resize the laptop window. *Expected:* no clipped buttons, overlapping navigation, missing text or horizontal scrolling.

## 2. Deadlines and countdowns (8)

- [ ] **08 · Desk upcoming deadlines** [All] — Inspect the Desk's next-deadline area and course summaries. *Expected:* deadlines belong to the right courses and are ordered by date.
- [ ] **09 · Course-specific next deadline** [All] — Open each course's next-deadline display. *Expected:* it belongs to that course and is the earliest unfinished deadline.
- [ ] **10 · Live countdown** [All] — Watch a countdown for 60 seconds. *Expected:* it decreases correctly without a refresh; units stay readable.
- [ ] **11 · Countdown consistency** [All] — Compare the same deadline on the Desk, course page and docked bar. *Expected:* same deadline and roughly the same remaining time.
- [ ] **12 · Deadline opens correct assessment** [All] — Tap an upcoming deadline. *Expected:* the matching assessment opens.
- [ ] **13 · Expired and unknown deadlines** [All] — Inspect past-due or unscheduled items. *Expected:* no negative countdowns, fake dates or misleading labels; unknown dates are clearly marked.
- [ ] **14 · Mark done advances the queue** [All] — Mark the next deadline done. *Expected:* a confirmation appears and the next unfinished deadline takes its place everywhere.
- [ ] **15 · Undo restores the deadline** [All] — Select Undo immediately. *Expected:* the original deadline returns, with every display updated.

## 3. Interactive 3D book (10)

- [ ] **16 · Book loads** [All] — Open each course page. *Expected:* a properly rendered 3D book; no black canvas, missing geometry or permanent blank area.
- [ ] **17 · Week labels and content** [All] — Inspect the open spread and its week label. *Expected:* label, week and assessments agree.
- [ ] **18 · Desktop scroll interaction** [Laptop] — Scroll through several weeks over the book. *Expected:* pages turn in order without skipping or sticking.
- [ ] **19 · iPhone swipe** [iPhone] — Swipe the book several times. *Expected:* pages turn reliably without repeated attempts.
- [ ] **20 · iPad touch** [iPad] — Swipe quickly, then slowly. *Expected:* both work and pages settle cleanly.
- [ ] **21 · Reverse page turning** [All] — Advance three weeks, then go back three. *Expected:* back at the starting week with no lost, duplicated or mixed content.
- [ ] **22 · Semester boundaries** [All] — Go to the first and last weeks and try to go further. *Expected:* no invalid, empty or out-of-range pages.
- [ ] **23 · Assessment pop-ups** [All] — Go to a week with an assessment. *Expected:* it rises from the page with a readable label and no clipping.
- [ ] **24 · Open a pop-up** [All] — Tap it, read the details, return. *Expected:* correct information, no reload, book position kept.
- [ ] **25 · Book gestures vs page scrolling** [All] — Use the book, then scroll the page. *Expected:* no accidental page turns or trapped scrolling.

## 4. Docked top bar (7)

- [ ] **26 · Sticky positioning** [All] — Scroll a long course page. *Expected:* the bar stays reachable without covering content or the iPhone notch area.
- [ ] **27 · Current course indicator** [All] — Switch between courses. *Expected:* the course shown always matches the page.
- [ ] **28 · Desk shortcut** [All] — Use the dock's Desk link while scrolled down. *Expected:* the Desk opens; Back still works.
- [ ] **29 · Dock countdown** [All] — Watch the dock countdown while scrolling. *Expected:* live, correct, and updated after a completion change.
- [ ] **30 · Section control** [All] — Change section from the dock, then switch back. *Expected:* section and its information update together, in the right course only.
- [ ] **31 · Dock Search button** [All] — Scroll down and use Search in the dock. *Expected:* search opens without scrolling to the top.
- [ ] **32 · Pause control state** [All] — Press Pause motion twice. *Expected:* the control clearly shows paused vs playing, including its accessible state.

## 5. Search (7)

- [ ] **33 · Open Search** [All] — Open Search on each course page. *Expected:* it appears and the input is ready.
- [ ] **34 · Keyboard shortcut** [Laptop / hardware keyboard] — Press ⌘K (Mac/iPad keyboard) or Ctrl+K (Windows). *Expected:* search opens without triggering the browser's own search.
- [ ] **35 · Relevant results** [All] — Search for a known assignment, assessment or topic in each course. *Expected:* accurate, readable, course-relevant results.
- [ ] **36 · Open a result** [All] — Choose an assessment or topic. *Expected:* its details open and come into view without a reload.
- [ ] **37 · No results** [All] — Search for `zzzxq12345`. *Expected:* a clear empty state, no stale results or errors.
- [ ] **38 · Clear query** [All] — Delete the search text. *Expected:* back to the empty-query state with nothing stale selected.
- [ ] **39 · Close Search** [All] — Close it with its control; on laptop also Escape. *Expected:* overlay closes and focus returns somewhere sensible.

## 6. Motion, appearance and accessibility (8)

- [ ] **40 · Pause decorative motion** [All] — Pause while the book is animating. *Expected:* movement stops, nothing disappears, countdowns keep updating.
- [ ] **41 · Resume motion** [All] — Resume after about 30 seconds. *Expected:* smooth continuation, no catch-up jumps.
- [ ] **42 · System Reduce Motion** [All] — Turn on Reduce Motion and reload. *Expected:* continuous movement and page-turn effects removed or simplified; everything still reachable. Restore the setting afterwards.
- [ ] **43 · Auto theme** [All] — Choose Auto, switch the system between Light and Dark. *Expected:* the site follows without a mixed theme.
- [ ] **44 · Manual themes** [All] — Choose Light, then Dark; check Desk, book, dock, cards and pop-ups. *Expected:* readable text and visible controls in both.
- [ ] **45 · Text enlargement** [All] — Zoom text/page to about 200%. *Expected:* nothing essential clipped, overlapping or unreachable.
- [ ] **46 · Screen reader** [All] — Use VoiceOver (or a laptop screen reader) on the Desk, dock, book controls and an assessment. *Expected:* meaningful names and states; content reachable without the 3D.
- [ ] **47 · Keyboard navigation** [Laptop / hardware keyboard] — Use Tab, Shift+Tab, Enter, Space, Escape. *Expected:* visible focus, working controls, no keyboard traps.

## 7. Saved progress and preferences (7)

- [ ] **48 · Completion survives reload** [All] — Mark a test item done and reload. *Expected:* still done.
- [ ] **49 · Undo saves correctly** [All] — Mark done, Undo, reload. *Expected:* still unfinished.
- [ ] **50 · Checklists and notes** [All] — Tick an item, add a note or target date, close and reopen the tab. *Expected:* all values restored.
- [ ] **51 · Section and group remembered** [All] — Choose a section (and CEN100 group), visit another course, return, reload. *Expected:* choices and their information kept.
- [ ] **52 · Independent course progress** [All] — Record a test completion in each course and switch between them. *Expected:* progress never appears in another course.
- [ ] **53 · Theme survives navigation** [All] — Choose Dark or Light, change courses, return to the Desk, reload. *Expected:* the same appearance everywhere.
- [ ] **54 · Backup and fresh browser** [All] — Export a backup; open a private session and import it. *Expected:* the fresh session starts empty; import restores supported records without touching other courses. Keep backups private.

## 8. Performance, heat and battery (6)

For 59–60: about 50% brightness, normal Wi-Fi, no unnecessary background apps; record battery before and after.

- [ ] **55 · Initial loading** [All] — Load the Desk and each course in a fresh tab. *Expected:* text and navigation appear promptly; no endless loading or missing book fallback.
- [ ] **56 · Repeated course switching** [All] — Switch courses about 20 times. *Expected:* no freezes, crashes, duplicated content or slowdown.
- [ ] **57 · Repeated page turns** [All] — Turn about 20 times with quick reversals. *Expected:* responsive, week label in sync, no stacked pop-ups.
- [ ] **58 · Scrolling and offscreen rendering** [All] — Scroll fast, leave the book offscreen, use other controls, return. *Expected:* smooth scrolling, no background stutter.
- [ ] **59 · Heat** [All] — Use the site for 10–15 minutes with motion on and regular page turns. *Expected:* no uncomfortable heat or throttling warnings.
- [ ] **60 · Battery** [All] — Use the site actively for 15 minutes and compare with normal browsing. *Expected:* no unusual drain; paused motion or an offscreen book should not keep the GPU busy.

## Results

| Device | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| iPhone — Safari | | | |
| iPad — Safari | | | |
| Laptop — | | | |

Device / OS / browser versions: ____

Major issues found: ____

**Failure report format:** Test # · Device · Steps taken · Actual result · Screenshot or video.

**Acceptance rule:** a test passes only when the expected behaviour happens consistently. A missing feature, broken control or significant usability problem is a failure, not a skip.
