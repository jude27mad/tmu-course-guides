# Codex tasks for Night Shift

Coding-only work that runs in parallel with Claude's design work (books, Desk, motion, styling). Each task is a self-contained prompt: paste the task file into Codex as-is.

| Task | Branch | Start | Depends on |
| --- | --- | --- | --- |
| [E — Semester weeks and page-bend math](task-e-weeks-bend-math.md) | `codex/ns-weeks-bend-math` | now | nothing |
| [A — CEN100 guide as a route module](task-a-cen-module.md) | `codex/ns-cen-module` | after Stage 1 lands on `night-shift` | Stage 1 |
| [B — Math guide lifecycle](task-b-math-lifecycle.md) | `codex/ns-math-lifecycle` | after Stage 1 lands | Stage 1 |
| [C — Shared guide lifecycle](task-c-shared-lifecycle.md) | `codex/ns-shared-lifecycle` | after Stage 1 lands | Stage 1 |
| [D — Router](task-d-router.md) | `codex/ns-router` | after Stage 1 lands | Stage 1; integrates A–C through the contract below |

Claude reviews and merges each branch into `night-shift`. Codex must not push to `main` or `night-shift`, and must not open pull requests unless asked.

## Rules for every task

- Repository: `jude27mad/tmu-course-guides`. Base every branch on the latest `night-shift` at the time you start.
- Read `NIGHT-SHIFT-PLAN.md` Sections 1, 3, 7 and 12 first. Section 12 (one persistent world, no page reloads) is why these tasks exist.
- No visual design changes: do not edit colours, typography, layout CSS, animation timing or 3D visuals. Claude owns those. If a refactor needs a CSS change to keep the existing look, keep it minimal and say so in the commit.
- Behaviour must be identical for users unless the task says otherwise. Preserve every storage key, saved-progress shape, assessment ID, hash route, element ID that tests or other modules use, and every event (`workspace-changed`, `guide-completion`, `guide-motion-change`, `course-open-item`, `course-view-change`, `course-schedule`, `night-hold`).
- Only edit the files your task owns. If you must touch another file, keep the change minimal and list it in your final summary.
- Static GitHub Pages site, native ES modules, no build step for pages, no new runtime dependencies, Content Security Policy unchanged (`script-src 'self' 'unsafe-inline'`, `connect-src 'none'` — note: the router's same-origin fetch needs `connect-src 'self'`; Task D owns that one CSP change on the four route documents).
- Tests: add focused tests under `tests/` (run with `node --test`), keep `tools/ui-build` passing (`npm ci && npm run build && npm test`; the build must leave vendor files byte-identical). Never delete or weaken an existing functional assertion to get green.
- Commit messages: imperative, explain why. One logical change per commit.

## Route lifecycle contract (shared by A, B, C, D)

Every **route-specific** module (anything that only makes sense on one route: the CEN guide, math guide, math labs, workspace, editorial shell, course header, semester visuals, Night Shift deadline/timeline/scroll/hero, Desk) follows this contract:

```js
// No side effects at import time beyond defining functions/constants.
export function mount(ctx) {
  // ctx.root   — the route region element (the document's <main data-route-region> or the wrapper the router swaps)
  // ctx.route  — 'desk' | 'cen100' | 'mth140' | 'mth141'
  // ctx.signal — AbortSignal aborted on unmount: pass it to every addEventListener({signal})
  // ctx.direct — true on a direct document load, false when the router swapped the route in
}
export function unmount() {
  // Disconnect observers, clear timers, kill tweens/ScrollTriggers, remove DOM this module created
  // outside ctx.root, and delete/reset globals it defined (CourseWorkspace, CourseVisuals, CEN_SCHEDULE …).
}
```

- **Direct loads:** each route document lists its route modules in order with `<script type="module" data-route-module src="…">`. A tiny bootstrap, `assets/app/route-boot.mjs` (owned by Task D; Tasks A–C may add a temporary local stand-in with the same behaviour and remove it if D has landed), imports them in document order and calls `mount({root, route, signal, direct:true})` after `DOMContentLoaded`.
- **Router swaps:** the router calls `unmount()` on the outgoing modules in reverse order, aborts their signal, swaps the region, then imports the incoming document's `data-route-module` scripts and calls `mount(... direct:false)`.
- **Shell modules** (initialise once, never unmount): `hub.js` sidebar and theme button, Night Shift `core.mjs` services (clock, holds, tiers, sound), the dock, the palette, the single 3D stage host, `guide-motion.mjs` motion preference controller. They react to a `route-changed` event (`document`, `detail:{route, from}`) dispatched by the router after each mount.
- Globals that other code reads (`window.CourseWorkspace`, `window.CourseVisuals`, `window.GuideMotion`, `window.CEN_SCHEDULE`) are set in `mount()` and removed in `unmount()`, except `GuideMotion`, which is shell-owned.
- A module that cannot yet unmount cleanly must say so by exporting `export const reloadRequired = true;` — the router then falls back to a full navigation for that route instead of leaking.

## Definition of done (every task)

1. Branch pushed with focused commits.
2. `node --test tests/*.test.mjs` and `tools/ui-build` `npm test` pass, with no new failures compared with `docs/qa/night-shift/baseline-tests.md` (list any pre-existing failures by name).
3. A short summary in the final message: files changed, contract functions exported, tests added, anything left for Claude.
