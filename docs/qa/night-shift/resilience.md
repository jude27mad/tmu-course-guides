# Night Shift resilience

Work starts from `night-shift` revision `aa41914ea33dd9172559f52cc2f2c7505733a32a` on `codex/ns-resilience`. This request authorizes implementation and integration into `night-shift`; the earlier documentation-only and Claude-only push rules are superseded. No `main` push or protected-file edit is authorized or performed.

## Reproduce

```sh
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers \
QA_CHROMIUM_PATH=/usr/bin/chromium node tools/qa/run.mjs
node --test tests/*.test.mjs tests/scene-*.cjs
node --test tools/qa/checks.test.mjs tools/qa/runtime.test.mjs tools/qa/resilience.test.mjs
PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright \
QA_CHROMIUM_PATH=/usr/bin/chromium node --test tools/qa/instrument.test.mjs
cd tools/ui-build
npm ci --cache /tmp/ns-resilience-npm-cache && npm run build && npm test
```

QA uses the existing reports writer: each of the seven checks writes its own JSON and Markdown, with the usual run summary, at both `/` and `/tmu-course-guides/`. `tools/qa/run.mjs` registers the checks with one import line. Reports stay git-ignored; assertions and expected failure diagnostics remain in their JSON.

## Functional fixes and regressions

- **Unbounded route fetch/body:** the router previously waited forever for a stalled fetch or response body. A 10-second aborting timeout bounds the entire read; failed navigation makes exactly one normal navigation to the requested URL, including its query and hash. Two test-first stall regressions and HTTP 500/AbortError exact-once tests are in `tests/router.test.mjs`.
- **Warmed routes failed offline:** swapping routes removed their loaded stylesheet nodes, forcing a network request on revisit even with route HTML and modules cached. The router now retains retired sheets inert in their original positions and reuses them in authored order; duplicate copies are retired so the cache stays bounded. `core.loadCSS` reactivates retained feature sheets through the CSSOM. Test-first regressions in `tests/router.test.mjs` and `tests/night-core-css.test.mjs`, plus native browser checks at both bases, verify offline navigation and unchanged active CSS order. Offline poster failures remain recorded as expected diagnostics for the exact warmed URLs; coursework remains usable.
- **Stale cross-tab guide state:** CEN and math guides retained mount-local progress and sections despite another tab updating storage. Relevant native storage events now re-read the saved records, update controls/card and notify existing deadline/workspace owners. Remote section refresh suppresses writes to avoid echoing the event. Tests cover completion, Undo, notes, checklist state, section/group, disposal and write counts in `tests/resilience-state.test.mjs`.
- **Stale restored native cards:** CEN and math next-assessment cards lacked a persisted `pageshow` refresh even though Night Shift's deadline adapter already refreshed. Their existing date/card routines now run immediately on restoration. Three test-first persisted-handler regressions are in `tests/resilience-state.test.mjs`.
- **Desk minute boundary exceeded the update limit:** adding 50 ms after an exact wall-clock minute scheduled a 60,050 ms semantic refresh. A backwards jump could leave the old chip beyond the required minute. The existing alignment delay is now capped at 60,000 ms. A real Desk-mount regression first observed the stale `30m` chip, then verifies `1h 29m` after the jump and 60 seconds.
- **Direct math loads placed navigation before Skip:** `hub.js` only respected the Desk's existing Skip link and prepended itself before the math Skip links. It now inserts after an existing body-level Skip link on every route. The Skip link is positioned outside normal flow, so no layout/CSS changes are needed. Three test-first regressions in `tests/hub-skip.test.mjs` cover both bases, native first focus, Desk behavior and persistent hub identity.
- **Empty no-JavaScript coursework:** CEN100 and MTH141 now contain inert `<noscript>` lists of canonical titles, published dates/times, quiz-week uncertainty and pending finals, with native guide links. Normal JavaScript presentation is unchanged. Three canonical-data/reachability/link regressions are in `tests/nojs.test.mjs`.

CEN's modified guide URL receives `?v=20261013-resilience1`. Storage keys, saved shapes, assessment IDs, course data, motion timing, CSS and visuals are preserved. No runtime dependency is added.

## Protected defects and proposed patches

**MTH140 no-JavaScript fallback:** `mth140/index.html` leaves `#assessment-list` empty and only directs readers to D2L; coursework titles, published dates and native links to the other course guides are absent. The `nojs` check records these failures. [Proposed exact fallback patch](resilience-mth140-nojs.patch) adds the existing four quiz weeks, announced October 19 Monday make-up, October 23 midterm at 6:30–8:30 PM Toronto and pending final. It is not applied.

**Shared math-guide and hub cache tokens:** the cache invariant test requires fresh URLs for the changed `assets/math-guide.mjs` and `assets/hub.js`. Both math pages and all four route documents, respectively, currently name their deployed `?v=20261013-shift1` URLs. MTH140 is protected, so partial token changes would create duplicate module URLs or mismatched shell signatures. [Proposed synchronized token patch](resilience-cache-tokens.patch) updates all six references together; it is not applied. `tests/asset-urls.test.mjs` retains its failing assertion rather than hiding this deployment limitation. Both proposed patches pass `git apply --check` against the unchanged protected document.

All user-listed protected files remain byte-identical in this branch. These patches require the owner of the paused book branch to apply them together before treating the whole release as verified.

## Verification record

The clean starting revision passed all 260 root tests, with no failures or skips, after installing the existing `tools/ui-build` and `tools/scene-build` development dependencies. Its unchanged UI build and all six course × motion workflows passed. The vendor build was byte-identical.

After merging latest `night-shift` (already up to date at `aa41914`), the root suite reports **277 passed, one failed, no skips** out of 278 tests. The sole failure is `changed assets never reuse a URL the deployed site served`, for the six shared math-guide/hub references described above; it is not allowlisted or weakened. The UI build and test suite pass, preserving all six course × motion workflows and the Desk/router/fallback checks; `assets/vendor/` remains byte-identical. QA helper/runtime tests pass **31/31**, and browser instrumentation tests pass **14/14**.

Full-run reports: `tools/qa/reports/2026-10-13T18-49-40-723Z-19524/`. The final clock rerun is `tools/qa/reports/2026-10-13T18-53-07-651Z-20412/`, **passed at both bases with zero failures**. It supersedes the full run's clock fixture: optional real-network prefetch raced the simulated fetch-timeout clock and generated an `ERR_ABORTED` diagnostic. The corrected fixture disables optional prefetch before advancing the clock; it does not ignore those errors. All reported card/dock/HUD/Desk values still use the real canonical records and exact clock instants.

| Check | `/` | `/tmu-course-guides/` |
| --- | --- | --- |
| routes | Passed | Passed |
| stability | Failed (1 failed assertions) | Passed |
| frames | Failed (1 failed assertions) | Passed |
| deadlines | Passed | Passed |
| modes | Failed (1 failed assertions) | Failed (3 failed assertions) |
| layout | Failed (18 failed assertions) | Failed (18 failed assertions) |
| webkit | Skipped | Skipped |
| nojs | Failed (6 failed assertions) | Failed (6 failed assertions) |
| bfcache | Passed | Passed |
| failures | Passed | Passed |
| crosstab | Passed | Passed |
| clock | Passed | Passed |
| forward | Passed | Passed |

The full run completed all 26 check/base combinations and exited 1 with 80 failed assertions; its JSON/Markdown remains unchanged. The table uses the later clock and layout reports for those two checks. The final layout rerun (`tools/qa/reports/2026-10-13T19-10-40-103Z-31503/`) removes the 12 math Skip-order failures per base after the functional hub fix, leaving only the 18 small-control assertions per base. The resulting individual reports still contain 54 failed assertions, so this is not a green release gate. No result is silently accepted or allowlisted.

The root stability run recorded pending rAF callbacks increasing 2→3, with recurring callbacks unchanged at 2 and every listener/observer/GSAP count flat. A separate vendor-only, WebGL-disabled probe reproduced the same 3-pending/2-recurring pulse without importing the changed router/core: ScrollTrigger's existing 250 ms interval briefly schedules its finite `Ct` update. Later samples return to 1–2 pending. This supports snapshot timing jitter rather than a confirmed product leak, but the actual stability assertion remains failed. A proposed QA follow-up is to compare both snapshots at an equivalent native-frame phase after garbage collection, keeping the growth assertions and testing the vendor's finite pulse. No such change or allowlist is applied here.

Settling and layout assertions also remain enforced. Native-clock and Date-offset probes both showed finite GSAP wrapper entrances eventually clearing under long SwiftShader frames; they did not reveal an orphaned tween or an inert/readability trap. Small controls still need a separate layout change; this request forbids visual changes. The functional math Skip ordering defect is fixed above and verified by a separate layout rerun. No longer delay or altered animation timing is substituted for a passing result.

The three project-base reduced-motion drawing assertions sampled a delayed first static paint, not a confirmed animation loop. A single MTH141 probe with OS reduce plus saved `full` stayed at 41 draw calls before `renderer.compileAsync` completed, then painted once (51 calls, `sceneFrame=1`) and stayed at that count/frame through six subsequent samples to 6.48 seconds, with motion off and no rotation. Proposed QA follow-up: await `data-scene-ready=true` or the poster fallback before the drawing baseline, then retain the existing 450 ms unchanged-draw assertion. The recorded failures remain; no protected scene/header patch is warranted by this evidence.

## Integration

The latest remote `night-shift` remains `aa41914`; merging it into this branch was already up to date. Functional revisions are `426ff74` (router recovery/offline sheets), `1714ff6` (guide state/resume), `bf39317` (permitted no-JS fallbacks), `85487ad` (Desk clock cap) and `9b7f199` (Skip ordering). QA was introduced in `43682df` and stabilized in `33fd2da`/`5ddd2a1`. Independent product/harness review, fresh root/UI checks and the affected clock/layout reruns are complete. Integration is limited to `codex/ns-resilience` and `night-shift`; `main` stays at `f4c8342`.

## Coverage limits

Playwright's WebKit browser downloaded successfully, but launch fails because this executor lacks its GTK/GStreamer and other shared libraries. `webkit` is explicitly skipped at each base, with the launch reason; no Safari or physical iPhone pass is claimed. The configured iPhone descriptor is 390px wide, touch-enabled, mobile and DPR 3; desktop is 1440px. A runnable WebKit environment will execute the existing routes, deadlines and layout assertions through that browser.

Native BFCache coverage uses actual cross-document navigation and browser Back, observes `pageshow.persisted`, and checks the shell marker, singleton counts and usable navigation. Synthetic persisted events separately exercise resume handlers and are labelled as such. Chromium's default BFCache-disable flag is removed for the native fixture. The preview server's `no-store` HTML prefetch can prevent cache restoration; any fixture disabling optional prefetch is reported with the result.

The repository has no custom `404.html`. The misspelt-route test verifies native HTTP 404, the unchanged requested path, readable `Not found` and no claimed application route. GitHub Pages' hosted 404 presentation is not reproduced locally.

Offline coverage distinguishes warm routes/modules from unvisited routes; no offline first-install guarantee is claimed. SwiftShader frame metrics and delayed animation settlement do not establish real-device smoothness or visual approval. No screenshots are sent to the user.
