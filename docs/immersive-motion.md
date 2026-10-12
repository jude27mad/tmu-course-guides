# Course scenes and interface motion

Current architecture — October 12, 2026. Static HTML and native ES modules are served directly by GitHub Pages. Prebuilt vendor bundles are committed.

## Responsibilities

- `assets/course-header.mjs` and its stylesheet create the responsive title/artwork stage and pause control.
- `assets/course-scene.mjs` owns the WebGL2 renderer, camera, lifecycle, quality adaptation and poster fallback. It uses Three.js, not WebGPU.
- `assets/scenes/circuit.mjs`, `calculus.mjs` and `algebra.mjs` create the subject scenes. The historical filename `circuit.mjs` now contains the planetary gearbox.
- `assets/scenes/drag.mjs` owns pointer rotation and decaying release velocity. `framing.mjs` owns course camera framing and portrait/landscape poster selection.
- `assets/guide-motion.mjs` and its stylesheet coordinate GSAP/Flip interface transitions. GSAP is bundled locally; Motion is not the current interface engine.

Course changes animate departure and entrance. Section changes move the content; assignment sheets, search, tools, study expansion, disclosures and completion updates have coordinated transitions. Native scrolling, DOM state and focus handling remain part of the guide. Header pause is independent of interface motion.

## Motion lifecycle

Idle animation runs without a click when motion is enabled. Dragging the artwork rotates it directly; releasing continues with inertia. Arrow keys rotate and Home resets focused artwork. Paused artwork allows page scrolling. Device reduced motion is respected; `?motion=full` explicitly selects and remembers full motion and `?motion=off` selects the static mode.

Hidden and offscreen scenes stop rendering. Back/Forward restoration wakes eligible scenes. GPU context loss, render exceptions or shader failure restore the corresponding poster. Adaptive quality lowers rendering cost after sustained slow frames. Interaction cleanup releases pointer capture and removes listeners.

## Maintenance

Build commands and evidence limitations are in [visual-overhaul.md](visual-overhaul.md). The [UI bundle README](../tools/ui-build/README.md) describes GSAP playback and workflow checks. Test both enabled and reduced motion, rapid repeated opening, keyboard focus, Back/Forward and saved inputs when changing transitions. Use real GPU browser review for scene changes; DOM tests cannot validate their appearance.

No analytics or external rendering service is used. See [privacy-audit.md](privacy-audit.md).
