# Subject headers and visual verification

Current implementation: October 12, 2026. This supersedes the October 11 abstract signal engine, liquid-metal vortex and optical crystal. Those designs and their geometry budgets are historical, not descriptions of the current site.

## Artwork

| Course | Current scene | Meaning |
| --- | --- | --- |
| CEN100 | Planetary gearbox with 24/18/60-tooth sun, planet and fixed ring | Coupled engineering motion with involute gear teeth |
| MTH140 | Flowing mint function ribbons and analytic tangent | A curve's local direction and continuous change |
| MTH141 | Sphere and basis transformed by 3×3 matrices | Linear maps, deformation and rank-two projection |

The folded-page logo is an original vector mark. The original salmon, mint and lavender identities remain. Titles and artwork have separate responsive zones; rotation-aware framing keeps the subject within its stage. Headers are visual introductions; interactive study exercises remain in Study.

## Interaction and rendering

Scenes animate continuously when motion is enabled. Mouse/touch dragging directly changes orientation; release adds decaying inertia. Focused artwork supports arrow-key rotation and Home reset. Pause, device reduced motion and the remembered motion preference control animation. Paused artwork permits normal page scrolling.

The production renderer uses locally bundled Three.js 0.186.1 and WebGL2. Matching portrait/landscape WebP posters appear before the first successful frame and remain when WebGL2 is unavailable. Context loss and shader/render errors stop the GPU scene and restore its poster. One frame owner sleeps offscreen, while hidden and when paused; adaptive quality reduces work on sustained slow frames.

Scripts, fonts and artwork are self-hosted. No remote model service or runtime CDN is required. The static pages run without a deployment build step.

## Verification

The subject-header and privacy changes passed 48 Node tests and six course/motion UI workflows, including real timed GSAP playback in the DOM harness. Coverage includes scene math, finite geometry, drag/inertia, pause/visibility lifecycle, fallback, source data and preserved guide interactions.

Responsive layout checks used phone, tablet and desktop viewport widths, including 320–1920 CSS pixels. GPU-capable remote browser captures were used for subject-header visual review; captures are in `docs/qa/subject-headers/`. The ordinary review browser lacked WebGL and exercised fallback rendering. DOM tests use a stub renderer and do not prove visual quality or GPU performance. No sustained physical iPhone, iPad, Android or desktop frame-rate certification is claimed.

## Rebuild and checks

```sh
npm ci --prefix tools/scene-build
npm run build --prefix tools/scene-build
npm ci --prefix tools/ui-build
node --test tests/*.test.mjs tests/scene-lifecycle.cjs tests/scene-rendering.cjs
npm test --prefix tools/ui-build
```

Keep poster imagery aligned with the production scene and camera. The older offline Mitsuba export/render scripts are tooling, not proof of live GPU output. Review actual browser pixels when changing geometry, lighting, camera or materials.

See [motion architecture](immersive-motion.md), [math studio](math-studio.md), [privacy review](privacy-audit.md) and [release history](../CHANGELOG.md).

## Design references

Subject references include Bartosz Ciechanowski's [Mechanical Watch](https://ciechanow.ski/mechanical-watch/) and [Gears](https://ciechanow.ski/gears/), and 3Blue1Brown's linear-transformation explanations. The selected mint Calculus concept informed the ribbon art direction.

Interaction references include [Bruno Simon's public portfolio source](https://github.com/brunosimon/folio-2025), [Active Theory](https://activetheory.net/work), [Locomotive](https://locomotive.ca/en) and [GSAP timelines](https://gsap.com/docs/v3/GSAP/Timeline/). These are references, not dependencies or claims that this site reproduces their engines.
