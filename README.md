# TMU Course Guides: CEN100, MTH140 and MTH141

One Fall 2026 course companion with a shared course switcher and light/dark appearance. CEN100 keeps its complete assignment guide at the site root. The two math guides focus on assessments, announced coverage, topic progression, recommended practice, and section-specific labs.

| Course | Open guide | Section support |
| --- | --- | --- |
| CEN100: Introduction to Engineering | [CEN100](https://jude27mad.github.io/tmu-course-guides/) | All 39 sections and 52 Innovation Challenge groups |
| MTH140: Calculus I | [MTH140](https://jude27mad.github.io/tmu-course-guides/mth140/) | All 34 sections, instructors, TAs and lab rooms |
| MTH141: Linear Algebra | [MTH141](https://jude27mad.github.io/tmu-course-guides/mth141/) | All 34 sections, instructors, Academic Assistants and lab rooms |

## Visual overhaul — October 11, 2026

Full-width graphite scenes use the original salmon, mint and lavender colours. Engineering has a layered circuit with deadline-driven signals; Calculus I has a flowing metallic ribbon; Linear Algebra has a kinetic solid cube cluster that separates and reassembles. These headers are abstract course artwork; exact teaching diagrams remain in the study studio. Pointer and section changes move the camera. The same mathematical geometry also drives an animated Canvas2D fallback.

GSAP timelines and Flip coordinate section changes, assignment sheets, study expansion, search, tools, disclosure panels and completion reordering. Native scrolling remains. The header pause button pauses the scene independently of interface transitions. Device reduced motion is respected by default; opening a link with `?motion=full` explicitly selects and remembers full motion. Offscreen and hidden scenes stop rendering. Course dates, saved records and study interactions are preserved.

See [the rendering and motion notes](docs/visual-overhaul.md) for build commands, verification and the physical-device evidence boundary.

The legacy `/cen100-guide/` site is a forwarding-only repository; edit the course content in `tmu-course-guides`. Paths, query strings and assignment hashes are retained on forwarding.

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
- **Next assessment** and an assessment-weight strip replace the team/individual split. Each math guide has **Assessments**, **Topic map**, and **Rules & help** views.
- **Section-aware quiz dates:** official quiz weeks combine with the selected lab timetable. These calculated days are labelled as timetable-derived; quiz start times are not invented. Monday MTH140 sections see a confirmation warning for Thanksgiving week.
- **Announced coverage:** MTH141 Quiz 1, Quiz 2 and October 16 midterm, plus MTH140 Quiz 1. Unprovided future scopes and final dates are marked pending.
- **Eight topic blocks per course**, in outline order, with self-reported skill-review checks and all 77 recommended-practice rows across the two math courses. The MTH141 textbook-edition mismatch is visible beside the free textbook links.
- **Preparation and completion** are separate. Each assessment has a preparation checklist, completion record, private notes, a personal study target, and a shareable link.
- **Calendar export** includes published midterm times and optionally tentative all-day lab dates. It excludes unknown finals and unresolved Thanksgiving dates. Calendar imports do not update automatically.
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

**Assessments** contains quiz, midterm, and final cards. Preparation checks do not mark an assessment completed; use **My plan & completion** for your own completion record, notes, and study target. **Topic map** follows the outline order and provides skill-review prompts and official exercise references. **Rules & help** contains assessment policies, selected-section contacts, free textbook links, pending details, and source checks.

Math calendars include the published midterm by default. Including section lab dates is optional and produces tentative all-day quiz entries. Math progress backups include topic checks and only import into the matching course. Section choices, theme, and unread-update preferences are not included in a progress backup.

Dates and requirements were reviewed October 7, 2026 against official supplied course files and announcements. See [the math source audit](docs/math-source-audit.md) for sources, conflicts, derived dates and maintenance instructions.

The public site summarizes course requirements and lists exercise references. It does not publish uploaded PDFs, announcement screenshots, sample exams or restricted solutions. Contact details stay on D2L.

No build step is required. For local preview, serve the repository over HTTP, for example `python3 -m http.server 8765`. Run `node --test tests/schedule.test.mjs` to verify the math deadline and calendar logic. `assets/course-data.mjs` is the authoritative math dataset; both pages render from it.

## CEN100 guide

A course companion for **CEN100: Introduction to Engineering**, Fall 2026, at Toronto Metropolitan University. The guide brings deadlines, assignment requirements, checklists, course clarifications, and section/group contacts into one responsive page.

**[Open the guide](https://jude27mad.github.io/tmu-course-guides/)**

### What's included

- **Team, Individual + pairs, and Rules tabs** with expandable assignment cards. Team contains full/sub-team work (42%); Individual + pairs contains individual work (48%) and MATLAB pair work (10%). The shared notebook is under Team, and peer evaluation is under Individual + pairs.
- **Complete course grading breakdown** under Guide tools, listing all 20 graded items and totalling 100%, with a separate explanation of the official 41% Innovation Challenge Project category and the 52% of course marks for work normally completed in teams or pairs. See the grading table below.
- **Requirement previews** on closed assignment cards and visible opening cues on upcoming deadlines.
- **Deadline tracking** shared by the upcoming-deadline banner, assignment date displays, work planner, and calendar exports. Tap a banner deadline to open its assignment. The banner skips dates marked submitted/completed while retaining later unrecorded deadlines.
- **Section and group selection** at the top of the page, covering all 39 sections and 52 Innovation Challenge groups in the staffing sheet.
- **Who to ask** results showing the assigned GA, lab/location, and Project Manager.
- **Checklists and separate completion records** for tracking preparation and recording submitted or completed work.
- **What should I work on?** with Next 7 days and All unfinished views.
- **Private notes and personal target dates** inside each assignment card.
- **Direct assignment links** that open the appropriate tab and expanded card.
- **Search, checklist filtering, and source notes** for finding and checking requirements.
- **What’s changed** at the bottom of the page, with a New updates indicator for unread releases.
- **Calendar exports and progress backups** for use outside the current browser.
- **Rose deadline highlights and shared Auto/Dark/Light appearance**. Auto follows the device setting. The Rules tab’s **Still open** icons keep their original yellow, independently of the rose accent.
- **Separate colour preview** for comparing eight accents against dark navy or light backgrounds without changing the main guide.
- **Private usage reporting** through Cloudflare Web Analytics, with a separate daily archive for saved all-time, monthly, and yearly totals.

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
2. Select **Team**, **Individual + pairs**, or **Rules**. Open an assignment card to review its requirements, checklist, source notes, and tools.
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

Tutorial timing is identified by section where confirmed. Other sections are directed to D2L rather than assigned an assumed schedule. Reflection instructions show the selected group's Project Manager when available.

The staffing document supplies section/group mappings, names, and lab locations only. **GA and Project Manager email addresses are not published or stored in the page's source code.** For contact details, check D2L or the official Section GAs and PMs document.

This guide is an unofficial planning aid. Current official assignment instructions and course-team announcements remain the authority for requirements, submission methods, and deadlines.

## Usage analytics and privacy

Cloudflare Web Analytics was added to CEN100 on **September 28, 2026** and to both math guides on **October 7, 2026**. The beacon is currently disabled on all three course pages and remains disabled in this visual release. The historical information below describes the previous integration; this release does not enable measurement. There is no public visitor counter.

Cloudflare measures page views, visits, and page performance, with breakdowns such as country, browser, device type, and referrer. It [states that its analytics does not use cookies, local storage, or fingerprinting to track individuals](https://blog.cloudflare.com/privacy-first-web-analytics/). The guide uses local storage separately to save your progress; it does not send your selected section/group, checklist ticks, completion records, notes, or target dates to analytics. The beacon still sends measurement requests to Cloudflare, so this is not a claim that no data leaves the browser.

Visits are **not unique people**: repeat visits and the maintainer’s visits can count. Blockers and network failures can leave visits unrecorded, and sampling can make totals estimates. See Cloudflare’s [metric definitions](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/), [reported dimensions](https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/), and [collection limits](https://developers.cloudflare.com/web-analytics/faq/).

### Long-term aggregate archive

A separate private repository archives daily totals for the installed beacon and `jude27mad.github.io`, starting **September 28, 2026**. The first scheduled collection of a completed day succeeded on **September 29, 2026**.

- Uses **America/Toronto** calendar days and excludes the current incomplete day.
- Saves daily page views and visits, sampling information, and collection timestamps; it does not archive individual visitor records or students’ saved progress.
- Provides saved all-time, monthly, and yearly totals, downloadable CSV/JSON files, and version history. All-time means the days successfully saved since installation; earlier traffic cannot be recovered.
- Runs daily through GitHub Actions. Repeated runs replace a day’s totals rather than adding duplicates. Recent days are refreshed, and missing days are retried while available from Cloudflare. Failed or empty responses preserve saved totals, and unverified days remain visible as gaps.
- Keeps the read-only API credentials in encrypted Actions secrets in the private repository. A separate daily health check alerts the maintainer to failed or stale collection and missing/unverified days.

Saved history has no automatic expiry in the archive. Continued collection depends on the scheduled workflow, credentials, and services remaining available; Cloudflare’s own history window is separate from these saved files.

## Files and hosting

| File | Purpose |
| --- | --- |
| `index.html` | CEN100 content, styles, JavaScript, course data, contact mappings, and full release history. |
| `mth140/index.html`, `mth141/index.html` | Math page structures and course-specific release notes. |
| `assets/hub.js`, `assets/hub.css` | Shared course navigation, saved-section labels, and appearance control. |
| `assets/course-data.mjs` | Math assessments, section timetables, instructors, topics, practice references, and sources. |
| `assets/schedule.mjs` | Math date resolution, Toronto time handling, upcoming assessments, and calendar exports. |
| `assets/math-guide.mjs`, `assets/math.css` | Math rendering, progress, guide tools, unread-update handling, and responsive design. |
| `docs/math-source-audit.md` | Math source audit, conflicts, unknowns, and date derivation rules. |
| `tests/schedule.test.mjs` | Section, deadline, timezone, calendar, and source-data checks. |
| `README.md` | Three-course features, release notes, usage, data handling, and maintenance documentation. |
| `colour-preview.html` | Separate palette comparison page with shareable colour selections and temporary progress. |

The guide uses plain HTML, CSS, and JavaScript. No installation, package manager, build step, or application backend is required to serve it. Archivo is loaded through Google Fonts, with system-font fallbacks. The prebuilt rendering and interaction bundles are checked in; rebuilding them is optional for serving the site. The historical analytics archive is separate from this public site; the public beacon remains disabled.

GitHub Pages serves the **main** branch from **/(root)** using **Deploy from a branch**. To preview all three courses locally, clone or download this repository and serve it over HTTP.

### Maintaining course information

Update CEN100 in `index.html` and math course information in `assets/course-data.mjs`. Verify new dates and coverage against official course documents or announcements, retain source notes, and keep unresolved details labelled pending. Keep CEN100’s short `preview` text consistent with the full requirements; math previews render from each assessment’s `scope`. For math source changes, update `docs/math-source-audit.md`.

Update the relevant course's **What's changed?** entry and release version when publishing a release so returning visitors see the unread badge. CEN100's version lives in `index.html`; the math version lives in `assets/math-guide.mjs`. Run `node --test tests/schedule.test.mjs` for math date/data changes, preview affected pages over HTTP, and check the GitHub Pages deployment after publishing to `main`.

