# Night Shift resilience

Implemented on `codex/ns-resilience`, starting from `night-shift` revision `aa41914ea33dd9172559f52cc2f2c7505733a32a`. The remote `night-shift` head fetched for final verification, `672326669b770c314b2ca518187516efe735f308`, is incorporated by merge `7b97939`. The final code verification below is against that merged revision; subsequent report changes affect documentation only. No visual changes or edits to the user-listed protected files are introduced by this work. Upstream Task L changes are preserved exactly. `main` remains unchanged.

## Reproduce

```sh
npm ci --prefix tools/ui-build --cache /tmp/ns-resilience-npm-cache
npm ci --prefix tools/scene-build --cache /tmp/ns-resilience-npm-cache
PLAYWRIGHT_PATH=/workspace/qa-playwright/node_modules/playwright \
PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers \
node tools/qa/run.mjs
node --test tests/*.test.mjs tests/scene-*.cjs
PLAYWRIGHT_PATH=/workspace/qa-playwright/node_modules/playwright \
PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers \
node --test tools/qa/checks.test.mjs tools/qa/runtime.test.mjs \
  tools/qa/resilience.test.mjs tools/qa/instrument.test.mjs
cd tools/ui-build
npm run build
PLAYWRIGHT_PATH=/workspace/qa-playwright/node_modules/playwright \
PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers npm test
```

The QA-only Playwright package is installed outside the repository at `/workspace/qa-playwright`, pinned to `1.64.0`; its Chromium and WebKit downloads use `/workspace/pw-browsers`. A fresh executor needs these browsers and their host dependencies before running the commands above.

QA uses the existing reports writer: each of the seven checks writes its own JSON and Markdown, with the usual run summary, at both `/` and `/tmu-course-guides/`. `tools/qa/run.mjs` registers the checks with one import line. Reports stay git-ignored; assertions and expected failure diagnostics remain in their JSON.

## Functional fixes and regressions

- **Unbounded route fetch/body:** the router previously waited forever for a stalled fetch or response body. A 10-second aborting timeout bounds the entire read; failed navigation makes exactly one normal navigation to the requested URL, including its query and hash. Two test-first stall regressions and HTTP 500/AbortError exact-once tests are in `tests/router.test.mjs`.
- **Warmed routes failed offline:** swapping routes removed their loaded stylesheet nodes, forcing a network request on revisit even with route HTML and modules cached. The router now retains retired sheets inert in their original positions and reuses them in authored order; duplicate copies are retired so the cache stays bounded. `core.loadCSS` reactivates retained feature sheets through the CSSOM. Test-first regressions in `tests/router.test.mjs` and `tests/night-core-css.test.mjs`, plus native browser checks at both bases, verify offline navigation and unchanged active CSS order. Offline poster failures remain recorded as expected diagnostics for the exact warmed URLs; coursework remains usable.
- **Stale cross-tab guide state:** CEN and math guides retained mount-local progress and sections despite another tab updating storage. Relevant native storage events now re-read the saved records, update controls/card and notify existing deadline/workspace owners. Remote section refresh suppresses writes to avoid echoing the event. Tests cover completion, Undo, notes, checklist state, section/group, disposal and write counts in `tests/resilience-state.test.mjs`.
- **Stale restored native cards:** CEN and math next-assessment cards lacked a persisted `pageshow` refresh even though Night Shift's deadline adapter already refreshed. Their existing date/card routines now run immediately on restoration. Three test-first persisted-handler regressions are in `tests/resilience-state.test.mjs`.
- **Desk minute boundary exceeded the update limit:** adding 50 ms after an exact wall-clock minute scheduled a 60,050 ms semantic refresh. A backwards jump could leave the old chip beyond the required minute. The existing alignment delay is now capped at 60,000 ms. A real Desk-mount regression first observed the stale `30m` chip, then verifies `1h 29m` after the jump and 60 seconds.
- **Direct math loads placed navigation before Skip:** `hub.js` only respected the Desk's existing Skip link and prepended itself before the math Skip links. It now inserts after an existing body-level Skip link on every route. The Skip link is positioned outside normal flow, so no layout/CSS changes are needed. Three test-first regressions in `tests/hub-skip.test.mjs` cover both bases, native first focus, Desk behavior and persistent hub identity. Latest Task L independently contains the same functional fix; after the merge, `hub.js` is byte-identical to upstream and uses its refreshed `qa1` token.
- **Empty no-JavaScript coursework:** CEN100 and MTH141 now contain inert `<noscript>` lists of canonical titles, published dates/times, quiz-week uncertainty and pending finals, with native guide links. Normal JavaScript presentation is unchanged. Three canonical-data/reachability/link regressions are in `tests/nojs.test.mjs`.

A separate read-only browser probe verifies the new fallbacks remain inert with JavaScript enabled in all eight course × direct/router × base cases. Direct documents contain no parsed fallback list; router imports contain it but render no rectangles, text or layout. Shell markers are unchanged and there are no page errors. Probe: `/tmp/ns-noscript-inert.mjs`.

CEN's modified guide URL receives `?v=20261013-resilience1`. Storage keys, saved shapes, assessment IDs, course data, motion timing, CSS and visuals are preserved. No runtime dependency is added.

## Protected defects and proposed patches

**MTH140 no-JavaScript fallback:** `mth140/index.html` leaves `#assessment-list` empty and only directs readers to D2L; coursework titles, published dates and native links to the other course guides are absent. The `nojs` check records these failures. [Proposed exact fallback patch](resilience-mth140-nojs.patch) adds the existing four quiz weeks, announced October 19 Monday make-up, October 23 midterm at 6:30–8:30 PM Toronto and pending final. It is not applied.

**Shared math-guide cache token:** the cache invariant test requires a fresh URL for the changed `assets/math-guide.mjs`. Both math documents still use their deployed `?v=20261013-shift1` URL. MTH140 is protected, so changing only MTH141 would create two module URLs in the persistent shell. [Proposed synchronized token patch](resilience-cache-tokens.patch) updates the two references together; it is not applied. `tests/asset-urls.test.mjs` retains its failing assertion. Latest upstream already refreshes the hub and core URLs, so neither needs a proposed cache patch here. Both proposed patches pass `git apply --check` against the merged documents.

All user-listed protected files remain byte-identical to `6723266`. That upstream contains its own Task L import-token and MTH140 accessibility changes; the resilience merge preserves them without further edits. The paused book branch owner must apply the two proposals before the protected no-JavaScript and deployed-cache gates can pass.

## Verification record

Final merged environment: Node `24.19.0`, Playwright `1.64.0`, its bundled Chromium `156.0.8078.4` and ANGLE SwiftShader. The browser pair matches latest upstream CI; CI itself uses Node 22. Development dependencies are installed in the existing UI/scene build tools. No runtime or repository dependency is added. Local socket access is enabled for browser/server checks.

The merged root suite reports **289 passed, one failed, no skips**, out of 290 tests. The sole failure is `changed assets never reuse a URL the deployed site served`, for the two math-guide references described above. The assertion is not weakened or allowlisted. The UI build and full UI workflow suite pass, including six course × motion workflows, palette, Desk, repeated routing, transition handoffs and fallback checks; `assets/vendor/` remains byte-identical. QA helper/runtime/instrumentation tests pass **49/49**, with no skips. Logs are `/tmp/ns-resilience-merged-root-final.log`, `/tmp/ns-resilience-merged-build.log`, `/tmp/ns-resilience-merged-ui.log` and `/tmp/ns-resilience-merged-harness.log`. An earlier root invocation lacked socket access and is discarded; the network-enabled full rerun supplies these counts.

The clean starting revision `aa41914` passed its then-current 260 root tests, with no failures or skips. That earlier baseline is separate from the final merged evidence.

Full merged-run reports: `tools/qa/reports/2026-10-13T19-26-09-459Z-36178/`, completed `2026-10-13T19:47:33.169Z`. The run completes all **26 check/base combinations** and correctly exits 1: **2336/2348 assertions pass, with 12 failed assertions**, all six MTH140 no-JavaScript findings repeated at each base. WebKit contributes zero assertions and one explicit skip per base. Every other check passes at both bases without skips. Table cells show passing/total assertions.

| Check | `/` | `/tmu-course-guides/` |
| --- | ---: | ---: |
| routes | Passed: 60/60 | Passed: 60/60 |
| stability | Passed: 45/45 | Passed: 45/45 |
| frames | Passed: 24/24 | Passed: 24/24 |
| deadlines | Passed: 128/128 | Passed: 128/128 |
| modes | Passed: 188/188 | Passed: 188/188 |
| layout | Passed: 288/288 | Passed: 288/288 |
| webkit | Skipped (browser unavailable) | Skipped (browser unavailable) |
| nojs | **Failed: 27/33** | **Failed: 27/33** |
| bfcache | Passed: 74/74 | Passed: 74/74 |
| failures | Passed: 43/43 | Passed: 43/43 |
| crosstab | Passed: 126/126 | Passed: 126/126 |
| clock | Passed: 75/75 | Passed: 75/75 |
| forward | Passed: 90/90 | Passed: 90/90 |

Native BFCache restoration observes `pageshow.persisted=true` on every route at both bases: all eight native cases preserve their shell marker and singleton counts, immediately re-resolve deadlines/state, and navigate successfully afterward. Synthetic handler cases are labelled separately in JSON. The six MTH140 no-JavaScript failures at each base are its empty coursework list, absent CEN100/MTH141 links, missing coursework titles, unreadable published dates and missing honest pending-date text. No result is allowlisted or silently accepted. This is not a green release gate until the protected proposals are applied and WebKit can run.

Pre-integration reports remain intact at `tools/qa/reports/2026-10-13T18-49-40-723Z-19524/` (full matrix with system Chromium 154), `2026-10-13T18-53-07-651Z-20412/` (corrected clock fixture) and `2026-10-13T19-10-40-103Z-31503/` (functional Skip fix). The initial clock fixture allowed optional real-network prefetch to race simulated fetch-timeout timers and recorded an `ERR_ABORTED` error. The final fixture disables optional prefetch before advancing time; no error is ignored. Initial layout target-size and arrival findings are addressed by latest upstream Task L and are verified again in the final matrix.

Earlier vendor-only, WebGL-disabled diagnostics reproduced ScrollTrigger's finite 250 ms rAF pulse without importing the changed router/core. Delayed reduced-motion draw samples captured a single static paint after `renderer.compileAsync`, then unchanged draw/frame/rotation counts through six further samples. These probes explain timing-sensitive categories in previous reports; they do not turn any failed assertion into a pass or certify protected rendering code. Proposed QA follow-ups are equivalent frame-phase snapshots and a scene-ready/poster baseline before the existing unchanged-draw sample; neither is applied here.

## Integration

Latest `night-shift` (`6723266`) is merged in `7b97939`. Overlapping hub-comment and QA-index edits were resolved by retaining upstream's hub verbatim and all index entries. Independent merged-product review found no material interactions; targeted arrival, accessibility, Skip and stylesheet tests pass. Functional revisions are `426ff74` (router recovery/offline sheets), `1714ff6` (guide state/resume), `bf39317` (permitted no-JS fallbacks), `85487ad` (Desk clock cap) and `9b7f199` (Skip ordering). QA was introduced in `43682df` and its clock/browser lifecycle fixtures refined in `33fd2da`/`5ddd2a1`. Integration is limited to `codex/ns-resilience` and `night-shift`; `main` stays at `f4c8342`.

## Coverage limits

Playwright's WebKit browser downloaded successfully, but launch fails because this executor lacks GTK 4, Graphene, HarfBuzz ICU, Manette, Hyphen and GLES shared libraries. `webkit` is explicitly skipped at each base, with the launch reason; no Safari or physical iPhone pass is claimed. The configured iPhone descriptor is 390px wide, touch-enabled, mobile and DPR 3; desktop is 1440px. A runnable WebKit environment will execute the existing routes, deadlines and layout assertions through that browser.

Native BFCache coverage uses actual cross-document navigation and browser Back, observes `pageshow.persisted`, and checks the shell marker, singleton counts and usable navigation. Synthetic persisted events separately exercise resume handlers and are labelled as such. Chromium's default BFCache-disable flag is removed for the native fixture. The preview server's `no-store` HTML prefetch can prevent cache restoration; any fixture disabling optional prefetch is reported with the result.

The repository has no custom `404.html`. The misspelt-route test verifies native HTTP 404, the unchanged requested path, readable `Not found` and no claimed application route. GitHub Pages' hosted 404 presentation is not reproduced locally.

Offline coverage distinguishes warm routes/modules from unvisited routes; no offline first-install guarantee is claimed. SwiftShader frame metrics and delayed animation settlement do not establish real-device smoothness or visual approval. No screenshots are sent to the user.

Latest upstream `checks.mjs` performs a fresh settlement predicate after its polling deadline. This establishes eventual fresh settlement, rather than a strict wall-clock timeout bound. The separate deterministic resilience clock samples still enforce their exact 60,000 ms endpoint.
