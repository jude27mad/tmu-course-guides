# Night Shift Stage 0: test baseline

Recorded 2026-10-12, before any Stage 1 product change.

- Branch: `night-shift`
- Commit: `406c4a4e8bb2e625328d2764a9cf8b5945644401` (`Merge remote-tracking branch 'origin/main' into night-shift`)
- Working tree: clean before and after these runs (`git status --short` was empty)
- Node `v22.22.0`, npm `10.9.4`

## 1. `tools/ui-build`

| Command | Result |
|---|---|
| `npm ci` | Exit 0. Added 40 packages. `EBADENGINE` warnings: `jsdom@30.1.2`, `@asamuzakjp/css-color@7.1.5`, `@asamuzakjp/dom-selector@9.2.4` and `w3c-xmlserializer@6.0.0` require Node `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`. npm audit reported 1 low-severity vulnerability. |
| `npm run build` | Exit 0. Printed `night-vendor.mjs: 67.4 KB`. |
| Rebuilt vendors vs git | **Byte-identical.** `git status` stayed clean, and the SHA-256 hashes were the same before and after the build. No restore was needed. |
| `npm test` (`node test.cjs && node workflow-check.cjs`) | **Exit 1.** |

Vendor files after the build:

| File | Bytes | SHA-256 |
|---|---|---|
| `assets/vendor/gsap-3.15.0.mjs` | 95884 | `e6ede5ab4bd593b9d4e2283e01ccda612b60a2aa58b0e0cdd1b6e398ba6da5ea` |
| `assets/vendor/night-vendor.mjs` | 69065 | `66bcd0ad8732b11032f2d5f3ceffd242e51aa9b7f205dd70572785ab82eac03b` |

### `npm test` detail

- `test.cjs`: **passed** (`GSAP playback, section interruption, expanding surfaces, dialog reversal, Flip continuity and pause/reduced-motion settlement passed`).
- `workflow-check.cjs`: **failed** on its first case, `cen100` with `motion=off`, at `AssertionError: cen100 final runtime errors` (`workflow-check.cjs:130`). Its runner stops at the first rejection, so the other five cases did not run in this command.
- jsdom also printed `[csstree-match] BREAK after 15000 iterations`. This line is not part of the assertion.

Failing assertion (actual runtime errors; expected `[]`):

```
Could not load link: "https://guide.test/assets/night/warp.css?v=20261012-night2"
Could not load link: "https://guide.test/assets/night/palette.css?v=20261012-night2"
Could not load link: "https://guide.test/assets/night/feel.css?v=20261012-night2"
```

Reason: `assets/night/boot.mjs` declares `FEATURES=['warp','hero','scroll','backdrop','palette','feel']` and loads `<name>.css` plus `<name>.mjs` for each one. `warp`, `palette` and `feel` have no `.css` or `.mjs` file in `assets/night/`. The harness returns 404, and jsdom reports the stylesheet link failures as runtime errors.

### All six workflow cases, run independently

To record every case, a scratch runner loaded the same `workflow-check.cjs` source, including its `check()`, with its original filename. It called each case in its own `try/catch`. No repository file was changed.

| Case | Result |
|---|---|
| cen100, motion=off | FAIL: `cen100 final runtime errors` (same three CSS links) |
| mth140, motion=off | FAIL: `mth140 final runtime errors` (same three CSS links) |
| mth141, motion=off | FAIL: `mth141 final runtime errors` (same three CSS links) |
| cen100, motion=on | FAIL: `cen100 final runtime errors` (same three CSS links) |
| mth140, motion=on | FAIL: `mth140 final runtime errors` (same three CSS links) |
| mth141, motion=on | FAIL: `mth141 final runtime errors` (same three CSS links) |

In every case, the only failure was the final `assert.deepEqual(errors,[],…)`. Every earlier assertion in `check()` passed for all six cases, covering navigation, search, drawers, tools, sections, sheets, history and state.

## 2. Repo root: `node --test tests/*.test.mjs tests/scene-*.cjs`

**Exit 1. Tests 49 · pass 41 · fail 8 · cancelled 0 · skipped 0 · todo 0** (about 4.0 s).

Per file:

| File | Pass | Fail |
|---|---|---|
| `tests/challenges.test.mjs` | 3 | 0 |
| `tests/composition.test.mjs` | 6 | 0 |
| `tests/course-scenes.test.mjs` | 9 | 0 |
| `tests/future-look.test.mjs` | 2 | 0 |
| `tests/header-geometry.test.mjs` | 4 | 0 |
| `tests/lab-math.test.mjs` | 6 | 0 |
| `tests/schedule.test.mjs` | 7 | 0 |
| `tests/subject-headers.test.mjs` | 3 | 2 |
| `tests/scene-lifecycle.cjs` | 1 | 0 |
| `tests/scene-rendering.cjs` | 0 | 6 |

Failing tests, numbered as in the combined run:

| # | File | Test | Reason |
|---|---|---|---|
| 32 | `tests/scene-rendering.cjs:20` | context loss shows the authored poster and releases the scene frame loop | esbuild cannot resolve `tools/scene-build/node_modules/three/...` (`three.module.js`, `RoundedBoxGeometry.js`, `BufferGeometryUtils.js`) |
| 33 | `tests/scene-rendering.cjs:25` | unsupported rendering uses an immediate poster without a busy animation loop | Same missing `three` resolution |
| 34 | `tests/scene-rendering.cjs:29` | nonthrowing shader link failure returns to the poster and stops the GPU frame loop | Same missing `three` resolution |
| 35 | `tests/scene-rendering.cjs:33` | adaptive GPU frame scheduling keeps advancing after downgrade and sleeps while paused or offscreen | Same missing `three` resolution |
| 36 | `tests/scene-rendering.cjs:41` | touch drag rotates through movement, releases with inertia, and pointer cancellation clears it | Same missing `three` resolution |
| 37 | `tests/scene-rendering.cjs:49` | pausing mid-drag releases the gesture so a later touch can start | Same missing `three` resolution |
| 48 | `tests/subject-headers.test.mjs:20` | animated art and basis tips remain visible at extreme drag rotations | `ERR_MODULE_NOT_FOUND`: `tools/scene-build/node_modules/three/build/three.module.js` |
| 49 | `tests/subject-headers.test.mjs:31` | the moving tangent endpoints fit in addition to the ribbon surface | `ERR_MODULE_NOT_FOUND`: `tools/scene-build/node_modules/three/build/three.module.js` |

Cause of all 8 failures: `tools/scene-build/node_modules` does not exist. `tools/scene-build/package.json` pins `three@0.186.1` and `esbuild@0.27.4`, and these tests import `three` from that path. The Stage 0 commands do not install `tools/scene-build` dependencies, so it was not installed for this baseline.

These are the same eight test names as the historical "32–37, 47, 48" failures in plan section 11. In this run, the last two are numbered 48 and 49.

## Summary

- Vendor rebuild: byte-identical to git.
- `tools/ui-build` `npm test`: `test.cjs` passes. `workflow-check.cjs` fails all 6 course × motion cases, only on the final runtime-errors assertion, because of missing `warp.css`, `palette.css` and `feel.css` requested by `boot.mjs`.
- Root suite: 49 tests, 41 pass, 8 fail. All 8 failures come from the missing `three` dependency in `tools/scene-build/node_modules`.
