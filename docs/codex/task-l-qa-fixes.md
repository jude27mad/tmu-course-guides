# Task L — Fix what the QA harness found (start when Claude says the router review has landed)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-qa-fixes` from the latest `night-shift`. Read `docs/codex/README.md` and `tools/qa/README.md`.

Run `node tools/qa/run.mjs` at both bases (`/` and `/tmu-course-guides/`) and fix every real failure it reports **outside** the book and Desk scene code (Claude is building `assets/book/*`, `assets/app/stage.mjs`, `assets/app/three.mjs` and the Night Shift hero/scroll/timeline/deadline modules — report issues there instead of editing them). Known so far: a missing favicon request, accessibility issues (for example the course pages' first tab stop, the hub brand, is about 30.6 px tall instead of at least 44 px) and WebGL contexts that grow across route round trips. For each fix: reproduce with the harness, fix minimally, re-run. No visual redesign; keep the existing look. Report what was fixed, what is left and why, with the before/after harness summaries.
