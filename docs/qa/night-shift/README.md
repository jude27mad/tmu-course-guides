# Night Shift QA index

Read each note against its recorded revision and environment. Earlier passes do not certify later changes. Documentation base `f4c8342` records the final Stage 1b Chromium review; Safari/iOS, the listed follow-ups and the book stages remain unverified.

## Notes in this directory

| Note | Scope |
| --- | --- |
| [Inventory](inventory.md) | Stage 0 route, storage, hash, deadline and scene inventory before the Desk/CEN split. |
| [Test baseline](baseline-tests.md) | Stage 0 suite results, missing-feature requests, dependency failures and vendor reproducibility. |
| [Visual baseline](baseline-visual.md) | Stage 0 settled layouts, startup timing and composition issues in Chromium/SwiftShader, not real-device performance. |
| [Stage 1 routes](stage1-routes.md) | CEN100 relocation, root-hash compatibility and preserved progress at both deployment bases. |
| [Stage 1 Desk](stage1-desk.md) | Shared deadline resolver, DOM Desk directory, live summaries and the checks performed at that stage. |
| [Stage 1 gate](stage1.md) | Routing, saved-state and deadline agreement checks, the Desk skip-link fix and remaining limitations. |
| [Codex tasks A–E](codex-tasks.md) | Lifecycle/router integration and week/bend-math results, including repeated-route checks at the reported checkpoint. |
| [Stage 1b review](stage1b.md) | Reproduced router/lifecycle defects, fixes and final Chromium re-verification at both bases, with open issues and separate deadline-review scope. |
| [Codex tasks F–H merge](fgh.md) | Palette, QA harness, Three.js addons, paper sounds and warp/backdrop removal merged onto `f4c8342`: shared module URLs, `shift2` cache tokens, palette interface copy, favicon, harness deadline alignment, and browser and QA results at both bases. |
| [Performance](performance.md) | Cold-load timing, request/byte/import budgets and exact before/after screenshot evidence for the performance branch. |
| [Task L QA fixes](task-l-qa-fixes.md) | Completed branch verification of Skip order, 44 px targets, bounded arrival cleanup and polling-boundary fixes, before the release-candidate integration. |
| [Release candidate](release-candidate.md) | Task L and CI merge commits, final merged-head suites and all six browser checks at both deployment bases, comparison with F–H and Task L, and release gains. |
| [Legacy forwarder](forwarder.md) | Proposed change to the separate `cen100-guide` repository; explicitly not applied in this evidence. |

## Related references

- [Toronto deadline results](../toronto-deadline-results.md) — corrected multi-zone results, resolver changes and the CEN100 end-of-day exception.
- [Deadline test contract](../toronto-deadline-test-cases.md) and [JSON fixtures](../toronto-deadline-test-cases.json) — 40 synthetic edge cases, not official university assessments.
- [Device checklist](../device-checklist.md) — manual iPhone, iPad and laptop checks; not evidence that those checks passed.
- [Task L](../../codex/task-l-qa-fixes.md) — follow-up QA issues and ownership boundaries; an assignment, not a completed verification report.
