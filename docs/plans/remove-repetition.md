# Remove the repetition, then add only the components that bring something new

> **Superseded for course layout (2026-10-23):** The owner authorized [shorter focused course views](2026-10-23-shorter-course-views.md). That brief replaces the long-scroll/pinned layout, side-by-side Work calendar, and staged approval/integration ownership below. Data, date precision and preservation requirements still apply.
>
> **Historical status:** plan only, saved on 2026-10-19 from a full read of `origin/main` (`e1f8be4`). No stage has started. Each stage needs the owner's go-ahead.
>
> **Codex tasks:** the code-only parts are briefed in [docs/codex/remove-repetition/](../codex/remove-repetition/README.md) (R1–R5).

---

## Context

**What the site is.** An immersive website built on the Giats portfolio design, used on phones, iPads, laptops and desktops. Scrolling is part of the experience; the aim is not a shorter page or a productivity dashboard.

**The goal.**
- Remove repeated content and photography.
- Make text readable at every width.
- Add only the features the site genuinely lacks.

**What a full read of `origin/main` (`e1f8be4`, checked again on 2026-10-19) showed:**
- MTH140 "Lab Quiz 2" appears in about 13 places: next tile, deadline row, deadline details, hover popup, checklist, grading table, card head, card body, work tile, footer, menu, next-course card, Desk, and search.
- Each assignment's checklist is rendered twice.
- "Mark done" appears in 5 places.
- The next deadline appears 7 ways on the Desk.
- The same course photo appears 4 + N times on each course page.

### Decisions this plan keeps

- **One complete assignment view:** requirements, checklist, completion records, notes and targets together, shown once.
- **Photos:** one hero photo per course. The Desk "Next up" keeps its single photo.
- **Calendar:** one Schedule-X calendar beside the assignment list.
- **Course information and help:** a Radix Accordion.
- **Unchanged:** the existing pinned windows and scroll behaviour; saved progress and its storage keys; grading; deadline calculations.
- **Desk:** keeps "Next up" and the lanyard badges. The stacked course cards stay only on `/courses/`.
- **Not used:** Aceternity Expandable Cards, Aceternity Timeline or Kibo List.
- **Not reused:** the abandoned custom MTH140 window prototype (branch `origin/codex/mth140-window-preview`, 2026-10-19) must not be merged, cherry-picked or copied.

### Corrections to the earlier reasoning

- **Aceternity.** The Aceternity UI licence (ui.aceternity.com/licence, read 2026-10-19) allows use in end products but forbids redistributing the component source. Whether committing that source to this public repository counts as redistribution was not settled. These components are dropped mainly because they duplicate features that already exist: cards that expand, and a list of later items.
- **Kibo List.** It is dropped because it duplicates the existing checkbox ticks. Its touch behaviour was not tested. Reading its source shows it passes no dnd-kit sensors and sets no `touch-action`, so touch dragging would need testing before any claim either way.
- **SCSS, not Tailwind.** SCSS is preferred because it fits the site with no extra setup. Tailwind is not inherently incompatible. The global reset (`styles/reset.scss`, an unlayered `all: unset`) would need to move into a cascade layer for Tailwind v4 utilities to apply. That is avoidable work, not a blocker.

---

## A. Confirmed by repository inspection (origin/main `e1f8be4`)

**Course page structure**
- Section order is in `pages/[course].page.jsx:72-90`: Hero, CourseDetails with CourseTiles, Deadlines, Checklist, Assessments, ItemCards, CourseInfo, GuideTools, NextCourse.
- Footer and PreFooter come from `components/dom/Layout.jsx:216-219`.

**Photos**
- `CourseArtwork` is rendered in `hero/Hero.jsx:57`, in `deadlines/Deadlines.jsx` (three windows, `:167-182`; on phones one per bucket at `:195-199`), and in `checklist/Checklist.jsx` (one per entry).
- On phones each copy is 79vw tall (`deadlines.module.scss:108`, `checklist.module.scss:108`). The hero is 93svh.

**Typography**
- Phone sizes are set under `@include mobile`, which applies below 812px (`styles/variables.scss:2`).
- Above 812px every size is plain `vw` with no minimum (`styles/fontStyle.scss`): `.p-l` 1.15vw, `.p` 0.95vw, `.p-x` 0.85vw, `.p-xs` 0.75vw, `.h6` 1.5vw.
- At 813px that makes body text about 9.3px and small text about 6.9px. At 1024px they are about 11.8px and 8.7px.

**Week grouping**
- `buckets()` (`lib/deadlines.mjs:270-286`) groups items by date only.
- A missed deadline dated earlier this week therefore lands in This week, not in `earlier`.
- Undated items go to `later`.
- `earlier` is calculated but never shown.

**Overdue and done**
- CEN: `overdue = passed && !done && !reminder` (`lib/deadlines.mjs:145`).
- Math: `overdue = passed && !done` (around `:231`).
- `markable` comes from `CEN.completionKeys` (`:142`).
- Reminders (`calendar:false` rows) retire only once every dated row of the item is recorded (`:105-116`).

**CEN items with several deadline rows**
- `y1` has 4 rows; `y2`, `y5`, `y6` and `m6` have 2 each.
- `failure-lab` is a Section 29 reminder only: rows are filtered by `row.section` at `lib/deadlines.mjs:248`.
- `showcase-signup` is a reminder.
- `y7` and `y9` have no date (`cenUndated`).

**Deadline timing** (`lib/vendor/night/targets.mjs`)
- End-of-day submissions carry `endOfDay:true`, with `at` set to the following midnight (`:63`).
- Untimed dated items have `precision:'day'` (`:64`, `:86`).
- Math lab quizzes have `at` = lab start and `end` = lab end. For quizzes flagged `quizSecondHour` the label is "Your lab starts · quiz in its second hour", and the code comment says not to invent a quiz start (`:76-79`).
- MTH140 `quiz-2` has `quizSecondHour: true` (`lib/vendor/course-data.mjs:690`). The October 8 D2L announcement covers the Monday sections on October 19 (`:778`).
- Quiz weeks before a section is chosen: `precision:'week'`, label "Quiz week", plus a CTA "Choose section for quiz date" (`:82-83`).
- Holiday weeks: label "Quiz date needs confirmation" (`:71`).
- No date at all: `precision:'pending'`, "Date pending" (`:87`).

**Mark done and undo**
- `progress.markDone` keeps one pending Undo.
- `progress.setDone` clears it (`lib/progress.mjs:52,79-102`).
- Ticks (`toggleTick`) are kept separate from completion records.

**Links into the page**
- Item links use `#assignment-*`, `#assessment-*` and `#topic-*`.
- Section links use `#p-team`, `#p-you`, `#t-*`, `#panel-assessments`, and `#study` on CEN100.
- The Guide Tools dialog opens from `#guide-tools` and `#math-tools` through the cancelable `guide-hash` event (`tools/dialog.mjs`).

**Bugs found**
- Search's "Export calendar" points to `#course-info` (`lib/search.mjs:105`).
- The menu's "This week" list is really the next three items (`utils/upcoming.js:18-29`).
- The grading table ignores the saved section (`overview/Assessments.jsx:13`).
- WorkTile prints the target date twice.
- The "This week's work" heading stays even when the list falls forward to next week.
- PreFooter's "Open a course guide below…" appears on course pages and on Privacy.
- MagicBall leftovers remain in `utils/routes.js`, `store.js` and `Badge.jsx`.

**Packages and policy**
- Not installed: Radix, Schedule-X, Tailwind, Motion or dnd-kit (`site/package.json`).
- The CSP meta is in `pages/_document.page.jsx:8-19` and contains no `unsafe-eval`.
- `next build` runs ESLint.

## B. Assumptions that need a spike or a device test

1. **Calendar layout.** Schedule-X's switch to its small-screen layout, measured on the calendar's own container (700px is the documented value), and the ~520px fallback to month-agenda inside the pinned desktop window. Both are values to test, not settled breakpoints.
2. **Calendar API and cost.**
   - The "+N more" click handler.
   - Theme variable names (`--sx-*`).
   - How multi-day all-day events look in the month grid and in month-agenda.
   - That event titles can carry qualifiers such as "Quiz week".
   - Bundle size, peer-dependency resolution under React 18.2, and no CSP or eval errors.
3. **Accordion find-in-page.** Whether `hidden="until-found"` and the `beforematch` event work in Safari and iOS Safari. If they don't, Safari find-in-page cannot reveal closed panels, and **Expand all** is the fallback.
4. **Touch scrolling.** Native vertical scrolling inside the calendar on iOS, with Lenis around it (`syncTouch:false`) and `data-lenis-prevent`.
5. **Typography on devices.** Whether the new minimum sizes keep the Giats layout working at 812–1280px. This needs checks on a real iPad (portrait, landscape, Split View) and a laptop.
6. **Licences and versions** for Schedule-X and Radix, rechecked at install time. As read on 2026-10-19: `@schedule-x/calendar` 4.9.1 and `@schedule-x/react` 4.1.0 are MIT, with peers `preact ^10.19.2`, `@preact/signals ^2.0.2` and `temporal-polyfill 0.3.2`. Radix primitives are MIT.

---

## C. Rules

### C1. Responsive typography (whole site)
- **Minimum sizes at every width, phones through desktop:**
  - `.p-l` and `.footer`: 16px
  - `.p`: 15px
  - `.p-x`: 14px
  - `.p-xs`: 13px
  - `.h6` and assignment row titles: 18px
- **Headings:** `.h1` to `.h5` stay fluid (vw), with minimums high enough to stay above body text.
- **Method:** `max(<vw>, <px>)` or `clamp()` in `styles/fontStyle.scss`. The layout grid stays vw-based.
- **Width range:** the 812–1279px band (iPad and small laptops) must meet the minimums without changing the 812px layout breakpoint.

### C2. Assignment grouping (one row per content item)
- **Rows.**
  - One row per CEN item (17) or math assessment (MTH140 6, MTH141 7).
  - The set of rows always matches the set of cards in `courseInfo()`.
  - An item with several dated records has one row, but **one calendar event per dated record**, each linking to the same row.
- **Overdue first.**
  - An item goes to **Overdue** when any markable record has `overdue` set, whatever week its date falls in.
  - The heading reads "Past due · not marked done". It is about the date passing, not about a confirmed submission.
- **Other open items** are grouped by their lead record, the earliest markable record not yet done, into This week, Next week or Later.
- **Undated items** (pending dates, `y7`, `y9`, finals) stay visible in Later with their "Date pending" wording.
- **Done.**
  - An item is Done only when every markable record is done.
  - Reminders and other non-markable rows never hold an item back.
  - The heading reads "Marked done by you". It records what the student marked, not what the course confirmed.
- **Open rows stay put.**
  - An open row keeps its group and its position until it is closed, even if its completion changes.
  - Checkboxes, progress counts and status text still update immediately.
- **Links.**
  - Every existing anchor, alias and search target keeps working.
  - A link to an item in Done opens the collapsed Done group first.
- **Mark done** exists in exactly two places:
  - the next tile's button (`markDone` with Undo);
  - the record checkboxes inside the item (`setDone`).
  - `progress.mjs` and its storage formats do not change.

### C3. Calendar date accuracy (Toronto time; never invent precision)

| Data | On the calendar |
|---|---|
| Exact time with `end` (math labs, midterms) | Timed event from start to end. |
| Quiz with `quizSecondHour` | Shown as the **lab window**, titled e.g. "Quiz 2 · in your lab's second hour". Never shown as a 08:00–10:00 quiz, and no quiz start time is worked out. |
| `endOfDay:true` | Shown at 11:59 PM on the due date (`at − 60 000 ms`). That minute is subtracted **only** when `endOfDay` is set. |
| Exact time with no end | A point-in-time event at that time. |
| `precision:'day'` | All-day event marked "time not posted". |
| `precision:'week'` | A Monday–Friday band labelled "Quiz week · date depends on your lab section". It must not look like a five-day exam. Holiday weeks say "date needs confirmation". |
| `pending` / `empty` | Not on the grid; still listed in Later. |
| Section-specific rows (`failure-lab` for Section 29) | Shown only for that section. |
| Notes and announcement qualifiers (Monday make-up, "Check D2L") | Kept in the row's Dates block. |
| Daylight saving | Times convert in America/Toronto. Clocks go back on 1 November 2026, so events on 31 Oct, 2 Nov and 4 Nov are tested. |

### C4. Calendar interactions and layout
- **One calendar** beside the assignment list, not one per group.
- **Read-only.** No event pop-up. Clicking an event opens its assignment row through the existing `guide-hash` path.
- **Layout by the calendar's measured width** (ResizeObserver, not the screen width):
  - month grid when wide;
  - month-agenda when narrow, which must still be readable.
  - Thresholds are confirmed in the spike.
- **Steering on desktop.**
  - Scrolling through the groups may move the calendar to the relevant dates.
  - Once the student navigates the calendar themselves (month arrows, view change, date pick), steering pauses until they turn on a visible "Follow list" control.
  - Steering never scrolls the page. The page scrolls only after an event click.
  - A guard stops each side from triggering the other in a loop.
- **Updates.** A section change or new data replaces the events in place; the calendar is not rebuilt.
- **Failure fallback.** If the calendar code fails to load or throws, an error boundary shows a plain "Calendar unavailable — every date is in the list" panel. The list is unaffected.
- **Motion.** Pause motion and reduced motion turn off calendar animation. Everything else stays usable.

### C5. Accordion (Radix primitives, styled with the site's SCSS)
- **Without JavaScript**, every rule and explanation is readable.
  - Panels are always in the exported HTML (`forceMount`).
  - The existing boot script in `_document` adds a JS marker before the first paint.
  - Closed panels are hidden only when that marker is present, so no-JS readers see everything and JS readers see the closed state from the first paint.
  - This avoids the collapse-after-load layout shift.
- **Search results** from the site search, including "Search the guide", open the panel that holds the match before scrolling to it.
- **Links into a panel** (`#p-rules`, `#p-confirmed`, `#p-open`, `#rules-help`, `#textbooks`, `#sources`, plus aliases such as `t-rules`). `#p-rules`, `#rules-help`, `#textbooks` and `#contacts` already exist (`CourseInfo.jsx:105-161`); `#p-confirmed`, `#p-open` and `#sources` are new in Stage 7. These links must:
  - open the panel first;
  - refresh ScrollTrigger;
  - then scroll and move focus;
  - the target must not move after that.
- **Expand all / Collapse all** control.
- **Keyboard and focus.** Radix keyboard support (Enter/Space, arrow keys, Home/End). Visible `:focus-visible` styles, because the global reset removes the browser's. Focus returns to the panel's button when a panel closes.
- **Browser find-in-page.** Closed panels use `hidden="until-found"` where supported, with a `beforematch` handler that opens the panel. Tested in Chrome and Safari (desktop and iOS). If Safari can't do it, **Expand all** is the documented fallback.
- **ScrollTrigger** refreshes after each open or close.

---

## D. Process for every stage (release discipline)

1. Fetch the latest `origin/main` and merge it in.
2. Change only the files listed for the stage.
3. Run `cd site && npm test` and the root suite (`node --test tests/*.test.mjs tests/scene-*.cjs`).
4. Build from that exact merged source and run the stage's checks against that build. Also check the publish build with the commands under "Checking a publish locally" in `site/README.md`.
5. Commit the source only. The Pages workflow builds what is published; `next/` is the earlier preview and is no longer updated.
6. Merge to `main`, then confirm the Pages workflow's three jobs (build, deploy, live check) passed for that commit and check the live `https://jude27mad.github.io/tmu-course-guides/`.
7. Report the deployed commit and what visibly changed.

**If `main` moves after the build was checked:** fetch, merge, rebuild, retest, and only then push. Never merge a build that was not checked from the merged source.

**Integration owner.**
- One agent owns the shared files for the whole project: `site/package.json` and its lockfile, `lib/content/pages.mjs`, `[course].page.jsx`, `hooks/useCourseState.js` and the publishing files (`.github/workflows/pages.yml`, `scripts/pages-site.mjs`, `scripts/check-pages-site.mjs`).
- Default owner: Claude in this session. The owner can reassign it.
- Other agents work on branches and hand them over. They do not push these files to `main`.

**Scope.**
- The previous website's files at the repository root (`index.html`, `cen100/`, `mth140/`, `mth141/`, `assets/`) and the frozen `next/` folder are not touched.
- No unrelated refactoring.
- A stage with no visible change is reported as groundwork, not as a website update.

**Rollback.**
- Each stage lands as one merge commit. Reverting it publishes the previous website build again.
- Saved-progress formats never change, so a revert loses no student data.

---

## E. Target course page

1. Hero, with its one photo.
2. Course details, the next tile, and one progress tile showing the overall % and this week's done out of total.
3. **Assignments** (`#assignments`).
   - Contents: the calendar window plus one list grouped Past due, This week, Next week, Later, Done (Done collapsed).
   - Each row opens the item's full view: a Dates block covering every record, requirements, checklist, records, notes and target.
4. Study topics: MTH140 and MTH141 only, using the existing topic cards (`#study`).
5. Grading.
   - Uses section-aware dates.
   - CEN shows its 42% / 58% team / individual split here.
   - The math quiz policy and "50% to pass" appear only here.
6. Course info.
   - The section picker and contacts are always visible.
   - The accordion holds the rest. CEN100: Rules, Confirmed, Still open. MTH140 and MTH141: Rules & help, Textbooks, Sources.
7. Guide Tools dialog (unchanged), then the next-course card.

**Removed from the course page:**
- the separate checklist section;
- WorkTile and WeekTile;
- the inline deadline details and the hover pop-up;
- the photos in the list windows;
- the footer's "Next deadline" line on course pages.

---

## F. Stages
Each stage follows section D.

### Stage 1 — Small fixes (visible)
- **Files:**
  - `lib/search.mjs`: Export calendar → `#guide-tools`; Contacts → `#contacts`; rules → `#p-rules`.
  - `components/dom/navbar/components/MenuLinks.jsx`: "This week" becomes "Coming up". Update the comment in `utils/upcoming.js` to match.
  - `components/dom/Footer.jsx`: no next deadline on course pages.
  - `components/dom/PreFooter.jsx`: copy chosen per page. The owner approves the wording.
  - `pages/course/components/overview/Assessments.jsx`: pass the saved section.
  - `lib/info.mjs`: drop the quiz policy and "50%" lines from the math rules card. They are filtered here so the content parity test stays word for word.
  - `pages/course/components/info/CourseInfo.jsx`: remove the duplicate notes and brief.
  - MagicBall leftovers: `utils/routes.js`, `store.js`, `Layout.jsx`, `Loader.jsx`, `DemandDriver.jsx`, `_app.page.jsx`, and the comment in `Badge.jsx`.
- **Depends on:** nothing.
- **Accepted when:**
  - `api.test` covers the new search targets.
  - No math rules text contains the quiz policy or "50% of total", and `info.rules.length` is still 4.
  - Math grading shows the exact quiz date once a section is chosen.
- **Owner can review:** the menu label, the footer and PreFooter on course pages, and grading dates after picking a section.
- **Rollback:** revert the commit.

### Stage 2 — Responsive typography, whole site (visible; moved earlier)
- **Files:** `styles/fontStyle.scss`. Also any component SCSS that overrides a size below the minimums: `courseTiles.module.scss`, `checkRow.module.scss`, `sectionPicker.module.scss`, `guideTools.module.scss` (which uses rem), and the footer and menu styles.
- **Depends on:** nothing. It goes early so the new components are judged at their final text sizes.
- **Accepted when:**
  - Measured sizes meet C1 at 360, 390, 430, 600, 768, 813, 834, 1024, 1180, 1280, 1440 and 1920px.
  - There is no horizontal overflow.
  - Pinned sections don't overlap.
  - The 1440px look is substantially unchanged.
- **Owner can review:** reading on the phone, on an iPad in portrait and landscape, and on a laptop.
- **Rollback:** revert the commit.

### Stage 3 — Desk and tiles (visible)
- **Files:**
  - `pages/index.page.jsx`: remove Projects. Delete `pages/components/projects/Index.jsx`. CourseCards and `projects.module.scss` stay for `/courses/`.
  - `pages/course/components/tiles/CourseTiles.jsx`: delete WorkTile and WeekTile. ProgressTile gains this week's done/total from `live.week`.
  - `courseTiles.module.scss`: remove the styles that only those tiles used. `workList` stays in the data library because it is tested.
- **Depends on:** Stage 2.
- **Accepted when:**
  - The Desk reads Next up, then badges, then Quote.
  - `/courses/` is unchanged.
  - The course-details pin still lines up at 1024 and 1440px.
- **Owner can review:** the Desk and a course page's top section.

### Stage 4 — Data layer (groundwork: no visible change)
- **Files:**
  - New `lib/assignments.mjs`, exported from `lib/index.js`, wrapped in `fast()`, and documented in `lib/README.md`:
    - `assignmentList(courseId, {now, items})` returns the groups and the focus dates.
    - `calendarEvents(courseId, items)` returns plain events with start and end in milliseconds or ISO dates, a title, a qualifier, the row anchor and a style id.
  - Tests are listed in section G.
- **Depends on:** nothing. Can run alongside Stages 1–3.
- **Accepted when:** every C2 and C3 rule is covered by a test.
- **Owner can review:** nothing visible. Reported as groundwork.

### Stage 5 — One assignment list (visible)
- **Files:**
  - New `pages/course/components/assignments/`: `Assignments.jsx`, `AssignmentRow.jsx`, and a pure `deepLinks.mjs`.
  - The card bodies (`CenBody`, `AssessmentBody`) move unchanged from `cards/ItemCards.jsx` into `cards/bodies.jsx`. `CheckRow` and `PlanFields` are reused as they are.
  - New `study/StudyTopics.jsx` holds the topic cards.
  - Update `[course].page.jsx` and `hooks/useCourseState.js` (`live.list`, `live.events`).
  - Add an `immediate` option to `utils/scrollToHash.js`.
  - Delete `deadlines/`, `checklist/`, `cards/ItemCards.jsx`, `RecordActions.jsx` and `portal/`.
  - Until Stage 6, the pinned window holds a single placeholder with no photo.
- **Depends on:** Stage 4.
- **Accepted when:**
  - Every anchor appears exactly once.
  - Each checklist's text appears once on the page.
  - All C2 behaviours hold.
  - Every old link resolves.
  - Ticks and records keep their byte-identical storage formats.
  - The old `scripts/verify-artwork.mjs` is marked historical.
- **Owner can review:** one list per course, opening items, ticking, Mark done/Undo, past-due and Done groups, and links from search and the menu.
- **Rollback:** revert. The storage formats are unchanged.

### Stage 6 — Calendar (spike, then visible)
- **Spike first:** the section B assumptions 1, 2, 4 and 6. Report the measured findings before building. If the spike fails, stop and ask the owner; do not substitute another component.
- **Files:**
  - Install pinned versions of `@schedule-x/react`, `@schedule-x/calendar`, `@schedule-x/calendar-controls`, `@schedule-x/events-service`, `@schedule-x/theme-default`, `temporal-polyfill`, `preact` and `@preact/signals`, with the lockfile.
  - New `pages/course/components/calendar/DeadlineCalendar.jsx`. It loads through `next/dynamic` with `ssr:false`, behind a placeholder of the same size, inside an error boundary.
  - New `calendar.module.scss`: `--sx-*` mapped to the course palette from `utils/theme.js`, `var(--font-primary)`, visible `:focus-visible` styles, and `data-lenis-prevent` on its scrolling areas.
  - Lint comments for the `Temporal` global and for imports resolved through package export maps.
  - Licence notices in `site/public/licenses/`, and credits in `site/README.md`.
- **Depends on:** Stage 5 (the window) and Stage 4 (the events).
- **Accepted when:**
  - All C3 and C4 rules hold.
  - The calendar code is not downloaded on the Desk.
  - There are no CSP errors and no requests to other sites.
  - The failure fallback works.
- **Owner can review:** the month grid on desktop following the list, the agenda on a phone, tapping events, and iPad rotation.

### Stage 7 — Accordion (visible)
- **Files:**
  - Add `@radix-ui/react-accordion`, pinned.
  - New `pages/course/components/info/InfoAccordion.jsx` and `infoAccordion.module.scss`.
  - Update `CourseInfo.jsx`.
  - Add the JS marker to the boot script in `_document.page.jsx`.
  - `lib/search.mjs`: point the CEN Confirmed and Still open results at `#p-confirmed` and `#p-open`.
- **Depends on:** Stage 2. It does not depend on Stages 5–6.
- **Accepted when:** every C5 requirement holds, including no-JS reading, the find-in-page results, and links that land without the page shifting.
- **Owner can review:** Course info on the phone and the iPad, links from search, and Expand all.

### Stage 8 — Release (visible)
- **Version:** bump `GUIDE_VERSION` in `lib/content/cen-literals.mjs` and `lib/content/math.mjs`. Update the four pinned test lines in `tests/content.test.mjs` (17, 125) and `tests/storage.test.mjs` (162, 224).
- **What's changed?:** add a hand-written entry at the top of `updates` in `lib/content/pages.mjs`. Do not regenerate that file.
- **Docs:** update `README.md` (pages, getting started, "Coming up", no-JS behaviour, calendar, accordion), `site/README.md` (structure, dependencies, credits), `lib/README.md` and `CHANGELOG.md`.
- **Depends on:** Stages 1–7.
- **Owner can review:** the "What's changed?" note and the badge, and the README.

---

## G. Tests and checks
The original checks are kept, and none are weakened to make a stage pass.

**Data tests (`site/tests/`)**
- **`assignments.test.mjs`**
  - Partitioning: each content item appears in exactly one group, across several fixed times and saved states. CEN has 17 items, MTH140 6, MTH141 7. Anchors are unique and match `courseInfo()`.
  - Past due takes priority over the weekly groups, including an item that passed earlier this week.
  - Multi-record items: `y6` (notebook-1 then notebook-2) and `y1` (4 records).
  - Reminders never block Done: `failure` done means `m3` is done.
  - Week edges: Sunday 23:59 versus Monday 00:00.
  - The focus dates.
- **`calendarEvents` cases**
  - `outline` falls on Oct 2 at 23:59, not Oct 3.
  - The one-minute subtraction never applies to a row without `endOfDay`.
  - `notebook-1` is Nov 4 at 15:00 EST, plus the 31 Oct and 2 Nov daylight-saving checks.
  - MTH140 Section 3 Quiz 2 is a lab-window event with the "second hour" title and no invented 09:00 start.
  - The midterm runs 18:30–20:30.
  - With no section, quiz weeks are "Quiz week" Monday–Friday bands.
  - Holiday weeks say "date needs confirmation".
  - Pending items are excluded.
  - `failure-lab` appears for Section 29 only.
  - Several events point to one row.
  - Done records get the done style.
- **`deep-links.test.mjs`**: alias resolution, opening Done, opening an accordion panel, unknown ids.
- **`api.test.mjs`**: the new search targets, the filtered math rules, and `info.rules.length`.
- **`blocked.test.mjs`**: `assignmentList` and `calendarEvents` work with blocked storage.

**Browser checks**
- New script `scripts/verify-assignments.mjs`, built on the pattern of `check-guide-tools-popup.mjs`: a local server for `site/out` and Playwright using `/opt/pw-browsers/chromium`.
- Widths: 360, 390, 430, 600, 768, 813, 834, 1024, 1180, 1280, 1440 and 1920px.
- It checks:
  - **Typography:** the C1 minimum sizes.
  - **Page health:** no horizontal overflow, page errors, CSP violations or requests to other sites.
  - **No repetition:** anchors and checklist text appear once; one photo per course page and one on the Desk.
  - **Mark done and saved progress:**
    - Mark done/Undo on the next tile stays in sync with the record checkbox.
    - `cen100-personal-plan-v1` and `mth140-progress-v1` stay in their exact old formats, and ticks stay in `cen100-g9-ticks` across a reload.
  - **Open-row behaviour:** an open row keeps its group and position while its record is ticked, while counts update.
  - **Links:** items, items in Done, old aliases, accordion panels, `#guide-tools`, and the search actions.
  - **Calendar:**
    - The grid follows the list, and manual navigation pauses that steering until "Follow list" is turned back on.
    - "+N more" works.
    - Events and the list update after a section change.
    - Quiz-week and second-hour labels are right.
    - The failure fallback works with the list still usable.
  - **Accordion:** keyboard, focus, Expand all, rules text present in the static HTML, a no-JS run (JavaScript disabled), and opening from links and search.
  - **Motion:** Pause motion and reduced motion.
  - **Loading:** the calendar code is not downloaded on the Desk.

**On real devices, by the owner (after Stages 2, 5, 6 and 7)**
- iPhone Safari: reading, scrolling inside the calendar, tapping events, links, and find-in-page.
- iPad: portrait, landscape, rotating mid-page, and Split View.
- A laptop or desktop: Chrome and Safari, including find-in-page.

---

## H. Open questions (decide or spike; don't invent)

1. **Safari find-in-page.** Does it support `hidden="until-found"`/`beforematch`? This needs a device test. If not, Safari readers rely on Expand all.
2. **Calendar layout thresholds.** Do Schedule-X's small-screen switch (700px) and the ~520px fallback hold up in the real windows? To confirm in the Stage 6 spike.
3. **Re-enabling steering.** Is a visible "Follow list" control the right way to let the calendar follow the list again after manual navigation? This is the owner's choice.
4. **PreFooter wording** for course pages and Privacy. This is the owner's choice.
5. **Integration owner.** The default is Claude in this session. The owner should confirm or reassign.
6. **Minimum text sizes on iPad.** If the C1 minimums break the Giats layout on an iPad between 812 and 1280px, choose between adjusting the layout and lowering the minimums by 1px. This is the owner's call after Stage 2.
7. **Aceternity licence.** Whether committing Aceternity source to a public repository counts as redistribution was not settled. It does not matter for this plan, because those components are not used.
