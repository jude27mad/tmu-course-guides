## 2026-10-20 - Pre-computing normalisation values for full text search
**Learning:** String `normalize` and regex `.replace` are expensive operations to be continuously done on long arrays of texts per user keystroke in the full text search implementation of `site/src/lib/search.mjs`
**Action:** When evaluating full text search, pre-calculate the normalised query inputs to memory at module level in order to only compute this string modification once.

## 2026-10-21 - React & WebGL fluid canvas performance
**Learning:** In Three.js render loops (e.g. `FluidEffect.jsx` `update()` method), creating new `Color`/`Vector3` objects and comparing them against cached ones using `!==` will ALWAYS be true (reference inequality). Additionally, using `JSON.stringify(props)` in a React hook dependency array (like in `useMemo`) when `props` contains WebGL Texture references (`tFluid`) is highly inefficient and causes significant UI thread blocking.
**Action:** Always compare raw primitive values (like hex strings) before doing WebGL math or allocating memory inside a render loop. Use primitive destructuring (`intensity`, `fluidColor`, `backgroundColor`, `tFluid`) in React dependency arrays instead of `JSON.stringify` for props containing complex context objects.

## 2026-10-22 - WebGL Render Loop Allocations
**Learning:** In Three.js and React Three Fiber render loops, mapping over short arrays or instantiating primitive `new Vector3` objects inside `useFrame` can cause significant GC spikes and microstutters on complex scenes.
**Action:** Avoid allocating new arrays, objects, or `new Vector3`/`new Vector2` objects in `useFrame`. Unroll iterations when possible, and instead reuse uniform cache properties using `.set(x, y, z)`.

## 2026-10-23 - React Canvas useMemo Prop Serialization
**Learning:** Using `JSON.stringify` on props in a React `useMemo` dependency array (like in `Fluid.jsx`) forces an expensive serialization operation on every render, and is incredibly dangerous when props contain complex WebGL objects (like a Three.js Texture). This will severely block the UI thread and degrade frame times.
**Action:** When memoizing WebGL effects based on React props, destructure the specific primitives (`intensity`, `fluidColor`, etc.) and the exact object references (`tFluid`) to be used in the dependency array. Never stringify whole prop objects or WebGL textures.

## 2026-10-27 - Object Allocation and Unrolling arrays in render loops
**Learning:** In Three.js and React Three Fiber render loops, allocating array objects (e.g. `const shaderUpdates = [...]` in `Fluid.jsx`) and looping through them, or passing newly created payload objects inside hot path physics engines (`card.current.applyImpulse({x, y, z})` in `BadgeScene.jsx`), causes silent memory leaking per-frame and severe GC stutters.
**Action:** Always unroll arrays manually in WebGL implementations instead of using closures like `forEach` or `map`. Allocate object parameters inside refs (`useRef({x:0, y:0, z:0})`) or direct `.set()` mutations for vectors inside `useFrame`.
