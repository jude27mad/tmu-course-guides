# Release history

Latest first. Course-specific student-facing notes remain under **What's changed?** above each course footer. Older entries record the behaviour at the time; later releases supersede them.

## October 15, 2026 — New website design (preview)

The new design is available for review at [`/next/`](https://jude27mad.github.io/tmu-course-guides/next/). The previous version remains at the site root until the switch. Both read the same saved progress.

- **New design.** The website now has a full-screen animated background, 3D sections, a fluid effect that follows the pointer, a loading intro, page transitions and smooth scrolling. Each course has its own colour scheme. Typography is set in Inter Display.
- **Desk.** The home page shows the next deadline across all courses with a live countdown, **Mark done** and **Undo**, followed by a card for each course and a list of the course guides. A new **Courses** page lists all three guides.
- **Course guides.** CEN100, MTH140 and MTH141 share one layout: next deadline, deadlines grouped under This week, Next week and Later, the weekly checklist, assessments with weights and dates, course information for the selected section, guide tools and a link to the next course.
- **Search and menu.** Search opens from the top bar, from the Menu on phones, or with Ctrl K / ⌘ K. The Menu lists every page, the next deadlines across courses, **Pause motion** and official sources.
- **Saved progress.** Sections, groups, checklist ticks, completion records, notes and target dates use the same browser storage keys and formats as before, so existing progress carries over. Calendar and backup files keep their formats, and old backups still import.
- **Deadlines.** Deadline handling is unchanged: Toronto time, the end-of-day rule for untimed CEN100 submissions, quiz weeks, pending dates and the same countdown wording.
- **Accessibility.** Reduced motion and **Pause motion** stop the animations, hold the 3D sections still, remove the pointer effect, and replace the loading intro and page transitions with an immediate change; mouse-wheel scrolling is still smoothed. Pinch zoom, text selection, keyboard scrolling and visible focus are supported, buttons and controls on phones have tap targets of at least 44 px, and course information, rules, grading and contacts are readable without JavaScript.
- **Privacy.** No analytics and no requests to other websites. Fonts and the 3D lighting environment are served from the website itself, and each page carries a Content Security Policy.
- **Appearance.** The new design uses a light appearance only; the Auto and Dark settings are not part of this version.
- **What's changed?** Each guide has a new entry for this release, and its unread badge shows until the notes are opened. The previous version keeps its own badge, so a student who uses both may see each badge again.
- **Verification.** The site's 65 data tests check deadline results against the previous version, including the 40 Toronto boundary cases across several time zones, and check that saved progress is read and written byte for byte as before. The existing 384 repository tests pass. Every page was checked at phone and desktop sizes for errors, failed requests, saved progress, search, menu and page transitions.

## October 12, 2026 — Night Shift foundation

Branch snapshot: `night-shift` at `f4c8342`. This records integrated foundation work. The [Stage 1b report](docs/qa/night-shift/stage1b.md) re-verifies the earlier router-review snapshots in Chromium; Safari/iOS review and the book stages remain pending.

- Added the editorial course layout, live deadline card, semester timeline and dock with course identity, Desk, countdown, section, Search and Pause motion controls.
- Made the site root the Desk directory, with three course links, saved-section summaries and the next deadline across courses. CEN100 lives at `/cen100/`; old CEN-specific root hashes forward once with their query and hash preserved. Generic root links stay on Desk. Existing progress keys are unchanged.
- Centralized Toronto deadline resolution and display states across the Desk and course deadline surfaces, including exact instants, date-only items, unresolved quiz weeks and pending dates. Lab-start countdowns retain their lab wording rather than claiming an exact quiz start.
- Applied the owner's end-of-day rule to dated CEN100 submissions without posted times: count down to the following Toronto midnight, display “Due by end of day” / “by 11:59 PM Toronto”, and keep the whole final minute open. Untimed in-class events remain date-only. Official course records were not changed.
- Integrated the persistent shell, route-module mount/unmount lifecycle and no-reload switching between Desk and the three course routes, with direct-load and normal-navigation fallbacks. The final review records fixes for stylesheet/history restoration, stale caches, route boot failures, deep links and the CEN100 WebGL-context leak.
- Added shared semester-week and page-bend logic for the future books. Toronto term-week labels remain separate from the book's clamped spread index; dated exam records can extend book spreads without inventing an official term week or final-exam date.
- Stopped loading the old animated backdrop and course-switch warp/wipe from Night Shift boot. Backdrop files and dormant wipe remnants remain for the separate cleanup task; they have not all been deleted.
- Added deadline boundary fixtures, corrected the cross-time-zone test adapter and applied the adopted countdown, empty-state and accessibility copy. See the [deadline results and correction](docs/qa/toronto-deadline-results.md) and [QA index](docs/qa/night-shift/README.md) for the exact checkpoints tested.

## October 12, 2026 — Math assessment updates

- Confirmed MTH140 Quiz 2 covers Chapter 3, Sections 3.1–3.5 and takes place in the second hour of the lab; Monday sections write on October 19 after Thanksgiving.
- Kept MTH141 midterm coverage and published dates while removing public question-type breakdowns and other assessment-format details. Official format stays on D2L.
- Updated quiz date handling, calendar export, course notes and assessment-data tests without changing student progress storage.

## October 12, 2026 — Subject headers and privacy

- Replaced the abstract chrome/glass headers with a working planetary gearbox, mint Calculus ribbons and tangent, and a matrix-transformed sphere and basis.
- Added direct mouse/touch rotation with inertial release, continuous idle motion, arrow-key rotation and Home reset. Preserved pause, reduced motion, offscreen sleep and GPU failure fallback.
- Added the folded-page vector logo and responsive subject framing with matching poster assets.
- Removed dormant analytics integration, served licensed Archivo fonts locally, blocked outbound reporting with Content Security Policy and suppressed referrers on external links.
- Replaced course-only staff names with role-based D2L contact guidance and added a visitor Privacy page. Section/group choices, rooms, deadlines and saved progress remain available.
- Refreshed README, architecture, source audit and release notes; updated all course unread-release versions.
- Verification: 48 Node tests and six course/motion workflow checks passed for the implementation. Subject-header browser visual review is documented separately from physical-device performance claims.

## October 11, 2026 — Workspace, study and motion

- Organized the shared layout into Assignments, Study for math, and Course info; aligned course widths and brought Search and Guide tools together above content.
- Added semester timelines and assignment detail sheets while retaining existing completion records, notes and checklist data.
- Simplified math experiments with focused button actions and optional exact values; added matrix operation composition and four Find the mistake examples per course.
- Added GSAP/Flip motion for courses, sections, sheets, search, tools, study and completion, with reduced-motion handling.
- Iterated through circuit/ribbon/lattice and abstract optical headers. The October 12 subject scenes supersede these designs.

## October 9, 2026 — Fewer taps

Visible search, weekly-work and contact shortcuts, and Mark done with Undo improved navigation and completion tracking.

## October 7, 2026 — Three-course guide

Added MTH140 and MTH141, independent saved sections/progress, shared appearance, assessment coverage, topic/practice references, section-aware schedules, calendars and backups. Added source/conflict notes and per-course unread release badges. Retained CEN100 requirements and direct assignment links.

Earlier CEN100 release history is retained in the root page's **What's changed?** panel. The repository was renamed to `tmu-course-guides`; the legacy `cen100-guide` site forwards links to the current guide.
