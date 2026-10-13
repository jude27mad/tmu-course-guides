# Night Shift browser QA

Run reusable Stage 3 and Stage 7 checks from the repository root:

```sh
node tools/qa/run.mjs
node tools/qa/run.mjs routes deadlines
node tools/qa/run.mjs stability --base /tmu-course-guides/
node tools/qa/run.mjs frames --gpu
```

The default runs all thirteen checks at both `/` and `/tmu-course-guides/`. `--base` selects one deployment path. The harness chooses a free local port, starts `tools/preview-server.mjs`, and closes its server, pages, contexts and browsers when it finishes or receives SIGINT/SIGTERM. It serves the existing static site; it does not build or modify product code.

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
| `webkit` | Reuses the route and deadline checks on Playwright WebKit at 1440 px and with an iPhone descriptor (390 px, touch, DPR 3). Reuses the full layout matrix with the same iPhone descriptor at 390 px. An unavailable binary or system dependency is an explicit skip with its launch error, never a passed WebKit assertion. |
| `nojs` | Every authored route with `javaScriptEnabled:false`: readable heading, complete coursework/course list, published dates, plain course hrefs and no `html.ns-held`, opacity-zero or visibility-hidden reading content. Visible `noscript` coursework counts; unrelated release-note lists do not. |
| `bfcache` | Every route leaves to the real privacy document and returns with browser Back. Native `pageshow.persisted` gates shell retention, singleton counts, deadline recomputation after changed completion/clock and subsequent routing. Unsupported native restoration is explicitly skipped. A separate, labelled synthetic persisted-event case exercises handlers on every route. |
| `failures` | Injects only the router's destination fetch: HTTP500, 10-second timeout, AbortError and HTML without a route region. Requires exactly one normal navigation with query/hash retained. Also checks every route with throwing local/session storage getters and methods, real offline navigation after warming all routes, and a native HTTP404 for a misspelt path. |
| `crosstab` | Exactly two real pages in one context for each course. Native Mark done/Undo and section UI actions must update the other page's Desk summaries and course card/dock via trusted browser storage events, retaining its shell. |
| `clock` | `page.clock` on Desk/course surfaces across Toronto midnight (including end-of-day expiry), Nov 1 DST fall-back and one backwards jump. Canonical target/date/chip/digits must agree with the current absolute clock within one minute and never become negative. |
| `forward` | Root and `index.html` historical CEN hashes forward once, carrying full query/hash data to `/cen100/`. Generic query-only options stay Desk. The actual inventory has no CEN-specific query keys. |

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

Run resilience checks or their helper tests separately:

```sh
node tools/qa/run.mjs nojs bfcache failures crosstab clock forward webkit
node --test tools/qa/resilience.test.mjs
```

WebKit uses its Playwright-installed executable and dependencies, without falling back to Chromium. Set `PLAYWRIGHT_BROWSERS_PATH` if those browsers were installed in a custom directory. Native BFCache fixtures use the public `TMU_BOOT_OPTIONS.autoPrefetch=false`: the preview server's `Cache-Control:no-store` prefetched HTML can otherwise exclude Chromium's cache. They use an advancing native Date offset and observe actual persisted events; the separate synthetic-handler phase uses `page.clock`. Offline coverage warms every route and module first, so it does not promise cold, unvisited content offline. The repository has no custom 404 document: the local preview's readable HTTP404 response is covered; GitHub Pages' hosted 404 presentation needs a hosted run. See [resilience findings](../../docs/qa/night-shift/resilience.md) for protected-file defects and proposed patches.
