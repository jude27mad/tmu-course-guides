> Historical design: superseded by the October 12 subject-specific headers. See [current artwork documentation](../../visual-overhaul.md).

# Futuristic Header Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three dated header objects with a suspended signal engine, liquid vortex and optical crystal while retaining the accepted motion.

**Architecture:** Keep `mountScene` as the single lifecycle and camera owner. Replace the course model internals, add a shared material/lighting module, and keep the current model API. Use original rendered posters for first paint and fallback.

**Tech Stack:** Plain HTML/CSS/ES modules; locally bundled Three 0.186.1/WebGL2; existing GSAP 3.15.0; esbuild; Node tests; real GPU/browser captures.

**Spec:** [Futuristic course header objects](../specs/2026-10-11-future-header-objects-design.md).

## Global Constraints

- Keep plain HTML, locally bundled Three 0.186.1/WebGL2 and the existing GSAP motion system.
- Keep the original salmon/mint/lavender course palette, course data, storage keys and navigation skeleton.
- Keep current course, section, drawer and search transition timing and ownership.
- Keep one scene animation owner, independent header pause, reduced-motion behavior, offscreen sleep and Back/Forward lifecycle.
- Keep analytics disabled and native scrolling.
- Add no new sliders, dragging requirements or explanatory text to the header.
- Use one dominant transmissive layer per view. Balanced mode disables dispersion and reduces internal detail while preserving the silhouette and lighting.
- Starting budgets: at most 50,000 visible triangles and 20 draw calls per header, counting its render passes; at most 500 KiB incremental compressed artwork resources across the three courses. These are design budgets to verify, not measured outcomes.
- Performance targets: approximately 60 fps on a representative desktop and at least 30 fps sustained on supported mobile hardware. Measure actual GPU frame time; a screenshot or geometry count does not establish this.

## Review Focus

1. GPU context failure or loss: a matching rendered poster appears; navigation still works and no animation loop leaks.
2. Pause, reduced motion, hidden tab and offscreen header: artwork settles attractively and the frame owner sleeps/resumes correctly.
3. Long or rapid interaction: deformation stays finite, bounded and continuous; the accepted interface animation keeps its owner.
4. Narrow phones and tablet side navigation: the artwork's defining feature and the title remain visible without overflow or large empty sides.
5. Sustained GPU load: resolution/material downgrade continues rendering and preserves the object's identity; GPU appearance and performance are measured separately from software tests.

## File map and shared interfaces

- Create `assets/scenes/future-look.mjs`: shared materials, reusable flow/noise data and an original studio environment.
- Modify `assets/scenes/circuit.mjs`, `calculus.mjs`, `algebra.mjs`: geometry, internal idle motion and impulse response for their respective sculpture.
- Modify `assets/course-scene.mjs`: use the new lighting, per-course composition, quality hook and poster fallback. Retain lifecycle/camera ownership.
- Modify `assets/course-header.mjs` and `assets/course-header.css`: revised accessible descriptions, poster mount/placement and composition adjustments only.
- Create `assets/scenes/posters/{cen100,mth140,mth141}-{wide,tall}.webp`: six captures of the actual GPU artwork, each at most 64 KiB.
- Modify `tools/scene-build/vendor-entry.mjs` only for the Three exports the artwork needs; rebuild the existing vendor bundle and keep its license.
- Extend `tests/course-scenes.test.mjs` and `tests/scene-lifecycle.cjs` for real geometry/lifecycle risks. Add `tests/future-look.test.mjs` for shared resource ownership.
- Update imports in `index.html`, `mth140/index.html`, `mth141/index.html` with one new artwork version. Update `docs/visual-overhaul.md` with measured results.
- Leave `assets/guide-motion.mjs`, `assets/workspace.mjs`, study modules and course data unchanged unless a demonstrated integration defect requires a narrowly scoped fix.

Existing creators keep `createCircuit(palette)`, `createCalculus(palette)` and `createAlgebra(palette)`. Their returned model keeps `root`, `bounds`, `caption`, `update(time, dt, {still, impulse})`, `react()`, `sketch()` and `dispose()`; Engineering also keeps `urgency('calm'|'soon'|'close')`.

Add `model.setQuality('full'|'balanced'|'software')`. The lifecycle owner calls this after renderer selection and quality changes. It changes material/detail cost, never starts a second loop.

Shared look API: `createFutureLook(palette)` returns `{materials, update(time, impulse, still), setQuality(mode), disposeTextures()}`. `materials` exposes `metal`, `ceramic`, `glass`, `light` and `flow`. Scene disposal owns the materials; the look owns and releases its generated textures. `createStudioEnvironment(palette)` returns a Three scene for one-time PMREM conversion and is disposed immediately afterward.

## Task 1: Shared material and lighting foundation

**Files:** `assets/scenes/future-look.mjs`, `assets/course-scene.mjs`, `tools/scene-build/vendor-entry.mjs`, `tests/future-look.test.mjs`.

**Produces:** the shared look API and quality modes above.

- [ ] Add a resource-ownership test: repeated look creation/disposal releases every generated texture once; updates keep uniforms finite; quality changes allocate no per-frame resources.
- [ ] Run `node --test tests/future-look.test.mjs`; confirm the new API is initially missing.
- [ ] Implement the shared look and studio environment. Use shaped softbox highlights, selective physical glass and original baked flow/noise data. Uniform updates must not trigger shader recompilation each frame.
- [ ] Wire one-time environment conversion and `setQuality` into the existing renderer lifecycle. Keep current motion timing and scene owner.
- [ ] Run the new test and `node --test tests/scene-lifecycle.cjs`; inspect a GPU material study containing metal, ceramic and glass. Confirm the glass reveals internal geometry without washing it out.
- [ ] Commit the foundation once material appearance and disposal pass.

## Task 2: Suspended Engineering signal engine

**Files:** `assets/scenes/circuit.mjs`, `tests/course-scenes.test.mjs`.

**Consumes:** shared look; current palette, urgency source and impulse. **Produces:** the existing circuit model interface with the new shell/core.

- [ ] Extend geometry tests to exercise all urgency states, idle motion, 100 successive impulses and the paused pose; assert finite coordinates, bounded geometry and the spec's budgets.
- [ ] Replace plate banks with three custom curved shell sections, a partial glass sleeve, a luminous core and integrated signal channels. Preserve the existing urgency timing source.
- [ ] Use the existing impulse to open the sections and settle them; avoid a second spring/timeline owner. Keep the core recognizable throughout.
- [ ] Run `node --test tests/course-scenes.test.mjs`; capture paused and moving GPU output on phone and desktop. Compare against the current circuit at the same sizes.
- [ ] Commit when construction, material depth and deadline-driven light are visible in the captures.

## Task 3: Calculus liquid vortex

**Files:** `assets/scenes/calculus.mjs`, `tests/course-scenes.test.mjs`.

**Consumes:** shared flow material and current impulse. **Produces:** the existing calculus model interface with the folded vortex.

- [ ] Extend geometry tests for the continuous loop, paused pose and maximum impulse: finite geometry, no broken seam, spec budgets and stable resource counts through repeated updates.
- [ ] Build a thick folded surface with a central void and partial optical lens. Animate a baked flow field; calculate deformation normals consistently with the surface. Reuse allocated geometry and uniforms.
- [ ] Bind the existing impulse to a limited surface ripple that settles into the idle flow.
- [ ] Run the geometry tests; inspect GPU highlights across the seam, both surface sides and the transparent lens. Capture the same three framing classes as Engineering.
- [ ] Commit after the paused sculpture has visible volume and moving reflections follow its folds.

## Task 4: Algebra optical crystal

**Files:** `assets/scenes/algebra.mjs`, `tests/course-scenes.test.mjs`.

**Consumes:** shared glass/chrome materials and current impulse. **Produces:** the existing algebra model interface with the faceted crystal.

- [ ] Extend geometry tests for the closed crystal, maximum face opening, repeated impulses and return to idle; assert finite transforms, bounded panel movement and spec budgets.
- [ ] Build 20 bevelled triangular panels around the chrome core and three internal planes. Batch or instance compatible geometry. Use selective optical faces so panel depth remains legible.
- [ ] Open panels along their face directions in a coordinated wave; route the existing impulse into that motion.
- [ ] Run the geometry tests; inspect back/front glass ordering and edge highlights in GPU captures. Verify the open pose still reads as one designed sculpture.
- [ ] Commit after paused and moving captures demonstrate a clear upgrade over the cube cluster.

## Task 5: Composition, first paint and fallback

**Files:** `assets/course-scene.mjs`, `assets/course-header.mjs`, `assets/course-header.css`, six poster files, `tests/scene-lifecycle.cjs`, three course HTML files.

**Consumes:** completed models; actual GPU captures. **Produces:** coherent framing and a matching first/fallback frame on all three courses.

- [ ] Extend lifecycle tests for renderer initialization failure, forced context loss, hidden tab, Back/Forward restore, quality downgrade and pause/reduced motion. Assert a matching poster, one loop at most and working course navigation.
- [ ] Set per-course desktop/phone/tablet camera framing using the spec. Keep stage height initially; update accessible object descriptions without adding visible explanatory copy.
- [ ] Produce wide/tall posters from each real GPU scene. Show the matching poster immediately and fade to the ready scene; keep it for unsupported/context-lost rendering. Dispose unused renderer resources.
- [ ] Version the artwork imports consistently across modules and all three course pages.
- [ ] Run `node --test tests/*.test.mjs tests/scene-lifecycle.cjs` and `npm test --prefix tools/ui-build`. Check all courses at 320, 390, 412, 768, 820, 1024, 1366 and 1920 px, including tablet portrait/landscape and short landscape screens.
- [ ] Commit after title contrast, central-feature framing, first paint and fallback pass.

## Task 6: GPU quality and release verification

**Files:** `docs/visual-overhaul.md`; built vendor assets if exports changed.

**Consumes:** the complete artwork revision. **Produces:** measured performance, clear visual evidence and a verified release.

- [ ] Rebuild with `npm run build --prefix tools/scene-build` if vendor exports changed; run the complete checks from Task 5 and `git diff --check`.
- [ ] Measure all render passes, triangles, compressed artwork size and steady-state GPU frame time. Record at least 60 seconds on representative desktop, iPad and Android WebGL hardware; tune quality only against observed bottlenecks.
- [ ] Capture a paused before/after image and an idle/tap/course-switch recording for every header. Identify GPU/software paths accurately. A software browser capture alone cannot approve the material finish.
- [ ] Check the five Review Focus cases and confirm unchanged notes, assignments, search, study controls and navigation. Confirm no analytics activation or new input controls.
- [ ] Update the documentation with results, device/browser names, any remaining measurement limits and the actual revision.
- [ ] Publish the three completed headers together through the existing GitHub workflow. Verify the deployed asset version and record the deployed pages, so cached old artwork cannot be mistaken for the revision.

## Plan self-review

Each sculpture has a geometry/motion task; shared material cost and ownership have one owner; lifecycle/fallback/framing have one integration task. All five Review Focus cases map to Tasks 1, 5 or 6. The exact course content and accepted interface motion remain outside the artwork changes. Visual acceptance requires actual GPU captures in addition to automated checks. Execution has not started.
