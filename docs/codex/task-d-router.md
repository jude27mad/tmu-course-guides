# Task D — Router (start after Stage 1 lands)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-router` from the latest `night-shift`. Read `docs/codex/README.md` (shared rules and the **route lifecycle contract**) and `NIGHT-SHIFT-PLAN.md` Sections 3 and 12 first.

## Goal

Moving between the Desk (`/`), `/cen100/`, `/mth140/` and `/mth141/` (under the deployment base: `/` locally, `/tmu-course-guides/` on GitHub Pages) never reloads the document. Each route stays a real document for direct loads, deep links and no-JS reading.

## Owns

New `assets/app/router.mjs`, new `assets/app/route-boot.mjs`, the `<script>`/CSP lines that load them in `index.html`, `cen100/index.html`, `mth140/index.html`, `mth141/index.html`, `tools/preview-server.mjs` only if needed, tests. Tasks A–C convert the route modules; integrate against the contract and use stubs in tests where their branches have not landed.

## Requirements

1. **`route-boot.mjs`** (direct loads): imports the document's `script[type=module][data-route-module]` in document order and calls `mount({root, route, signal, direct:true})` after `DOMContentLoaded`. Route = `body.dataset.page==='desk' ? 'desk' : body.dataset.course`.
2. **Base awareness:** derive the deployment base from the location of `assets/app/router.mjs` (`new URL('../../', import.meta.url)`), never from hard-coded paths. Works at `/` and `/tmu-course-guides/` (use `node tools/preview-server.mjs --base /tmu-course-guides/` to check).
3. **Interception:** same-origin, primary-button, unmodified clicks on links whose resolved pathname is one of the four route roots (with or without `index.html`), not `target=_blank`, not `download`, not `rel=external`. Capture phase on `window`, call `preventDefault()` so `guide-motion.mjs`'s old departure animation stands down. Same-route links with only a hash change are left to the existing hash routing.
4. **Fetch and prefetch:** add `connect-src 'self'` to the CSP of the four route documents (leave every other directive unchanged). Prefetch destination HTML on `pointerenter`/`focus` of a route link and on idle for the other courses; cache parsed documents (bounded, e.g. 4 entries). Use `fetch(url, {credentials:'same-origin'})`, `DOMParser`.
5. **Swap:** dispatch `route-will-change` (cancelable; Claude's camera transition will await a returned promise via `event.detail.waitUntil(promise)`), unmount outgoing route modules in reverse order and abort their signal, replace the route region (`<main data-route-region>` — add this attribute to each document's main element) with the destination's, sync `<head>`: add stylesheets the destination needs and remove ones only the old route used **after** the new ones have loaded (no unstyled flash), update `document.title`, `meta[name=description]`, `body` `data-course`/`data-page`/classes, then import and mount the destination's route modules (`direct:false`), then dispatch `route-changed` (`detail:{route, from}`).
6. **History:** `pushState` on navigation, `popstate` for back/forward, `history.scrollRestoration='manual'` with per-entry scroll positions restored after mount; hashes on the destination (`#assignment-…`, `#course-info`, etc.) still open their item after mount (dispatch the same events a direct load would).
7. **Focus and announcements:** after mount, move focus to the destination's Skip target / main heading (`tabindex=-1` if needed) without scrolling past restored position; announce "<Course name> guide" via a polite live region in the shell.
8. **Fallback:** if a route module exports `reloadRequired=true`, the fetch fails, the destination lacks a route region, or anything throws during swap, do a normal `location.assign(url)`. Never leave the page half-swapped.
9. **Shell marker:** set `window.TMURouter = {navigate(url), prefetch(url), get route(){}}` and a `data-shell-id` on `<html>` created once per real document load, so tests can assert no reload happened.

## Tests

- Unit (`tests/router.test.mjs`, jsdom from `tools/ui-build/node_modules` is fine): link eligibility matrix, base derivation at both bases, head sync ordering, fallback triggers, history/scroll bookkeeping.
- `tools/ui-build/workflow-check.cjs`: navigate Desk → CEN100 → MTH140 → MTH141 → back → forward in one jsdom window, asserting the shell marker survives, the right modules are mounted, saved state is preserved, focus lands on the new route, and listener/observer counts stay flat over 20 round trips.

## Done when

No reloads between the four routes in the harness, direct loads unchanged, all workflows and root tests pass with no new failures.
