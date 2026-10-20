# R5 — Browser check script

Added `site/scripts/verify-assignments.mjs`, a self-contained server and Playwright runner for `site/out` at `/tmu-course-guides/next`. Only this QA script and this report changed. Branch starts at `origin/main` `e51b2e18bcc3fdce87753fcad3135455a3a8fc14`.

## Run

From `site/` after a fresh export:

```sh
npm ci
npm run build
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
PLAYWRIGHT_CHROMIUM=/usr/bin/chromium \
QA_REPORT_DIR=/tmp/r5-assignments-qa \
node scripts/verify-assignments.mjs
```

`PLAYWRIGHT_CHROMIUM` defaults to `/opt/pw-browsers/chromium`. `QA_REPORT_DIR` defaults to `/tmp/assignments-qa`. JSON and Markdown reports are written there. Exit 1 means a real failure; expected text-size failures and pending checks do not change the exit status.

Executed against fresh build `okbVQXqQFVTqdB9nJ7xfI` using Chromium 154.0.8037.57. All 12 widths and six routes ran in normal, reduced-motion and saved-pause modes. Saved-progress and deep-link checks also covered all 12 widths. Phone emulation below 812px uses touch and device scale factor 3; height is 900px. Date advances normally from `2026-10-20T16:00:00Z` on each load for reproducible in-term records. No physical-device/Safari claims.

## Validation

- `npm ci` in `site/`, `tools/scene-build` and `tools/ui-build`: passed.
- `npm test`: 88 passed, 0 failed.
- `npm run build` (including ESLint): passed, with existing warnings.
- Root `node --test tests/*.test.mjs tests/scene-*.cjs`: 383 passed, 1 failed, 0 skipped. Run with `PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright QA_CHROMIUM_PATH=/usr/bin/chromium` and local network permission.
- The existing root failure is `tests/fix-header.test.mjs:96`, “Mark done and Undo reach the book…”. Its live-clock fixture expects `quiz-2:false:`, but the current date returns `midterm:false:null` before any mutation. Application and tests match the base commit; neither was changed.
- Initial sandbox runs denied local server access. Network permission and the explicit browser path resolved those environmental failures.
- Browser summary: 1661 pass, 3 real failures, 52 expected text-size failures, 14 pending, 70 informational baselines.

## Real browser failures (checks 1, 3, 4 and 6)

All 216 page-health checks passed (overflow, page errors, CSP and external requests), as did all 1,236 anchor checks and 36 saved-progress cases (180 exact-byte snapshots). Three loads failed their readiness check:

| Page | Width | Mode | Observation |
| --- | --- | --- | --- |
| /mth140/ | 430px | Normal | `main h1` did not become visible within 30 seconds. |
| /mth141/ | 1280px | Saved Pause motion | `main h1` did not become visible within 30 seconds. |
| /privacy/ | 1180px | Normal | `main h1` did not become visible within 30 seconds. |

All three cases passed a sequential focused follow-up against the same build. The original full-run failures remain recorded. The two missing normal-mode typography/repetition rows were collected during that follow-up (MTH140 at 430px and privacy at 1180px). The timeout cause remains unconfirmed.

The full run uses two independent width workers and a 30-second readiness limit. Follow-up evidence is in `/tmp/r5-followup-qa/results.json`; full-run evidence is retained separately.

## Before counts (check 5)

Counts use the initial hydrated DOM before opening cards. Title mentions are case-insensitive normalized substrings in `main` text, excluding script/style/template/noscript and attributes. They include screen-reader/hidden UI copies and explanatory mentions of short titles. Photo count uses `[data-course-artwork]`; Mark done counts include controls present in the DOM.

| Page | Widths (px) | Photos | Mark done controls |
| --- | --- | --- | --- |
| / | all widths | 1 | 1 |
| /courses/ | all widths | 0 | 0 |
| /cen100/ | all widths | 5 | 2 |
| /mth140/ | all widths | 5 | 2 |
| /mth141/ | all widths | 5 | 2 |
| /privacy/ | all widths | 0 | 0 |

| Page | Anchor | Title | Occurrences (widths) |
| --- | --- | --- | --- |
| /cen100/ | assignment-m1 | Team Contract + Task Outline | 2 (all widths) |
| /cen100/ | assignment-m2 | Project Outline + User Research | 2 (all widths) |
| /cen100/ | assignment-m3 | Failure Analysis Labs | 9 (all widths) |
| /cen100/ | assignment-m4 | Midterm Design Review | 3 (all widths) |
| /cen100/ | assignment-y6 | Team design notebook | 6 (all widths) |
| /cen100/ | assignment-m5 | Low-Fidelity Prototype | 3 (all widths) |
| /cen100/ | assignment-m6 | Final Presentations | 1 (all widths) |
| /cen100/ | assignment-m7 | Final Report | 3 (all widths) |
| /cen100/ | assignment-y1 | September items | 1 (all widths) |
| /cen100/ | assignment-y2 | MATLAB assignments | 4 (all widths) |
| /cen100/ | assignment-y3 | WHMIS certification | 2 (all widths) |
| /cen100/ | assignment-y4 | Academic Integrity Quiz | 4 (all widths) |
| /cen100/ | assignment-y5 | Personal Reflections | 4 (all widths) |
| /cen100/ | assignment-y7 | Tutorial attendance quizzes | 2 (all widths) |
| /cen100/ | assignment-y8 | Exit survey | 3 (all widths) |
| /cen100/ | assignment-m8 | Peer Evaluation | 10 (all widths) |
| /cen100/ | assignment-y9 | Final exam | 5 (all widths) |
| /mth140/ | assessment-quiz-1 | Lab Quiz 1 | 2 (all widths) |
| /mth140/ | assessment-quiz-2 | Lab Quiz 2 | 2 (all widths) |
| /mth140/ | assessment-quiz-3 | Lab Quiz 3 | 4 (all widths) |
| /mth140/ | assessment-quiz-4 | Lab Quiz 4 | 3 (all widths) |
| /mth140/ | assessment-midterm | Midterm Test | 9 (all widths) |
| /mth140/ | assessment-final | Final Exam | 4 (all widths) |
| /mth140/ | topic-functions | Functions & graphs | 1 (all widths) |
| /mth140/ | topic-limits | Limits & continuity | 1 (all widths) |
| /mth140/ | topic-derivatives-1 | Derivatives I | 2 (all widths) |
| /mth140/ | topic-integration-1 | Integration I | 2 (all widths) |
| /mth140/ | topic-derivatives-2 | Derivatives II | 1 (all widths) |
| /mth140/ | topic-integration-2 | Integration II | 1 (all widths) |
| /mth140/ | topic-applications-d | Applications of derivatives | 1 (all widths) |
| /mth140/ | topic-applications-i | Applications of integrals | 1 (all widths) |
| /mth141/ | assessment-quiz-1 | Lab Quiz 1 | 3 (all widths) |
| /mth141/ | assessment-quiz-2 | Lab Quiz 2 | 2 (all widths) |
| /mth141/ | assessment-quiz-3 | Lab Quiz 3 | 7 (all widths) |
| /mth141/ | assessment-quiz-4 | Lab Quiz 4 | 3 (all widths) |
| /mth141/ | assessment-quiz-5 | Lab Quiz 5 | 3 (all widths) |
| /mth141/ | assessment-midterm | Midterm Test | 4 (all widths) |
| /mth141/ | assessment-final | Final Exam | 5 (all widths) |
| /mth141/ | topic-complex | Complex numbers | 2 (all widths) |
| /mth141/ | topic-systems | Systems of equations | 1 (all widths) |
| /mth141/ | topic-matrices | Matrices | 2 (all widths) |
| /mth141/ | topic-determinants | Determinants | 2 (all widths) |
| /mth141/ | topic-rn | Vectors in ℝⁿ | 1 (all widths) |
| /mth141/ | topic-transformations | Linear transformations | 1 (all widths) |
| /mth141/ | topic-diagonalization | Diagonalization | 1 (all widths) |
| /mth141/ | topic-abstract | Abstract vector spaces | 1 (all widths) |


## Computed text sizes (check 2)

**Expected to fail until Stage 2.** Minimums are `.p-l` 16, `.p` 15, `.p-x` 14, `.p-xs` 13 and `.h6` 18px. Cells list all distinct computed pixel sizes, rounded here to 3 decimals. The unused `.p` class was measured with temporary hidden probes, removed immediately; its column uses the global class measurements validated at all 12 widths in `/tmp/r5-font-probes-qa/results.json` (0 real failures). The script now probes any unused type class automatically. Course cards were expanded after counting repetition so lazy checklist/notes content is included. Hidden mounted menu/dialog UI is also measured. No styles were changed.

| Page | Width (px) | .p-l ≥16 | .p ≥15 | .p-x ≥14 | .p-xs ≥13 | .h6 ≥18 |
| --- | --- | --- | --- | --- | --- | --- |
| / | 360 | 15 | 14 | 13 | 12 | 16 |
| /courses/ | 360 | 15 | 14 | 13 | 12 | 16 |
| /cen100/ | 360 | 13, 15 | 14 | 13 | 12 | 16 |
| /mth140/ | 360 | 13, 15 | 14 | 13 | 12 | 16 |
| /mth141/ | 360 | 13, 15 | 14 | 13 | 12 | 16 |
| /privacy/ | 360 | 15 | 14 | 13 | 12 | 16 |
| / | 390 | 15 | 14 | 13 | 12 | 16 |
| /courses/ | 390 | 15 | 14 | 13 | 12 | 16 |
| /cen100/ | 390 | 13, 15 | 14 | 13 | 12 | 16 |
| /mth140/ | 390 | 13, 15 | 14 | 13 | 12 | 16 |
| /mth141/ | 390 | 13, 15 | 14 | 13 | 12 | 16 |
| /privacy/ | 390 | 15 | 14 | 13 | 12 | 16 |
| / | 430 | 15 | 14 | 13 | 12 | 16 |
| /courses/ | 430 | 15 | 14 | 13 | 12 | 16 |
| /cen100/ | 430 | 13, 15 | 14 | 13 | 12 | 16 |
| /mth140/ † | 430 | 13, 15 | 14 | 13 | 12 | 16 |
| /mth141/ | 430 | 13, 15 | 14 | 13 | 12 | 16 |
| /privacy/ | 430 | 15 | 14 | 13 | 12 | 16 |
| / | 600 | 18.6 | 17.4 | 16.8 | 16.2 | 20.4 |
| /courses/ | 600 | 18.6 | 17.4 | 16.8 | 16.2 | 20.4 |
| /cen100/ | 600 | 16.8, 18.6 | 17.4 | 16.8 | 16.2 | 20.4 |
| /mth140/ | 600 | 16.8, 18.6 | 17.4 | 16.8 | 16.2 | 20.4 |
| /mth141/ | 600 | 16.8, 18.6 | 17.4 | 16.8 | 16.2 | 20.4 |
| /privacy/ | 600 | 18.6 | 17.4 | 16.8 | 16.2 | 20.4 |
| / | 768 | 23.808 | 22.272 | 21.504 | 20.736 | 26.112 |
| /courses/ | 768 | 23.808 | 22.272 | 21.504 | 20.736 | 26.112 |
| /cen100/ | 768 | 21.504, 23.808 | 22.272 | 21.504 | 20.736 | 26.112 |
| /mth140/ | 768 | 21.504, 23.808 | 22.272 | 21.504 | 20.736 | 26.112 |
| /mth141/ | 768 | 21.504, 23.808 | 22.272 | 21.504 | 20.736 | 26.112 |
| /privacy/ | 768 | 23.808 | 22.272 | 21.504 | 20.736 | 26.112 |
| / | 813 | 9.35 | 7.723 | 6.91 | 6.098 | 12.195 |
| /courses/ | 813 | 9.35 | 7.723 | 6.91 | 6.098 | 12.195 |
| /cen100/ | 813 | 9.35 | 7.723 | 6.91 | 6.098 | 12.195 |
| /mth140/ | 813 | 9.35 | 7.723 | 6.91 | 6.098 | 12.195 |
| /mth141/ | 813 | 9.35 | 7.723 | 6.91 | 6.098 | 12.195 |
| /privacy/ | 813 | 9.35 | 7.723 | 6.91 | 6.098 | 12.195 |
| / | 834 | 9.591 | 7.923 | 7.089 | 6.255 | 12.51 |
| /courses/ | 834 | 9.591 | 7.923 | 7.089 | 6.255 | 12.51 |
| /cen100/ | 834 | 9.591 | 7.923 | 7.089 | 6.255 | 12.51 |
| /mth140/ | 834 | 9.591 | 7.923 | 7.089 | 6.255 | 12.51 |
| /mth141/ | 834 | 9.591 | 7.923 | 7.089 | 6.255 | 12.51 |
| /privacy/ | 834 | 9.591 | 7.923 | 7.089 | 6.255 | 12.51 |
| / | 1024 | 11.776 | 9.728 | 8.704 | 7.68 | 15.36 |
| /courses/ | 1024 | 11.776 | 9.728 | 8.704 | 7.68 | 15.36 |
| /cen100/ | 1024 | 11.776 | 9.728 | 8.704 | 7.68 | 15.36 |
| /mth140/ | 1024 | 11.776 | 9.728 | 8.704 | 7.68 | 15.36 |
| /mth141/ | 1024 | 11.776 | 9.728 | 8.704 | 7.68 | 15.36 |
| /privacy/ | 1024 | 11.776 | 9.728 | 8.704 | 7.68 | 15.36 |
| / | 1180 | 13.57 | 11.21 | 10.03 | 8.85 | 17.7 |
| /courses/ | 1180 | 13.57 | 11.21 | 10.03 | 8.85 | 17.7 |
| /cen100/ | 1180 | 13.57 | 11.21 | 10.03 | 8.85 | 17.7 |
| /mth140/ | 1180 | 13.57 | 11.21 | 10.03 | 8.85 | 17.7 |
| /mth141/ | 1180 | 13.57 | 11.21 | 10.03 | 8.85 | 17.7 |
| /privacy/ † | 1180 | 13.57 | 11.21 | 10.03 | 8.85 | 17.7 |
| / | 1280 | 14.72 | 12.16 | 10.88 | 9.6 | 19.2 |
| /courses/ | 1280 | 14.72 | 12.16 | 10.88 | 9.6 | 19.2 |
| /cen100/ | 1280 | 14.72 | 12.16 | 10.88 | 9.6 | 19.2 |
| /mth140/ | 1280 | 14.72 | 12.16 | 10.88 | 9.6 | 19.2 |
| /mth141/ | 1280 | 14.72 | 12.16 | 10.88 | 9.6 | 19.2 |
| /privacy/ | 1280 | 14.72 | 12.16 | 10.88 | 9.6 | 19.2 |
| / | 1440 | 16.56 | 13.68 | 12.24 | 10.8 | 21.6 |
| /courses/ | 1440 | 16.56 | 13.68 | 12.24 | 10.8 | 21.6 |
| /cen100/ | 1440 | 16.56 | 13.68 | 12.24 | 10.8 | 21.6 |
| /mth140/ | 1440 | 16.56 | 13.68 | 12.24 | 10.8 | 21.6 |
| /mth141/ | 1440 | 16.56 | 13.68 | 12.24 | 10.8 | 21.6 |
| /privacy/ | 1440 | 16.56 | 13.68 | 12.24 | 10.8 | 21.6 |
| / | 1920 | 22.08 | 18.24 | 16.32 | 14.4 | 28.8 |
| /courses/ | 1920 | 22.08 | 18.24 | 16.32 | 14.4 | 28.8 |
| /cen100/ | 1920 | 22.08 | 18.24 | 16.32 | 14.4 | 28.8 |
| /mth140/ | 1920 | 22.08 | 18.24 | 16.32 | 14.4 | 28.8 |
| /mth141/ | 1920 | 22.08 | 18.24 | 16.32 | 14.4 | 28.8 |
| /privacy/ | 1920 | 22.08 | 18.24 | 16.32 | 14.4 | 28.8 |


† Measurement from the focused follow-up, with the full-run failure retained above. Repetition tables include those same two follow-up rows. The `.p` column comes from the separate all-width probe validation; all remaining measurements came from the full run.

## Pending stages and limits

Fourteen named checks report `pending`, never `pass`: Stage 5 assignment-list/checklist uniqueness; Stage 6 steering, manual-navigation priority, +N more, section changes, quiz-week/second-hour labels and fallback; Stage 7 keyboard, focus, Expand all, no-JS text and opening from links/search. These remain scaffolds for Claude.

Full per-check evidence, exact storage snapshots and anchor sources are in `/tmp/r5-assignments-qa/results.json`; the detailed tables are in `results.md` in that directory. No generated export, application code, dependency manifests or existing tests were changed. No deployment or main-branch push was performed.
