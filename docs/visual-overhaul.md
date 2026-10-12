# Course header artwork and interface motion

The current headers use original optical sculptures on a graphite stage, with the existing salmon, mint and lavender course identities.

| Course | Artwork | Visible geometry | Meshes |
| --- | --- | ---: | ---: |
| CEN100 | Suspended ceramic/chrome signal engine, optical core and deadline-driven channels | 45,436 triangles | 8 |
| MTH140 | Folded liquid-metal vortex, optical lens and mint flow | 34,416 triangles | 4 |
| MTH141 | Twenty bevelled crystal panels, chrome core and intersecting planes | 1,338 triangles | 5 |

These counts include instances and are geometry measurements, not GPU frame-rate results. The scene owner exposes actual render-pass calls and triangles in the header's diagnostic data attributes when WebGL runs. `renderer.info.autoReset` is disabled so the frame measurement includes transmission passes.

## Rendering and material quality

Three 0.186.1/WebGL2 uses original studio-light geometry converted through PMREM once, physical transmission, controlled iridescence, shaped highlights and a reusable 128 × 128 surface field. Calculus flow and its corrected surface normals are shader-driven; its geometry is not rebuilt each frame. Compatible shell/panel geometry is instanced. No recurring shadow, full-screen fluid simulation or extra full-resolution blur pass is required.

The vendor module is 575,531 bytes / 144,056 gzip, 1,033 compressed bytes larger than the prior module. The six WebP posters together are 301,152 bytes; each is below 64 KiB. Each course initially loads its corresponding poster, not all six. The artwork modules remain native ES modules and require no GitHub Pages build pipeline.

The single scene frame owner pauses offscreen, when the document is hidden, and when the header is paused; it resumes after Back/Forward restoration. Sustained slow frames lower resolution and disable dispersion. Pointer and section changes retain the accepted camera response. Context loss, thrown rendering errors and nonthrowing shader-link errors all return safely to the matching poster and stop the GPU loop. Shader callbacks record a failure; renderer disposal happens after the active rendering operation.

## First paint and unsupported rendering

Landscape and portrait posters are path-traced offline from the production geometry, shared camera poses and original lighting arrangement. They use Mitsuba's material approximations rather than the live Three shader pipeline; they are not browser/GPU screenshots. The initial poster fades only after a successful WebGL render. Unsupported devices retain the polished image, with a restrained compositor float controlled by the same pause, reduced-motion and visibility state. The previous striped Canvas2D approximation is no longer the user-facing fallback.

No new header inputs or visible explanatory copy were added. The sculptures are abstract course identities; exact instructional mathematics remains in the unchanged study tools.

## Accepted interface motion

The existing GSAP 3.15.0/Flip implementation is retained. Whole-content course departure is 500 ms and entrance 950 ms; sections turn/slide for 720 ms; assignment opening is 700 ms and closing 340 ms. Search/disclosure and completion motions are unchanged. Native scrolling, DOM identity, saved input and focus handling are preserved. Header pause remains independent from interface motion. Device reduced motion is respected by default; `?motion=full` explicitly selects and remembers full motion.

## Build and verification

```sh
npm ci --prefix tools/scene-build
npm run build --prefix tools/scene-build
npm ci --prefix tools/ui-build
node --test tests/*.test.mjs tests/scene-lifecycle.cjs tests/scene-rendering.cjs
npm test --prefix tools/ui-build
```

Reproduce the offline poster assets with a Python environment containing `tools/scene-build/requirements-posters.txt`, then:

```sh
node tools/scene-build/export-posters.mjs /tmp/course-header-geometry
python tools/scene-build/render-posters.py /tmp/course-header-geometry assets/scenes/posters --samples 768
```

Fresh verification: 41 Node tests cover course data/math, finite geometry, repeated impulses, material/resource ownership, poster fallback, shader failure, quality downgrade and scene lifecycle. The GPU renderer used in lifecycle tests is deliberately a stub; those tests do not establish actual GPU shading. Real timed GSAP playback and all six course/motion workflows pass, preserving notes, sections, search, drawers, tools, Back/Forward and study state.

Native browser layout checks cover all three courses at viewport widths 320, 390, 412, 600, 768, 820, 1024, 1366 and 1920 pixels: 27 cases, with no horizontal overflow and all poster assets loaded. The review browser cannot create a WebGL context, so these checks establish responsive layout and fallback rendering only. Compact framing and Engineering title contrast follow the artwork's actual content width, including tablet layouts with the navigation sidebar.

CPU-only model update samples on this host averaged 0.018 ms for Engineering and 0.004 ms for Algebra; Calculus updates were below 0.001 ms. These are JavaScript update measurements only, not GPU FPS claims. Exact live GPU shading/glass sorting and sustained physical iPad/Android/desktop frame rate remain unmeasured in this environment. Target frame rates are 60 fps on representative desktop and 30 fps sustained on supported mobile hardware, with adaptive quality; these are targets, not certification.

Analytics remains disabled. Course information, progress/storage keys and study interactions are unchanged.

## Primary references

- [Glass, refraction and bounded interaction](https://tympanus.net/codrops/2026/08/31/volatile-nexus-tinkering-with-glass-caustics-cubes-and-sound-in-three-js/).
- [Procedural vortex composition and baked-flow optimization](https://tympanus.net/codrops/2025/03/10/rendering-a-procedural-vortex-inside-a-glass-sphere-with-three-js-and-tsl/).
- [Face-oriented geometry and coordinated panel movement](https://tympanus.net/codrops/2026/08/12/creating-an-interactive-3d-cluster-with-three-js-tsl-and-three-start/).
- [Three physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).
- [Mitsuba surface scattering models](https://mitsuba.readthedocs.io/en/stable/src/generated/plugins_bsdfs.html).
- [Bruno Simon's public portfolio source](https://github.com/brunosimon/folio-2025), [Active Theory's documented approach](https://www.commarts.com/webpicks/active-theory-2), [Locomotive Scroll documentation](https://scroll.locomotive.ca/docs/), and [GSAP timelines](https://gsap.com/docs/v3/GSAP/Timeline/): previously implemented interaction choreography, lifecycle and camera direction.
