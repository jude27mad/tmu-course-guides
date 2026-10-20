# Task R1 — Small fixes (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/rr-small-fixes` from the latest `origin/main`.

**Read first:**
- `docs/codex/remove-repetition/README.md` (the rules for every task)
- Stage 1 of `docs/plans/remove-repetition.md`

This is the code-only part of Stage 1. **No visual design.** Leave the PreFooter wording and the `CourseInfo.jsx` duplicate removal alone; Claude does those.

## Changes

1. **Search targets** (`site/src/lib/search.mjs`).
   - The "Export calendar" action (`id: 'action-calendar'`) links to `${current.href}#guide-tools`, not `#course-info`. The calendar now lives in the Guide Tools dialog, and `#guide-tools` already opens it (`site/src/pages/course/components/tools/dialog.mjs`).
   - The "Contacts" action (`action-contacts`) and the contact lookup results link to `#contacts`.
   - Search results for rules link to an id that exists in `site/src/pages/course/components/info/CourseInfo.jsx`: `#p-rules` for CEN100, `#rules-help` for MTH140 and MTH141.
   - Check every other `href` produced by `search.mjs` against the ids actually rendered on the course pages, and list any that point nowhere in your report.
2. **Menu label** (`site/src/components/dom/navbar/components/MenuLinks.jsx`).
   - The heading "This week" becomes "Coming up". The list really is the next three open items across courses, not this week's.
   - Rename `THIS_WEEK_SLOTS` to `COMING_UP_SLOTS`, and update the comments there and in `site/src/utils/upcoming.js`.
3. **Footer** (`site/src/components/dom/Footer.jsx`).
   - On course pages (`courseId` set), do not compute or render the "Next deadline:" block. The course page already shows it in its next tile.
   - The Desk, Courses and Privacy pages keep it.
4. **Grading table** (`site/src/pages/course/components/overview/Assessments.jsx`).
   - `assessments(courseId)` ignores the saved section, so math quiz dates stay "Week of …" after a section is chosen.
   - Pass the saved section (check how `assessments()` in `site/src/lib/deadlines.mjs` accepts it), and re-run when the section changes.
5. **Duplicate rules text** (`site/src/lib/info.mjs`, `mathInfo`).
   - Remove two lines from the list in the "Assessment rules" card: "At least 50% of total course marks is required to pass." and `course.quizPolicy`. The grading section already shows both.
   - Filter them in `info.mjs`, **not** in `site/src/lib/content/math.mjs`. The content parity test pins `content/math.mjs` word for word.
   - The rules array must still have 4 cards.
6. **Leftover 3D-ball code.** The MagicBall 3D scenes were removed from the course pages, but some setup for them is left in:
   - `site/src/utils/routes.js` (`SRGB_PAGES`)
   - `site/src/store.js` (`isAbout` and related state)
   - `site/src/components/dom/Layout.jsx`
   - `site/src/components/dom/Loader.jsx`
   - `site/src/components/canvas/DemandDriver.jsx`
   - `site/src/pages/_app.page.jsx` (the shared canvas colour-space switch)
   - a stale comment in `site/src/pages/components/clients/components/Badge.jsx`

   Remove it, keeping the colour space the Desk badges render with today, so nothing changes on screen. Compare Desk screenshots before and after at 390 px and 1440 px, and attach both pairs to your report.

## Tests

In `site/tests/api.test.mjs`, add tests for:
- the new search targets;
- no math `courseInfo().rules` text contains the quiz policy or "50% of total";
- `courseInfo(<math course>).rules.length === 4`.

Then run everything listed in the README rules.

## Finish

Write `docs/codex/remove-repetition/reports/r1-small-fixes.md` and push `codex/rr-small-fixes`. Never push to `main`.
