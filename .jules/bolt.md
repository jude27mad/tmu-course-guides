## 2026-10-20 - Pre-computing normalisation values for full text search
**Learning:** String `normalize` and regex `.replace` are expensive operations to be continuously done on long arrays of texts per user keystroke in the full text search implementation of `site/src/lib/search.mjs`
**Action:** When evaluating full text search, pre-calculate the normalised query inputs to memory at module level in order to only compute this string modification once.

## 2026-10-21 - React & WebGL fluid canvas performance
**Learning:** In Three.js render loops (e.g. `FluidEffect.jsx` `update()` method), creating new `Color`/`Vector3` objects and comparing them against cached ones using `!==` will ALWAYS be true (reference inequality). Additionally, using `JSON.stringify(props)` in a React hook dependency array (like in `useMemo`) when `props` contains WebGL Texture references (`tFluid`) is highly inefficient and causes significant UI thread blocking.
**Action:** Always compare raw primitive values (like hex strings) before doing WebGL math or allocating memory inside a render loop. Use primitive destructuring (`intensity`, `fluidColor`, `backgroundColor`, `tFluid`) in React dependency arrays instead of `JSON.stringify` for props containing complex context objects.

## 2026-10-21 - WebGL Render Loop Array Allocation
**Learning:** In Three.js render loops (e.g. `Fluid.jsx` `useFrame`), creating array maps and defining objects with anonymous closures inside array `.forEach()` iterations forces the JS engine to allocate new memory structures on every single frame. This contributes heavily to Garbage Collection (GC) pressure and frame stuttering.
**Action:** Unroll loop arrays and configuration objects inside highly executed 60fps render paths (like `useFrame`). Perform operations sequentially using raw WebGL/Three.js state functions to prevent memory allocation entirely.
