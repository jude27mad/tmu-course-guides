# Task G — Verification and performance harness (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-qa-harness` from the latest `night-shift`. Read `docs/codex/README.md` and `NIGHT-SHIFT-PLAN.md` Sections 8 and 11 first.

Build reusable, scriptable checks for Stages 3 and 7, so verification is one command instead of ad-hoc scripts. **Do not change product code.**

## Owns

New `tools/qa/` (Node scripts + README), an npm script entry in `tools/ui-build/package.json` only if convenient, and `.gitignore` entries for report output (`tools/qa/reports/`).

## Environment

Playwright is installed at `/opt/node-tools/node_modules/playwright` in Claude's container; resolve it via an env var `PLAYWRIGHT_PATH` with that default, falling back to `require('playwright')`. Chromium launch args for software GL: `['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']`, overridable with `QA_GPU=1` for real-GPU machines. Serve with `node tools/preview-server.mjs --port <n> [--base /tmu-course-guides/]` (spawned and stopped by the harness).

## Checks (each writes JSON + a short Markdown summary to `tools/qa/reports/<timestamp>/`)

1. **routes** — Desk → CEN100 → MTH140 → MTH141 → Desk, Back ×3, Forward ×2 at both bases: no document reload (`html[data-shell-id]` unchanged), URL/title/`body` attributes, rendered content present, focus target, console errors, failed requests.
2. **stability** — 20 Desk↔course round trips, 20 workspace view changes, 20 palette open/close cycles (skip if no palette), 10 Mark done/Undo cycles: count live event listeners, Intersection/Mutation/Resize observers, GSAP ticker callbacks and ScrollTriggers (if exposed), rAF loops, canvases and WebGL contexts, via an init script that instruments constructors and `addEventListener`/`removeEventListener`. Report baseline vs end; fail when counts grow.
3. **frames** — 5 s scripted wheel scroll on each route at 1440×900: share of frames over 16.7 ms and over 33 ms (via `requestAnimationFrame` timestamps), long tasks over 50 ms (`PerformanceObserver`), and environment (SwiftShader vs GPU) clearly labelled — SwiftShader numbers are diagnostics, not device smoothness.
4. **deadlines** — `page.clock.install` at fixed Toronto times with seeded sections/completions: CEN Academic Integrity Quiz → 2026-10-14 3:00 PM Toronto; MTH140 midterm → 2026-10-23 6:30 PM Toronto; quiz week with no section shows the section call to action and no timer; Undo restores the previous target; hide/resume recomputes. Assert the same target on the Desk, the course card, the dock and the hero line.
5. **modes** — `?motion=off`, OS reduced motion (`reducedMotion:'reduce'`) and a saved full preference: no animated transforms, canvas loops, cursor or particles where the plan forbids them; WebGL disabled (`--disable-webgl`) shows posters and full coursework.
6. **layout** — 1440, 1024 and 390 widths × dark/light: horizontal overflow, controls under 44 px, focus visibility of the first five tab stops, Skip link first.

`node tools/qa/run.mjs [check…] [--base /tmu-course-guides/] [--gpu]` runs all or some; exit code non-zero on failure. Keep it dependency-free beyond Playwright.
