# Task P — First-load performance (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-perf` from the latest `night-shift`. Read `docs/codex/README.md`, `NIGHT-SHIFT-PLAN.md` Sections 1, 7, 8 and 12, and `tools/qa/README.md` first.

Make every route load faster on a phone **without changing how anything looks**. The plan's rule stands: no loading screen, and coursework is readable from the first paint.

## 1. Measure first

Add a `perf` check in a new `tools/qa/checks-perf.mjs`, registered with one line in `tools/qa/run.mjs`, so this work cannot conflict with Task O. For each route at both bases, on a cold cache:

- **Profiles:** 390 px mobile with 4× CPU slowdown and Slow 4G throttling (about 1.6 Mbps down, 750 kbps up, 150 ms latency), and 1440 px desktop without throttling.
- **Record:** first contentful paint, largest contentful paint, layout shift, long tasks over 50 ms, time until coursework text is visible, time until the deadline chip shows, request count, bytes by type, and the depth of the module import chain.
- **Budgets:** set budgets for the deterministic numbers (requests, bytes and chain depth) from the measured values plus a small margin, and fail when they are exceeded. Timings under SwiftShader are diagnostics only: report them, never gate on them.

Commit the baseline report before optimising.

## 2. Then apply safe wins

- `<link rel="modulepreload">` for each route's boot-critical module graph. Generate the list from the actual import graph with a script, and add a test that fails when the list and the graph disagree (including `?v=` tokens), so it cannot go stale.
- Preload only the font file needed above the fold. Check `assets/fonts/archivo.css` for `font-display` behaviour. Do not change fonts.
- Give images and posters intrinsic sizes (no layout shift), `decoding="async"`, and `loading="lazy"` when they start off-screen.
- Router prefetch respects `navigator.connection.saveData` and does not prefetch on touch until there is intent.
- Keep the lazy vendor lazy, and check that no module is fetched under two URLs.
- List anything bigger (unused CSS or JavaScript bytes, large images) in the report with numbers. Do not remove visual CSS.

**Zero visual change:** capture settled screenshots of all four routes at 1440 and 390 px in dark and light before and after, and compare them in the harness. They must be pixel-identical; explain any difference.

Claude is building the book on a paused branch. Do **not** edit these files: `assets/app/stage.mjs`, `assets/app/three.mjs`, anything in `assets/book/`, `assets/course-header.mjs`, `assets/course-scene.mjs`, `assets/night/{deadline,hero,scroll,timeline}.mjs`, `assets/night/{layout,hero,scroll}.css` or `assets/scenes/*`. In `mth140/index.html`, keep your edits to one contiguous block in `<head>`. Bump `?v=` tokens on every changed asset, as `tests/asset-urls.test.mjs` requires.

## Finish

Write `docs/qa/night-shift/performance.md` with before and after tables per route and profile, what changed and what is left. Link it from `docs/qa/night-shift/README.md`. Merge the latest `night-shift` into your branch, re-run the root suite, `tools/ui-build` and all QA checks, then merge your branch into `night-shift` and push both. Never push to `main`.
