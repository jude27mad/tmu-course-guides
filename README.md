# TMU Course Guides: CEN100, MTH140 and MTH141

One Fall 2026 course companion with a shared course switcher and light/dark appearance. The site root is the Desk, a directory of all three guides; CEN100's complete assignment guide lives at `/cen100/`. The two math guides focus on assessments, announced coverage, topic progression, recommended practice, and section-specific labs.

| Course | Open guide | Section support |
| --- | --- | --- |
| CEN100: Introduction to Engineering | [CEN100](https://jude27mad.github.io/tmu-course-guides/cen100/) | All 39 sections and 52 Innovation Challenge groups |
| MTH140: Calculus I | [MTH140](https://jude27mad.github.io/tmu-course-guides/mth140/) | All 34 sections, lab timetables and rooms |
| MTH141: Linear Algebra | [MTH141](https://jude27mad.github.io/tmu-course-guides/mth141/) | All 34 sections, lab timetables and rooms |

## Current release — October 12, 2026

Subject-specific 3D headers replace the earlier abstract chrome/glass artwork. **Engineering** shows a working planetary gearbox; **Calculus I** shows flowing mint function ribbons with an analytic tangent; **Linear Algebra** transforms a sphere and its basis with actual matrix maps, including a planar projection. A folded-page vector mark replaces the Sigma logo.

The scenes move continuously when motion is enabled. Drag with a mouse or touch to rotate, then release for inertia. Focus the artwork and use arrow keys to rotate or Home to reset. Pause and reduced-motion preferences are supported; paused artwork allows normal page scrolling. Offscreen and hidden scenes stop rendering, with matching posters when WebGL2 is unavailable.

GSAP and Flip coordinate course and section changes, assignment sheets, search, guide tools, study expansion and completion. The shared responsive layout keeps the original salmon, mint and lavender course colours. Assignments, Study (math courses) and Course info organize the workspace; Search and Guide tools sit together above the content. Study experiments use focused button actions, optional exact values, matrix composition and Find the mistake exercises.

Privacy changes remove dormant analytics code and course-only staff names, serve Archivo fonts locally with their license, suppress external-link referrers and block outbound reporting with Content Security Policy. Progress and notes remain in browser storage. See [Privacy](privacy.html).

Documentation: [header artwork and verification](docs/visual-overhaul.md), [motion architecture](docs/immersive-motion.md), [math studio](docs/math-studio.md), [privacy review](docs/privacy-audit.md), and [release history](CHANGELOG.md).

The legacy `/cen100-guide/` site is a forwarding-only repository; edit the course content in `tmu-course-guides`. Paths, query strings and assignment hashes are retained on forwarding. Old root CEN100 links that carry a CEN100 hash (for example `#assignment-y4`) forward once from the Desk to `/cen100/` with the whole query and hash; see `assets/legacy-route.js` and `docs/qa/night-shift/forwarder.md`.

## Getting started

1. Choose **CEN100**, **MTH140**, or **MTH141** in the course bar. Each course remembers its own section and progress.
2. Select your section at the top. CEN100 also asks for your Innovation Challenge group; the math guides use the section's lab timetable.
3. Scan the short requirement or coverage preview on each card. Tap **View requirements** or an upcoming deadline to open its assignment or assessment, including dates, coverage, preparation, notes, and completion records. Math guides also have a **Topic map** for skills and recommended practice.
4. Search above the tabs, or tap **This week's work**, **Contacts**, or **D2L**. Use **Mark done** on the next deadline to save that one completion record; **Undo** restores it. **Guide tools** beside Search opens grading, calendars, and backups in Course info. **What's changed?** sits immediately above the footer on every course page. Opening it clears that course's unread-update badge.
5. Use **Auto theme**, **Dark theme**, or **Light theme** in the shared header. This appearance choice applies across all three courses.

## What's changed — October 9, 2026

Visible search, one-tap weekly work and contacts, and **Mark done** with **Undo** reduce menu opening across all three courses. Math search results open the correct assessment or topic tab. Guide tools sit below the cards, math grading is collapsed inside them, and CEN100 tab introductions are shorter. Saved progress keys and course dates are unchanged.

## What's changed — October 7, 2026

| Area | Update |
| --- | --- |
| Card previews and opening cues | Added short requirement previews to CEN100 cards and coverage previews to both math guides. Upcoming deadlines have opening arrows; the next deadline has a View requirements cue. |
| Visual polish | Kept the existing layout, with clearer text hierarchy, softer borders and badges, consistent spacing, and gentle card-opening transitions that respect reduced motion. |
| Three-course navigation | Added MTH140 and MTH141 alongside the original CEN100 URL, with separate saved sections and progress and a shared appearance setting. |
| Math assessment guides | Added all 68 math section mappings, quiz weeks, published midterm dates, grading weights, announced coverage, assessment rules, and source notes. |
| Study and planning | Added 16 topic blocks, 77 recommended-practice rows, skill checks, preparation lists, completion records, private notes, personal study targets, direct assessment links, search, calendars, and course-specific backups. |
| Visual design | Added cyan curve/tangent graphics for Calculus I and violet vector-transformation graphics for Linear Algebra. Math pages use assessment dashboards and grading bars. |
| Date and source checks | Clearly labelled timetable-derived quiz dates, unresolved Thanksgiving arrangements, unannounced coverage and finals, conflicting MTH140 quiz-drop wording, and the MTH141 textbook-edition mismatch. |
| Documentation and release notes | Reorganized this README for all three courses, expanded the CEN100 release entry, and added What's changed with unread badges to both math pages. |
| Verification | Checked desktop and phone layouts, enlarged text, keyboard opening, reduced motion, course and section switching, saved progress, backups, calendars, and existing CEN100 records and assignment links. |

## Math guides

- **Coverage previews** on closed assessment cards, plus **View requirements** and arrows on upcoming assessments, make it easier to scan and open the right details.
- **Next assessment** and an assessment-weight strip replace the team/individual split. Each math guide has **Assignments**, **Study**, and **Course info** views.
- **Section-aware quiz dates:** official quiz weeks combine with the selected lab timetable. These calculated days are labelled as timetable-derived, except the confirmed Monday MTH140 Quiz 2 make-up on October 19. Quiz start times are not inferred when unannounced.
- **Announced coverage:** MTH141 Quiz 1, Quiz 2 and October 16 midterm, plus MTH140 Quiz 1 and Quiz 2 (Chapter 3, Sections 3.1–3.5). Unprovided future scopes and final dates are marked pending. Public pages omit assessment question-type breakdowns.
- **Eight topic blocks per course**, in outline order, with self-reported skill-review checks and all 77 recommended-practice rows across the two math courses. The MTH141 textbook-edition mismatch is visible beside the free textbook links.
- **Preparation and completion** are separate. Each assessment has a preparation checklist, completion record, private notes, a personal study target, and a shareable link.
- **Calendar export** includes published midterm times and optionally tentative all-day lab dates. It excludes unknown finals and uses the confirmed October 19 Monday make-up for MTH140 Quiz 2. Calendar imports do not update automatically.
- **Search, unfinished-work planning, backups and restore** follow the same approach as CEN100. Math backups are course-specific and include topic checks; conflicting existing notes and targets survive import.
- **Independent saved sections and progress** across all three courses; one shared appearance setting. Existing CEN100 local data and direct assignment links continue to work.
- **Distinct mathematics visuals:** a curve and tangent for Calculus I, vector transformation geometry for Linear Algebra, with cyan and violet course accents.
- **What's changed** above each math footer, with an unread-update indicator saved independently for each course.

### Math grading

| Course | Lab quizzes | Midterm | Final |
| --- | --- | --- | --- |
| MTH140 | 15%; four quizzes, lowest dropped | 40%; October 23, 6:30–8:30 PM | 45%; December, exact schedule pending |
| MTH141 | 20%; five quizzes, lowest dropped | 35%; October 16, 6:30–8:30 PM | 45%; December, exact schedule pending |

All times are Toronto time. Each course requires at least 50% overall to pass. Quiz dates depend on the selected lab section; the guide distinguishes announced weeks from timetable-derived days.

### Using the math guides

**Assignments** contains quiz, midterm, and final cards. Preparation checks do not mark an assessment completed; use **My plan & completion** for your own completion record, notes, and study target. **Study** includes the topic map, which follows the outline order and provides skill-review prompts and official exercise references. **Course info** contains assessment policies, selected-section contacts, free textbook links, pending details, and source checks.

Math calendars include the published midterm by default. Including section lab dates is optional and produces tentative all-day quiz entries. Math progress backups include topic checks and only import into the matching course. Section choices, theme, and unread-update preferences are not included in a progress backup.

Dates and requirements were reviewed October 12, 2026 against supplied official course files and announcements. See [the math source audit](docs/math-source-audit.md) for sources, conflicts, derived dates and maintenance instructions.

The public site summarizes course requirements and lists exercise references. It does not publish uploaded PDFs, announcement screenshots, sample exams or restricted solutions. Contact details stay on D2L.

No build step is required. For local preview, serve the repository over HTTP, for example `python3 -m http.server 8765`. Run `node --test tests/schedule.test.mjs` to verify the math deadline and calendar logic. `assets/course-data.mjs` is the authoritative math dataset; both pages render from it.

## CEN100 guide

A course companion for **CEN100: Introduction to Engineering**, Fall 2026, at Toronto Metropolitan University. The guide brings deadlines, assignment requirements, checklists, course clarifications, and section/group contacts into one responsive page.

**[Open the guide](https://jude27mad.github.io/tmu-course-guides/cen100/)**

### What's included

- **Assignments and Course info navigation** with assignment detail sheets. Team work contains full/sub-team work (42%); Individual + pairs contains individual work (48%) and MATLAB pair work (10%). The shared notebook is under Team, and peer evaluation is under Individual + pairs.
- **Complete course grading breakdown** under Guide tools, listing all 20 graded items and totalling 100%, with a separate explanation of the official 41% Innovation Challenge Project category and the 52% of course marks for work normally completed in teams or pairs. See the grading table below.
- **Requirement previews** on closed assignment cards and visible opening cues on upcoming deadlines.
- **Deadline tracking** shared by the upcoming-deadline banner, assignment date displays, work planner, and calendar exports. Tap a banner deadline to open its assignment. The banner skips dates marked submitted/completed while retaining later unrecorded deadlines.
- **Section and group selection** at the top of the page, covering all 39 sections and 52 Innovation Challenge groups in the staffing sheet.
- **Who to ask** guidance showing roles, lab/location and D2L references for current staff contacts.
- **Checklists and separate completion records** for tracking preparation and recording submitted or completed work.
- **What should I work on?** with Next 7 days and All unfinished views.
- **Private notes and personal target dates** inside each assignment card.
- **Direct assignment links** that open the appropriate tab and expanded card.
- **Search, checklist filtering, and source notes** for finding and checking requirements.
- **What’s changed** at the bottom of the page, with a New updates indicator for unread releases.
- **Calendar exports and progress backups** for use outside the current browser.
- **Rose deadline highlights and shared Auto/Dark/Light appearance**. Auto follows the device setting. The Rules tab’s **Still open** icons keep their original yellow, independently of the rose accent.
- **Separate colour preview** for comparing eight accents against dark navy or light backgrounds without changing the main guide.
- **Local progress storage** with no active analytics, tracking cookies or session recording.

### Grading: course category and working arrangements

Based on the **CEN100 Course Outline F26**, page 9 for assessment weights and pages 10–11 for working arrangements and the shared notebook:

| Grouping | Included assessments | Course grade |
| --- | --- | ---: |
| Official Innovation Challenge Project category | M1–M8, including the individual Peer Evaluation (3%) | **41%** |
| Shared project deliverables | M1–M7: 2% + 4% + 6% + 8% + 4% + 6% + 8% | **38%** |
| All full/sub-team work | M1–M7 (38%) + shared Team Design Notebook (4%) | **42%** |
| All team/pair work | Full/sub-team work (42%) + MATLAB assignments (10%) | **52%** |
| Individual work | Orientation/policy items (12%) + participation (5%) + reflections (4%) + peer evaluation (3%) + final exam (24%) | **48%** |

The first four rows overlap; they are not separate amounts to add together. The working-arrangement split is **42% full/sub-team + 10% MATLAB pairs + 48% individual = 100%**. These are calculated grade-weight subtotals, not percentages of time or workload.

Peer Evaluation is individual even though it belongs to the official project category. The notebook is shared even though it sits outside that category. Personal Reflections are individual and also outside the project category. Shared work still requires documented individual contributions.

MATLAB is normally completed in pairs. The confirmed exception for an odd-sized class allows the unpaired student to work solo or join a group of three; 52% describes the normal team/pair arrangement.

The **Team** tab contains 42%. **Individual + pairs** contains the remaining 58%: 48% individual and 10% MATLAB. These navigation totals do not change any assessment weight or redefine the official project category. The September 30 clarification updates these labels, the grading explanation, and the change history while retaining all 20 assessment weights.

### Using CEN100

1. Optionally choose a section and Innovation Challenge group below the main heading. Group choices are filtered by section, and selections save immediately. The page heading follows the selection, with a neutral course label before selection. The selected section’s lab location appears beside the section and group at the top. Use **Done** to collapse the picker or **View contacts** to open Who to ask.
2. Open **Assignments** for requirements, checklists, source notes and completion records, or **Course info** for rules and support.
3. Open **Guide tools** for the complete course grading breakdown, search, Hide fully checked items, the work planner, calendar exports, and backups. Find **What’s changed** at the bottom of the page, just above the footer.
4. Returning visits restore the saved section/group selection. Use **Change** at the top or **Change section/group** in Who to ask to edit it.

### Colour preview

Open the [colour preview](https://jude27mad.github.io/tmu-course-guides/colour-preview.html) to switch between dark navy and light backgrounds and compare Gold, Coral, Peach, Violet, Rose, Mint, Blue, and Silver accents on the guide’s existing layout. **Copy this look** shares the selected background and accent; reopening the link restores that combination. **Reset preview** returns to dark navy and the original gold accent.

Colour choices affect only the preview. Its course progress and section/group choices are temporary and reset on reload; it does not read or change the main guide’s saved progress. The preview is a separate snapshot, so use the main guide for current course information. The main guide uses the selected rose accent and the shared Auto/Dark/Light appearance control.

### Progress and personal planning

Checklist ticks track preparation. A **Date passed** badge describes the calendar date; it does not indicate completion or a grade.

Each card's **My plan & completion** section contains separate submission/completion records, a notes field, and an optional personal target date. Assignments with multiple deadlines have separate records for each occurrence. Closed cards show partial progress such as **1 of 2 recorded**, or **Submitted**, **Emailed**, or **Completed** when all records are marked. These records are entered manually; the guide does not submit assignments or verify submission on D2L. Marking a record updates the upcoming-deadline banner immediately; clearing it restores the date if it is still upcoming. Checklist ticks alone do not remove banner deadlines.

**What should I work on?** uses those completion records. Next 7 days includes upcoming unrecorded deadlines and personal targets from today through the following six days. All unfinished also includes past dates with no completion recorded and work with an unconfirmed date. Each result shows remaining checklist items and opens its assignment card.

Personal target dates do not change official deadlines. Notes are saved on the current device and are not shared with a team. **Clear my ticks** clears checklist ticks only; completion records, notes, and target dates remain saved.

### Sharing an assignment

Choose **Copy assignment link** inside a card. The link opens that assignment's tab and expands its card. Links do not contain saved section/group choices, checklist progress, completion records, notes, or personal target dates. If clipboard access is unavailable, the guide displays a link to copy manually.

### Calendar exports

Use **Add to calendar** inside a card or **Guide tools → Add deadlines to my calendar**. Select one assignment or all confirmed deadlines, choose whether to include only upcoming dates, and select a reminder of one day, two days, or none.

Download the `.ics` file and open it in Apple Calendar or import it into Google Calendar. Confirmed times use **America/Toronto**, including daylight-saving changes. Dates without a confirmed time are all-day entries, with reminders at 9 AM on the selected prior day.

Calendar exports exclude approximate dates, section-specific lab activity reminders, and the unscheduled final exam. Imported calendars do not update automatically. Check D2L for changes and review the calendar application's alert settings.

### Backups and local storage

Use **Guide tools → Move or back up my progress → Export my progress** to download a `.json` backup. Import it through the same panel on another device.

- Current backups include checklist ticks, completion records, private notes, and personal target dates.
- Older checklist-only backups still import.
- Importing adds checked items and completion records, and fills empty notes or target dates. Existing conflicting notes or target dates are retained and reported.
- Section/group choices and interface preferences are not included in backups.

Progress, selections, notes, targets, and preferences are stored in browser local storage. There are no accounts or automatic synchronization between browsers or devices. Clearing browser data may remove locally saved information.

### Sources and contact privacy

The guide uses Fall 2026 CEN100 documents on D2L and confirmed course-team clarifications. Source notes distinguish course-outline information, assignment summaries, and confirmed clarifications. Resolved guidance appears under **Confirmed**; unanswered questions remain under **Still open**.

Personal Reflections are emailed directly to the assigned Project Manager; there is no D2L submission box. MATLAB assignments are normally completed in pairs; when a class has an odd number of students, the unpaired student may work solo or join a group of three. FMEA “Environmental” remains under Still open, awaiting official clarification from the Head GA.

WHMIS is due October 14, with at least 80% on all three quizzes and a generated certificate. The Academic Integrity Quiz is due October 14 at 3 PM and allows ten attempts.

Tutorial timing is identified by section where confirmed. Other sections are directed to D2L rather than assigned an assumed schedule. Reflection instructions identify the selected group; the current Project Manager name is obtained from D2L.

The public guide retains section/group numbers and teaching-room information. Personal names and contact details from course-only staffing documents are omitted. For current GA, Project Manager, instructor, and assistant names, use D2L.

This guide is an unofficial planning aid. Current official assignment instructions and course-team announcements remain the authority for requirements, submission methods, and deadlines.

## Privacy

The current site contains no analytics SDK, beacon, tracking cookie or session recorder. Browser Content Security Policy blocks outbound reporting. Fonts, scripts and artwork are served with the site; external links do not receive a referrer.

Section/group choices, checklists, notes, target dates and appearance preferences stay in browser local storage. Backups are created locally only when exported; keep them private because they contain notes and progress. There are no accounts or automatic device synchronization.

The public pages omit personal credits and names from course-only staff rosters. Current staff contacts are available through D2L.

GitHub Pages logs visitor IP addresses for hosting security. See [GitHub’s hosting documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection) and the visitor-facing [Privacy page](privacy.html). Historical aggregate analytics collected before the pause remain in a separate private archive; this release collects no new analytics.

## Files and hosting

| File | Purpose |
| --- | --- |
| `index.html` | The Desk: the site root and course directory. `assets/legacy-route.js` forwards old root CEN100 links to `cen100/`. |
| `cen100/index.html` | CEN100 content, styles, JavaScript, contact mappings, and full release history. |
| `assets/cen-schedule.js`, `assets/cen-schedule.mjs` | The one copy of the CEN100 schedule records, for the CEN guide's inline script (`window.CEN_SCHEDULE`) and for ES modules. |
| `assets/night/targets.mjs` | Data-level next-deadline resolver shared by the course card, dock, hero line and the Desk: the CEN100 and math rules over the unchanged records, read-only saved-state readers, and shared countdown formatting. |
| `assets/night/desk.mjs`, `assets/night/desk.css` | The Desk directory: per-course and overall next deadlines without loading a course page. `[data-desk-stage]` is the empty mount point for the later 3D desk. |
| `tests/targets.test.mjs` | Frozen-clock deadline fixtures, including a case-for-case comparison with the CEN100 guide's own rules. |
| `mth140/index.html`, `mth141/index.html` | Math page structures and course-specific release notes. |
| `assets/hub.js`, `assets/hub.css` | Shared course navigation, saved-section labels, and appearance control. |
| `assets/course-data.mjs` | Math assessments, section timetables, role-based contact guidance, topics, practice references, and sources. |
| `assets/schedule.mjs` | Math date resolution, Toronto time handling, upcoming assessments, and calendar exports. |
| `assets/math-guide.mjs`, `assets/math.css` | Math rendering, progress, guide tools, unread-update handling, and responsive design. |
| `docs/math-source-audit.md` | Math source audit, conflicts, unknowns, and date derivation rules. |
| `tests/schedule.test.mjs` | Section, deadline, timezone, calendar, and source-data checks. |
| `assets/course-header.mjs`, `assets/course-scene.mjs`, `assets/scenes/` | Responsive subject artwork, WebGL2 lifecycle, drag interaction and fallback posters. |
| `assets/guide-motion.mjs`, `assets/vendor/` | Interface motion and self-hosted rendering/animation dependencies. |
| `assets/fonts/`, `privacy.html` | Licensed local fonts and visitor privacy information. |
| `CHANGELOG.md`, `docs/` | Release history, architecture, source audits and verification boundaries. |
| `README.md` | Three-course features, release notes, usage, data handling, and maintenance documentation. |
| `colour-preview.html` | Separate palette comparison page with shareable colour selections and temporary progress. |

The guide uses plain HTML, CSS, and JavaScript. No installation, package manager, build step, or application backend is required to serve it. Archivo is self-hosted under its SIL Open Font License, with system-font fallbacks; loading a page does not request fonts from Google. The prebuilt rendering and interaction bundles are checked in; rebuilding them is optional for serving the site. The historical analytics archive is separate from this public site; the public beacon remains disabled.

GitHub Pages serves the **main** branch from **/(root)** using **Deploy from a branch**. To preview all three courses locally, clone or download this repository and serve it over HTTP, for example with `node tools/preview-server.mjs --port 4173`. Add `--base /tmu-course-guides/` to reproduce the Pages project path.

### Maintaining course information

Update CEN100 in `cen100/index.html` (its dated schedule records are in `assets/cen-schedule.js`) and math course information in `assets/course-data.mjs`. Verify new dates and coverage against official course documents or announcements, retain source notes, and keep unresolved details labelled pending. Keep CEN100’s short `preview` text consistent with the full requirements; math previews render from each assessment’s `scope`. For math source changes, update `docs/math-source-audit.md`.

Update the relevant course's **What's changed?** entry and release version when publishing a release so returning visitors see the unread badge. CEN100's version lives in `cen100/index.html`; the math version lives in `assets/math-guide.mjs`. Run `node --test tests/schedule.test.mjs` for math date/data changes, preview affected pages over HTTP, and check the GitHub Pages deployment after publishing to `main`.

