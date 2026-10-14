# Latest149382 private evidence/archive candidate builder

Prepared code: `/tmp/ns-perf-latest-run-evidence.mjs`.

Do not execute while the run is active. Root must provide actual finalized inputs
after raw completedAt, its independently retrieved CLI exit and the monitor's
source/resource closure proof exist. Execution writes only a new `/tmp` candidate
directory, with no repository or canonical evidence edits.

```sh
node /tmp/ns-perf-latest-run-evidence.mjs /tmp/latest-run-evidence-input.json
```

REF means `{ "path": "/absolute/file", "sha256": "64 hex" }`.

```json
{
  "schemaVersion": 1,
  "runDirectory": "/workspace/tmu-course-guides/tools/qa/reports/2026-10-14T07-09-10-842Z-149382",
  "summarySHA256": "Actual final summary SHA; pending until closure",
  "sourceBefore": "REF /tmp/ns-perf-latest-full-source-before.json; fixed be421f9e…",
  "sourceBeforeBound": "REF /tmp/ns-perf-latest-full-source-before-bound.json; fixed412c0819…",
  "sourceAfter": "REF /tmp/ns-perf-latest-full-source-after.json",
  "resourceClosure": "REF /tmp/ns-perf-latest-full-resource-closure.json",
  "cliObservation": "REF to root's actual independently retrieved exit observation",
  "runnerLog": "REF to actual closed /tmp/ns-perf-latest-full-qa.log",
  "suiteValidation": "REF docs/qa/night-shift/performance-current-suite-validation.json",
  "visualProof": "REF docs/qa/night-shift/performance-visual-aa7bca2-proof.json",
  "visualComparison": "REF docs/qa/night-shift/performance-visual-comparison.json",
  "beforeBaseline": "REF current performance-before.json; fixed889612c8…",
  "budgets": "REF current tools/qa/perf-budgets.json; fixedd96fdcd1…",
  "reviewedSkips": "REF to array of exact actual latest-run native gap reviews, [] if none",
  "additionalVisualProofs": [],
  "wholeCheckFollowups": [],
  "outputDirectory": "/tmp/ns-perf-latest-run-evidence-candidate"
}
```

Actual CLI observation schema:

```json
{
  "recordedAt": "Truthful observation after actual closure",
  "rawDirectory": "/workspace/tmu-course-guides/tools/qa/reports/2026-10-14T07-09-10-842Z-149382",
  "observer": "/root",
  "exitCode": 1,
  "reportedAfterRunClosure": true,
  "source": "Concrete actual tool/session observation, not an inferred summary exit"
}
```

The exitCode shown is illustrative. It must equal root's actual retrieved CLI
exit and the raw finalized summary. The builder never infers a CLI observation.

Postclosure source capture uses the existing actual capture helper schema:
recordedAt/observedAfterClosureAt after summary completion, five exact source rows,
sourceUnchanged/driverIdentityUnchanged true, actual loader/driver identities and
launchOptions. Genuine prelaunch07:09:07.568 remains before actual07:09:10.842;
the later metadata binding time07:33:17.510 is preserved separately. No capture
timestamp or phase is relabeled.

Resource closure uses the actual monitor schema below. It retains all original
runner events and cleanup arrays; observedAt is an actual observation timestamp:

```json
{
  "observedAt": "Actual postclosure observation",
  "observationCompletedAt": "Actual observation completion",
  "rawDirectory": "Exact149382 directory",
  "runStartedAt": "Actual raw summary startedAt",
  "runCompletedAt": "Actual raw summary completedAt",
  "rawStatus": "Actual raw status",
  "rawExitCode": 1,
  "rawFailures": 12,
  "artifacts": {
    "summary": "Exact REF to own raw summary.json",
    "before": "Exact REF to original sourceBefore capture",
    "after": "Exact REF to original sourceAfter capture"
  },
  "sourceUnchanged": true,
  "productUnchanged": true,
  "protectedUnchanged": true,
  "driverIdentityUnchanged": true,
  "currentSources": "Actual exact five source rows",
  "driverIdentity": "Actual sourceAfter driverIdentity",
  "loader": "Actual sourceAfter loader",
  "launchOptions": "Actual sourceAfter launchOptions",
  "resources": {
    "fullQaPid": 149382,
    "fullQaProcessPresent": false,
    "activeChromiumProcesses": [],
    "ownedPreviewPorts": [
      { "origin": "Actual preview origin", "result": "refused", "error": { "code": "ECONNREFUSED" } }
    ]
  },
  "runnerCleanupErrors": [],
  "caseCleanupErrors": [],
  "caseResourceRecords": "Every selected {check,base,runnerErrors,cleanupErrors} record, in raw order",
  "rawRunErrors": [],
  "allObservedResourcesClosed": true
}
```

The example verdict/failure count is illustrative; every value must exactly match
the actual finalized summary. Raw cleanup arrays must match the finalized original;
they are never discarded. Nonempty caseCleanupErrors uses grouped rows
`{check,base,errors}` with the original complete cleanupErrors array. All selected
caseResourceRecords and rawRunErrors must match exactly, including raw expected:false.
Driver1.57 and core identities bind actual loader/core entry and package realpaths,
versions and hashes. All five current source files must still match committed
launchd6114ac, and product179546/protectedc428 must match independently at extraction.

Outputs:

- `archive/summary.json`, all14 whole-check JSON reports, runner.log, actual
  before/bound/after source captures, closure proof and CLI observation, byte-identical.
- `performance-browser-qa.candidate.json`: actual latest-normal verdict, exact
  failed assertions and all raw runner events/expected flags, per-case evidence
  guards, explicit availability limits and separately scoped follow-ups if supplied.
- `performance-verification.candidate.json`: committed root415/415, QA tools138/138,
  UIci/build/tests exit0 with eight identical vendor files, existing primary32 exact
  screenshot pairs, explicit default-URL MTH140 supplemental scope, and the latest
  browser verdict. Private guard counts are not added to production suite counts.
- `archive-verification.json`: immutable raw copy hashes/counts and actual verdict.

Latest raw failures remain failed. A passed raw case with unmatched generic
telemetry is retained as raw-passed and adds an evidence-validation blocker. Nojs
must reconcile exactly99 generated module GET/CSP failures, permitting CSP and
explicit disabled JavaScript, exact query tokens and no executed/pending scripts.
Failure fixtures reconcile URL-bound native offline/404 policy events plus the
four exact opaque-storage bootstrap events, retaining all13 generic expected:false
events. Unexpected bare-course ERR_ABORTED requests are never waived.

Capped or failed latest perf samples are archived with their collection state and
never replace canonical AFTER. Old660 metrics are not read. A genuinely passing
latest whole perf check must reproduce the current AA7 baseline-derived368 budgets
and16 complete unique samples before becoming an AFTER candidate. Every actual
base/route/profile sample settings object must exactly equal the frozen AA7 BEFORE
sample, including viewport, CPU, network, DPR, wall clock and all cache flags;
the same exact guard applies to every follow-up and effective union.

Root/UI suite validation, primary visual proof and comparison must use their exact
DOCS paths and match the committed d6114ac blobs. Every supporting suite copy hash
likewise binds actual committed evidence. No caller-selected numeric JSON is accepted.
Primary before/after manifest bytes bind frozen proof SHA references; all32 generated
case IDs, actual source/protected fingerprints, source stability, fixed clock,
recipe, driver/rendering environment, genuine live WebGL course scenes, natural
settlement, browser/evidence/repeat/error counters, PNG bytes/dimensions and decoded
RGBA hashes/equality are checked. Repeat captures are validated from actual PNGs
and every repeat/case comparison must have zero difference in all channels.

Existing primary32 screenshots keep their exact proof and high-tier MTH140 URL
scope. Any supplied default-URL supplement is preserved but remains separately
unvalidated until its actual schema is integrated; the builder currently cannot
claim the overall requested goal complete from the high-tier proof alone.

Optional later recovery accepts complete whole checks at either one actual base
or both actual bases. A single-base run must be the literal fresh-browser command
`node tools/qa/run.mjs CHECK --base BASE`; a both-base run is
`node tools/qa/run.mjs CHECK`. Its own summary must select exactly that one CHECK
and the stated bases, with normal SwiftShader, help false and all selected cases
actually passed. Each run must begin after original149382 completedAt. It binds
actual matching sources/driver/profile, genuine prelaunch/postclosure captures,
its own actual root CLI observation and resource closure, final runner log,
independent actual evidence peer review, fresh native-gap approvals and an exact
root failure-scope review. Fresh sourceBefore.recordedAt must be >= original
completedAt and < own startedAt. Both captures must bind their own runDirectory,
runSelection (exact check/bases/gpu/help) and runStartedAt; sourceAfter also binds
runCompletedAt and observes after closure. An original capture with null runDirectory
requires a separate honest `sourceBeforeBound` or `sourceAfterBound` REF: copy every
original field unchanged except runDirectory, add `sourceArtifact` exact original REF,
`bindingObservedAt` after actual launch/capture, exact actual directory/runSelection/
runStartedAt and, for sourceAfter, runCompletedAt. Old or unrelated-run captures
cannot be rebound. The independent peer inputs must bind these optional artifacts
when used, and the archive preserves them byte-identically. Supply `wholeFollowupReview` REF and rows:

```json
{
  "check": "An actual failed latest whole check",
  "bases": ["/"],
  "report": "REF to actual later whole report",
  "summary": "REF to its own actual closed summary",
  "sourceBefore": "REF",
  "sourceAfter": "REF",
  "resourceClosure": "REF to its own actual closed-resource proof",
  "cliObservation": "REF to its own actual retrieved root CLI exit and argv",
  "runnerLog": "REF to its own actual final log",
  "reviewedSkips": "REF to current exact native-gap rows",
  "peerReview": "REF to independent actual whole-check evidence review"
}
```

`cliObservation.argv` is exactly `["node", "tools/qa/run.mjs", "CHECK",
"--base", "BASE"]` for one base, or `["node", "tools/qa/run.mjs", "CHECK"]`
for both bases, preserving the actual command separately from its concrete
retrieved-tool-exit `source`. Other fields use the actual CLI schema above.

Review schema:

```json
{
  "approved": true,
  "reviewedBy": "/root",
  "originalSummarySHA256": "Exact finalized149382 summary SHA",
  "noOriginalFailureOrEventWaivers": true,
  "checks": [
    {
      "check": "Actual failed whole check",
      "bases": ["/"],
      "originalReportSHA256": "Exact original whole report SHA",
      "followupReportSHA256": "Exact later whole report SHA",
      "originalFailures": [
        { "base": "/", "name": "Exact failed assertion name", "rawAssertionSHA256": "SHA256(JSON.stringify(originalAssertion))" }
      ],
      "completeFixtureAssertions": [
        { "base": "/", "names": ["Every actual complete substantive assertion, in order, including multiplicities"] }
      ]
    }
  ]
}
```

Independent peer review binds actual finalized evidence, and cannot be a
source-only proposal approval:

```json
{
  "artifactType": "independent-whole-check-followup-evidence-review",
  "recordedAt": "Actual observation after later run completedAt",
  "reviewer": "/root/final_review",
  "approved": true,
  "sourceApprovalOnly": false,
  "check": "Actual CHECK",
  "bases": ["Actual BASE"],
  "findings": [],
  "inputs": {
    "report": "Exact REF supplied for follow-up",
    "summary": "Exact REF",
    "sourceBefore": "Exact REF",
    "sourceAfter": "Exact REF",
    "resourceClosure": "Exact REF",
    "cliObservation": "Exact REF",
    "runnerLog": "Exact REF",
    "reviewedSkips": "Exact REF"
  }
}
```

Only originally failed full cases are replaced in the separately labeled
effective coverage. An untouched passed latest-full base stays authoritative;
rerunning a selected passed base does not substitute for it. Duplicate selective
replacements are rejected. Original all28 records, assertions, generic events
and actual failed verdict remain immutable. Every replacement must retain the
original substantive assertion names/multiplicities and exact reviewed complete
fixture assertion list, including assertions the failed original could not reach.
Only exact reviewed current native restoration gaps can omit authored conditional
native assertions for previously passing native fixtures. A formerly failed
native restoration fixture must execute genuine persisted restoration and router
recovery; availability cannot substitute even if its original parking/Back never
completed. Generic unexpected events and ERR_ABORTED requests are never waived.

Effective perf is accepted only when the explicitly sourced actual cases across
both bases provide16 complete samples and all368 independently recomputed budget
assertions. The validation container is explicitly a union of actual raw records,
and never a claim that one new whole-all14 or whole-perf run executed. Original
failed/capped samples remain archived. Effective coverage includes exact raw
case sources, independent counts and acceptance separate from latestFullAcceptance.
All follow-up raw reports, summaries, sources, closure, CLI, runner log, gaps and
peer/root reviews are archived byte-identically too. Supporting baseline controls
and older passive observations are diagnostics only, never automatic recovery.

Preparation verification is syntax checking only. No current-run candidate has
been generated, no browser was launched and no production test count is claimed.
