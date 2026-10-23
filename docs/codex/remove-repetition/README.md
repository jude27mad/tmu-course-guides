# Codex tasks: remove repetition

These are the code-only parts of [docs/plans/remove-repetition.md](../../plans/remove-repetition.md). Each task file is self-contained: paste the whole file into Codex.

No task here involves visual design. Claude does the visible work (text sizes, the Desk and tiles, the assignment list on the page, fitting the calendar and the accordion), merges the Codex branches into `main`, and the Pages workflow publishes the website.

| Task | Branch | Start | Depends on |
|---|---|---|---|
| [R1 — Small fixes](task-r1-small-fixes.md) | `codex/rr-small-fixes` | now | — |
| [R2 — Assignment list and calendar data](task-r2-data-layer.md) | `codex/rr-data-layer` | now | — |
| [R3 — Deep-link resolver](task-r3-deep-links.md) | `codex/rr-deep-links` | now | — |
| [R4 — Calendar and accordion spike (report only)](task-r4-calendar-spike.md) | `codex/rr-calendar-spike` | now | — |
| [R5 — Browser check script](task-r5-verify-script.md) | `codex/rr-verify-script` | now | — |

The five tasks touch different files, so they can run at the same time.

## Rules for every task

- **Repository:** `jude27mad/tmu-course-guides`. Work in `site/` (the Next.js app). Start your branch from the latest `origin/main`.
- **Never push to `main`.** Push only your own branch. Claude merges it.
- **Do not touch:**
  - `next/` (the earlier preview export, frozen) and `.github/workflows/pages.yml`;
  - `site/package.json` and `site/package-lock.json` (except on the R4 spike branch);
  - `site/src/lib/content/pages.mjs`;
  - `site/src/pages/[course].page.jsx`;
  - `site/src/pages/course/hooks/useCourseState.js`;
  - the root website (`index.html`, `cen100/`, `mth140/`, `mth141/`, `assets/`).
- **Do not change** saved-progress storage keys or value formats, deadline calculations or grading.
- **No visual design:** no new layouts, colours, fonts or styles beyond what the task states.
- **Do not weaken, skip or delete existing tests** to make anything pass.
- **Before pushing,** run from `site/`:
  - `npm ci`
  - `npm test`
  - `npm run build` (this also runs ESLint)
  - from the repository root: `node --test tests/*.test.mjs tests/scene-*.cjs` (needs `npm ci --prefix tools/scene-build` and `npm ci --prefix tools/ui-build` first)
- **Finish** with a short report at `docs/codex/remove-repetition/reports/<task>.md`. It lists what changed, the test results, and anything you could not do or are unsure about. Do not invent answers to open questions: write them down.
