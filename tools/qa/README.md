# Night Shift browser QA

Run reusable Stage 3 and Stage 7 checks from the repository root:

```sh
node tools/qa/run.mjs
node tools/qa/run.mjs routes deadlines
node tools/qa/run.mjs stability --base /tmu-course-guides/
node tools/qa/run.mjs frames --gpu
```

The default runs all fourteen checks at both `/` and `/tmu-course-guides/`. `--base` selects one deployment path. The harness chooses a free local port, starts `tools/preview-server.mjs`, and closes its server, pages, contexts and browsers when it finishes or receives SIGINT/SIGTERM. It serves the existing static site; it does not build or modify product code.

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

| `webkit` | Reuses the route and deadline checks on Playwright WebKit at 1440 px and with an iPhone descriptor (390 px, touch, DPR 3). Reuses the full layout matrix with the same iPhone descriptor at 390 px. An unavailable binary or system dependency is an explicit skip with its launch error, never a passed WebKit assertion. |
| `nojs` | Every authored route with `javaScriptEnabled:false`: readable heading, complete coursework/course list, published dates, plain course hrefs and no `html.ns-held`, opacity-zero or visibility-hidden reading content. Visible `noscript` coursework counts; unrelated release-note lists do not. |
| `bfcache` | Every route leaves to the real privacy document and returns with browser Back. Native `pageshow.persisted` gates shell retention, singleton counts, deadline recomputation after changed completion/clock and subsequent routing. Unsupported native restoration is explicitly skipped. A separate, labelled synthetic persisted-event case exercises handlers on every route. |
| `failures` | Injects only the router's destination fetch: HTTP500, 10-second timeout, AbortError and HTML without a route region. Requires exactly one normal navigation with query/hash retained. Also checks every route with throwing local/session storage getters and methods, real offline navigation after warming all routes, and a native HTTP404 for a misspelt path. |
| `crosstab` | Exactly two real pages in one context for each course. Native Mark done/Undo and section UI actions must update the other page's Desk summaries and course card/dock via trusted browser storage events, retaining its shell. |
| `clock` | `page.clock` on Desk/course surfaces across Toronto midnight (including end-of-day expiry), Nov 1 DST fall-back and one backwards jump. Canonical target/date/chip/digits must agree with the current absolute clock within one minute and never become negative. |
| `forward` | Root and `index.html` historical CEN hashes forward once, carrying full query/hash data to `/cen100/`. Generic query-only options stay Desk. The actual inventory has no CEN-specific query keys. |

Telemetry records every console error, uncaught error, failed request and HTTP error as a failing assertion for each case. Optional unavailable product features are not broadly ignored. The command palette alone can be explicitly skipped when its dialog is absent, as Task G permits.

Instrumentation runs before application scripts. Listener accounting honors duplicate `(type, callback, capture)` registrations, removal, `once` and abort signals. WeakRefs keep the QA registry from retaining removed DOM. Both snapshots request garbage collection through Playwright when supported; availability is recorded. Observer accounting reports live instances separately from observers with active targets. rAF accounting reports pending requests and requests scheduled from inside a frame callback, rather than cumulative requests. Stability uses a continuously advancing Date offset at Oct 13 noon Toronto while preserving native animation frames/timers; the deadline check uses Playwright's installed clock. Canvas draw calls are diagnostic cumulative counters; WebGL counts exclude lost contexts. GSAP metrics observe the already-loaded singleton. Browser errors and all raw counts remain in JSON for diagnosis. A route-wrapper settlement defect remains a failed assertion while the remaining lifecycle/count checks continue.

The Node-side poller makes one final condition sample at its deadline so a slow, stale browser reply cannot be mistaken for the current state. The predicate and polling budget are unchanged; a still-unsettled wrapper fails.

Verification limits: deadline checks use forced-off motion and native button activation to isolate semantic behavior from simulated-clock pointer hit testing. Other checks use real pointer/keyboard activation. The resume test dispatches `visibilitychange` with a synthetic `document.hidden` getter; it exercises product resume handlers and absolute-clock recomputation, not background-tab throttling. Pending finite frame chains can briefly qualify as recurring rAF; snapshots happen after settlement. Canvas draw counts measure drawing API calls, not presented frames. Unexposed GSAP internals are reported as unavailable. Frame checks cover Chromium only. The Desk currently has an empty mount point for future artwork, so the no-WebGL Desk check reports its DOM course list fallback. No desktop run establishes Safari, physical touch, phone GPU, zoom or visual-design approval.

Run the harness's own focused tests separately from product checks:

```sh
node --test tools/qa/checks.test.mjs tools/qa/runtime.test.mjs
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node --test tools/qa/instrument.test.mjs
```

Browser instrumentation tests intentionally fail when Playwright/Chromium is missing; they do not report a false pass through an implicit skip.

## Performance measurements and budgets

Run `node tools/qa/run.mjs perf` with the Playwright and Chromium variables above. `tools/qa/perf-budgets.json` contains separate measured baselines and limits for each base, route and profile. Margins are 10%, with at least two extra requests, 4,096 extra total bytes, 8,192 extra bytes per resource type, and one extra import edge. The per-type allowance covers the planned generated head hints: the three documents speculatively fetched from CEN100 add 5,622 bytes together. These limits are generated from the unchanged control baseline. A missing or incomplete budget fails. Browser errors, incomplete network samples and module URL aliases also fail; SwiftShader timings never gate device speed.

`QA_PERF_RECORD=1` explicitly records a new baseline without budget comparisons. Generate budgets from the resulting `perf.json` using the exported `makeBudgets(report)` in `checks-perf.mjs`, review the measurements, and commit the report and budgets together. `QA_PERF_BASELINE` selects an alternate budget file. Recording is separate from normal checks and must not be used to waive regressions.

Generate static route hints with `node tools/generate-modulepreloads.mjs --write`; verify them with `node tools/generate-modulepreloads.mjs --check` and `node --test tests/module-graph.test.mjs tests/modulepreloads.test.mjs`. V8 parses the actual imports, including their version queries. The boot policy includes the Desk's awaited directory/data imports and excludes deferred scene/effect/vendor imports. The same generated block preloads only Archivo's used Latin font; font files and `font-display: swap` stay unchanged.

## Performance visual baseline

Capture the same route viewport matrix before and after a performance change:

```sh
PLAYWRIGHT_LEGACY_SCREENSHOT=1 PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node tools/qa/compare-perf-visuals.mjs capture before --repeat-case root-cen100-1440x900-dark --serial --compositor-drain --disable-gpu-rasterization
PLAYWRIGHT_LEGACY_SCREENSHOT=1 PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node tools/qa/compare-perf-visuals.mjs capture after --serial --compositor-drain --disable-gpu-rasterization
node tools/qa/compare-perf-visuals.mjs compare
node --test tools/qa/compare-perf-visuals.test.mjs
```

The 32 cases cover Desk/CEN100/MTH140/MTH141, both deployment bases, 1440×900 and 390×844, and dark/light. PNGs, manifests and raw pixel diff PNGs go under ignored `tools/qa/reports/perf-visuals/`. PNG decoding uses an already-installed `pngjs` from `/opt/codex/cua_node/lib/node_modules/pngjs` (`PNGJS_PATH` can override it); no product dependency is added. `--only CASE_ID` selects one case; `--resume` captures only missing/failed cases from a completed run with unchanged source, recipe and concurrency, retaining earlier successful captures and failure telemetry. Interrupted or incomplete provenance requires a fresh matrix. `--no-webgl` adds Chromium's native WebGL-disable flag for a separate fallback run; it overwrites that label's manifest, so retain the live matrix before using it. `--full-page` is an exploratory capture option, because capturing beyond the viewport can omit a paused WebGL drawing buffer. `--native-clock` diagnoses ordinary entrance timing without the initial Date offset and writes into a separate `before-native-clock`/`after-native-clock` directory.

Fresh contexts seed the existing saved scene-pause key, theme and a route-specific `Math.random` sequence while leaving normal DOM entrance motion enabled. A moving Date offset starts at noon Oct 13 Toronto without freezing GSAP. Captures wait for completed route content, font readiness, decoded images and a ready static scene, then check natural wrapper settlement after optional idle initialization. Natural settlement defects are recorded. The product's own `GuideMotion.setPaused(true)` and `setScenePaused(true)` complete/cancel tracked motion before the final required opacity/filter/transform gate and 1.5 s settled delay. Only then Date freezes at `2026-10-13T16:00:00.000Z`; `workspace-changed`/`visibilitychange` refresh the real navigation marker and deadlines. Scene frames and bounds must remain stable for 100 ms. A final `visibilitychange` requests the paused renderer's static frame immediately before the screenshot. The screenshot uses the entire requested viewport and Playwright `animations:'disabled'`; there are no masks, crops, hidden elements or injected CSS.

`--serial` avoids competing SwiftShader shader startup. `--compositor-drain` adds Chromium's `--run-all-compositor-stages-before-draw`; `--disable-gpu-rasterization` disables CSS GPU rasterization while retaining SwiftShader WebGL. `PLAYWRIGHT_LEGACY_SCREENSHOT=1` removes Playwright's opt-in `CDPScreenshotNewSurface` feature. These conditions are recorded in the recipe and actual Chromium command line and must match between matrices. CEN desktop exposed coordinate-based gradient dither variants on unchanged source despite matching layout, font and scene observations. Compositor draining and `--disable-partial-raster` alone retained 30,196-pixel repeat failures. CSS CPU raster matched four minimal contexts but a broader matrix exposed a 51,619-pixel difference; a five-second settlement delay reproduced that failure. Those runs remain archived diagnostic evidence. The legacy screenshot surface matched six CEN contexts across three browser launches, including CEN → MTH140 → MTH141 → CEN route history. The complete matrices must independently pass exact repeat and comparison gates. `--settled-delay-ms` adjusts only the pause settlement interval (minimum 1,500 ms); `--observe-compositor` records native LayerTree observations without computed-style diagnostics. `--probe-history CASE_ID` adds a diagnostic case after an `--only` capture and before its fresh-context repeat; it requires unique IDs on the same deployment base. Earlier failed probes remain evidence rather than passing comparisons. `--repeat-case CASE_ID` chooses the independent fresh-context repeat (default `--repeat-check` uses MTH140 desktop dark). Optional `--diagnostic` records computed ancestor styles/layers and consecutive screenshots for investigations; it is omitted from final matrix commands.

Manifests record rendered platform fonts through Chrome DevTools, actual font requests, image intrinsic/rendered dimensions and positions, scene state after the final redraw, errors and screenshot/pixel hashes. A fingerprint of tracked and untracked static product files protects resumed captures from mixing source states under the same Git commit; a completed run checks that source remained unchanged. `--repeat-check` repeats a representative desktop MTH140 dark capture. Comparison is exact RGBA, with no tolerance or accepted difference threshold; it validates canonical case identities, verifies every PNG and repeated PNG against its recorded hash, recomputes repeat pixels and rejects differing recipes. Exit 1 reports different pixels, missing/invalid captures, browser errors, natural settlement failures or invalid requested repeat evidence. Diagnostics remain in the comparison report. SwiftShader captures establish Chromium layout evidence only.

Run resilience checks or their helper tests separately:

```sh
node tools/qa/run.mjs nojs bfcache failures crosstab clock forward webkit
node --test tools/qa/resilience.test.mjs
```

WebKit uses its Playwright-installed executable and dependencies, without falling back to Chromium. Set `PLAYWRIGHT_BROWSERS_PATH` if those browsers were installed in a custom directory. Native BFCache fixtures use the public `TMU_BOOT_OPTIONS.autoPrefetch=false`: the preview server's `Cache-Control:no-store` prefetched HTML can otherwise exclude Chromium's cache. They use an advancing native Date offset and observe actual persisted events; the separate synthetic-handler phase uses `page.clock`. Clock fixtures also disable optional prefetch so virtual fetch-timeout timers do not race real network requests while time advances. Offline coverage warms every route and module first, so it does not promise cold, unvisited content offline. The repository has no custom 404 document: the local preview's readable HTTP404 response is covered; GitHub Pages' hosted 404 presentation needs a hosted run. See [resilience findings](../../docs/qa/night-shift/resilience.md) for protected-file defects and proposed patches.
