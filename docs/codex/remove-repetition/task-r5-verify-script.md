# Task R5 — Browser check script (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/rr-verify-script` from the latest `origin/main`.

**Read first:**
- `docs/codex/remove-repetition/README.md` (the rules for every task)
- Section G of `docs/plans/remove-repetition.md`
- `site/scripts/check-guide-tools-popup.mjs`, the pattern to follow

This adds a QA script only. It changes no application code and nothing visible.

## Add `site/scripts/verify-assignments.mjs`

Follow `check-guide-tools-popup.mjs`:
- a self-contained static server for `site/out` under `/tmu-course-guides/next`;
- Playwright loaded from `PLAYWRIGHT_PATH`;
- Chromium at `/opt/pw-browsers/chromium` if `PLAYWRIGHT_CHROMIUM` is unset;
- reports written to `QA_REPORT_DIR`.

It runs against the exported site after `npm run build`.

**Widths:** 360, 390, 430, 600, 768, 813, 834, 1024, 1180, 1280, 1440 and 1920 px. Use phone settings (touch, device scale factor 3) below 812 px.

**Pages:** `/`, `/courses/`, `/cen100/`, `/mth140/`, `/mth141/` and `/privacy/`.

### Checks to run now (they apply to the site as it is)

1. **Page health:** no horizontal overflow, no page errors, no CSP violations, no requests to other hosts.
2. **Text sizes:** measure the computed `font-size` of `.p-l`, `.p`, `.p-x`, `.p-xs` and `.h6` at every width, and report them against the plan's minimums (16, 15, 14, 13 and 18 px).
   - This check is expected to fail today. Report the measured table and do not change any styles.
   - Mark the check as "expected to fail until Stage 2", so it is clearly separate from real regressions.
3. **Saved progress.**
   - Seed `localStorage` with the old formats: `cen100-g9-ticks`, `cen100-personal-plan-v1`, `cen100-contact-choice-v1`, `mth140-progress-v1` and `mth140-section-v1`.
   - Load each course page and confirm nothing is rewritten on read.
   - Tick one checklist step and use Mark done/Undo on the next tile, then confirm the stored values keep their exact old byte formats.
4. **Deep links:** every `assignment-*`, `assessment-*`, `topic-*`, `p-rules`, `rules-help`, `textbooks`, `contacts` and `guide-tools` anchor in the export resolves to an element, or opens the dialog for `guide-tools`.
5. **Repetition counts.** Report, without failing, the current numbers:
   - photos (`[data-course-artwork]`) per page;
   - how many times each assignment anchor's title appears on its page;
   - how many Mark done controls each page has.

   This records the "before" picture.
6. **Motion:** with `prefers-reduced-motion: reduce`, and with the saved Pause motion setting (`guide-motion-paused`), every page still loads and its content is visible.

### Checks for later stages (scaffold only)

Add clearly named check functions for the following, each marked `pending` with the stage that enables it:
- one assignment list per page, and each checklist rendered once (Stage 5);
- the calendar: steering, manual-navigation priority, "+N more", section changes, quiz-week and second-hour labels, and the failure fallback (Stage 6);
- the accordion: keyboard use, focus, Expand all, no-JS text, opening from links and search (Stage 7).

A pending check reports `pending` and never `pass`. Claude fills them in during those stages.

## Finish

Run the script once against a fresh `npm run build` and save the output under `QA_REPORT_DIR`.

Write `docs/codex/remove-repetition/reports/r5-verify-script.md` with:
- how to run the script;
- the "before" numbers from check 5;
- the measured text-size table from check 2;
- any real failures from checks 1, 3, 4 and 6.

Push `codex/rr-verify-script`. Never push to `main`.
