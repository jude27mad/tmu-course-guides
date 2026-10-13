/* The one Three.js URL in the page. Every module that needs Three imports this file, never the vendor
   bundle directly, so the shared route document holds a single Three instance (one renderer state, one
   shader cache, one BRDF lookup texture) whichever route loads first. When the vendor bundle changes,
   bump the token here and in every `app/three.mjs?v=` import; nothing else names the bundle.
   Check: `grep -r "three-0.186.1.mjs?v=" assets` finds only this file. */
export * from '../vendor/three-0.186.1.mjs?v=20261013-stage1';
