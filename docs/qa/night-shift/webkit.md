# WebKit CI verification

Recorded 2026-10-14 on `codex/ns-resilience`, initially based on upstream `night-shift` revision `66049a17117ff085a99413066b326bb599f7b2c8`, then merging the latest book release `aa7bca26bdfe6d640766858f4f3a27e2e9e668e7` in `91170cb`. That upstream applies the previously proposed MTH140 no-JavaScript fallback and synchronized math-guide cache tokens. No protected product files are edited by this follow-up.

## Workflow

`.github/workflows/ci.yml` adds an independent WebKit job for `/` and `/tmu-course-guides/`, with `fail-fast: false` and a 20-minute limit. Ubuntu 24.04 installs the existing pinned `playwright@1.64.0` outside the checkout, then runs `npx --no-install playwright install --with-deps chromium webkit`. Chromium is needed by the QA runner's setup probe even when only WebKit is selected.

Each job runs `node tools/qa/run.mjs webkit --base "$QA_BASE"`. A post-run guard requires the requested base, WebKit browser identity, nonempty all-passing assertions, zero failures and zero skips. Local missing-library skips keep their existing semantics; they cannot pass this dedicated CI job. Summary output and uniquely named report artifacts are uploaded under `always()`, including failed runs.

The existing jobs, push filters and their order are preserved: `night-shift`, `main`, `codex/**`, `chatgpt/**`, `book-*`. The last filter arrives with the latest upstream book release and is retained. No deployment or `main` push is performed.

## Executed results

The latest book-merged [CI run 38510279439](https://github.com/jude27mad/tmu-course-guides/actions/runs/38510279439), on `91170cbe5e3f0de35cf6d2bab1b5d096e74e2f72`, completes **all 16 jobs successfully** and actually launches WebKit 27.2. Browser and OS dependency installation succeeds on both runners. The downloaded WebKit artifact archives match their published SHA-256 digests. Later commits change only this report and its index.

| Base | Routes | Deadlines | Layout | Total | Skips |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 120/120 | 256/256 | 288/288 | **664/664** | 0 |
| `/tmu-course-guides/` | 120/120 | 256/256 | 288/288 | **664/664** | 0 |

Routes and deadlines run at 1440 px and with the iPhone descriptor: 390×844 px, touch enabled, mobile, DPR 3. Layout runs all four routes in both themes at 390 px with that descriptor, plus 1024 and 1440 px. Route/history focus, shell identity, native navigation, canonical deadlines, Mark done/Undo, overflow, 44 px targets, Skip order and visible tab focus all pass. These are headless WebKit results, not a physical iPhone or Safari-device certification.

Artifacts are `browser-qa-webkit-root` and `browser-qa-webkit-github-pages`, retained for seven days. Each contains `webkit.json`, `webkit.md`, `summary.json` and `summary.md` with raw assertions and observations.

## Failure found in the existing Chromium check

The initial [CI run 38508269130](https://github.com/jude27mad/tmu-course-guides/actions/runs/38508269130), on `490478e38e43968d2918b15d06b29ce9b1efc714`, also passes 664/664 WebKit assertions at each base, but has 15 successful jobs and one failed job: `Browser QA (modes, /tmu-course-guides/)`. Root tests pass 290/290, UI build/tests pass, and all other Chromium jobs pass. WebKit has no functional failures.

Its only failed assertion is:

```text
cen100 OS reduced motion: no canvas drawing loop
before drawCalls: 41
after drawCalls: 61
sample: 450 ms
expected: no drawing during sample
```

Both snapshots resolve motion off with OS reduce enabled, no animated transforms or decorative effects, identical static transforms and no telemetry errors. The raw report does not record scene readiness or frame number, so this delta alone cannot establish an animation loop. The protected scene module publishes its renderer before asynchronous shader compilation; its first static paint happens afterward and then sets `data-scene-ready=true`. The old harness waits for DOM/deadline and wrapper readiness, which does not establish that this first paint has finished.

QA-only fix `0b8a5e9` waits up to ten seconds for the authored `data-scene-ready=true` first-paint marker, or a genuinely loaded and visible authored poster, before taking the existing two snapshots. The Desk is exempt because it has no header scene. A missing/never-ready course scene fails; the harness never waits for draw counts to stop. The original 450 ms interval and all unchanged-draw/transform assertions are preserved. The latest upstream independently adds a 30-second first-frame settlement gate and two native animation-frame waits; the merge retains that step before the stricter readiness diagnostics. Readiness, scene-frame and motion-state fields are now recorded in the reports.

Five root-CI regressions in `tests/qa-motion-readiness.test.mjs` cover delayed first paint, a continuing drawing loop, a scene that never becomes ready, loaded/visible poster requirements and the Desk exemption versus a missing course header. The delayed-first-paint case failed before the fix and passes after it; a continuing loop still violates draw equality. All 40 focused QA/helper tests pass locally, without skips. No product or protected rendering code is changed.

## Final verification and integration

The [QA-fix CI run 38509620947](https://github.com/jude27mad/tmu-course-guides/actions/runs/38509620947), on `0b8a5e92848d9ebb56d7a4af007adc423b0bd8d3`, completes **all 16 jobs successfully**, including both WebKit bases and both Chromium motion checks. It verifies the fix before the upstream book merge; it does not certify the later book code.

The final book-merged [CI run 38510279439](https://github.com/jude27mad/tmu-course-guides/actions/runs/38510279439), on `91170cb`, is green in **all 16 jobs**: root tests, UI build/tests, twelve Chromium check/base jobs and two WebKit base jobs. The Chromium modes checks retain all 188 assertions per base; both pass. The CI root suite reports **388 passed, zero failed, one skipped** out of 389. Its optional rail-layout browser test skips because that root job does not install Playwright; this is separate from the mandatory, fully executed WebKit jobs.

A corrected local root run using the pinned Playwright and installed browser path passes **389/389 with no skips**, including that rail test. An earlier attempt selected a missing default Chromium executable and left its preview fixture open; it was stopped and is not passing evidence. Local logs are `/tmp/ns-webkit-book-root-pinned.log` and `/tmp/ns-webkit-merged-helper.log` (40/40 focused QA/helper tests).

Latest upstream remains `aa7bca2` when fetched after verification. The merge retains its `book-*` filter, route-focus contract and first-frame settlement helper. The only protected-file changes are those already in that upstream; this follow-up's asset diff against it is empty. Final integration merges `codex/ns-resilience` into `night-shift` and pushes these two branch refs. No `main` ref is pushed.

## Protected findings and proposals

No WebKit functional defect is found in the protected stage, book, header, scene, Night Shift or MTH140 files. Those files match fetched upstream `aa7bca2` byte for byte; upstream book changes are preserved unchanged. The existing Chromium initialization sampling issue is addressed in QA code; it does not justify modifying protected rendering code. No new protected-file patch is proposed, and no assertion is removed or allowlisted.
