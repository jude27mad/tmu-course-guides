# Course scenes and motion

The guide remains static HTML served by GitHub Pages. Course data, progress storage and native navigation stay in their existing modules.

## Rebuild the vendor file

Run `npm ci --prefix tools/scene-build` then `npm run build --prefix tools/scene-build`. Three.js 0.186.1 and esbuild 0.27.4 are pinned in the committed lockfile. The output and MIT licence are committed so Pages needs no build step. Motion 14.1.0 remains the shared interface animation dependency.

## Architecture

- `course-header.mjs/css` reserves a large responsive composition and renders an immediate SVG fallback.
- `course-scene.mjs` is loaded after the guide is usable. One renderer uses WebGPU where available, with Three's WebGL2 fallback. The SVG remains visible until the first GPU render succeeds. Context loss restores it.
- `scenes/` contains procedural geometry, actual mathematical state and small materials shared between courses. The circuit uses a TSL emissive material and a procedural contact shadow. No models, videos or textures are downloaded.
- `guide-motion.mjs/css` owns interruptible interface animations. State and keyboard focus are updated immediately. Dialog exits restore the original nodes and their listeners.
- Pointer movement and native scroll gently change the scene camera. Touch never requires dragging.
- Pause is remembered across courses. Reduced-motion and the fixture's `?motion=off` override disable motion. Hidden/offscreen scenes stop rendering. The renderer reduces resolution and targets 30 fps after a sustained slow frame sample.

## Validation

Run `node --test tests/*.test.mjs`. Scene tests cover secant/tangent correctness, continuous area-preserving transforms, finite geometry, signal routes and geometry budgets.

`tests/editorial/` provides 11 responsive viewport sizes for all three guides, with study/info/search views and a static-motion override. This fixture changes layout dimensions; it does not impersonate a physical device or another browser engine.

Initial geometry: circuit 17 meshes / 11,028 triangles; calculus 9 / 7,684; algebra 14 / 1,150. Shared renderer is approximately 282 KB gzip; this is a build-size measurement, not a network or frame-rate claim.

Actual WebGPU/WebGL2 appearance and sustained frame rate must be checked on GPU-capable devices. The cloud review browser has no working graphics context, so it exercises the complete fallback and interface rather than proving GPU rendering. Keep that distinction when reporting verification. Analytics remain disabled.
