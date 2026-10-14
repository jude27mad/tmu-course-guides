# Night Shift performance

Performance and visual results are complete. Final root/UI/tool validation and a fresh full browser QA run on the latest merged branch are pending; this document does not claim they passed.

The control product/visual reference is latest `night-shift` revision `aa7bca2`; the after product/visual reference is `b096bd8`. Both cold-load runs passed all 16 route/base/profile cases. Raw evidence: [before](performance-before.json), [after](performance-after.json) and [committed budgets](../../../tools/qa/perf-budgets.json). The earlier [66049a1 comparison](performance-control-66049a1.md), its [before](performance-before-control-66049a1.json), [after](performance-after-control-66049a1.json), [budgets](performance-budgets-control-66049a1.json), [browser QA](performance-browser-qa-control-66049a1.json), [visual comparison](performance-visual-comparison-control-66049a1.json) and [verification](performance-verification-control-66049a1.json) are historical. They use the prior course-header product and do not serve as this book-enabled comparison’s control.

The functional product merge is `42576dc`. Product and protected-source fingerprints bind the measured product to the visual reference independently of QA/evidence-only commits.

The after product fingerprint is 1795468f427084977fac5a0707eef0b14e461c8d2041cb9c6d1e0315de48851f; both references share protected fingerprint c428377743e2e8a1ee386c55882e182d3b8e750ade67b1bd2b65835c210e0481. Performance was measured at cec2cef and visuals at b096bd8. Later QA-only checkpoint 3225348 and the upstream WebKit/QA merge preserve that same product. The control frontend remains aa7bca2.

The phone saving comes from avoiding unsolicited prefetches of the other three route documents. This summary includes only the eight phone cases; matching values at both deployment bases collapse to one number.

| Route | Phone requests | Requests removed | Phone wire B | Wire B removed | Wire reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| desk | 31 → 28 | 3 | 623,321 → 535,681 | 87,640 | 14.1% |
| cen100 | 56 → 53 | 3 | 1,618,005 → 1,576,134 | 41,871 | 2.6% |
| mth140 | 67 → 64 | 3 | 1,892,207 → 1,819,114 | 73,093 | 3.9% |
| mth141 | 66 → 63 | 3 | 1,702,836 → 1,629,819 | 73,017 | 4.3% |

Across the four separate phone cold loads at each base, the measured total reduction is 12 requests and 275,621 wire bytes. These totals sum independent fresh loads rather than one cached navigation session. Desktop request counts are unchanged; wire-byte change is +9,040 B per route across the two bases (positive values are overhead). Desktop keeps the existing idle route prefetch, so its network totals include the added hints in all four HTML documents plus the router guards. The detailed desktop rows below retain that cost.

Phone FCP increases in 3/8 sampled cases and decreases in 5/8; its after-minus-before range is -956–+412 ms. Phone LCP increases in 3/8 sampled cases and decreases in 5/8; its after-minus-before range is -3,716–+8,540 ms. All timing changes remain report-only observations from one SwiftShader sample per case. These values establish neither universal timing improvement nor physical-device speed; the traffic savings and visual result are assessed separately.

The matching latest-control/topic visual matrix is exact: 32/32 captures and 0/26,002,560 changed pixels. All recorded independent repeat gates pass. The recorded software-compositor environment retains live SwiftShader WebGL models and matching protected-source fingerprints; the detailed evidence is linked below.

Phone: 390×844, touch/mobile, DPR 1, 4× CPU slowdown, 1.6 Mbps download (200,000 B/s), 750 kbps upload (93,750 B/s), and 150 ms latency. Desktop: 1440×900, DPR 1, unthrottled. Every route at both `/` and `/tmu-course-guides/` starts in a fresh context with cache disabled and service workers blocked/bypassed. A moving Date offset starts at noon Toronto on October 13, 2026, while native timers and animation frames remain active. Chromium 154.0.8037.57 on Linux uses SwiftShader.

FCP, LCP, CLS, long tasks over 50 ms and readable-content times are report-only diagnostics. A single SwiftShader run per case does not establish a repeatable timing improvement, physical-phone pacing or Safari behavior. Timing regressions remain visible below; request counts, bytes and import depth have explicit gates.

Wire bytes come from CDP `Network.loadingFinished.encodedDataLength`, including HTTP headers. The static preview serves uncompressed responses. Decoded body/source sizes are separate diagnostics and must not be substituted for wire traffic.

Readable text uses a post-FCP viewport probe, effective ancestor opacity of at least 0.85, no nonzero blur or full clipping, and two native animation frames. The DOM/CSS approximation polls every 100 ms; it is not a physical screen presentation timestamp. The primary deadline is the Desk hero countdown or the course deadline chip. Actual compact-chip timing is separate: Desk chips below the initial viewport are marked `offscreen`; other null observations stay `not observed`, with reasons retained in raw JSON. The collection observes normal optional-feature fetches and a quiet network without importing vendors into the page.

Budgets reproduce from the control measurements: total/per-type bytes and request counts add 10%, with minimum allowances of 4,096 total bytes, 8,192 bytes per resource type, and 2 requests; longest import chain adds 1 edge. Missing/duplicate cases, unfinished samples, browser errors and module URL aliases fail. Timing values do not set pass/fail thresholds.

The per-type byte minimum was deliberately raised to 8,192 B before the after run, based on known hint overhead rather than after measurements. The current generated blocks add 1,397 source bytes on Desk, 2,013 B on CEN100, 2,386 B on MTH140 and 2,386 B on MTH141; CEN100 desktop's other three prefetched heads total 6,169 B. The limits are regenerated from the latest aa7bca2 control plus the established margin; after measurements do not calibrate them.

Timing and network cells show **before → after**. Times are milliseconds; resource values are bytes; longest chain is measured in import edges. Only resource types with nonzero traffic in either run are shown.

## / — phone

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 5,268 → 5,680 | 5,268 → 5,680 | 0.3071 → 0.3071 | 12 / 2,501 → 7 / 1,885 | 5,745 → 6,173 | 5,746 → 6,177 | offscreen → offscreen |
| cen100 | 4,760 → 3,804 | 15,736 → 13,828 | 0.7524 → 0.7524 | 37 / 21,010 → 32 / 18,093 | 21,731 → 17,410 | 21,738 → 17,411 | 21,738 → 17,411 |
| mth140 | 2,912 → 2,680 | 8,288 → 16,828 | 0.6902 → 0.6902 | 25 / 12,862 → 35 / 26,381 | 8,671 → 8,425 | 8,673 → 16,612 | 8,676 → 16,612 |
| mth141 | 2,608 → 2,660 | 13,820 → 11,116 | 0.5054 → 0.5054 | 33 / 20,637 → 31 / 9,320 | 9,153 → 7,021 | 15,220 → 12,150 | 15,225 → 12,176 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 31 → 28 | 623,321 → 535,681 | 5,850 → 7,247 | 356,149 → 357,007 | 80,764 → 80,764 | 90,281 → 90,281 | 382 → 382 | 89,895 → 0 | 17 / 5 → 17 / 5 |
| cen100 | 56 → 53 | 1,618,005 → 1,576,134 | 51,003 → 53,016 | 1,246,017 → 1,246,875 | 153,161 → 153,161 | 90,281 → 90,281 | 32,801 → 32,801 | 44,742 → 0 | 24 / 5 → 24 / 5 |
| mth140 | 67 → 64 | 1,892,207 → 1,819,114 | 19,408 → 21,794 | 1,482,198 → 1,483,056 | 197,891 → 197,891 | 90,281 → 90,281 | 26,092 → 26,092 | 76,337 → 0 | 29 / 5 → 29 / 5 |
| mth141 | 66 → 63 | 1,702,836 → 1,629,819 | 19,484 → 21,870 | 1,268,122 → 1,268,980 | 197,891 → 197,891 | 90,281 → 90,281 | 50,797 → 50,797 | 76,261 → 0 | 29 / 5 → 29 / 5 |

## / — desktop

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 1,952 → 2,460 | 1,952 → 2,460 | 0.1228 → 0.0000 | 4 / 399 → 3 / 455 | 2,776 → 3,456 | 2,777 → 3,457 | offscreen → offscreen |
| cen100 | 924 → 884 | 3,168 → 2,732 | 0.7090 → 0.6706 | 12 / 11,102 → 9 / 9,877 | 4,492 → 4,050 | 4,496 → 4,050 | 4,497 → 4,051 |
| mth140 | 1,512 → 732 | 7,280 → 3,496 | 0.4113 → 0.5098 | 19 / 20,213 → 13 / 20,063 | 10,860 → 1,507 | 10,861 → 9,663 | 10,861 → 9,663 |
| mth141 | 628 → 596 | 2,380 → 2,128 | 0.2100 → 0.2010 | 8 / 9,568 → 9 / 9,260 | 11,034 → 10,037 | 11,035 → 10,038 | 11,035 → 10,038 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 31 → 31 | 623,321 → 632,361 | 5,850 → 7,247 | 356,149 → 357,007 | 80,764 → 80,764 | 90,281 → 90,281 | 382 → 382 | 89,895 → 96,680 | 17 / 5 → 17 / 5 |
| cen100 | 56 → 56 | 1,618,005 → 1,627,045 | 51,003 → 53,016 | 1,246,017 → 1,246,875 | 153,161 → 153,161 | 90,281 → 90,281 | 32,801 → 32,801 | 44,742 → 50,911 | 24 / 5 → 24 / 5 |
| mth140 | 67 → 67 | 1,926,244 → 1,935,284 | 19,408 → 21,794 | 1,482,198 → 1,483,056 | 197,891 → 197,891 | 90,281 → 90,281 | 60,129 → 60,129 | 76,337 → 82,133 | 29 / 5 → 29 / 5 |
| mth141 | 66 → 66 | 1,702,836 → 1,711,876 | 19,484 → 21,870 | 1,268,122 → 1,268,980 | 197,891 → 197,891 | 90,281 → 90,281 | 50,797 → 50,797 | 76,261 → 82,057 | 29 / 5 → 29 / 5 |

## /tmu-course-guides/ — phone

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 4,752 → 4,392 | 4,752 → 4,392 | 0.3071 → 0.3071 | 8 / 1,318 → 6 / 871 | 5,269 → 4,735 | 5,269 → 4,736 | offscreen → offscreen |
| cen100 | 3,536 → 3,196 | 10,752 → 12,456 | 0.7774 → 0.6745 | 31 / 13,690 → 29 / 12,585 | 11,292 → 13,252 | 11,292 → 13,254 | 11,295 → 13,254 |
| mth140 | 3,172 → 2,708 | 14,524 → 10,808 | 0.6902 → 0.6902 | 35 / 16,796 → 30 / 14,766 | 14,365 → 6,908 | 14,368 → 10,653 | 14,369 → 10,653 |
| mth141 | 2,632 → 2,636 | 9,872 → 9,572 | 0.5054 → 0.5054 | 30 / 14,593 → 29 / 7,141 | 6,545 → 6,343 | 10,663 → 10,618 | 10,666 → 10,621 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 31 → 28 | 623,321 → 535,681 | 5,850 → 7,247 | 356,149 → 357,007 | 80,764 → 80,764 | 90,281 → 90,281 | 382 → 382 | 89,895 → 0 | 17 / 5 → 17 / 5 |
| cen100 | 56 → 53 | 1,618,005 → 1,576,134 | 51,003 → 53,016 | 1,246,017 → 1,246,875 | 153,161 → 153,161 | 90,281 → 90,281 | 32,801 → 32,801 | 44,742 → 0 | 24 / 5 → 24 / 5 |
| mth140 | 67 → 64 | 1,892,207 → 1,819,114 | 19,408 → 21,794 | 1,482,198 → 1,483,056 | 197,891 → 197,891 | 90,281 → 90,281 | 26,092 → 26,092 | 76,337 → 0 | 29 / 5 → 29 / 5 |
| mth141 | 66 → 63 | 1,702,836 → 1,629,819 | 19,484 → 21,870 | 1,268,122 → 1,268,980 | 197,891 → 197,891 | 90,281 → 90,281 | 50,797 → 50,797 | 76,261 → 0 | 29 / 5 → 29 / 5 |

## /tmu-course-guides/ — desktop

| Route | FCP | LCP | CLS | Long tasks: count / total ms | Coursework | Primary deadline | Actual chip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 4,644 → 2,480 | 4,644 → 2,480 | 0.0907 → 0.1165 | 3 / 464 → 7 / 1,652 | 5,601 → 4,855 | 5,601 → 4,855 | offscreen → offscreen |
| cen100 | 1,140 → 1,620 | 3,048 → 4,720 | 0.0912 → 0.5644 | 12 / 10,520 → 10 / 11,975 | 4,636 → 13,630 | 4,636 → 13,631 | 4,636 → 13,631 |
| mth140 | 756 → 868 | 4,492 → 3,488 | 0.3808 → 0.0622 | 16 / 21,372 → 14 / 16,780 | 6,375 → 4,668 | 6,375 → 4,669 | 6,376 → 4,669 |
| mth141 | 644 → 684 | 2,180 → 2,548 | 0.2046 → 0.4541 | 10 / 11,039 → 10 / 8,119 | 12,657 → 1,568 | 12,657 → 9,540 | 12,657 → 9,540 |

| Route | Requests | Total wire B | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 31 → 31 | 623,321 → 632,361 | 5,850 → 7,247 | 356,149 → 357,007 | 80,764 → 80,764 | 90,281 → 90,281 | 382 → 382 | 89,895 → 96,680 | 17 / 5 → 17 / 5 |
| cen100 | 56 → 56 | 1,618,005 → 1,627,045 | 51,003 → 53,016 | 1,246,017 → 1,246,875 | 153,161 → 153,161 | 90,281 → 90,281 | 32,801 → 32,801 | 44,742 → 50,911 | 24 / 5 → 24 / 5 |
| mth140 | 67 → 67 | 1,926,244 → 1,935,284 | 19,408 → 21,794 | 1,482,198 → 1,483,056 | 197,891 → 197,891 | 90,281 → 90,281 | 60,129 → 60,129 | 76,337 → 82,133 | 29 / 5 → 29 / 5 |
| mth141 | 66 → 66 | 1,702,836 → 1,711,876 | 19,484 → 21,870 | 1,268,122 → 1,268,980 | 197,891 → 197,891 | 90,281 → 90,281 | 50,797 → 50,797 | 76,261 → 82,057 | 29 / 5 → 29 / 5 |

The latest control and current after observations record coursework and primary-deadline appearance in all 16 cases. The four Desk compact-chip observations in each sample are null because those chips remain below the initial viewport. All 16 after samples are ready, quiet and uncapped with no unfinished requests or browser errors. FCP/LCP/readable-content deltas below are report-only observations; increases remain visible and no universal timing or physical-device speedup is claimed.

## Changes and remaining payload

Generated head hints preload each route's actual boot-critical module graph with the exact URL tokens, plus the basic Latin font. The hints improve resource discovery while preserving native static documents and module identity. Optional night-vendor/Three rendering paths remain outside the generated preload blocks. Save-Data/coarse-pointer protection avoids unsolicited route-document prefetches while preserving explicit pointer/keyboard intent and native navigation.

The real import graph yields 17 Desk, 24 CEN100 and 29 modules on each Math route at both bases, with longest chain depth 5. Generated modulepreloads retain exact bare and ?v= URL identity, including the newly inherited eager book state/weeks/course styles. All deferred book-scene/geometry/texture, Three and night-vendor paths remain outside boot hints. The exact graph/list and token drift tests must pass on the final source.

The inherited book modules offer owner-coordinated opportunities: shared eager book-state/weeks are 35,187 source bytes on Desk; course styles bring the eager course total to 41,647 B. Runtime texture painters and procedural geometry total 89,582 B; the eight deferred stage/Three-loader/book modules total 245,239 B. These totals overlap: texture and geometry bytes are included in the deferred set. They describe unchanged uncompressed repository bytes, not measured compressed transfers, texture-generation runtime or promised savings. The book painters produce CanvasTextures and procedural maps; no fetched SVG texture asset is claimed. Owners could assess splitting unused state and nonessential painters while preserving the exact book visuals, focus and lifecycle. At 200,000 B/s the eager course, texture/geometry and deferred totals correspond to theoretical link-only quantities of 0.21 s, 0.45 s and 1.23 s; the overlapping values are not additive and predict no FCP/LCP improvement. The latest baseline Math stylesheet payload is 197,891 wire bytes per sample, corresponding to approximately 0.99 s of theoretical link time at 200,000 B/s; this separate wire quantity is read from the current baseline, not substituted from source-module sizes or the historical CSS total.

Archivo already uses font-display: swap. The 90,104-byte Latin WOFF2 and every font stylesheet byte match the owner control; only the above-fold Latin face is preloaded with the same asset URL and anonymous CORS. The hub mark already has intrinsic dimensions, while above-fold authored posters reserve their layout and already use asynchronous decoding. The inventory found no eligible offscreen images/posters within the protected owner scope; no image-byte or lazy-image saving is claimed.

Larger opportunities remain in the unchanged visual dependencies: Three is 621,214 source bytes, night-vendor 69,065 bytes and GSAP 95,884 bytes, totaling 786,163 bytes. These source/body sizes exclude HTTP headers and differ from wire totals. Deferring or splitting those payloads would require coordination with their protected owners and preservation of the current visual behavior. Math routes load 197,891 stylesheet wire bytes in the control samples; hints alone do not shrink this CSS. See the [asset inventory](inventory.md) and raw before resources for the owners and individual payloads.

At the configured 200,000 B/s download cap, the 786,163 B combined library bodies require a theoretical network-only lower bound of 3.93 seconds of link time. The 197,891 B Math stylesheet wire payload requires approximately 0.99 seconds. These payload/rate calculations exclude latency, parsing and rendering; requests overlap, so they are neither predicted FCP/LCP savings nor additive page-timing improvements.

## Visual evidence

The final matched comparison reports 32/32 pixel-identical viewport captures, zero changed pixels, matching protected source evidence, and no capture, browser, settlement, repeat or evidence failures. See [comparison](performance-visual-comparison.json), [before manifest](performance-visual-before.json) and [after manifest](performance-visual-after.json). These are exact RGBA comparisons with no masks or pixel tolerance.

The matched matrix covers all four routes at both deployment bases, 1440×900 and 390×844, dark and light: 32/32 exact RGBA pairs, zero changed pixels across 26,002,560 pixels. No masks or tolerance are used. Both sources use the same recorded native software-compositor recipe, font/geometry settlement and public paused scene state. MTH140 alone uses the authored ?tier=high override on both references to render the actual book under SwiftShader; ordinary perf URLs retain normal production tier selection. All 48 course captures and 16 MTH140 book captures pass live SwiftShader WebGL2/framebuffer evidence; both independent CEN repeats are exact. Fonts, headings, wrapper geometry, themes, image dimensions/positions and scene bounds match in all32 pairs. The before/after/compare CLIs exit0, source fingerprints remain unchanged and all four preview ports and browser processes are closed. These are Chromium viewport results, not physical-device or Safari certification. A fetched poster alone does not establish renderer choice.

The prior [66049a1 visual comparison](performance-visual-comparison-control-66049a1.json), older [initial visual matrix](performance-visual-initial-aa41914.json) and [exploratory captures](performance-visual-exploratory.json) remain archived evidence for their original sources. Their parity and calibration results do not substitute for the latest book-enabled 32-case matrix.

## Upstream owner changes and scope

The topic merges the latest night-shift book release aa7bca2. The independent static review preserves all 93 tracked assets other than the authorized router/route-boot pair, all 11 selected HTML bodies/fixtures and the complete protected fingerprint. In MTH140 the performance diff remains one contiguous head block; its book body and every assets/book/* byte match the owner control. Router intent guards preserve the owner’s book URL, focus and mandatory-navigation behavior. The task never pushes main.

The earlier complete 14-check run at both bases remains failed: 21 passed records, five failed records and two WebKit-unavailable records; 2,852 of 2,859 assertions passed, with seven failures. Its four skips and 229 raw runner events remain archived. Failures occurred in root deadlines, cross-tab at both bases, and project BFCache and failure fixtures. Separate passive cross-tab diagnostics show correct sender Undo followed by delayed receiver replies and trusted storage processing; the earlier full-run causes remain unknown. Reviewed QA-only completion and progress polling allowances preserve the original predicates, callbacks and assertions. Recovery diagnostics and a fresh full run of all14 checks on the latest merged branch are pending.

Selected coverage and full/follow-up provenance: [browser QA evidence](performance-full-run-aa7bca2-archive-verification.json).

## Verification

| Check | Result | Evidence |
| --- | ---: | ---: |
| Cold performance control | PASS: 16/16 cases; zero assertions failed. | [raw evidence](performance-before.json) |
| Cold performance result | PASS: 16/16 cases; zero assertions failed; 368 budget assertions pass. | [raw evidence](performance-after.json) |
| Latest book control | PASS: 16/16 cold cases; 240 browser assertions and 368 derived budget assertions; zero failures; runner/server closure recorded. | [raw evidence](performance-before.json) |
| Latest static source and graph audit | PASS: 93 protected-owner assets and all 11 selected HTML bodies preserved; MTH 140 one head-only hunk; exact real import graphs 17/24/29/29, chain depth 5, no URL aliases. | [raw evidence](performance-static-aa7bca2-review.json) |
| Latest cold performance result | PASS: 16/16 cases,608 assertions including 368 budget gates; zero failed assertions; raw frozen at full-run closure. | [raw evidence](performance-after.json) |
| Original latest full browser QA | FAILED: 14 checks/28 records;21 passed,5 failed,2 WebKit unavailable;2852/2859 assertions pass. Original failures and telemetry preserved. | [raw evidence](performance-full-run-aa7bca2-archive-verification.json) |
| Current follow-up QA / root / UI / harness / visuals | PENDING: no current follow-up or exact 32 visual result is accepted in this draft. | — |
| Exact latest visual comparison | PASS: 32/32 pairs; zero changed pixels; both independent repeat, live renderer, source and closure gates pass. | [raw evidence](performance-visual-aa7bca2-proof.json) |

The latest control, optimized performance samples, static source audit and exact32 visual comparison are complete. Fresh root/UI/tool checks and latest full browser QA remain pending; historical results are not promoted into current pass counts.
