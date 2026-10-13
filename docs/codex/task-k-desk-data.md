# Task K — Desk data adapter (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-desk-data` from the latest `night-shift`. Read `docs/codex/README.md`, `NIGHT-SHIFT-PLAN.md` Sections 3 ("Storage and shared course data") and 4 (the Desk), `assets/night/targets.mjs`, `assets/book/weeks.mjs` and `assets/night/desk.mjs` first.

Pure data for the Stage 5 3D Desk, so the scene only draws. No DOM, no Three.js, no storage writes, no visuals.

## Owns

New `assets/desk/desk-data.mjs`, new `tests/desk-data.test.mjs`. Do not edit other files.

## Requirements

`deskSummary({now, storage, data})` → for each of `cen100`, `mth140`, `mth141`:
- `next`: the course's target from `resolveTarget()` (same as the Desk list and the course card), plus `status()`, `compact()` and `targetDate()`;
- `urgency`: `'hot'|'soon'|'ahead'|'live'|'passed'|'week'|'pending'|'empty'` from `parts()`;
- `progress`: completed records / total countable records for the term (CEN `calendar:false` rows excluded; math from the existing completion shape) and the count completed this week;
- `kinds`: counts of upcoming items by `popupRank` category (final, midterm, quiz/lab, minor);
- `week`: the current `termWeek()` and the spread index `currentWeekIndex()` for the book;
- `section`: the saved section label exactly as the Desk list shows it (or `null`).

Plus `deskOverall(summary, now)` → the overall next item using the existing `overall()`; and `spineState(courseSummary)` → `{glow:'none'|'static'|'urgent', label}` honouring the **one-pulse rule**: only the overall next item may be `'urgent'`, and only when its target is exact and under 6 h; everything else is `'static'` or `'none'`.

Read storage only through the existing readers (`readSaved`, `keys`); denied or corrupt storage must give an honest empty summary, never a throw. Tests with frozen clocks across the term, seeded completions/sections, corrupt storage, and agreement with `resolveTarget()`/the Desk list for every course.
