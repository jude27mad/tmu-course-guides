# Task L — QA fixes and verification

Recorded October 12, 2026 (America/Toronto); Actions timestamps are October 13 UTC.

## Revision and scope

Branch: `codex/ns-qa-fixes`, created from the latest `night-shift` at task start, `bc1285f009cee264b2d2593d9c5aa70b9e5af5ca`.

Verified code: `152df6191912356b28f710f8aefbd19c9e933b1c`. Final verification is Actions run **38342195533**; every downloaded `verified-commit.txt` identifies this code revision. Its triggering commit is `d58f97b`, because the branch-guarded preparation job applied the reviewed patch and passed the resulting commit to every test job. The closing documentation/workflow-cleanup commit changes no verified application or test bytes.

Only the task branch was pushed. No pull request was opened. The temporary `.github/workflows/task-l-qa.yml` and patch-transfer files are absent from the final tree.

## Before and after

The baseline ran the complete `node tools/qa/run.mjs` selection, including both deployment bases, on `2826feb` (application bytes identical to the pinned base). Final verification ran all six checks independently; stability was split by base. Every check/base combination completed, with no browser cases skipped.

Values below are **failed assertions / total assertions**.

| Check | Before `/` | Before `/tmu-course-guides/` | After `/` | After `/tmu-course-guides/` |
| --- | ---: | ---: | ---: | ---: |
| Routes/history | 0 / 60 | 0 / 60 | 0 / 60 | 0 / 60 |
| Layout/accessibility | 30 / 288 | 30 / 288 | 0 / 288 | 0 / 288 |
| Motion/fallback modes | 1 / 189 | 2 / 190 | 0 / 188 | 0 / 188 |
| Deadlines | 0 / 128 | 0 / 128 | 0 / 128 | 0 / 128 |
| Repeated-navigation stability | 1 / 46 | 0 / 45 | 0 / 45 | 0 / 45 |
| Frame diagnostics | 3 / 27 | 1 / 25 | 0 / 24 | 0 / 24 |
| **Total** | **35 / 738** | **33 / 736** | **0 / 733** | **0 / 733** |

Baseline: **68 failures in 1,474 assertions**. Final: **1,466 passing assertions, zero failures**. The eight-count difference is expected: the harness appends a failure assertion when wrapper settlement throws, but no matching assertion on successful settlement. No functional assertion was removed.

## Fixes and regression coverage

### Skip order and clickable targets

`assets/hub.js` now inserts the shared hub after an authored direct-child Skip link on course pages as well as the Desk. Previously, the math pages' first tab stop was the hub brand instead of Skip. Six direct-load regression cases cover Desk/MTH140/MTH141 at both bases and repeated initialization without duplicating the shell.

Minimal `assets/workspace.css` changes give the hub brand, footer links, footer reset, and category buttons at least 44-pixel clickable dimensions. The CEN100 “All” filter had measured approximately 40.36 pixels wide on desktop and 35.58 on mobile. Four stylesheet-cascade tests protect these targets. Browser layout checks cover three widths and both themes. Typography, colors, and the visual design were not changed; the hit-target CSS is explained in its commits.

The relevant tests were observed failing before the fix and passing afterward. `tests/qa-accessibility.test.mjs` contains ten tests.

### Bound arrival cleanup without retiming the design

`assets/guide-motion.mjs` keeps the existing 0.35-second arrival, easing, and start/end values. A deadline completes the public timeline when a stalled animation clock would otherwise leave the page partly transformed. Normal settlement clears the deadline; an ownership check prevents an old arrival from settling a newer exit. The global GSAP clock is unchanged.

Two tests in `tests/qa-arrival.test.mjs` exercise a sleeping real GSAP ticker and replacement by a new exit. They verify complete style cleanup, unchanged duration, and exactly-once exit settlement.

### Cache URLs and the existing lifecycle fixture

The four route documents refresh only changed asset URLs. `assets/course-header.mjs` and `assets/course-scene.mjs` have import-URL changes only, keeping one exact motion-service URL. There are no rendering changes in either file.

The shared-lifecycle test fixture now reads that exact URL from `index.html` rather than bundling an extra unversioned motion instance. Its existing functional assertions remain intact, including repeated route lifecycle checks.

### A fresh observation at the QA polling deadline

After the application fixes, one intermittent full-motion wrapper timeout remained; its captured wrapper was already neutral. An unchanged-product diagnostic run passed all 376 mode assertions. Eleven of forty browser replies took longer than the existing two-second polling budget; the slowest took 3,448 milliseconds. The old helper already accepted a late true reply, but could treat a late stale false reply as the final state without checking again.

`tools/qa/checks.mjs` now samples the same predicate once at the deadline before failing. No timeout value, acceptance predicate, or telemetry allowance changed. The extra observation can add one browser round trip; it is not a hard wall-clock timeout. Four new boundary tests prove both eventual success and rejection of persistent failure. The helper is exported for these QA tests and documented in `tools/qa/README.md`.

## Other verification

| Suite | Result |
| --- | --- |
| Root: `node --test tests/*.test.mjs tests/scene-*.cjs` | 240 tests: **238 pass, 0 fail, 2 skip** |
| UI dependency install/build/tests | **Pass**, including all course/motion cases, palette, Desk, and router workflows |
| Vendor rebuild | **Byte-identical**; `git diff --exit-code -- assets/vendor` passed |
| QA helper/runtime/instrumentation self-tests | **42 pass, 0 fail, 0 skip** |

The two root skips are environment/history-dependent and were also skipped in this task's baseline:

- `changed assets never reuse a URL the deployed site served`: `origin/main` is unavailable in the verification checkout.
- `extracted records deep-equal the array in the pre-move root guide`: the historical baseline commit is unavailable; the separate record SHA-256 test passes.

The older Stage 0 failures documented in `baseline-tests.md` did not reproduce on the pinned revision with both tool dependency sets installed. They are not claimed as fixes from this task.

After twenty route round trips, both bases report unchanged live/retained listener counts (94), active observers (1), pending/recurring frame chains (2), and GSAP ticker callbacks (2). Connected canvases and live WebGL contexts return to zero; ScrollTriggers remain zero. The reported missing favicon and context-growth defects did not reproduce even in this task's baseline, so no speculative fix was made for them.

## Files, contracts, and remaining work

Application changes are limited to `assets/hub.js`, `assets/workspace.css`, `assets/guide-motion.mjs`, import URLs in `assets/course-header.mjs` and `assets/course-scene.mjs`, and asset references in `index.html`, `cen100/index.html`, `mth140/index.html`, and `mth141/index.html`. Test/tool changes are the two new regression files, the shared-lifecycle fixture, and the three QA files described above.

No application contract functions were added or removed. `mount`/`unmount`, event names, storage keys and saved-state shapes, records, assessment IDs, hash routes, element IDs, CSP, runtime dependencies, and vendor bundles are preserved. Only the QA helper `until` gains an export.

No edits touch `assets/book/*`, `assets/app/stage.mjs`, `assets/app/three.mjs`, or Night Shift hero/scroll/timeline/deadline modules. There are no unresolved failures in this verified Chromium matrix. Claude still owns integration into `night-shift` and physical-device/visual approval. SwiftShader frame diagnostics do not establish real-GPU smoothness, Safari behavior, physical touch, or zoom quality.

## Reproduction and evidence

The final environment used Node 22.23.3 and Chromium 156.0.8078.4 with ANGLE SwiftShader. Local preview navigation was blocked by the container browser policy; browser runs therefore used GitHub Actions rather than bypassing that policy.

```sh
npm ci --prefix tools/ui-build
npm ci --prefix tools/scene-build
node --test tests/*.test.mjs tests/scene-*.cjs
(cd tools/ui-build && npm run build && npm test)
git diff --exit-code -- assets/vendor
# With Playwright Chromium installed as described in tools/qa/README.md:
node --test tools/qa/checks.test.mjs tools/qa/runtime.test.mjs tools/qa/instrument.test.mjs
node tools/qa/run.mjs
```

Actions runs in this repository retain JSON reports, logs, commit manifests, and available screenshots as artifacts (seven-day retention): **38338449212** (baseline), **38339583296** (first accessibility fix), **38341082639** (application fixes), **38341736899** (latency diagnostic), and **38342195533** (final complete matrix). The numeric before/after results and limitations are preserved permanently in this report.
