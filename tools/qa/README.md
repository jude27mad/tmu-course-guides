# Night Shift browser QA

Run reusable Stage 3 and Stage 7 checks from the repository root:

```sh
node tools/qa/run.mjs
node tools/qa/run.mjs routes deadlines
node tools/qa/run.mjs stability --base /tmu-course-guides/
node tools/qa/run.mjs frames --gpu
```

The default runs all seven checks at both `/` and `/tmu-course-guides/`. `--base` selects one deployment path. The harness chooses a free local port, starts `tools/preview-server.mjs`, and closes its server, pages, contexts and browsers when it finishes or receives SIGINT/SIGTERM. It serves the existing static site; it does not build or modify product code.

Playwright is the only QA dependency. Resolution first tries `PLAYWRIGHT_PATH`, defaulting to `/opt/node-tools/node_modules/playwright`, then Node's `require('playwright')`. Set `PLAYWRIGHT_PATH` to an installed package directory or its entry file. Chromium uses the Playwright browser when installed, with `/usr/bin/chromium` as a fallback. `QA_CHROMIUM_PATH` selects another executable.

For this Codex environment:

```sh
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node tools/qa/run.mjs
```

Software GL uses `--use-angle=swiftshader`, `--enable-unsafe-swiftshader` and `--ignore-gpu-blocklist`. `QA_GPU=1` or `--gpu` omits these flags. Reports record the requested mode and Chromium's actual WebGL renderer. SwiftShader frame numbers are diagnostics, not evidence of device smoothness. A browser run requires permission to create local sockets in restricted execution environments.

Each run writes `<check>.json`, `<check>.md`, `summary.json` and `summary.md` to `tools/qa/reports/<UTC timestamp>-<process id>/`. JSON includes assertions, raw observations, per-case browser errors and skip reasons. Reports are ignored by git. Exit 0 means the selected checks passed, exit 1 means assertions failed, and exit 2 means setup/CLI/reporting failed. Interruptions return 130 or 143 with partial results. A failing product check is recorded honestly; no failure allowlist or acceptance threshold is silently added.

| Check | Coverage and gates |
| --- | --- |
| `routes` | Desk → CEN100 → MTH140 → MTH141 → Desk, Back ×3, Forward ×2. Checks shell identity, document requests, URL, title, body route identity, rendered heading/content and focus within the Skip destination. |
| `stability` | Warm every route and reusable shell service, then compare the same mounted Desk before/after 20 round trips, 20 workspace changes, 20 palette cycles when present and 10 Mark done/Undo cycles. Fails on growing live or retained listeners, retained observer instances, active observers/targets, pending/recurring rAF callbacks, canvases, WebGL contexts, exposed GSAP ticker subscribers or ScrollTriggers. Mark done/Undo also assert target changes and restoration. |
| `frames` | Every route at 1440×900, five seconds of scripted wheel scrolling. Reports frame shares over 16.7 ms and 33 ms, p95/max intervals, long tasks over 50 ms, renderer and viewport. Requires a valid sample and long-task support; frame percentages have no invented pass threshold. |
| `deadlines` | Seeded existing storage keys, Toronto browser timezone and `page.clock.install`. CEN Academic Integrity Quiz at Oct 14 3 PM Toronto, MTH140 midterm at Oct 23 6:30 PM Toronto, and a quiz week without a section. Checks target identity/time, Desk overall and course summary, course card, dock and hero. Tests Mark done, Undo, and recomputation after a one-hour wall-clock jump during a visibility hold. |
| `modes` | Every route with forced-off, OS reduce, OS reduce plus saved legacy `full`, and saved `full` with normal OS settings. Restricted modes require static transforms, no running transform animations, no canvas drawing, cursor, particles or dust. A separate browser with `--disable-webgl` checks authored course posters, full DOM content and no WebGL rendering loop. |
| `layout` | Every route at 1440, 1024 and 390 px in dark/light themes. Checks horizontal overflow, 44 px controls, Skip first and a visible indicator on the first five tab stops. Native checkbox/radio labels count as their clickable target when at least 44×44 px. Inline links and footer links remain checked. |
| `perf` | Every route in a fresh, cache-disabled context at 390×844 with touch, 4× CPU slowdown and 1.6 Mbps down / 750 kbps up / 150 ms latency, and at 1440×900 unthrottled. Reports FCP, LCP, CLS, long tasks, coursework/deadline appearance, requests, CDP wire bytes by type and the actual boot import graph. Committed request/byte/depth budgets fail on growth; timing values remain report-only. |

Telemetry records every console error, uncaught error, failed request and HTTP error as a failing assertion for each case. Optional unavailable product features are not broadly ignored. The command palette alone can be explicitly skipped when its dialog is absent, as Task G permits.

Instrumentation runs before application scripts. Listener accounting honors duplicate `(type, callback, capture)` registrations, removal, `once` and abort signals. WeakRefs keep the QA registry from retaining removed DOM. Both snapshots request garbage collection through Playwright when supported; availability is recorded. Observer accounting reports live instances separately from observers with active targets. rAF accounting reports pending requests and requests scheduled from inside a frame callback, rather than cumulative requests. Stability uses a continuously advancing Date offset at Oct 13 noon Toronto while preserving native animation frames/timers; the deadline check uses Playwright's installed clock. Canvas draw calls are diagnostic cumulative counters; WebGL counts exclude lost contexts. GSAP metrics observe the already-loaded singleton. Browser errors and all raw counts remain in JSON for diagnosis. A route-wrapper settlement defect remains a failed assertion while the remaining lifecycle/count checks continue.

Verification limits: deadline checks use forced-off motion and native button activation to isolate semantic behavior from simulated-clock pointer hit testing. Other checks use real pointer/keyboard activation. The resume test dispatches `visibilitychange` with a synthetic `document.hidden` getter; it exercises product resume handlers and absolute-clock recomputation, not background-tab throttling. Pending finite frame chains can briefly qualify as recurring rAF; snapshots happen after settlement. Canvas draw counts measure drawing API calls, not presented frames. Unexposed GSAP internals are reported as unavailable. Frame checks cover Chromium only. The Desk currently has an empty mount point for future artwork, so the no-WebGL Desk check reports its DOM course list fallback. No desktop run establishes Safari, physical touch, phone GPU, zoom or visual-design approval.

Run the harness's own focused tests separately from product checks:

```sh
node --test tools/qa/checks.test.mjs tools/qa/runtime.test.mjs
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node --test tools/qa/instrument.test.mjs
```

Browser instrumentation tests intentionally fail when Playwright/Chromium is missing; they do not report a false pass through an implicit skip.

## Performance measurements and budgets

Run `node tools/qa/run.mjs perf` with the Playwright and Chromium variables above. `tools/qa/perf-budgets.json` contains separate measured baselines and limits for each base, route and profile. Margins are 10%, with at least two extra requests and 4,096 extra bytes for total/per-type traffic, and one extra import edge. A missing or incomplete budget fails. Browser errors, incomplete samples and module URL aliases also fail; SwiftShader timings never gate device speed.

`QA_PERF_RECORD=1` explicitly records a new baseline without budget comparisons. Generate budgets from the resulting `perf.json` using the exported `makeBudgets(report)` in `checks-perf.mjs`, review the measurements, and commit the report and budgets together. `QA_PERF_BASELINE` selects an alternate budget file. Recording is separate from normal checks and must not be used to waive regressions.

Generate static route hints with `node tools/generate-modulepreloads.mjs --write`; verify them with `node tools/generate-modulepreloads.mjs --check` and `node --test tests/module-graph.test.mjs tests/modulepreloads.test.mjs`. V8 parses the actual imports, including their version queries. The boot policy includes the Desk's awaited directory/data imports and excludes deferred scene/effect/vendor imports. The same generated block preloads only Archivo's used Latin font; font files and `font-display: swap` stay unchanged.

## Performance visual baseline

Capture the same route viewport matrix before and after a performance change:

```sh
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node tools/qa/compare-perf-visuals.mjs capture before --repeat-check
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node tools/qa/compare-perf-visuals.mjs capture after
node tools/qa/compare-perf-visuals.mjs compare
node --test tools/qa/compare-perf-visuals.test.mjs
```

The 32 cases cover Desk/CEN100/MTH140/MTH141, both deployment bases, 1440×900 and 390×844, and dark/light. PNGs, manifests and raw pixel diff PNGs go under ignored `tools/qa/reports/perf-visuals/`. PNG decoding uses an already-installed `pngjs` from `/opt/codex/cua_node/lib/node_modules/pngjs` (`PNGJS_PATH` can override it); no product dependency is added. `--only CASE_ID` selects one case; `--resume` captures only missing/failed cases while retaining earlier successful captures and failure telemetry. `--no-webgl` adds Chromium's native WebGL-disable flag for a separate fallback run; it overwrites that label's manifest, so retain the live matrix before using it. `--full-page` is an exploratory capture option, because capturing beyond the viewport can omit a paused WebGL drawing buffer. `--native-clock` diagnoses ordinary entrance timing without the initial Date offset and writes into a separate `before-native-clock`/`after-native-clock` directory.

Fresh contexts seed the existing saved scene-pause key, theme and a route-specific `Math.random` sequence while leaving normal DOM entrance motion enabled. A moving Date offset starts at noon Oct 13 Toronto without freezing GSAP. Captures wait for completed route content, font readiness, decoded images and a ready static scene, then check natural wrapper settlement after optional idle initialization. Natural settlement defects are recorded. The product's own `GuideMotion.setPaused(true)` and `setScenePaused(true)` complete/cancel tracked motion before the final required opacity/filter/transform gate and 1.5 s settled delay. Only then Date freezes at `2026-10-13T16:00:00.000Z`; `workspace-changed`/`visibilitychange` refresh the real navigation marker and deadlines. Scene frames and bounds must remain stable for 100 ms. A final `visibilitychange` requests the paused renderer's static frame immediately before the screenshot. The screenshot uses the entire requested viewport and Playwright `animations:'disabled'`; there are no masks, crops, hidden elements or injected CSS.

Manifests record rendered platform fonts through Chrome DevTools, actual font requests, image intrinsic/rendered dimensions and positions, scene state, errors and screenshot/pixel hashes. A fingerprint of tracked and untracked static product files protects resumed captures from mixing source states under the same Git commit. `--repeat-check` repeats a representative desktop MTH140 dark capture. Comparison is exact RGBA, with no tolerance or accepted difference threshold; it verifies each PNG against its recorded hash and rejects differing recipes. Exit 1 reports different pixels, missing captures, browser errors or a failed requested repeat. Natural settlement diagnostics remain in the comparison report and must be explained separately. SwiftShader captures establish Chromium layout evidence only.
