# Night Shift performance

All 16 cold-load cases and 368 resource budget checks pass. All 32 settled screenshot pairs are pixel-identical. Strict composite browser QA validates 26 passed records and 2 unavailable WebKit records, preserving the original failed full run. Two CEN100 native BFCache retention cases remain explicit coverage gaps.

The control product/visual reference is latest `night-shift` revision `66049a1`; the after product/visual reference is `3d14973`. Both cold-load runs passed all 16 route/base/profile cases. Raw evidence: [before](performance-before.json), [after](performance-after.json) and [committed budgets](../../../tools/qa/perf-budgets.json). The earlier [`4dc3568` control](performance-before-control-4dc3568.json), `6723266` [control](performance-before-control-6723266.json) and [result](performance-after-control-6723266.json), plus the initial [`aa41914` measurements](performance-initial-aa41914.json), are historical and do not serve as this comparison's control.

The functional product merge is `b301830`. Product and protected-source fingerprints bind the measured product to the visual reference independently of QA/evidence-only commits.

The fresh after perf executed from QA checkpoint HEAD `34aad19`, with reviewed working-tree helper bytes `b2bafede…`. Its product fingerprint `14aab876…` matches the `3d14973` visual capture. The recorded product/visual reference is not substituted for the later perf runtime HEAD; exact source/phase and helper provenance are validated by the accepted strict composite evidence.

The phone saving comes from avoiding unsolicited prefetches of the other three route documents. This summary includes only the eight phone cases; matching values at both deployment bases collapse to one number.

| Route | Phone requests | Requests removed | Phone wire B | Wire B removed | Wire reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| desk | 30 → 27 | 3 | 547,034 → 459,254 | 87,780 | 16.0% |
| cen100 | 53 → 50 | 3 | 1,515,304 → 1,473,114 | 42,190 | 2.8% |
| mth140 | 63 → 60 | 3 | 1,623,099 → 1,549,787 | 73,312 | 4.5% |
| mth141 | 63 → 60 | 3 | 1,600,135 → 1,526,883 | 73,252 | 4.6% |

Across the four separate phone cold loads at each base, the measured total reduction is 12 requests and 276,534 wire bytes. These totals sum independent fresh loads rather than one cached navigation session. Desktop request counts are unchanged; wire-byte change is +8,223 B per route across the two bases (positive values are overhead). Desktop keeps the existing idle route prefetch, so its network totals include the added hints in all four HTML documents plus the router guards. The detailed desktop rows below retain that cost.

Phone FCP increases in 7/8 sampled cases and decreases in 1/8; its after-minus-before range is -4–+1,168 ms. Phone LCP increases in 6/8 sampled cases and decreases in 2/8; its after-minus-before range is -1,568–+2,028 ms. All timing changes remain report-only observations from one SwiftShader sample per case. These values establish neither universal timing improvement nor physical-device speed; the traffic savings and visual result are assessed separately.

The matching latest-control/topic visual matrix is exact: 32/32 captures and 0/26,002,560 changed pixels. Both independent CEN repeats are exact. The recorded software-compositor environment retains live SwiftShader WebGL models and matching protected-source fingerprints; the detailed evidence is linked below.

Phone: 390×844, touch/mobile, DPR 1, 4× CPU slowdown, 1.6 Mbps download (200,000 B/s), 750 kbps upload (93,750 B/s), and 150 ms latency. Desktop: 1440×900, DPR 1, unthrottled. Every route at both `/` and `/tmu-course-guides/` starts in a fresh context with cache disabled and service workers blocked/bypassed. A moving Date offset starts at noon Toronto on October 13, 2026, while native timers and animation frames remain active. Chromium 154.0.8037.57 on Linux uses SwiftShader.

FCP, LCP, CLS, long tasks over 50 ms and readable-content times are report-only diagnostics. A single SwiftShader run per case does not establish a repeatable timing improvement, physical-phone pacing or Safari behavior. Timing regressions remain visible below; request counts, bytes and import depth have explicit gates.

Wire bytes come from CDP `Network.loadingFinished.encodedDataLength`, including HTTP headers. The static preview serves uncompressed responses. Decoded body/source sizes are separate diagnostics and must not be substituted for wire traffic.

Readable text uses a post-FCP viewport probe, effective ancestor opacity of at least 0.85, no nonzero blur or full clipping, and two native animation frames. The DOM/CSS approximation polls every 100 ms; it is not a physical screen presentation timestamp. The primary deadline is the Desk hero countdown or the course deadline chip. Actual compact-chip timing is separate: Desk chips below the initial viewport are marked `offscreen`; other null observations stay `not observed`, with reasons retained in raw JSON. The collection observes normal optional-feature fetches and a quiet network without importing vendors into the page.

Budgets reproduce from the control measurements: total/per-type bytes and request counts add 10%, with minimum allowances of 4,096 total bytes, 8,192 bytes per resource type, and 2 requests; longest import chain adds 1 edge. Missing/duplicate cases, unfinished samples, browser errors and module URL aliases fail. Timing values do not set pass/fail thresholds.

The per-type byte minimum was deliberately raised to 8,192 B before the after run, based on known hint overhead rather than after measurements. The original 6723266 policy calculation used 5,622 B of added prefetched heads against 40,498 B of CEN100 desktop fetch traffic, exceeding the earlier 4,096 B per-type floor and its 10% allowance. After refreshing the latest import tokens, the current generated blocks add 1,286 source bytes on Desk, 1,725 B on CEN100, 2,182 B on MTH140 and 2,182 B on MTH141; CEN100 desktop's other three prefetched heads total 5,650 B. The limits are regenerated from the latest 66049a1 control plus the established margin; after measurements do not calibrate them.

Timing and network cells show **before → after**. Times are milliseconds; resource values are bytes; longest chain is measured in import edges. Only resource types with nonzero traffic in either run are shown.

## / — phone

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 3,412 → 4,064 | 3,412 → 4,064 | 0.3071 → 0.3071 | 8 / 1,359 → 9 / 1,627 | 4,343 → 4,387 | 4,346 → 4,390 | offscreen → offscreen |
| cen100 | 2,336 → 3,504 | 9,468 → 11,496 | 0.7524 → 0.7524 | 24 / 11,242 → 31 / 14,312 | 9,963 → 13,009 | 9,966 → 13,009 | 9,967 → 13,009 |
| mth140 | 2,120 → 2,360 | 10,412 → 10,876 | 0.5652 → 0.5038 | 32 / 10,069 → 26 / 8,022 | 5,675 → 7,206 | 10,790 → 11,174 | 10,791 → 11,176 |
| mth141 | 3,184 → 4,252 | 11,376 → 11,620 | 0.5054 → 1.0075 | 26 / 7,976 → 32 / 14,177 | 7,536 → 9,523 | 11,552 → 12,237 | 11,552 → 12,237 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 → 27 | 547,034 → 459,254 | 5,859 → 7,139 | 306,562 → 307,414 | 54,038 → 54,038 | 90,281 → 90,281 | 382 → 382 | 89,912 → 0 | 15 / 4 → 15 / 4 |
| cen100 | 53 → 50 | 1,515,304 → 1,473,114 | 51,010 → 52,729 | 1,167,417 → 1,168,269 | 129,034 → 129,034 | 90,281 → 90,281 | 32,801 → 32,801 | 44,761 → 0 | 20 / 4 → 20 / 4 |
| mth140 | 63 → 60 | 1,623,099 → 1,549,787 | 19,411 → 21,607 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 73,761 → 73,761 | 76,360 → 0 | 26 / 4 → 26 / 4 |
| mth141 | 63 → 60 | 1,600,135 → 1,526,883 | 19,491 → 21,667 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 50,797 → 50,797 | 76,280 → 0 | 26 / 4 → 26 / 4 |

## / — desktop

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 1,888 → 2,160 | 1,888 → 2,160 | 0.1228 → 0.0000 | 2 / 192 → 3 / 610 | 2,798 → 3,077 | 2,798 → 3,078 | offscreen → offscreen |
| cen100 | 608 → 864 | 2,244 → 18,952 | 0.1385 → 0.3883 | 12 / 8,154 → 17 / 20,548 | 3,556 → 21,518 | 3,557 → 21,518 | 3,557 → 21,518 |
| mth140 | 748 → 708 | 2,056 → 2,496 | 0.1912 → 0.5342 | 11 / 7,543 → 11 / 9,430 | 9,166 → 1,705 | 9,169 → 10,986 | 9,169 → 10,986 |
| mth141 | 524 → 596 | 7,616 → 2,008 | 0.4528 → 0.0641 | 10 / 7,458 → 9 / 8,202 | 8,574 → 9,483 | 8,575 → 9,484 | 8,575 → 9,484 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 → 30 | 547,034 → 555,257 | 5,859 → 7,139 | 306,562 → 307,414 | 54,038 → 54,038 | 90,281 → 90,281 | 382 → 382 | 89,912 → 96,003 | 15 / 4 → 15 / 4 |
| cen100 | 53 → 53 | 1,515,304 → 1,523,527 | 51,010 → 52,729 | 1,167,417 → 1,168,269 | 129,034 → 129,034 | 90,281 → 90,281 | 32,801 → 32,801 | 44,761 → 50,413 | 20 / 4 → 20 / 4 |
| mth140 | 63 → 63 | 1,623,099 → 1,631,322 | 19,411 → 21,607 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 73,761 → 73,761 | 76,360 → 81,535 | 26 / 4 → 26 / 4 |
| mth141 | 63 → 63 | 1,600,135 → 1,608,358 | 19,491 → 21,667 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 50,797 → 50,797 | 76,280 → 81,475 | 26 / 4 → 26 / 4 |

## /tmu-course-guides/ — phone

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 3,896 → 4,064 | 3,896 → 4,064 | 0.3071 → 0.6326 | 9 / 1,319 → 11 / 1,834 | 5,336 → 4,870 | 5,337 → 4,877 | offscreen → offscreen |
| cen100 | 2,732 → 2,944 | 9,240 → 7,816 | 0.7524 → 0.7524 | 27 / 11,176 → 23 / 14,911 | 9,533 → 8,471 | 9,540 → 8,475 | 9,540 → 8,477 |
| mth140 | 2,076 → 2,216 | 8,084 → 8,596 | 0.5652 → 0.7313 | 23 / 5,267 → 28 / 7,036 | 5,802 → 5,929 | 8,213 → 8,907 | 8,216 → 8,908 |
| mth141 | 1,988 → 1,984 | 8,592 → 7,024 | 0.5054 → 1.2712 | 27 / 11,589 → 20 / 4,093 | 5,910 → 5,130 | 8,781 → 7,224 | 8,784 → 7,225 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 → 27 | 547,034 → 459,254 | 5,859 → 7,139 | 306,562 → 307,414 | 54,038 → 54,038 | 90,281 → 90,281 | 382 → 382 | 89,912 → 0 | 15 / 4 → 15 / 4 |
| cen100 | 53 → 50 | 1,515,304 → 1,473,114 | 51,010 → 52,729 | 1,167,417 → 1,168,269 | 129,034 → 129,034 | 90,281 → 90,281 | 32,801 → 32,801 | 44,761 → 0 | 20 / 4 → 20 / 4 |
| mth140 | 63 → 60 | 1,623,099 → 1,549,787 | 19,411 → 21,607 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 73,761 → 73,761 | 76,360 → 0 | 26 / 4 → 26 / 4 |
| mth141 | 63 → 60 | 1,600,135 → 1,526,883 | 19,491 → 21,667 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 50,797 → 50,797 | 76,280 → 0 | 26 / 4 → 26 / 4 |

## /tmu-course-guides/ — desktop

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 1,476 → 1,392 | 1,476 → 1,392 | 0.1165 → 0.1165 | 2 / 401 → 2 / 381 | 2,244 → 2,112 | 2,244 → 2,113 | offscreen → offscreen |
| cen100 | 632 → 656 | 7,612 → 14,888 | 0.4268 → 0.4823 | 10 / 8,136 → 14 / 18,242 | 9,132 → 18,506 | 9,133 → 18,506 | 9,133 → 18,507 |
| mth140 | 492 → 596 | 3,032 → 2,552 | 0.7062 → 0.5036 | 9 / 9,308 → 10 / 9,010 | 1,403 → 1,282 | 11,379 → 10,822 | 11,379 → 10,822 |
| mth141 | 620 → 804 | 1,932 → 2,516 | 0.2100 → 0.7380 | 10 / 3,525 → 12 / 8,244 | 9,401 → 1,613 | 9,401 → 9,785 | 9,401 → 9,786 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 → 30 | 547,034 → 555,257 | 5,859 → 7,139 | 306,562 → 307,414 | 54,038 → 54,038 | 90,281 → 90,281 | 382 → 382 | 89,912 → 96,003 | 15 / 4 → 15 / 4 |
| cen100 | 53 → 53 | 1,515,304 → 1,523,527 | 51,010 → 52,729 | 1,167,417 → 1,168,269 | 129,034 → 129,034 | 90,281 → 90,281 | 32,801 → 32,801 | 44,761 → 50,413 | 20 / 4 → 20 / 4 |
| mth140 | 63 → 63 | 1,623,099 → 1,631,322 | 19,411 → 21,607 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 73,761 → 73,761 | 76,360 → 81,535 | 26 / 4 → 26 / 4 |
| mth141 | 63 → 63 | 1,600,135 → 1,608,358 | 19,491 → 21,667 | 1,189,522 → 1,190,374 | 173,764 → 173,764 | 90,281 → 90,281 | 50,797 → 50,797 | 76,280 → 81,475 | 26 / 4 → 26 / 4 |

The clean latest 660 control records all 16 coursework and primary-deadline appearances. Only the four Desk strict-chip observations are null; the compact chips do not reach the initial viewport. There are no pending readability frames or appearance/collection caps in the control. Fresh after observations remain report-only; timing differences and any null observations with their raw reasons are retained honestly.

## Changes and remaining payload

Generated head hints preload each route's actual boot-critical module graph with the exact URL tokens, plus the basic Latin font. The hints improve resource discovery while preserving native static documents and module identity. Optional night-vendor/Three rendering paths remain outside the generated preload blocks. Save-Data/coarse-pointer protection avoids unsolicited route-document prefetches while preserving explicit pointer/keyboard intent and native navigation.

Archivo already uses `font-display: swap`; the 90,104-byte Latin WOFF2 and all font CSS remain unchanged. The preload uses the same Latin asset and anonymous CORS as the stylesheet request. The hub mark already has 34×34 intrinsic attributes. All six authored posters are 900×600 with reserved absolute geometry; the above-fold header posters already use asynchronous decoding and high fetch priority. The inventory found no eligible offscreen image/poster candidates within the protected-owner scope, so this change claims no lazy-image saving.

Larger opportunities remain in the unchanged visual dependencies: Three is 621,214 source bytes, night-vendor 69,065 bytes and GSAP 95,884 bytes, totaling 786,163 bytes. These source/body sizes exclude HTTP headers and differ from wire totals. Deferring or splitting those payloads would require coordination with their protected owners and preservation of the current visual behavior. Math routes load 173,764 stylesheet wire bytes in the control samples; hints alone do not shrink this CSS. See the [asset inventory](inventory.md) and raw before resources for the owners and individual payloads.

At the configured 200,000 B/s download cap, the 786,163 B combined library bodies require a theoretical network-only lower bound of 3.93 seconds of link time. The 173,764 B Math stylesheet wire payload requires approximately 0.87 seconds. These payload/rate calculations exclude latency, parsing and rendering; requests overlap, so they are neither predicted FCP/LCP savings nor additive page-timing improvements.

## Visual evidence

The final matched comparison reports 32/32 pixel-identical viewport captures, zero changed pixels, matching protected source evidence, and no capture, browser, settlement, repeat or evidence failures. See [comparison](performance-visual-comparison.json), [before manifest](performance-visual-before.json) and [after manifest](performance-visual-after.json). These are exact RGBA comparisons with no masks or pixel tolerance.

The final latest 660 control and 3d14973 topic comparison passes all 32 cases with 0 / 26,002,560 changed RGBA pixels, both independent CEN repeats exact, no diagnostic style reads, matching protected-source fingerprints, and valid live SwiftShader WebGL contexts. Earlier GPU-compositor runs exposed gradient-dither variability even on unchanged source. A calibrated native software-compositor backend made the matching recipe deterministic without editing product CSS, fonts or scene code, hiding models, masking pixels or weakening any exact repeat/comparison/evidence gate. Actual gears, wave and sphere remain rendered. Historical failed matrices and calibration probes remain archived.

Earlier exploratory compositor results, the 6723266 matrices, the initial `aa41914` visual matrix and the [interrupted 4dc3568 software control](performance-visual-before-software-interrupted-4dc3568.json) remain historical evidence. The 4dc control contains 24 captures and an exact representative repeat; it does not replace the fresh latest-control 32-case comparison. The [exploratory captures](performance-visual-exploratory.json) and [initial visual matrix](performance-visual-initial-aa41914.json) are also archived.

Historical 4dc control only: The control project-base CEN100 desktop sample recorded FCP at 2,032 ms, route readiness at 5,523.7 ms and ended at 13,674.2 ms, but no qualifying readable viewport observation. Its coursework/deadline/chip timings remain null. There were no pending readability frames, no collection-cap exhaustion and no browser errors. The collector did not retain rejected probe geometry/criteria, so the exact rejection reason is unestablished; these are report-only timings, not an inferred absence or an accepted error.

## Upstream owner changes and scope

The owner applied the protected MTH140 no-JavaScript fallback and synchronized both math-guide tokens upstream in 66049a1. The topic merges that upstream as b301830, preserving the latest MTH140 body and protected assets byte-for-byte with one generated head preload block. The old expected 12 nojs failures no longer apply: all current no-JS cases pass in the retained completed raw QA. This task did not push main, which advanced externally.

The full 14-check × two-base execution [96502](performance-full-run-failure.json) completed all 28 records and remains failed: seven assertions across [perf](performance-full-run-perf-failure.json), [bfcache](performance-full-run-bfcache-failure.json) and [crosstab](performance-full-run-crosstab-failure.json), plus one BFCache ERR_ABORTED event and eight reproduced QA-bootstrap SecurityErrors (four/base), whose original `expected:false` flags remain unchanged. The two WebKit records are unavailable, not passing executions. The full matrix is never described as passed.

Strict composite extraction accepts the fresh perf and matching-driver native follow-ups: preserve the full failed report identity/status/failure assertions and telemetry, retain its unaffected whole checks, and select later passing perf, bfcache and crosstab whole-check follow-ups at both bases. The fresh perf follow-up passes all 16 cold cases and 368 budget gates, keeping the collector cap, profiles and budgets unchanged; it supplies the accepted canonical after cases. The matching explicit Playwright/core 1.57.0 native run 115290 completes four BF/crosstab records and 382 assertions at both bases with zero unexpected telemetry; actual source/package identities and pre/post snapshots are recorded. The older 1.62.1 run 111119 / paired 4 remains supporting proof only and supplies no canonical counts or skips. Composite acceptance additionally binds unchanged product/predicates, exact helper-source provenance and reviewed skips. Focused follow-ups cannot erase the original failures.

The [initial interrupted run](performance-initial-qa-interruption.json) preserves its six failures and the [second interrupted run](performance-hardened-qa-interruption.json) preserves the denied-storage timeout; neither is complete passing QA. The [modes proof](performance-mode-readiness-proof.json) reproduces a late first static frame on both unchanged sources and verifies waiting for an actual visible still frame before the unchanged 450 ms draw/transform sample. Original snapshots do not retain the exact trigger. The initial MTH140 warm/readiness, later denied-storage and [readiness-only native-selector](performance-failures-readiness-only.json) timeouts remain preserved without inferred causes.

The [native no-JS policy proof](performance-nojs-policy-proof.json) binds disabled-JavaScript `csp` failures to exact declared same-origin GET Script modulepreload URLs, whether bare or queried, preserving the authored URL identity. Authored/header CSP may be absent or explicitly permit same-origin scripts; restrictive CSP and enabled-JavaScript errors remain failures. Zero completed/pending/executed scripts are required. Unrelated errors, font/CSS failures and module URL aliases retain their existing gates. [Focused no-JS and offline controls](performance-nojs-offline-proof.json) are supporting evidence, not the final matrix.

The [resilience policy review](performance-resilience-policy-review.json) and [focused action proof](performance-resilience-action-proof.json) verify a 30-second host allowance only for actual Chromium with explicit software rendering: mounted-route/deadline readiness and existing native course-anchor selector resolution. GPU Chromium, WebKit, Firefox and unknown modes keep 10 seconds; page defaults, generic polling, other waits and the product router fetch timeout retain their original limits. All functional predicates, native activation and error checks remain. Per-wait/action timing and selected budgets are recorded. This scope supplements the existing software-driver physical-click allowance and changes no product behavior.

The [native-operation proof](performance-native-operation-proof.json) verifies the same bounded explicit software-Chromium allowance for BFCache parking `goto` at the original load milestone, native `goBack` at commit, and existing cross-tab Mark/Undo/section operations. The helper preserves strict locators, values, assertion lines and operation errors, with no retries or forced actions. The matching 1.57 run records persisted Desk, MTH140 and MTH141 restoration at both bases. Exactly two CEN100 native Back cases (one/base) are nonpersisted with `masked` reasons; shell retention/resume is not claimed and no cause is ascribed. The old 10.457-second park, 12.226-second Mark done and two MTH140 skips belong only to supporting 1.62 evidence. No canonical 1.57 operation exceeded 10 seconds. Earlier privacy-load and Mark-done exact triggers remain unknown.

The eight retained denied-storage bootstrap events are an explicit QA capture gap: each occurs on about:blank before the case collector, leaving its owner array empty. Same-driver independent reproduction and exact root review support their narrow classification; strict composite admission is validated.[^storage-bootstrap] Original telemetry is not described as universally clean.

Selected coverage and full/follow-up provenance: [browser QA evidence](performance-browser-qa.json).

## Verification

| Check | Result | Evidence |
| --- | ---: | ---: |
| Cold performance control | PASS: 16/16 cases; zero assertions failed. | [raw evidence](performance-before.json) |
| Cold performance result | PASS: 16/16 cases; zero assertions failed; 368 budget assertions pass. | [raw evidence](performance-after.json) |
| Latest-source root suite | PASS: 316/316; zero failures or skips. | [raw evidence](performance-verification.json) |
| Current QA pure harness | PASS: 116/116; zero failures or skips. | [raw evidence](performance-verification.json) |
| UI build and complete workflows | PASS; 4 vendor SHA hashes unchanged; 3 Desk and 6 course × motion cases; 20 root round trips; project motion-on transition calls 14. | [raw evidence](performance-verification.json) |
| Current independent source/preload/cache review | PASS: 11/11 focused tests; generator current; 79 other asset files and all HTML bodies preserved; full protected fingerprint matches; MTH140 has one head-only hunk. | [raw evidence](performance-verification.json) |
| Pure wire-byte guard regressions | PASS: 22 focused perf tests include the 3 new guards; full current 116-test harness passes; valid sample counts and committed budget identity are unchanged. Fresh after performance passes all 16 cases and 368 budget gates; strict composite QA acceptance is validated. | [raw evidence](performance-verification.json) |
| Modes readiness diagnosis and targeted validation | PASS: paired late-frame reproduction and hardened targeted cases; 13 focused tests (3 new regressions); second interrupted run root modes passes all 188 assertions. Completed full-run modes evidence is retained in accepted composite validation. | [raw evidence](performance-mode-readiness-proof.json) |
| Native no-JavaScript policy proof and focused reading checks | PASS: 4/4 counterfactuals, 42/42 assertions; focused no-JS 8/8 route/base cases and 82/82 assertions, zero failures; exact 87 declared native policy blocks/base, zero completed/pending/executed scripts. | [raw evidence](performance-nojs-policy-proof.json) |
| Scoped resilience readiness/native actions | PASS: prior focused failures at both bases, 86/86 assertions; 34 readiness waits and 16 route actions/base succeed under the recorded explicit software-Chromium policy; current full pure harness 116/116 passes. | [raw evidence](performance-resilience-action-proof.json) |
| Matching-driver BFCache/cross-tab whole-check follow-ups | PASS: explicit Playwright/core 1.57.0; both bases, 4 records / 382 assertions, zero unexpected telemetry. Desk/MTH140/MTH141 restore natively persisted; 2 CEN100 masked nonpersisted skips remain without shell-retention claims or attributed cause. Completed 03:39:00.691Z; product/helper/driver identities unchanged at end. | [raw evidence](performance-native-operation-proof.json) |
| Denied-storage bootstrap capture-gap proof | PASS: same-driver 12 contexts; 8 methods-fixture early errors, 4 none/getters controls without errors; zero product scripts/requests/app markers or owner errors. Exact original 8 events and false flags preserved; exact scoped composite admission validated. | [raw evidence](performance-storage-bootstrap-proof.json) |

Root 316, UI workflows/build, independent source review, pure harness 116, exact visuals 32 and matching-driver native 4 records/382 assertions pass. Full 96502 remains failed after 28 records: 7 assertions, 1 BFCache ERR_ABORTED and 8 reproduced QA-bootstrap SecurityErrors with original false flags; 2 WebKit records remain unavailable. Fresh 16 performance/368 budgets and canonical native 115290 use explicit Playwright/core 1.57.0, with matching recorded package identities. Strict composite extraction validates 26 passed/2 unavailable selected-record coverage; it is not a claim that all 28 original executions passed. Exactly 2 CEN100 masked nonpersisted native Back cases remain explicit skips without inferred causes. Earlier 1.62 native runs remain supporting proof only. After perf runtime checkpoint 34aad19/helper b2 remains separate from product/visual reference 3d14973, bound by unchanged source fingerprints. Archived exact timeout triggers remain unknown. The eight about:blank denied-storage bootstrap events (four/base) retain original expected:false flags and empty case-owner arrays; independent same-driver 12-context proof and exact review pass, with exact strict composite admission validated. The capture gap remains documented without claiming all original telemetry is clean.

[^storage-bootstrap]: Eight deliberate methods-fixture about:blank SecurityErrors (four/base) remain `expected:false` in immutable original runner telemetry. The [same-Playwright 1.57 bootstrap proof](performance-storage-bootstrap-proof.json) passes all 12 contexts: eight methods fixtures reproduce one early error each, four none/getters controls produce zero, with zero product scripts/requests/app markers or case-owner errors and all resources closed. The [exact-scope review](performance-storage-bootstrap-review.json) binds original event identities/source/counts and admits no broader SecurityError exception. This exposed pre-collector capture gap is documented; reproduced fixture events do not establish old timeout causes or turn all original telemetry clean. Strict composite admission validates this exact scoped fixture classification.
