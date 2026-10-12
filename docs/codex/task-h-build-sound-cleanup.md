# Task H — Three.js addons, paper sounds and retiring warp/backdrop (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-build-sound` from the latest `night-shift`. Read `docs/codex/README.md` and `NIGHT-SHIFT-PLAN.md` Sections 6, 7 ("Feel, completion and sound") and 9 ("Retire after replacements are wired") first.

Three independent, coding-only parts. One commit per part.

## 1. Three.js addons in the bundled vendor

The book and Desk need these r186 addons from the **same** Three.js core (no second copy): `RoomEnvironment`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `ShaderPass`, and anything they import. Find how `assets/vendor/three-0.186.1.mjs` is built (`tools/scene-build`), add the addons to its entry so they are exported alongside the core, rebuild, and confirm: existing exports unchanged, current scenes still import what they use, size before/after reported. Keep `tools/scene-build` a development tool (committed output, no page build step). Update `THREE-LICENSE.md` if needed. Run the scene tests (`node --test tests/scene-*.cjs tests/*.test.mjs`).

## 2. Synthesised paper sounds in the shared sound service

In `assets/night/core.mjs` (the existing opt-in sound service, key `tmu-guide-sound-v1`, one shared `AudioContext`): replace the old `chime` and `whoosh` and the hover `tick` with **page turn**, **cover open**, **cover close**, **book set-down** and **pop-up unfold**, synthesised with WebAudio only (filtered noise bursts, short resonant thumps; no audio files). Requirements: off by default; nothing plays when motion is reduced/off; a `play(name, {intensity})` API; scrubbing turns are rate-limited so one gesture never produces a burst (e.g. at most one page-turn sound per 120 ms and per spread change); the context is created lazily on the first allowed play after a user gesture; no allocation of new buffers per call where a cached buffer works. Keep `haptic()` as is. Add `tests/sound.test.mjs` with a mocked `AudioContext` (rate limiting, gating, names).

## 3. Retire warp and backdrop

They are no longer loaded (boot loads only `hero`, `scroll`, and later `palette`). Delete `assets/night/warp.mjs`, `warp.css`, `backdrop.mjs`, `backdrop.css` if present, the `night-warp` arrival snippet (the inline `<script>` that reads `sessionStorage['night-warp']`) from every route document, the `html.ns-warp-in` cover rules in `assets/night/layout.css`, and any remaining references or tests. Do **not** delete the old subject scenes, `hero.mjs` or `scroll.mjs` yet — they are still in use until the books replace them.

Run `tools/ui-build` `npm test` and the root tests after each part.
