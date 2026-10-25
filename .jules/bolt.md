## 2026-10-20 - Pre-computing normalisation values for full text search
**Learning:** String `normalize` and regex `.replace` are expensive operations to be continuously done on long arrays of texts per user keystroke in the full text search implementation of `site/src/lib/search.mjs`
**Action:** When evaluating full text search, pre-calculate the normalised query inputs to memory at module level in order to only compute this string modification once.

## 2026-10-21 - React & WebGL fluid canvas performance
**Learning:** In Three.js render loops (e.g. `FluidEffect.jsx` `update()` method), creating new `Color`/`Vector3` objects and comparing them against cached ones using `!==` will ALWAYS be true (reference inequality). Additionally, using `JSON.stringify(props)` in a React hook dependency array (like in `useMemo`) when `props` contains WebGL Texture references (`tFluid`) is highly inefficient and causes significant UI thread blocking.
**Action:** Always compare raw primitive values (like hex strings) before doing WebGL math or allocating memory inside a render loop. Use primitive destructuring (`intensity`, `fluidColor`, `backgroundColor`, `tFluid`) in React dependency arrays instead of `JSON.stringify` for props containing complex context objects.

## 2026-10-22 - WebGL Render Loop Allocations
**Learning:** In Three.js and React Three Fiber render loops, mapping over short arrays or instantiating primitive `new Vector3` objects inside `useFrame` can cause significant GC spikes and microstutters on complex scenes.
**Action:** Avoid allocating new arrays, objects, or `new Vector3`/`new Vector2` objects in `useFrame`. Unroll iterations when possible, and instead reuse uniform cache properties using `.set(x, y, z)`.
