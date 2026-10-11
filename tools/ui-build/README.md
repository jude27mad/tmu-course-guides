# Guide interaction bundle

From this directory run `npm ci`, `npm run build`, and `npm test`.

GSAP 3.15.0 plus Flip is bundled into a local ESM asset, with upstream license
notices retained. Esbuild and jsdom versions are pinned in package-lock.json.
The npm package ships a license URL in its embedded source notices instead of a
LICENSE file; assets/vendor/gsap-3.15.0-LICENSE.txt records that attribution.

Native browser scrolling and IntersectionObserver drive once-only reveals.
Locomotive Scroll was not added because these interactions do not need virtual
scrolling, scroll interpolation, or another ticker.

`test.cjs` runs real GSAP playback against measured test rectangles in jsdom,
including intermediate motion, interruption, Flip, and preference settlement.
`workflow-check.cjs` adapts the existing guide DOM workflow for all three courses
and adds tools, completion events, rapid drawer reopening, lab state retention,
and Back/Forward with motion enabled. Canvas context is explicitly unavailable
in the DOM harness. These checks do not validate rendering or physical devices.
