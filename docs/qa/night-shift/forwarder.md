# Night Shift Stage 1 — legacy forwarder change (`jude27mad/cen100-guide`)

Not applied. That repository was read through the GitHub API only (no clone, no edit). This file records the exact coordinated change for whoever is authorized to edit it.

## Current state (read 2026-10-12, `main` at `b602950e92922ba7760e6407121e03bdaedf8298`)

`index.html`, `404.html`, `colour-preview.html`, `mth140/index.html` and `mth141/index.html` are the same 787-byte file (blob `7c3c874b42fc0493ca55c2454a189650be611505`). Its script:

```js
const base='/cen100-guide';let tail=location.pathname.startsWith(base+'/')?location.pathname.slice(base.length):'/';const dest=new URL('https://jude27mad.github.io/tmu-course-guides'+tail);dest.search=location.search;dest.hash=location.hash;document.getElementById('destination').href=dest.href;location.replace(dest.href);
```

The legacy root (`/cen100-guide/`) was the CEN100 guide. Today it forwards to `/tmu-course-guides/`, which is now the Desk.

## Change

In all five copies, replace

```js
let tail=location.pathname.startsWith(base+'/')?location.pathname.slice(base.length):'/';
```

with

```js
let tail=location.pathname.startsWith(base+'/')?location.pathname.slice(base.length):'/';if(tail==='/'||tail==='/index.html')tail='/cen100/';
```

Nothing else changes: the query and hash are still copied verbatim, other paths still map to the same path under `/tmu-course-guides/`, and the destination is still a fixed same-origin prefix. Each file stays byte-identical to the others (839 bytes).

Optional: the no-JavaScript fallback `<a id="destination" href="https://jude27mad.github.io/tmu-course-guides/">` can stay as it is. Because the same file also serves `mth140/`, `mth141/` and `404.html`, the Desk is the right shared fallback; it links to all three guides.

## Expected mapping (proposed script run in `node:vm` against these URLs)

| Legacy URL | Forwards to |
|---|---|
| `/cen100-guide/` | `/tmu-course-guides/cen100/` |
| `/cen100-guide` | `/tmu-course-guides/cen100/` |
| `/cen100-guide/?motion=off#assignment-y4` | `/tmu-course-guides/cen100/?motion=off#assignment-y4` |
| `/cen100-guide/index.html#course-info` | `/tmu-course-guides/cen100/#course-info` |
| `/cen100-guide/#` | `/tmu-course-guides/cen100/` |
| `/cen100-guide/mth140/#assessment-quiz-2` | `/tmu-course-guides/mth140/#assessment-quiz-2` |
| `/cen100-guide/mth141/?x=1` | `/tmu-course-guides/mth141/?x=1` |
| `/cen100-guide/colour-preview.html?background=light&accent=mint` | `/tmu-course-guides/colour-preview.html?background=light&accent=mint` (site root, not `cen100/`) |
| `/cen100-guide/privacy.html` (served by `404.html`) | `/tmu-course-guides/privacy.html` (site root) |

The legacy root now reaches CEN100 in one hop. Before this change is deployed, a legacy root link with a CEN hash still works, in two hops: the forwarder sends it to the Desk, and `assets/legacy-route.js` then forwards it to `cen100/`. A legacy root link without a hash lands on the Desk until the change is deployed.

## Verify after deploying

Open `https://jude27mad.github.io/cen100-guide/?motion=off#assignment-y4`. It should end at `https://jude27mad.github.io/tmu-course-guides/cen100/?motion=off#assignment-y4` with the Academic Integrity Quiz item open. `/cen100-guide/mth140/` should still end at `/tmu-course-guides/mth140/`.
