# Book-release performance baseline

The unchanged `night-shift` control `aa7bca26` passes all 16 cold route/base/profile cases, with no incomplete sample, alias or browser error. The [raw baseline](performance-before.json) records FCP, LCP, CLS, long tasks, readable coursework/deadline/chip timings, request counts, wire bytes by type and the real import graph. Longest import depth is 5 on every route.

Phone: 390×844, DPR 1, touch/mobile, CPU 4×, 200,000 B/s download, 93,750 B/s upload and 150 ms latency. Desktop: 1440×900 unthrottled. Each case uses a fresh context, disabled cache and blocked/bypassed service workers. Native Playwright/core 1.57 and Chromium 154 use SwiftShader; timings are report-only.

[Budgets](../../../tools/qa/perf-budgets.json) reproduce exactly from this baseline plus the established 10% margins with minimum +2 requests/+4,096 total B/+8,192 per-type B/+1 import edge. All 368 regenerated resource assertions pass. [Closure/source proof](performance-baseline-aa7bca2-proof.json) binds the actual control and unchanged collector to the complete run.
