# Task I — In-world transition controller (start when Claude says the router review has landed)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-transition` from the latest `night-shift`. Read `docs/codex/README.md`, `NIGHT-SHIFT-PLAN.md` Sections 4 ("Camera dive and reverse return") and 12, and `assets/app/router.mjs` first.

Build the **plumbing** for the Stage 5 Desk ↔ book camera move. No visuals: Claude's 3D code plugs into your hooks.

## Owns

New `assets/app/transition.mjs`, minimal changes to `assets/app/router.mjs` / `route-boot.mjs` if needed, new tests. Do not touch `assets/book/*`, `assets/night/*` or CSS.

## Requirements

1. `registerTransition({name, from:'desk'|'course'|'*', to:…, run({from, to, url, origin, signal, policy}) → Promise})` lets a scene register an outgoing/incoming animation. `origin` carries the clicked element's rect (or the viewport centre for keyboard/palette navigation). `policy` is `'full'|'fade'|'cut'` from the existing motion gates (OS reduced motion → `fade` 150 ms; `?motion=off`, Pause motion or a hold → `cut`).
2. The router awaits the matching transition through `route-will-change`'s `waitUntil` **in parallel with** fetching/prefetch, with a hard cap (e.g. 1 200 ms): navigation never waits longer, and a slow or failing animation never blocks the page. Abort via `signal` on Back/Forward, a second click or `pagehide`.
3. Arrival continuity: after the swap, the incoming side receives `{continuing:true, pose}` from the outgoing run so the destination continues the move instead of starting a second entrance. Direct loads and stale state get `{continuing:false}` and **never** a cover screen.
4. Back/Forward between Desk and a course plays the reverse transition when allowed; otherwise it is instant. Focus, scroll restoration and hash handling stay exactly as the router does now.
5. `?motion=off` and `cut`: no animation, immediate semantic navigation. Modified clicks, new tabs and external links are untouched.
6. Tests (`tests/transition.test.mjs`): registration and matching, cap and abort, policy selection, continuation hand-off, back/forward, no cover on direct load; extend `tools/ui-build/workflow-check.cjs` with a stub transition that records calls during Desk ↔ course round trips.
