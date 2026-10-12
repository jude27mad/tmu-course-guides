# Futuristic course header objects

Status: proposed design. This document plans the next artwork revision; it does not describe a deployed change.

## Intent

Jude likes the current movement and whole-page transitions. The circuit, cube cluster and calculus ribbon still look dated or too simple. Replace those three objects with original, sophisticated sculptures that feel like instruments from a far-future laboratory. Keep the accepted interaction choreography and the existing course layout.

The visual upgrade must be obvious in a paused frame. Motion should reveal the object's construction and materials, rather than carrying an otherwise weak design.

## One visual world

Use a graphite stage, shaped white studio reflections, dark ceramic, satin chrome and selective optical glass. Salmon, mint and lavender remain the respective course accents. Color lives in the interior, edge reflections and flowing light; it does not flood the entire object.

Use three levels of detail: an immediately recognizable silhouette, a few large structural features, and close-up surface detail. Bevels, thickness, joins, restrained surface roughness and controlled highlights make the sculptures feel designed. Start from custom geometry, not a repeated primitive grid.

### CEN100: suspended signal engine

Replace the flat board with a levitating instrument: three curved, machined shell sections around an exposed luminous core. A partial glass sleeve reveals copper filaments and narrow channels running through the structure. Small ceramic ribs and recessed seams give the shell believable construction. Its silhouette is asymmetrical and sculptural, with a clear central opening.

The shell floats around the core; the existing tap impulse makes its sections separate briefly and settle. Signals travel through the channels. Preserve the current calm/soon/close deadline states and their timing source: warm salmon in the calm state, progressively faster movement and pink light as a deadline approaches. All states remain readable and attractive when paused.

### MTH140: liquid vortex

Replace the simple thin ribbon with a thick, continuously folded liquid-metal surface curling into a central void. A partial clear lens encloses one side, so the mint light appears to pass through a physical volume. The surface has broad flowing folds and fine highlights, with different material response on its inner and outer sides.

The flow is continuous and smooth. A tap sends a bounded ripple through the surface using the existing impulse, then the sculpture returns to its idle form. Normals must follow deformation so reflected light moves with the surface. Use an animated baked flow/noise field rather than a full fluid simulation.

### MTH141: optical crystal

Replace the separate cubes with one faceted crystal assembled from 20 bevelled triangular panels. Selective glass faces reveal a smaller chrome core and three intersecting internal planes. Lavender refraction and narrow spectral highlights create optical depth; most edges stay clean and dark.

Panels open along their own face directions in a coordinated wave, then form the crystal again. The existing impulse changes the opening briefly. Avoid identical cube-like extrusions: panels have visible thickness, precise joins and a coherent outer silhouette. This is abstract course artwork; exact instructional mathematics stays in the study tools.

## Framing

- Desktop: title remains on the left; the sculpture fills about 80% of the usable art height on the right. Intentional cropping is allowed, but its defining feature must remain visible.
- Phone: title remains above the sculpture. Aim for an object width of 85% of the stage; keep the central feature, title and pause control clear at 320 px. Frame each object separately instead of shrinking a desktop camera.
- Tablet: tune the camera for the available header area, including the navigation width. Avoid a small central object surrounded by empty sides.
- Keep the existing header heights initially. Change height only when actual captures show a composition problem.

## Architecture and constraints

- Keep plain HTML, locally bundled Three 0.186.1/WebGL2 and the existing GSAP motion system.
- Keep the original salmon/mint/lavender course palette, course data, storage keys and navigation skeleton.
- Keep current course, section, drawer and search transition timing and ownership.
- Keep one scene animation owner, independent header pause, reduced-motion behavior, offscreen sleep and Back/Forward lifecycle.
- Keep analytics disabled and native scrolling.
- Add no new sliders, dragging requirements or explanatory text to the header.
- Use one dominant transmissive layer per view. Balanced mode disables dispersion and reduces internal detail while preserving the silhouette and lighting.
- Starting budgets: at most 50,000 visible triangles and 20 draw calls per header, counting its render passes; at most 500 KiB incremental compressed artwork resources across the three courses. These are design budgets to verify, not measured outcomes.
- Performance targets: approximately 60 fps on a representative desktop and at least 30 fps sustained on supported mobile hardware. Measure actual GPU frame time; a screenshot or geometry count does not establish this.

Create the lighting environment once from an original studio-light arrangement and convert it through PMREM. Reuse materials, bake the flow/noise data, and move deformation work into shaders where it is effective. Reuse the current adaptive resolution policy. Additional full-resolution blur, fluid simulation and recurring shadow passes are outside the initial design.

Render landscape and portrait WebP posters from the actual GPU scenes, each at most 64 KiB. Use these for immediate first paint and unsupported/context-lost rendering. The current striped Canvas2D material approximation must not be the visual reference for the new artwork. Full page and interface transitions remain available with a poster.

## Visual acceptance

Capture all three objects paused and moving, at desktop, tablet and phone sizes. A paused capture must show clear material differences, thickness, a distinctive silhouette and separation from the stage. Motion must keep highlights attached to geometry, keep glass sorting stable and avoid clipping the defining feature.

Compare the new capture against the current live header at the same size. Reject it if the improvement is mainly extra glow, additional repeated shapes or a faster spin. Verify GPU output in a WebGL-capable environment; label software-only evidence accurately. Retain course workflows and the accepted transition behavior.

Deliver all three headers as one coherent artwork revision, with versioned imports and recordings of the deployed revision.

## Research informing the design

These are technique references, not assets to copy. The proposed sculptures and material palette are our design decisions.

- [Volatile Nexus, Frank Reitberger, August 2026](https://tympanus.net/codrops/2026/08/31/volatile-nexus-tinkering-with-glass-caustics-cubes-and-sound-in-three-js/): facing-weighted refraction, damped interaction and deforming glass normals. [Live experiment](https://dasprinzip.com/tinker/day42/).
- [Vortex inside a glass sphere, MisterPrada](https://tympanus.net/codrops/2025/03/10/rendering-a-procedural-vortex-inside-a-glass-sphere-with-three-js-and-tsl/): composition, environment lighting and baked noise/vortex alternatives. [Demo](https://tympanus.net/Tutorials/VortexGlassSphere/) and [source/README](https://github.com/MisterPrada/vortex-glass-sphere).
- [Interactive 3D cluster, Francesco Michelini, August 2026](https://tympanus.net/codrops/2026/08/12/creating-an-interactive-3d-cluster-with-three-js-tsl-and-three-start/): face-centroid geometry and bounded individual-face movement. Use the structural idea with our optical finish. [Demo](https://tympanus.net/Tutorials/3DCluster/) and [source](https://github.com/kekkorider/codrops-tutorial-dark-cluster).
- [Interactive droplet-like metaballs, Yuki Kojima](https://tympanus.net/codrops/2025/06/09/how-to-create-interactive-droplet-like-metaballs-with-three-js-and-glsl/): shader-driven continuous shapes. Full-screen ray marching is not required for our chosen vortex.
- [Three physical material documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html): transmission, iridescence, dispersion and their per-pixel cost. Enable selectively.
- [Bruno Simon's portfolio source](https://github.com/brunosimon/folio-2025), [Active Theory's documented approach](https://www.commarts.com/webpicks/active-theory-2), and [Locomotive Scroll documentation](https://scroll.locomotive.ca/docs/): continue the previously implemented coordinated motion, camera response and lifecycle approach.
