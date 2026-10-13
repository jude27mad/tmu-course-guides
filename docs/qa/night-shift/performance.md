# Night Shift performance

Baseline product revision: `aa41914` on `night-shift`. All 16 cold-load cases passed before product changes. Raw observations: [performance-before.json](performance-before.json); separate limits: [perf-budgets.json](../../../tools/qa/perf-budgets.json).

The phone profile is 390×844, touch/mobile, DPR 1, 4× CPU slowdown, 1.6 Mbps download, 750 kbps upload and 150 ms latency. Desktop is 1440×900, DPR 1 and unthrottled. Every case uses a fresh context, disables cache, blocks/bypasses service workers and uses a moving Date offset at 2026-10-13 noon Toronto. Chromium 154.0.8037.57 runs on Linux with SwiftShader; timing values are diagnostics, with no timing pass/fail gate. The static preview does not compress responses; CDP wire bytes include HTTP headers.

Text appearance uses a post-FCP viewport probe, readable effective opacity of at least 0.85, no blur/full clipping, and two native animation frames. This is a DOM/CSS observation, not a physical screen presentation timestamp. Desk hero deadline and compact-chip timings are separate; Desk chips below the initial viewport are reported as outside viewport.

Request and byte limits add 10%, with minimum allowances of 2 requests and 4,096 bytes for total/per-type traffic. Import depth adds 1 edge. Missing/duplicate cases, incomplete samples, browser errors and module URL aliases fail.

## Before: / — phone

| Route | FCP ms | LCP ms | CLS | Long tasks >50 ms / total ms | Coursework ms | Deadline ms | Chip ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 3,740 | 3,740 | 0.3071 | 6 / 883 | 4,106 | 4,106 | outside viewport |
| cen100 | 2,720 | 9,284 | 0.7717 | 28 / 10,521 | 11,977 | 11,977 | 11,980 |
| mth140 | 2,108 | 9,276 | 0.5652 | 29 / 10,848 | 5,876 | 9,730 | 9,740 |
| mth141 | 2,772 | 14,444 | 0.5054 | 46 / 18,526 | 9,450 | 18,312 | 18,317 |

| Route | Requests | Wire bytes | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 | 535645 | 5847 | 304859 | 54038 | 90281 | 382 | 80238 | 15 / 4 |
| cen100 | 53 | 1502414 | 45613 | 1164490 | 128757 | 90281 | 32801 | 40472 | 20 / 4 |
| mth140 | 63 | 1610060 | 17374 | 1186446 | 173487 | 90281 | 73761 | 68711 | 26 / 4 |
| mth141 | 63 | 1587096 | 17251 | 1186446 | 173487 | 90281 | 50797 | 68834 | 26 / 4 |

## Before: / — desktop

| Route | FCP ms | LCP ms | CLS | Long tasks >50 ms / total ms | Coursework ms | Deadline ms | Chip ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 1,640 | 1,640 | 0.1228 | 2 / 224 | 2,295 | 2,295 | outside viewport |
| cen100 | 624 | 2,332 | 0.6656 | 7 / 8,411 | 9,471 | 9,471 | 9,471 |
| mth140 | 396 | 2,520 | 0.5268 | 11 / 8,659 | 1,516 | 10,157 | 10,158 |
| mth141 | 896 | 4,260 | 0.3381 | 16 / 4,283 | 2,862 | outside viewport | outside viewport |

| Route | Requests | Wire bytes | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 | 535645 | 5847 | 304859 | 54038 | 90281 | 382 | 80238 | 15 / 4 |
| cen100 | 53 | 1502414 | 45613 | 1164490 | 128757 | 90281 | 32801 | 40472 | 20 / 4 |
| mth140 | 63 | 1610060 | 17374 | 1186446 | 173487 | 90281 | 73761 | 68711 | 26 / 4 |
| mth141 | 63 | 1587096 | 17251 | 1186446 | 173487 | 90281 | 50797 | 68834 | 26 / 4 |

## Before: /tmu-course-guides/ — phone

| Route | FCP ms | LCP ms | CLS | Long tasks >50 ms / total ms | Coursework ms | Deadline ms | Chip ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 3,852 | 3,852 | 0.3071 | 13 / 3,719 | 6,504 | 6,513 | outside viewport |
| cen100 | 2,636 | 7,800 | 0.7774 | 23 / 11,219 | 8,309 | 8,311 | 8,315 |
| mth140 | 4,092 | 13,552 | 0.5635 | 35 / 10,628 | 9,496 | 13,954 | 13,959 |
| mth141 | 2,108 | 8,232 | 0.7079 | 27 / 5,722 | 5,147 | 8,650 | 8,650 |

| Route | Requests | Wire bytes | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 | 535645 | 5847 | 304859 | 54038 | 90281 | 382 | 80238 | 15 / 4 |
| cen100 | 53 | 1502414 | 45613 | 1164490 | 128757 | 90281 | 32801 | 40472 | 20 / 4 |
| mth140 | 63 | 1610060 | 17374 | 1186446 | 173487 | 90281 | 73761 | 68711 | 26 / 4 |
| mth141 | 63 | 1587096 | 17251 | 1186446 | 173487 | 90281 | 50797 | 68834 | 26 / 4 |

## Before: /tmu-course-guides/ — desktop

| Route | FCP ms | LCP ms | CLS | Long tasks >50 ms / total ms | Coursework ms | Deadline ms | Chip ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 1,632 | 1,632 | 0.1228 | 1 / 265 | 2,802 | 2,803 | outside viewport |
| cen100 | 720 | 10,940 | 0.3882 | 12 / 11,391 | 12,697 | 12,703 | 12,703 |
| mth140 | 548 | 6,780 | 0.1893 | 10 / 6,507 | 921 | 7,836 | 7,836 |
| mth141 | 472 | 1,756 | 0.1528 | 10 / 10,110 | 11,354 | 11,354 | 11,354 |

| Route | Requests | Wire bytes | Document | Script | CSS | Font | Image | Fetch | Modules / longest chain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desk | 30 | 535645 | 5847 | 304859 | 54038 | 90281 | 382 | 80238 | 15 / 4 |
| cen100 | 53 | 1502414 | 45613 | 1164490 | 128757 | 90281 | 32801 | 40472 | 20 / 4 |
| mth140 | 63 | 1610060 | 17374 | 1186446 | 173487 | 90281 | 73761 | 68711 | 26 / 4 |
| mth141 | 63 | 1587096 | 17251 | 1186446 | 173487 | 90281 | 50797 | 68834 | 26 / 4 |

## Visual baseline

[Before manifest](performance-visual-before.json): 32/32 viewport captures covering all four routes, both bases, 1440×900/390×844 and dark/light. Existing Pause motion controls, completed renderer, fonts, decoded images and a 1.5-second settled delay provide reproducible poses; there are no masks or injected styles. The representative repeat has 0 / 1,296,000 changed pixels and identical PNG hashes. Actual platform fonts confirm Archivo. PNGs are retained in the local ignored QA report directory.

[Exploratory capture evidence](performance-visual-exploratory.json) records an earlier full-page compositor issue: one repeat differed by 3.568%, including a blank paused WebGL buffer. Those captures do not serve as the comparison baseline. The requested viewport recipe produced 32 captures with no errors or natural-settlement failures.

## Image and font inventory

Archivo already uses `font-display: swap` for each subset. The rendered above-fold text uses the 90,104-byte Latin WOFF2; no font bytes or CSS will change. The hub logo already has 34×34 intrinsic attributes. The six authored posters are 900×600, use reserved absolute CSS geometry, and the above-fold header posters already decode asynchronously with high fetch priority. No offscreen product images or posters exist in this revision, so no lazy-loading candidate can be changed within the protected-owner constraints.

## Remaining work

Apply the generated critical module/font hints and Save-Data/touch prefetch protection, compare after captures and measurements, merge the latest night-shift and rerun all required verification before publishing either branch.
