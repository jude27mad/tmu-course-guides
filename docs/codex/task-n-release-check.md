# Task N — Merge Task L and CI, then check `night-shift` for release (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** work on the latest `night-shift` directly. Read `docs/codex/README.md`, `tools/qa/README.md` and `docs/qa/night-shift/README.md` first.

Claude merges `night-shift` to `main` (the live site) after reading your report. You never push to `main`.

## 1. Merge Task L

Merge `origin/codex/ns-qa-fixes` into `night-shift` with a merge commit (no rebase, no squash). It merged cleanly in a dry run on 13 October. If it no longer does, resolve the conflict so both sides' behaviour survives.

## 2. Review and merge the CI workflow

`origin/codex/ns-ci` adds `.github/workflows/ci.yml`. Before merging it, confirm that:

- it runs on pushes and pull requests to `night-shift` and `main` and never deploys, publishes or needs secrets;
- it runs `npm ci` in **both** `tools/scene-build` and `tools/ui-build` before the root tests, because the root suite fails without `tools/scene-build/node_modules`;
- it runs the root suite (`node --test tests/*.test.mjs tests/scene-*.cjs`), `tools/ui-build` `npm run build` with a check that vendor files stay byte-identical, `npm test`, and `node tools/qa/run.mjs` at both bases;
- it finishes in a reasonable time (aim for under 15 minutes) and uploads the QA report folder as an artifact.

Fix what is missing, then merge it into `night-shift`.

## 3. Run everything on the merged head

- Root suite, `tools/ui-build` build and test, and every `tools/qa` check at `/` and `/tmu-course-guides/`.
- Compare with the last recorded results (`docs/qa/night-shift/fgh.md` and `docs/qa/night-shift/task-l-qa-fixes.md`). A failure that is new on this head is a regression: find the cause and fix it if it is outside the files Claude owns (listed in `docs/codex/README.md`); otherwise report it with the failing output.
- Never weaken or delete an assertion to get green. Never change visuals.

## 4. Record and push

Write `docs/qa/night-shift/release-candidate.md`: the commit tested, a results table (suite, tests, pass, fail, skipped), anything still failing and why, and a short list of what the live site gains when this head reaches `main` (palette, opt-in sounds, interface copy, Task I transitions, Task L fixes, Desk data, docs). Link it from `docs/qa/night-shift/README.md`. Push `night-shift`, then check that the CI run on GitHub for that push is green and say so in your final message.
