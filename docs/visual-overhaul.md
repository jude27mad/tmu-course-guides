# Course scenes and interface motion

The October 11 overhaul follows the agreed full-width graphite art direction, keeping salmon/mint/lavender accents and the existing course workspace.

## Rendering

Three 0.186.1 uses WebGL2, physical materials, environment reflections and merged geometry. The renderer is deliberately narrower than the previous WebGPU/TSL bundle: 572,577 bytes before compression versus approximately 1.08 MB previously. This is a transfer-size result, not a claim that WebGL is inherently faster. RoomEnvironment is generated once and disposed after PMREM conversion. No recurring shadow or full-screen bloom pass is required.

The current scene budgets are 10 meshes / 21,028 triangles for Engineering, 7 / 4,208 for Calculus, and 7 / 5,778 for Linear Algebra. Pixel ratio is capped at 1.5 for coarse pointers and 1.8 otherwise. Sustained slow frames lower resolution and target about 30 fps. A single frame owner pauses when the document is hidden, the header leaves the viewport, motion is paused or reduced motion is requested. Returning from back/forward cache resumes it.

Canvas2D fallback projects the same geometry through the same camera. It preserves signal movement, camera response and the mathematical demonstration when WebGL2 cannot initialize or loses its context. Its material appearance is simpler than the GPU renderer. It is not evidence of GPU shader appearance or physical-device smoothness.

Calculus is y = x², extruded for depth. The secant goes through two actual points; its limiting tangent has slope 2x. Linear Algebra applies the 2×2 transformation to the x/y lattice, retaining z extrusion; the caption explicitly identifies a 2D transform. Its highlighted square has determinant one throughout the shear/rotation sequence.

## Interaction choreography

GSAP 3.15.0 and Flip are locally bundled. Section timelines run for 520 ms, assignment opening 440 ms, closing 340 ms, studio expansion 520 ms, disclosure/search 300 ms, and reordering 400 ms. Original DOM nodes retain saved input, event listeners and focus handling. The outgoing section is inert during the overlap. Interrupting a timeline settles its callbacks before the next owner takes over.

Native scroll is retained. Locomotive Scroll is not included because discrete transitions and camera progress do not need a second scroll engine. The documented ideas used here are coordinated timelines, camera interpolation, merged scene geometry, visibility-driven rendering and adaptive quality, not a copied portfolio interface.

## Build and verify

```sh
npm ci --prefix tools/scene-build
npm run build --prefix tools/scene-build
npm ci --prefix tools/ui-build
npm run build --prefix tools/ui-build
node --test tests/*.test.mjs tests/scene-lifecycle.cjs
npm test --prefix tools/ui-build
```

The static files are already built and GitHub Pages needs no build pipeline. Dependency versions and license files are checked in.

Verification performed: 31 mathematical/data/geometry tests; scene lifecycle fallback tests; real timed GSAP playback/interruption tests; six course workflows with motion on/off, preserved notes/sections, Back/Forward, close/reopen, completion event count and studio state. Browser layout checks cover 320, 360, 390, 412, 600, 768, 820, 1024, 1180, 1366 and 1920 widths for all three pages. They are viewport tests, not physical-device certification. The cloud browser has no WebGL context, so browser visual verification covers the live Canvas2D path. Physical iPad/Android GPU appearance and sustained frame rate remain unmeasured.

## Primary references

- [Active Theory founder interview](https://www.commarts.com/webpicks/active-theory-2): coordinated interaction, navigation and polish.
- [Bruno Simon's public portfolio source](https://github.com/brunosimon/folio-2025): rendering, quality, camera and reveal systems.
- [Locomotive Scroll documentation](https://scroll.locomotive.ca/docs/): scroll lifecycle and shared ticker integration, evaluated but not added.
- [GSAP timelines](https://gsap.com/docs/v3/GSAP/Timeline/) and [Flip](https://gsap.com/docs/v3/Plugins/Flip/): interruption and layout continuity.
- [Three physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) and [RoomEnvironment](https://threejs.org/docs/pages/RoomEnvironment.html): material response and image-based lighting.

Analytics stays disabled. No course data or storage keys are changed by the rendering system.
