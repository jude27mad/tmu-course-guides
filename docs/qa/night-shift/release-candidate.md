# Night Shift release candidate

Recorded 2026-10-13 on `night-shift`. **Locally tested code commit:** `3cc14c914810b41e89337a98ce02c17f06ef5d1d`. The following documentation commit changes only this report and its index. The live `main` revision remains `f4c8342e5ccfe36469a66842527e665f056cad35`; this work does not deploy the candidate.

## Integration and CI review

Both integrations use merge commits, with no rebase:

- `e6e3a9b8aa3e08712820f2f0043a7f92d27d509d`: clean merge of `origin/codex/ns-qa-fixes` (`ee373b7`), retaining the existing Task I transition implementation.
- `3cc14c914810b41e89337a98ce02c17f06ef5d1d`: merge of `origin/codex/ns-ci` (`d997143`) with the reviewed workflow repairs included.

The CI branch already installed both `tools/scene-build` and `tools/ui-build` dependencies before `node --test tests/*.test.mjs tests/scene-*.cjs`. Its UI job already rebuilt vendors, rejected any changed/deleted/staged/new vendor output, and ran `npm test`. Those steps are retained. Root checkout fetches full history so the deployed-URL and historical-record comparisons run.

The missing browser checks were stability, frames and deadlines. CI now runs all six checks in a **six checks × two bases** matrix, with unique report artifacts, `fail-fast: false`, and a 15-minute browser-job limit. Pushes include `night-shift` and `main`; PR base filters explicitly include those two branches. The workflow has `contents: read`, no deployment step, no secret references, and always uploads `tools/qa/reports/`. Parallel jobs address the roughly 15-minute runtime target; actual elapsed time must be checked on the push run.

After the candidate is pushed, CI publishes its verification and downloadable reports in [CI runs for night-shift](https://github.com/jude27mad/tmu-course-guides/actions/workflows/ci.yml?query=branch%3Anight-shift). Artifact names are `browser-qa-<check>-root` and `browser-qa-<check>-github-pages`, with seven-day retention.

## Merged-head results

Local environment: Node `24.19.0`, Playwright `1.64.0`, bundled Chromium `156.0.8078.4`, ANGLE SwiftShader. CI uses Node 22 and the same pinned Playwright/browser pair. Both tool dependency installs completed successfully.

Browser cells show **passing assertions / total assertions**. All cases completed; no browser assertions or cases were skipped.

| Check | `/` | `/tmu-course-guides/` |
| --- | ---: | ---: |
| Routes/history | 60/60 | 60/60 |
| Stability | **44/45** | 45/45 |
| Frame diagnostics | 24/24 | 24/24 |
| Deadlines | 128/128 | 128/128 |
| Motion/fallback modes | 188/188 | **187/188** |
| Layout/accessibility | 288/288 | 288/288 |
| **Total** | **732/733** | **732/733** |

| Suite | Result |
| --- | --- |
| Root `node --test tests/*.test.mjs tests/scene-*.cjs` | **272 pass, 0 fail, 0 skip**; includes both history-dependent comparisons and transition tests. |
| UI `npm run build` | **Exit 0; byte-identical vendors.** SHA-256 manifests before/after match for every vendor file; vendor diff and status are clean. GSAP: `e6ede5ab…`; Night vendor: `66bcd0ad…`; Three: `c1f72522…`. |
| UI `npm test` | **Exit 0.** Palette, three Desk cases, six course/motion cases, root routing with 20 round trips, and project-base routing with motion off/on pass. The transition stub receives 14 full-motion handoffs and zero with motion off. |
| QA helper/runtime/instrumentation tests | **42 pass, 0 fail, 0 skip**. |

Local raw reports, ignored by Git, are `tools/qa/reports/2026-10-13T18-31-52-960Z-4591/` (root) and `tools/qa/reports/2026-10-13T18-33-15-315Z-4912/` (project base). Both complete harness runs correctly return exit 1 because of the two assertions below. Root/UI/self-test logs are `/tmp/ns-root-tests-network.log`, `/tmp/ns-ui-build.log`, `/tmp/ns-ui-tests.log` and `/tmp/ns-qa-selftests.log` in this workspace.

## Failures and comparison with earlier evidence

The [F–H report](fgh.md) recorded 30 layout failures per base, intermittent wrapper settlement, pending-rAF and restricted-mode draw findings. [Task L](task-l-qa-fixes.md) then recorded 733/733 assertions passing at each base on `152df61`. Those earlier passes do not certify this merged head.

The layout failures and wrapper settlement failures do not reproduce here. Routes and deadlines remain fully passing. Two timing-sensitive findings do reproduce during the concurrent software-renderer runs:

```text
/ stability: raf.pending does not grow
Baseline 2; end 3; delta 1. Expected <= 2.

/tmu-course-guides/ modes:
cen100 OS reduced overrides saved full: no canvas drawing loop
before 41; after 61. Expected no drawing during sample.
```

At the root stability snapshot, recurring rAF chains stay **2 → 2**, live/retained listeners **100 → 100**, observer instances **1 → 1**, connected canvases and live WebGL contexts **0 → 0**, GSAP ticker callbacks **2 → 2**, and ScrollTriggers **0 → 0**. All 20 round trips, 20 workspace changes, 20 palette cycles and ten Mark done/Undo cycles completed. Task I adds persistent controller listeners, so Task L's older absolute listener count of 94 is not the comparison baseline.

A separate Desk-only diagnostic, without course mounts, captured ScrollTrigger's 250 ms timer queuing a finite `requestAnimationFrame(Ct)` callback. Its request timestamp changed on the next timer cycle, confirming periodic scheduling rather than retained callback accumulation. This explains a possible phase-sensitive pending-count increase; the failing full snapshot stores counts only, so the identity of its extra callback remains unconfirmed. Diagnostic source/output are `/tmp/ns-raf-provider-diagnostic.mjs` and `/tmp/ns-raf-provider-output.txt`.

For the CEN mode sample, both snapshots resolve motion **off**, OS reduce overrides saved full, all relevant transforms are `none`, and there are no running transform animations, cursor, particles or dust. The draw counter nevertheless advances by 20 during the 450 ms sample while other late initialization also changes content/observer counts. F–H reported the same category of late header drawing. This run does not prove a persistent drawing loop or identify a new deterministic product regression; the assertion remains a failure, with its exact output retained.

No new deterministic regression was established outside Claude's owned files. No product fix, visual adjustment, assertion removal, timeout increase or failure allowlist was added during this integration. Claude's book/stage/Three and Night Shift hero/scroll/timeline/deadline files were not edited. The two local failures remain reported rather than being treated as passes.

Earlier setup attempts used the environment's Playwright 1.57/system Chromium 154 and hit sidebar click timeouts during scene initialization; an isolated run captured an 11.27-second rAF gap. Ordinary clicks later succeeded, and both complete route checks pass with the pinned browser. The initial restricted root test run also lacked local socket access; the authorized socket-enabled rerun passes all 272 tests. These setup results are not substituted for the complete matrix above.

## What the live site gains on release

Compared with the current `main`, releasing this branch adds the persistent Cmd+K/Ctrl+K palette for courses, assessments, weeks, topics and actions, with route-aware results, real assessment opening, focus return and timeline fallback. It adds an opt-in local paper-sound service, shared/cache-refreshed module URLs and the guide favicon, and retires the old warp/backdrop layer.

Task L keeps Skip first, expands undersized controls to 44 px targets and bounds cleanup of a stalled page arrival while preserving its duration/easing. Task I supplies bounded transition registration, cancellation, motion gates and one-shot pose handoffs; current scene modules do not yet register a camera dive. The Desk data adapter and Three.js addons support later scene work. Complete CI and saved report artifacts make subsequent integrations independently reviewable.

SwiftShader frame numbers are diagnostics, not proof of real-device smoothness. Safari/iOS, physical touch, zoom, book/Desk scene visuals and visual approval remain unverified, as do the separate product follow-ups listed in F–H. Only `night-shift` is pushed by this task; `main` and the live deployment remain unchanged.
