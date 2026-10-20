# Task R4 — Calendar and accordion spike (report only, start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/rr-calendar-spike` from the latest `origin/main`. This branch is **never merged**. It exists only to measure things.

**Read first:**
- `docs/codex/remove-repetition/README.md` (the rules for every task)
- Sections B, C4 and C5 and Stages 6 and 7 of `docs/plans/remove-repetition.md`

The plan uses two ready-made components: the **Schedule-X** calendar and the **Radix Accordion**. Before Claude builds them into the site, several assumptions need measuring. Your job is to measure them and report. Do not style anything or build the real feature. Where something cannot be measured in your environment, say so rather than guessing.

## Setup (spike branch only)

In `site/`, install pinned versions of:
- `@schedule-x/react`, `@schedule-x/calendar`, `@schedule-x/calendar-controls`, `@schedule-x/events-service`, `@schedule-x/theme-default`
- `temporal-polyfill`, `preact`, `@preact/signals`
- `@radix-ui/react-accordion`

Add a throwaway page `site/src/pages/spike.page.jsx`. It renders:
- one Schedule-X calendar loaded with `next/dynamic` and `ssr:false`, given sample events: a timed event, an all-day event, a Monday–Friday all-day span, and five events on one day;
- one Radix Accordion with three panels.

## Measure and report

1. **Versions and licences.**
   - Exact versions installed.
   - Each package's licence, read from its LICENSE file in `node_modules`.
   - Peer-dependency warnings from `npm ls` with React 18.2.
2. **Build.**
   - Does `npm run build` pass ESLint? If not, which rules fail (for example `import/no-unresolved` on export-map imports, or the global `Temporal`), and which minimal lint comment fixes each.
3. **Size.** Gzipped size of the calendar chunk and the accordion code in the export.
4. **CSP.**
   - Serve the export with the site's CSP (it is in `site/src/pages/_document.page.jsx`).
   - Report any CSP violations or eval use, and any requests to other hosts.
5. **Width rules.**
   - Put the calendar in containers 360, 420, 480, 520, 600, 700, 800 and 1000 px wide.
   - Record which views Schedule-X allows at each width, and whether it measures its own container or the window.
   - Test `isResponsive: true` and `false`.
6. **Rendering.**
   - How a Monday–Friday all-day span looks in the month grid and in month-agenda.
   - Whether a qualifier in the title (for example "Quiz week · Quiz 2") stays readable.
   - What the "+N more" control does by default, and which option or callback overrides it.
7. **Theme.** List every `--sx-*` CSS variable the default theme defines.
8. **Touch.**
   - In Playwright with `hasTouch` at 390 px, can the month-agenda list scroll vertically inside the page?
   - Does the page's smooth-scroll library interfere with it when the wrapper has `data-lenis-prevent`? The site uses Lenis on `<main>`; see `site/src/pages/_app.page.jsx`.
   - Say clearly that this is not a substitute for a real iPhone test.
9. **Accordion and find-in-page.**
   - Does `@radix-ui/react-accordion` support keeping closed panels in the HTML (`forceMount`) together with `hidden="until-found"`?
   - Does the `beforematch` event fire in Chromium when the browser's find reveals text in a closed panel?
   - Try Playwright WebKit too, and record what happens there. WebKit in Playwright is not the same as iPhone Safari; say so.
   - Report which approach keeps the panel text readable with JavaScript turned off.
10. **Failure.** If the calendar code fails to load (block its chunk), does an error boundary catch it, and does the rest of the page still work?

## Finish

Write `docs/codex/remove-repetition/reports/r4-calendar-spike.md` with:
- the measured result for each item above;
- the exact package versions;
- screenshots at 390 px and 1440 px, linked from the report;
- a clear list of anything that would block the plan.

Push `codex/rr-calendar-spike` (the spike code plus the report). Never push to `main`, and do not open a merge.
