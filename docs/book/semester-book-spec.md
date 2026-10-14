# MTH140 Semester Book: Stage 2 build spec

**Status:** build spec for Stage 2. It merges the visual and technical research drafts and resolves their conflicts using `NIGHT-SHIFT-PLAN.md`. It does not authorize any product change by itself. Precedence: the plan (Sections 1, 2, 5–9 and 12), then this spec, then the drafts.

**Repo facts this spec relies on** (`night-shift` at `190f067`):

- Router and route lifecycle are merged: `assets/app/router.mjs`, `route-boot.mjs`, and `assets/route-lifecycle.mjs` (`scope(ctx)`, `rememberDOM`).
- `assets/course-header.mjs` already implements `mount(ctx)` / `unmount()`.
- Codex's `assets/book/weeks.mjs` and `assets/book/page-bend-math.mjs` are merged and tested.
- There is no shared stage host yet (`assets/app/stage.mjs` does not exist).
- Codex Task F (palette) and Task H (Three addons, sounds, retiring warp/backdrop) are open. Task H owns `tools/scene-build/vendor-entry.mjs`.

**Two builders, no conversation needed:**

- **Side A, Engine:** everything that touches Three.js, GPU, the canvas and the 3D scene.
- **Side B, DOM integration:** book state, the rail (caption and week controls), scroll, pin and swipe, Skip to coursework, dock handoff, fallback timeline, and the palette hook.

They meet only at the contracts in §3.

---

## 1. Decisions that resolve the two drafts

| # | Topic | Visual draft | Technical draft | **Decision** (reason) |
|---|---|---|---|---|
| 1 | Units and page | 0.142 × 0.206 m | W = 1, H ≈ 1.38 | **Metres, W 0.142, H 0.206.** The page frame is Codex's: x across from the spine, y along the spine in **[0, H]** (Codex bounds and picking require it), z up. |
| 2 | Curl model | Cylinder; tight radius mid-turn; corner skew ≤ 6° at high tier | Cylinder | **Codex's model as merged.** A semicircular fold of length πr rolls from the outer edge to beyond the spine: `a = (1−t)W − t·πr`. Because of this, a *large* radius is what lifts the sheet, so the radius peaks mid-turn (§5.2); the visual draft's profile is inverted. **No corner skew** (it would fork the math). |
| 3 | Page textures | Ink **masks** in R/G/B, `NoColorSpace`, colours as uniforms, no repaint on theme change | sRGB colour textures, repaint on theme change | **Masks.** A theme change becomes a uniform tween (plan §2: no reset). Linear coverage also avoids the thin-text problem with sRGB mips. |
| 4 | Pop-up mechanism | Parallel-fold arch: chord plus bow, apex by circle intersection; V-fold tag | Box linkage with Bézier arc (length ±15%) | **Exact chord linkage** solved from the real foot positions (Codex `bendPoint` on a turning sheet). The bow is cosmetic. The tag is a planar plate, a documented approximation (§5.3). Box and V-fold mechanisms wait for Stage 4. |
| 5 | Raise relation | `r(θ)` with θ = 180°(1−turn); the bow lags by 60 ms | Exact ω from linkage | **θ is measured from the geometry** (the angle between the foot directions). `r(θ)` drives bow and lean only. **No time lag:** scrubbing must be a pure function of `turn`. |
| 6 | Pop-up sizes | 0.30 / 0.25 / 0.15 / 0.08 H; at most 3 per spread | .34 / .28 / .20 / .14 W; at most 4 | **Visual sizes, at most 3.** |
| 7 | Completion | `r` forced to 0 | `flat` spring | **`flat ∈ [0,1]` tween.** The chord height scales by (1−flat). The tag folds **back** onto its own flattened arch, label and stamp face up (folding forward would hit the next slot). |
| 8 | Urgency pulse | Book may own the pulse (`data-ns-pulse`) | Static glow | **Static glow in 3D, always.** The DOM deadline surfaces own the single pulse; `hero.css` already says so. Plan §2. |
| 9 | Post-processing | CSS grain and vignette; layer bloom or a sprite; CA off | HDR threshold bloom; FinishPass with vignette, grain and CA ≤ 1.5 px | **Threshold bloom** (no second scene render) at high tier in dark theme only. **CSS** grain and vignette on the stage, covering the CSS desk too. **Finish** = Neutral tone map, sRGB, CA 0 over the book rising to ≤ 0.6 px at the corners, and dither. Plan §6/§8: CA only at high. |
| 10 | Shadows | Shadow maps, including the turning sheet | Pop-ups cast; sheets use an analytic band | **Technical approach.** No `MeshDepthMaterial` export. |
| 11 | Key light | `SpotLight` lamp (dark) / directional (light) | Directional | **Visual approach** (plan §4: desk lamp). Export `SpotLight`. |
| 12 | Environment and exposure | env 0.12 / 0.45; exposure 0.95 / 1.0 | .35 / .9; 1.0 | **Visual values.** |
| 13 | Sheet segments | 64×24 / 40×16 | 96×2 / 48×1 | **96×2 / 48×1.** The axis is parallel to the spine, so y segments add nothing. `bendHit` segments = mesh x segments. |
| 14 | Phone framing | Whole spread at 60° elevation | Right-page pose | **Whole spread.** |
| 15 | Idle drift | High-tier drift plus pointer parallax | No idle loop | **High tier only**, gated (§4). Mid tier and phones render on demand. Stage 3 may switch it off. |
| 16 | Scroll mapping | Dwells; 2 turns in 150vh | Linear; N ≤ 3 | **Dwell profile, N ≤ 2.** The pin gets shorter with N instead of stretching dwells. Keep the technical draft's teleport, `anchorDirty` and kill compensation. No auto-settle while scroll owns `turn`. |
| 17 | Swipe | 10 px, \|dx\| > 1.4\|dy\|, 0.8 × page width | 1.3, 0.6 × slot width | **Visual values.** |
| 18 | Corner drag | Pointer projected via `bendHit` | Screen-space | **Screen-space mapping**, with the visual draft's release rules. |
| 19 | Keyboard model | Radiogroup (APG) | Focusable stage (Home = today) | **Stage is not focusable** (`aria-hidden`). Keys live on the rail's radiogroup: APG arrows, Home/End = first/last, PageUp/PageDown ±4. Today is a button. |
| 20 | When the caption updates | At dwells only | On `select` | **The DOM renders `index`.** Discrete commands set it immediately. Continuous sources set it at a dwell or landing. The live region updates 400 ms after `settle`. |
| 21 | Posters | Ink 0, pop-ups raised but untagged | Undated poster mode | **Ink 0 and no pop-ups** (the pop-up set depends on the date). Neutral hero motif; block split 0.5. On arrival, pop-ups rise from 0 to 1. |
| 22 | Stage host | — | `assets/app/stage.mjs` plus a private stage before the router | **Singleton `stage.mjs`** (module scope survives router swaps). No private-stage path, because the router has landed. |
| 23 | Tag textures | One 640×240 texture each | Atlas of 512×256 slots | **Atlas of 2×4 slots of 640×240** (1280×960), mask channels. |
| 24 | Vendor | Claude edits `vendor-entry` | Claude edits `vendor-entry` | **Codex Task H owns the addon edit.** The engine's extra core exports are an addendum (§8). |
| 25 | Palette hook | `book.openWeek` | `currentBookState()` | **Both.** The palette (Task F) dispatches `book-open-week`, and book-state handles it (§6.9). |

---

## 2. Ownership and parallel plan

### 2.1 Files

| Side | Owns (create or edit) | Must not edit |
|---|---|---|
| **A, Engine** | New `assets/app/stage.mjs` and `assets/app/three.mjs` (single Three re-export). New `assets/book/{book-scene,book-geometry,page-bend,popup,course-styles,textures}.mjs`. New `assets/book/posters/mth140-{dark,light}-{wide,tall}.webp`. New `tools/scene-build/book-posters.mjs` and `tests/book-capture.html`. Import-URL switch in `assets/course-scene.mjs` and `assets/scenes/*.mjs`, plus `renderer.forceContextLoss()` in course-scene dispose. Tests `tests/book-{popup,bend-adapter,pick,textures}.test.mjs` and `tests/book-lifecycle.cjs`. | `weeks.mjs`, `page-bend-math.mjs`, `vendor-entry.mjs` (Task H; see §8), any DOM or CSS outside the canvas |
| **B, DOM** | New `assets/book/book-state.mjs`. Book branch of `assets/course-header.mjs` and `assets/course-header.css`. `assets/night/{scroll,hero,timeline,deadline}.mjs`, `assets/night/{layout,hero}.css`. Skip link in `mth140/index.html`. Tests `tests/book-{state,spread,scrub}.test.mjs` and `tools/ui-build/workflow-check.cjs` additions. | Anything under `assets/book/` except `book-state.mjs`; `core.mjs` (Task H is editing it); `palette.mjs` (Task F) |
| Codex (read-only for both sides) | `weeks.mjs`, `page-bend-math.mjs`, `router.mjs`, `route-boot.mjs`, `route-lifecycle.mjs`, the workspace and guide modules, and Tasks F, G and H outputs | — |

### 2.2 Milestones

Each side merges into `night-shift` independently. Each milestone ends green on the root tests and `tools/ui-build`.

| Milestone | Side A | Side B |
|---|---|---|
| M0 contracts | `stage.mjs`, plus a `mountBook` that returns the poster-only controller (`ready → 'poster'`). The §3.6 stub is checked in by B. | `book-state.mjs` and `describeSpread` with tests (pure). Lands first, because A consumes it. |
| **M1 paused frame (first gate)** | Book renders the paused frame (§4.2) at 1440 and 390, both themes. No motion. | Rail, caption, controls, Skip link, fallback timeline and tokens are complete under `?motion=off`. |
| M2 interaction | Turns (cut/fade/full), picking, corner drag, pop-up kinematics, completion | Scrub/pin, swipe, data refresh, palette hook, dock handoff calls |
| M3 motion | Choreography (§5.8), handoff close/shrink, drift, bloom | Pin tuning, live region, `--hero-p` ownership |
| M4 | Captures (§10.3); then the plan's checkpoint: merge MTH140 to `main` and stop. | Same captures |

---

## 3. Contracts between the sides

### 3.1 `assets/book/book-state.mjs` (B owns; pure: no DOM, Three, storage or timers)

```js
export function createBookState({ course, weeks, today, policy }) → BookState
  // weeks: Spread[] from semesterWeeks(); today: currentWeekIndex(weeks, now)
  // policy(): 'full' | 'fade' | 'cut'   (§4.1; injected so the module stays pure)
export function attachBookState(state)   // route mount: makes it current; wires document events (§3.5)
export function detachBookState(state)   // route unmount; no-op if not current
export function currentBookState()       // → BookState | null (null on the Desk and non-book routes)

BookState = {
  course, get weeks(), get today(),
  snapshot() → Snapshot,                                   // frozen
  openWeek(i, { source = 'control', animate = true } = {}) → Promise<{ index, cancelled }>,
  step(delta, opts) → Promise,                             // ±1, ±4
  grab(source) → boolean,                                  // 'drag' | 'swipe'; false unless policy() === 'full'
  scrub(turn, source) → boolean,                           // 'scroll' | 'drag' | 'swipe' | 'animation'
  release(source, { velocity = 0 } = {}) → Promise,        // velocity in turns/s, + = forward
  setWeeks(weeks, { reason, today } = {}),                 // data, section, completion, target, minute or midnight change
  setAnimator(animator | null),
  subscribe(fn, { continuous = false } = {}) → unsubscribe, // fn(snapshot, change)
  consumeAnchorDirty() → boolean,                          // scroll reads and clears
  dispose()
}
Snapshot = { course, count, today, index, turn, settled, source, lock, mode, version }
Change   = { kind: 'turn' | 'select' | 'settle' | 'weeks', source, reason? }
Animator = { animate(from, to, { distance, source, mode, ease, duration }) → Promise<void>, cancel() }
```

**Invariants**

- `turn` is a float in [0, count−1], and `index` is an integer in [0, count−1].
- Turn `i + f` (0 < f < 1) means the sheet between spreads i and i+1 is at local turn f.

**Commands**

- `openWeek` and `step` (source `key | control | palette | item | today | next`):
  1. Clamp the target.
  2. Set `index` immediately and emit `select`.
  3. Set `anchorDirty`.
  4. If a drag or swipe is in progress, cancel it.
  5. Then:
     - `cut`, or no animator: `turn = index`, `settled = true`; emit `turn`, `select`, `settle` synchronously.
     - `fade`: `animator.animate(..., { mode: 'fade' })`; `settle` when it resolves.
     - `full`: `animator.animate(turn, index, { distance, mode: 'full' })`.
  6. A new command while animating *retargets*: the previous promise resolves `{ cancelled: true }`. Repeated key presses collapse to the latest target.

**Continuous sources**

- `scrub(t, 'scroll')` returns false while a drag or swipe holds the lock. When |t − round(t)| < 0.02, it sets `index = round(t)`, `settled = true`, and emits `select` (if changed) and `settle`.
- On `release` the landing is:
  - `ceil(turn)` if v > 0.3
  - `floor(turn)` if v < −0.3
  - `round(turn)` otherwise

  Then `animate(..., { ease: 'power2.out', duration: clamp(|landing − turn| × 900, 180, 600) })` and `settle`. `anchorDirty` is set.

**Notifications and limits**

- Discrete subscribers get `select | settle | weeks`. Continuous subscribers also get `turn`.
- `setWeeks` keeps `index`, clamps it, and emits `weeks` with its `reason`. It accepts the same array to force a view refresh (`reason: 'target' | 'minute' | 'midnight'`).
- Never reads or writes storage. The week is session presentation state (plan §1).

### 3.2 `describeSpread()`: the only source of text (B owns; in `book-state.mjs`; pure)

```js
export function describeSpread(spread, { course, data, weeks, section, completed, now, targetId, today }) → SpreadView
export function paletteEntries(state, ctx) → [{ index, label: 'Week 6 · Oct 12–18', keywords: [...] }]
```

```
SpreadView = {
  index, count, datedCount, kind, partial, pending,
  kicker: 'WEEK' | 'EXAMS',  numeral: '06' | null,  of: '16',
  range: 'Mon Oct 12 – Sun Oct 18' | 'Date pending',
  note: 'Teaching week' | spread.label (partial or pending) ,
  relative: 'THIS WEEK' | 'NEXT WEEK' | 'IN 3 WEEKS' | 'LAST WEEK' | '2 WEEKS AGO' | 'BEFORE TERM' | 'AFTER TERM' | 'EXAMS · DATE PENDING',
  days: [{ date, dow: 'MON', dom: '12', today, outside }] × 7 ([] when pending),
  entries: Entry[]  (by date, then popupRank desc),
  popups: string[]  (≤ 3 entry ids by popupRank desc; completed entries keep their slot and lie flat),
  more: number,     (entries beyond 3)
  aria: 'Week 6, Oct 12 to 18, this week, 1 assessment',
  live: 'Week 6 of 16, Mon Oct 12 to Sun Oct 18, this week. Lab Quiz 2: Quiz week.',
  signature: string (stable hash of everything above)
}
Entry = { id, open, kind, kindLabel, title,
  when, label, cta,              // verbatim from resolveTarget({course,data,section,completed,now,id})
  day: 'YYYY-MM-DD' | null,      // weeks record date; null for week or pending precision
  rowWhen: string | null,        // `when` with its leading "Thu Oct 15 · " removed; never composed
  bracket: boolean,              // week precision: printed as a Mon–Fri bracket
  chip: 'NEXT' | 'SOON' | 'NOW' | 'DONE' | 'PASSED' | null,
  urgency: 'none' | 'soon' | 'hot', state, completed, passed, rank }
```

**Wording rules**

- All wording comes from `resolveTarget` (by `id`), `parts` and `compact`. **Nothing is composed.** No `23:59`, and no countdown digits in textures.
- Chip:
  - `DONE` if completed.
  - `PASSED` if the state is `passed` (line 2 = `compact()`, e.g. "Due time passed").
  - Otherwise, only the entry whose id is `targetId` gets one: `NOW` (live), `SOON` (soon or hot), or `NEXT`.
- `urgency` is `soon` or `hot` (hot includes live) only for exact or day precision.

**MTH140 check values** (now = 2026-10-12, no section):

- Index 5, relative `THIS WEEK`, one entry `quiz-2`: `when` "Oct 12–Oct 16 · during your assigned lab", `label` "Quiz week", `cta` "Choose your section for your quiz time", bracket true.
- Index 6: midterm, `when` "Fri Oct 23 · 6:30 PM Toronto", `label` "Test starts".
- Index 16 (pending): final, `when` "Date pending", `label` "Awaiting the official schedule".
- With section 1: quiz-2 has day 2026-10-15 and `rowWhen` "4:00 PM · POD367".

### 3.3 `assets/book/book-scene.mjs` (A owns)

```js
export async function mountBook(slot, {
  course, state, getView,          // getView(i) → SpreadView (B's describeSpread, bound to live context)
  signal, arrival = { start: 0 },  // navigation start, ms on performance.now()
  onOpen,                          // (open) => core.openItem(open)
  onFallback,                      // (reason) => void
  dockTarget                       // () => DOMRect | null of `.ns-dock-id i`
}) → BookController

BookController = {
  ready: Promise<'webgl2' | 'poster'>,
  metrics() → { pageWidthPx, spreadRect, stageRect },   // CSS px, for swipe and hit hints
  setHandoff(p),                     // 0..1, from scroll (§5.8); p > 0 disables picking
  setFocus(id | null),               // caption hover or focus → static tag highlight
  close({ ms = 350 }) → Promise,     // route-will-change; resolves at once unless mode is 'full'
  requestFrame(), stats(), dispose()
}
```

**Engine obligations**

- A subscribes to `state` with `continuous: true` and registers the animator.
- On a `weeks` change it re-calls `getView` for the live faces and repaints only those whose signature changed.
- A reads theme (via `course-styles.onTheme`) and tier (via `core.onTier`) itself.
- A calls `onOpen` only for a click on a settled, interactive pop-up or a printed row.

### 3.4 `assets/app/stage.mjs` (A owns; shell singleton)

```js
export function probe() → { ok, reason }   // cached; webgl2 + failIfMajorPerformanceCaveat; honours ?tier=
export function getStage() → Stage         // creates the renderer from the probed context on first use
Stage = { available, reason, renderer, canvas,
  attach(slot, controller) → detach,       // re-parents the one canvas; one controller in Stage 2
  requestFrame(), gates() → { visible, hidden, held, motion, ambient },
  environment() → Texture,                 // RoomEnvironment PMREM, cached; size by tier
  post() → { render(scene, camera, { bloom }), resize(w, h, dpr), dispose() } | null,   // high tier only
  quality, onQuality(fn), onLost(fn), onRestored(fn), stats() }
SceneController = { resize(w, h, dpr), update(dt, gates) → busy, render(renderer, post), dispose() }
```

### 3.5 Events and dataset hooks

| Event | Target | Detail | Fired by | Consumed by |
|---|---|---|---|---|
| `book-state` | document | `{ state }` | `attachBookState` | palette, dock |
| `book-week` | document | Snapshot | book-state on `select`, `settle`, `weeks` | dock, Stage 6 sound |
| `book-open-week` | document | `{ index }` | palette (Task F) | B: `preventDefault()` and `openWeek(i, { source: 'palette' })` |
| `book-ready` | slot | `{ renderer }` | A | B (hint text) |
| `book-fallback` | slot | `{ reason }` | A (also `onFallback`) | B (shows the timeline) |
| `book-hover` | slot | `{ id \| null }` | A | B (caption entry highlight) |
| `book-turn` | slot | `{ phase: 'start' \| 'land', from, to }` | A | Stage 6 sound (unused now) |
| `route-will-change` / `route-changed` | document | router | router | B (calls `close`, remounts) |

**Slot dataset (A writes):**

- Lifecycle: `renderer` (webgl2 or poster), `rendererReason`, `sceneReady`, `awake`, `motionState` (running or still), `quality`, `tier`, `post` (on or off).
- Diagnostics: `sceneFrame`, `drawCalls`, `triangles`.
- State and input: `week`, `turn` (2 decimals), `dragging`, `cursor` (open, turn, drag or empty).

**Slot dataset (B writes):** `gesture` (set during a swipe and for one task after release; A ignores clicks while it is set).

**On `<html>` (B writes):** `data-book="mth140"` while mounted, and `data-book-pin="on"` while pinned.

### 3.6 Stubs (so neither side waits)

| Stub | Who writes it | Behaviour |
|---|---|---|
| `tests/fixtures/book-controller-stub.mjs` | B | `mountBook` resolves `ready` to `'webgl2'` or `'poster'` (per option). It records `setHandoff`, `setFocus` and `close` calls, registers an animator that resolves after `duration` (fake timers), and returns fixed `metrics()`. |
| `tests/fixtures/book-state-stub.mjs` | A | Only needed until M0-B merges. Same API as §3.1, `policy` injectable. |

---

## 4. Motion policy, the paused gate and reduced motion

### 4.1 Modes (one table, both sides)

Side B computes `policy()` in `course-header.mjs`:

- `full` if `sceneMotionAllowed() && !held()`.
- Otherwise `fade` if the only reason is OS reduced motion (`preference().reduced && !preference().forced && !preference().scenePaused && !preference().paused && !held()`).
- Otherwise `cut`. This covers `?motion=off` (`forced`), Pause motion (`scenePaused`), a dialog pause and holds.

Side A's stage computes gates from the IntersectionObserver (rootMargin 100 px), `document.hidden`, `core.held()`, `sceneMotionAllowed()` and `ambientAllowed()`.

| Behaviour | full | fade (OS reduced) | cut (paused, off, held) |
|---|---|---|---|
| Week change | Turn or riffle (§5.8) | 150 ms `uFade` texture crossfade, no sheet | Instant swap; one frame |
| Pin, scrub, close-into-dock | Fine pointer, tier ≥ mid | None | None (kill with compensation if active) |
| Corner drag, swipe | Yes | Discrete: release past threshold = `step(±1)` | Discrete, instant |
| Pop-ups | Raise and flatten animate | Uncompleted raised, completed flat; changes cut | Same, cut |
| Arrival | §5.8 | 150 ms canvas crossfade from the poster | Settled frame |
| Drift, parallax, hover lean | High tier only (§5.7) | None | None |
| Theme change | 360 ms uniform tween | Instant | Instant |
| Urgency | Static glow or bloom | Static | Static |
| Hidden or offscreen | No rAF at all; a gate change requests one frame on wake | — | — |

### 4.2 The paused frame (first gate, M1; both themes, 1440 and 390)

- The book is open at today's spread (index 5 on 12 Oct).
- Uncompleted pop-ups are fully raised. Completed ones are flat, desaturated and stamped.
- The ribbon lies in today's gutter. The camera is at rest pose.
- The lamp (dark) or window light (light) is on.
- The caption and controls are visible. No pulse, no custom cursor.
- Urgency shows only as a static frame or glow.
- The poster is this frame with ink 0 and no pop-ups (§5.11).

---

## 5. Engine (Side A)

### 5.1 Frame and object

- **Book frame = Codex page frame.**
  - x across: the spine is at 0, the recto is +x, the verso is −x.
  - y runs along the spine from the tail (0) to the head (H).
  - z is up from the inner board surface.
- The book group has `rotation.x = −π/2` and is translated so the spread centre (0, H/2) sits at the world origin. World Y is up, and the camera is at +Z (the tail faces the viewer).

| Part | Spec |
|---|---|
| Leaf | W 0.142 × H 0.206; fore-edge corners r 0.005 (spine side square) |
| Boards | 0.148 × 0.212 × 0.0024. x ∈ [−0.003, W+0.003], 3 mm overhang at head and tail. `ExtrudeGeometry` of a rounded-rect `Shape` (r 0.006, bevel 0.0006, 2 bevel segments, 8 curve segments). **Not** `RoundedBoxGeometry`: its radius is capped at half the thickness. |
| Block | 0.011 total. `zL = max(0.0012, 0.011·i/(count−1))`, `zR = max(0.0012, 0.011 − zL)`. Set on `settle`, not animated. Rounded-rect extrusion; the side faces use the procedural edge shader. |
| Gutter valley | Static pages only: `z −= 0.003·(1−smoothstep(0, 0.018, x))`. On the turning sheet the same dip is multiplied by `1−smoothstep(0, 0.15, t)`. Picking ignores the dip (error ≤ 3 mm, inside the non-interactive 18 mm gutter band). |
| Spine | Rounded, 16 mm closed. Blind deboss "MTH140" plus logo (normal map). Visible only during close and dock. |
| Elastic | 6 × 1.2 mm, around the back board at x = 0.80·W. Open: short wraps over the recto head and tail edges. `TubeGeometry` (48 × 6) rebuilt only during handoff. |
| Ribbon | 7 × 0.3 mm, anchored at the spine head. On today's spread: in the gutter at 6°, with the tail hanging 25 mm past the tail edge onto the blotter. Elsewhere: it sits in the block containing today, its tail sticking out by a length proportional to the distance from today. |
| Blotter | 0.50 × 0.34 felt pad; shared with the Stage 5 Desk |
| Contact shadow | Baked radial quad at 1.25× the footprint, always on |
| Front cover | Deboss logo, 18 mm, at the lower outer corner, plus "MTH140 · CALCULUS I · FALL 2026" (Archivo condensed 600, 4 mm caps) as a normal and roughness map |

### 5.2 Turning sheets (`page-bend.mjs`)

**Exports**

- Re-exports `bendPoint`, `bendBounds`, `bendHit` and `MIN_RADIUS_RATIO`.
- `BEND_KEY = 'page-bend-1'`.
- `applyBend(material, uniforms)`: idempotent `onBeforeCompile` plus `customProgramCacheKey`.
- `createSheet()` returns `Sheet { group, front, back, set({turn, radius, stackZ}), anchor(x, y), hingeDir(a, y), hit(rayLocal), setFaces(front, back), setSegments(n), dispose() }`.

**Shader injection**

```glsl
// after <common>: uniform float uTurn, uRadius, uWidth; uniform vec2 uStackZ;  + PAGE_BEND_GLSL
// replace <beginnormal_vertex>:  vec3 objectNormal = bendNormal(position, uTurn, uRadius, uWidth);
// replace <begin_vertex>:        vec3 transformed  = bendPosition(position, uTurn, uRadius, uWidth);
//                                transformed.z += mix(uStackZ.x, uStackZ.y, uTurn) + 0.0002;  // + gutter dip × fade
```

**Geometry and materials**

- Geometry: `PlaneGeometry(W, H, segX, segY).translate(W/2, H/2, 0)`.
- Each sheet has a front mesh (FrontSide) and a back mesh (BackSide).
- Each sheet gets **its own material instances**, sharing `BEND_KEY`. Uniforms are not re-uploaded per object when a material is shared.
- The back face mirrors u (`repeat.x = −1, offset.x = 1`).
- `frustumCulled = false`.

**Radius**

`R(t, v) = clamp(mix(0.14W, W/π, sin(πt)^0.8) · (1 − min(0.3, 0.12|v|)), W·MIN_RADIUS_RATIO, W/π)`, where v is the gesture speed in turns/s. At t = 0.5 the sheet stands as a 90 mm semicircle over the gutter, a hood that clears the standing pop-ups (tested, §10.1).

**Rest and swap rules**

- At rest (settled, integer `turn`), sheets are hidden and the static pages show the faces. Static pages use `polygonOffset(1, 1)`.
- Forward k→k+1: static right switches to R(k+1) when the turn starts. Static left switches to L(k+1) when the sheet lands, then the sheet hides.
- Backward is the mirror: static left switches to L(k−1) at the start, static right to R(k−1) at landing.

**Face ids:** spread i shows `L(i)` = back of sheet i−1 (`L(0)` = endpaper) and `R(i)` = front of sheet i. The pending spread uses its own pair.

**Sheets in the air:** high 3, mid 2. Intermediate riffle sheets use one shared `riffle` face (paper plus generic pencil) and carry no pop-ups.

**Curl shadow** (static-page patch): a band under the fold. Centre = `bendBounds().max[0]` on the recto while the fold start a > 0, otherwise `min[0]` on the verso. Width = 1.2R. Opacity 0.35 (dark) / 0.20 (light) × sin(πt).

### 5.3 Pop-ups (`popup.mjs`; MTH140 "arcs")

**Layout**

- `layoutSpread(view.popups → records, style)` gives at most 3 pieces, highest rank furthest back (toward the head).
- Slot centre y from the tail:

  | Pop-ups | Slots |
  |---|---|
  | 1 | 0.50H |
  | 2 | 0.60H, 0.32H |
  | 3 | 0.64H, 0.42H, 0.22H |

- Any extra pop-ups print on the recto as "+N more on these pages".

| Kind (MTH140) | Strip | Foot offset a | Height at θ = π | Depth along y | Bow k | Wash (inner face) | Tag W × H |
|---|---|---|---|---|---|---|---|
| final | Two concentric arches; the inner one is 12 mm toward the tail | 0.34W / 0.23W | **0.30H** / 0.21H | 22 / 18 mm | 0.22 | 80% / 55% | 0.40W × 0.13H |
| midterm | Symmetric arch | 0.28W | **0.25H** | 20 mm | 0.22 | 65% | 0.38W × 0.12H |
| quiz / lab | "Wave": crest offset +0.15a toward the recto | a_R = 0.24W (a_L solved) | **0.15H** | 16 mm | +0.18 verso / −0.08 recto | 45% | 0.34W × 0.10H |
| minor | Low arch | 0.13W | **0.08H** | 12 mm | 0.30 | — | 0.30W × 0.09H |

Height × `heightScale` = `weight == null ? 1 : clamp(0.9 + 0.4·(rank − 2·floor(rank/2)), 0.9, 1.1)`, with `rank` from `popupRank`. All feet are within a ≤ 0.35W, inside the rigid zone while the fold start a > a_foot.

**Mechanism** (cross-section in x–z at the strip's y; extruded by its depth)

1. **Feet.**
   - A foot on a static page is `(∓a, y, zL|zR)`.
   - A foot on a turning sheet is `bendPoint(a, y, params) + stackZ(t)`.
   - Outgoing spread k: left foot on L(k), right foot on sheet k (front).
   - Incoming spread k+1: left foot on sheet k (back), right foot on R(k+1).
2. **Hinge angle.**
   - G = spine point.
   - l = normalize(L − G), r = normalize(R − G), and θ = acos(l·r).
   - b = normalize(l + r), falling back to +z when |l + r| < 1e−4.
   - `r(θ) = smoothstep(40°, 170°, θ)`.
3. **Apex M.**
   - M is the intersection of circles (L, c_L) and (R, c_R) in the x–z plane, choosing the solution with the larger (M − G)·b.
   - If d ≥ c_L + c_R, clamp to the point on segment LR at the ratio c_L : (c_L + c_R).
   - Chord lengths come from the design at θ = π: `c = √(a² + h²)`.
   - **Wave:** solve a_L by bisection on [0.5a, 1.5a] so that `a_L + c_L = a_R + c_R` (the flat-fold condition) with M at x = +0.15a.
4. **Bow.** Each half is `P(u) = F + u(M − F) + n̂ · bow · 4u(1 − u)`, where n̂ is the outward normal of the chord in x–z and `bow = k · c · smoothstep(0.6, 1, r) · (1 − flat)`.
5. **Completion.** `flat` is tweened. `h_eff = h(1 − flat)`, and the chords are recomputed at fixed feet. Exactness is required only at flat = 0.
6. **Tag plate.**
   - Hinge line across the gutter at `y_t = y_front − 0.008 − H_t·sin 24°`, where y_front is the arch's tail-side face.
   - Two halves span(l, c) and span(r, c), with `c = normalize(cos φ·b + sin φ·ŷ)` and `φ = 24°·r·(1 − s) + 90°·s`, `s = smoothstep(0.3, 1, flat)`.
   - Completed tags therefore fold back onto their own flattened arch, back face up.
   - The front face carries the label slot. The back face carries the same slot (u mirrored) plus the DONE stamp decal.
   - Not paper-rigid while ω < π: a visual approximation, exact at θ = π and θ = 0.
7. **Update and mesh.**
   - `update()` re-solves only when θ changes by more than 0.002 rad, or `flat` or the spec changes. It writes into preallocated `Float32Array`s (`DynamicDrawUsage`) and recomputes the bounding sphere.
   - Strip segments: high 24, mid 12. One DoubleSide mesh per strip; `gl_FrontFacing` selects the wash on the inner face.
   - Every arch edge has a 1.5 px pencil line.
8. **Contact shadows** live in the **page shader**: `uFoot[3]` rects (flat coords) with `uFootK[3] = (0.18 dark / 0.10 light) · r · (1 − flat)`. They bend with the sheet for free.

**States** (per pop-up material uniforms; label changes repaint only that atlas slot)

| State | Treatment |
|---|---|
| NEXT | 3 px accent frame, `NEXT` chip, wash +10% |
| SOON (urgency soon) | Frame and chip in urgent ink `#a8391d`. Dark: frame emissive `#ff7a59` ×1.15 (bloom at high) or an 18% halo quad (mid). |
| HOT or LIVE | Same, ×1.6 or a 30% halo. **Static, never pulsed.** |
| PASSED, not done | Stays raised; tag desaturated 40%; line 2 = `compact()` |
| DONE | `flat → 1`; saturation 0.15, lift +0.06; stamp (256² shared texture, accent at 0.85 multiply, rotated −10° to −4° deterministically per id) |
| Hover or caption focus | Tag lean −4°, scale 1.03, frame in ink at 0.5, `data-cursor=open` |

**Light theme:** no emissive above 0.9, so nothing blooms; urgency is carried by the frame colour.

**Interactive:**

- `interactive = shown spread && state settled && handoff === 0 && (completed || r ≥ 0.2) && facing camera`.
- Otherwise `raycast = () => {}`.
- The quiz tangent motif is **printed on the quiz tag** (accent channel), not modelled.

### 5.4 Textures and layout (`textures.mjs`)

**Masks**

- Each canvas (`getContext('2d', {alpha: false})`) is painted on black with `globalCompositeOperation = 'lighter'`.
  - **R** = pencil, **G** = printed ink, **B** = accent ink.
- `CanvasTexture`: `colorSpace = NoColorSpace`, mipmaps on, `anisotropy = min(tierCap, max)`.
- The page shader composites, in order:
  1. `c = paper·tooth·gutterAO + procedural rules`
  2. `c = mix(c, uPencil, R)`
  3. `c = mix(c, uInk, G)`
  4. `c = mix(c, uAccent, B)`
- Pencil roughness = `mix(0.90, 0.42, R)`, metalness = `0.12·R`. Tags swap `uAccent` to urgent ink per urgency.

**Sizes and caches**

| Item | Value |
|---|---|
| Page width | `clamp(pageScreenDevicePx × 1.25, 512, 1024)`, quantised to {512, 768, 1024}; aspect 1 : 1.451 (1024×1486, 768×1114, 512×743) |
| Live GPU faces | 2 at rest, 4 during a turn (+1 riffle); LRU cap high 6, mid 4 |
| Canvas pool | 4, reused; free on dispose (`width = height = 0`) |
| Label atlas | 1280×960 (2×4 slots of 640×240) high; 768×576 mid |
| Normal maps | Paper tooth 256² ×6 tiles per page (normalScale 0.25 / 0.15 mid). Linen 512² (32 threads, 0.45 mm pitch) high, 256² mid. `DataTexture`s, seeded. |
| Prefetch | After settle, in idle time: R(i+1) and L(i+1), then i−1 (high only). Scroll pin start prefetches i+1 and i+2. |
| Scheduling | ≤ 1 face paint per busy frame; the rest in `requestIdleCallback` (300 ms timeout); `renderer.initTexture()` in idle. Never in scroll handlers. Main thread only (CSP `worker-src 'none'`). |

**Repaint signature:** `faceId | style.id | bucket | fontsGen | view.signature`. **Theme is not part of it.** Fonts: `await document.fonts.load('condensed 600 96px Archivo')` and `'500 40px Archivo'` before the first paint; `loadingdone` bumps `fontsGen`.

**Condensed type:** set the font shorthand with `condensed`, and use it only if `measureText` gives a width under 0.92× normal. Otherwise use normal width at 0.86× size. Use `ctx.letterSpacing` when present, else manual advance. Numerals sit right-aligned in fixed columns.

**Grid** (canvas px at 1024 wide; scale proportionally)

- Margins: outer 88, head 96, tail 112, gutter side 136.
- Canvas y = 0 is the head (`flipY` true).
- **Keep-out:**
  - Verso text right limit = `w·(1 − a_max/W − 0.02)`.
  - Recto text left limit = `w·(a_max/W + 0.02)`.
  - `a_max` = the largest foot offset on the spread (0.24W if there are none). Pencil may pass under the feet.

| Verso ("the week") | Font / size | Channel | Position |
|---|---|---|---|
| Kicker `WEEK` / `EXAMS` | Archivo 600 / 26, caps, 0.22em | B | y 96 |
| Numeral `06` | Condensed 600 / 300, lh 0.82, −0.04em | G | y 130–376 |
| `/ 16` | Condensed 500 / 72 | G 0.45 | baseline after the numeral |
| Range | Archivo 600 / 44 | G | y 430 |
| Note (`Teaching week` or the partial label) | Archivo 500 / 30 | G 0.7 | y 482 |
| Ledger: 7 rows Mon–Sun, row height 106 | Day 600/24 caps 0.16em (G 0.6); date condensed 600/64 right-aligned in x 88–184 (G); entry title 600/32 + `rowWhen` 500/28 (G; NEXT bullet in B) from x 212; pencil row rule 1.5 px (R 0.4) | | y 560–1302 |
| Folio `WK 06` | 600 / 22, caps 0.16em | G 0.45 | outer tail corner |

| Recto ("the sketch and the work") | Font / size | Channel | Position |
|---|---|---|---|
| Running head `MTH140 · CALCULUS I · FALL 2026` | 600 / 22, caps 0.2em, right-aligned | G 0.55 | y 96 |
| Pencil motif | main strokes 0.85 coverage at 2.5–3 px; construction lines 0.35 at 1.5 px; hatching 0.25 | R | x 136–936, y 150–780 |
| `ON THESE PAGES` | 600 / 24, caps 0.2em | B | y 860 |
| Entry: kind / title / `when · label` / state | 600/22 caps (B) · condensed 600/40 (G) · 500/30 (G 0.75) · `NEXT` (B), `DONE` with pencil strike and accent check, `Due time passed` (G 0.75) | | from y 900, row 132 |
| Folio `Oct 12 – 18` | 600 / 22 caps | G 0.45 | outer tail corner |

**Text sizes:** informational text ≥ 28 px; decorative folios 22 px. **Compact variant** (on-screen page < 260 css px): verso shows kicker 48, numeral 520 and the range on two lines at 72, with no ledger; recto shows the motif plus kind words at 88 px.

**Label slot** (640×240)

| Line | Font | Channel |
|---|---|---|
| Line 1: title | Condensed 600 / 60 | G |
| Line 2: `when` (or `compact()` when passed) | 500 / 40 | G 0.75 |
| Chip, top right | 600 / 22 caps 0.18em | B |

**Honesty states**

| Case | Treatment |
|---|---|
| Partial first or last week | Note = `spread.label`. Rows outside the term are cross-hatched (R 0.25) with "before term" / "after term" (G 0.5). |
| Quiz week, no section | No ledger row. A pencil bracket over Mon–Fri (B) with title and `when`. Recto entry shows `label` and the `cta` text. |
| Date without time | Day row; `rowWhen` comes from the resolver as is |
| Pending | Pending spread: `EXAMS`, range "Date pending", note = `spread.label`. Never a day row or a clock. |
| Empty week | "No assessments this week." (G 0.6) and a larger sketch |
| Today | Pencil-wobbled accent ellipse (2.5 px, two passes) around the date, plus a `TODAY` tag (600/20 caps, B) |

**Pencil:**

- Seeded by spread index, so repaints and posters are deterministic.
- Jitter 0.6 px per 40 px, double pass offset 0.4 px, 12 px pressure taper.
- **Motif by topic:** `COURSES.mth140.topics[min(7, floor(i/2))]`

  | Topic | Motif |
  |---|---|
  | Functions & graphs | Graph with asymptote |
  | Limits & continuity | Secant fan converging to a tangent |
  | Derivatives I | Curve, tangent and right triangle |
  | Integration I | Hatched Riemann rectangles |
  | Derivatives II | Composed curves with an arrow |
  | Integration II | Shaded area between curves |
  | Applications of derivatives | Max/min with horizontal tangent dashes |
  | Applications of integrals | Solid of revolution |

- The pending spread and posters use the hero's tangent-on-crest motif.
- Motifs are never labelled.

### 5.5 Materials (albedo sRGB; dark | light)

| Surface | Dark | Light | Shared |
|---|---|---|---|
| Paper | `#efe6d2` | `#fbfaf6` | Standard, roughness 0.90; ±2% low-frequency tooth |
| Ink (G) / accent (B) / urgent | `#1f2624` / `#096450` / `#a8391d` | same | 12.4:1 / 5.7:1 / 5.2:1 on cream |
| Pencil (R) | `#5a5f61` | same | Graphite roughness/metal from R |
| Gutter AO | ×0.78 → 1 over 0.12W | ×0.86 → 1 | Analytic |
| Block edge base / line / signature gap (every 16) | `#e3d8c0` / `#cfc2a5` / `#b9ab8d` | `#f1efe8` / `#dedbd2` / `#cbc7bc` | Fades to the mean below 2 px (`fwidth`) |
| Cover linen | `#a6d6c2` | `#b2dbc4` | Physical: roughness 0.82, sheen 0.45, sheenColor `#dff2e7`, sheenRoughness 0.55; normalScale 0.35; roughness map ±0.06 (mid: Standard, no sheen) |
| Endpaper and board inside | `#dfeee5` | `#e6f2ea` | Paper material |
| Elastic | `#1f5a48` | same | Roughness 0.55, sheen 0.7 `#78b89b` 0.35; ribs at 0.5 mm, normalScale 0.3 |
| Ribbon | `#24624f` | same | Roughness 0.35, sheen 1.0 `#9ed1b8` 0.25 |
| Pop-up stock | Paper colour | Paper colour | Inner-face wash `uWash #b9dfc9` at the per-kind strength |
| Blotter | `#1a2327`, sheen 0.3 `#3a4a50` | `#bdb6a8`, sheen 0.25 `#e6e0d4` | Roughness 1.0 |
| Contact shadow | `#000` at 0.55 | `#4a3b22` at 0.28 | Every tier |
| Desk | CSS `--ns-desk` tokens (B, §6.2); canvas `alpha: true`; shadows land on a `ShadowMaterial` plane | | |

### 5.6 Light, tone and post

| | Dark (night lamp) | Light (daylight) |
|---|---|---|
| Key | `SpotLight` `#ffd1a3` at (−0.42, 0.62, 0.18) aimed at (0.02, 0, −0.01); angle 34°, penumbra 0.70, decay 2; E ≈ 2.6 at the book centre (`intensity = E·d²`) | `DirectionalLight` `#fff4e8` from (−0.9, 1.3, 0.35); E ≈ 2.2 |
| Fill | Hemisphere `#a9bcc6` / `#1a1410`, 0.35 | `#eef3f7` / `#d9cfbd`, 1.1 |
| Rim | Directional `#9fc2d2` from (0.6, 0.35, −0.7), 0.6 | `#ffffff` from (0.5, 0.4, −0.8), 0.25 |
| Environment | `RoomEnvironment` PMREM σ 0.04 (256 high / 128 mid), cached in the stage; `environmentIntensity` 0.12 | 0.45 |
| Tone | `NeutralToneMapping`, exposure 0.95 | 1.00 |
| Shadow map (high only) | PCFSoft 1024, frustum fitted to the book; bias −0.0005, normalBias 0.015 | 512 on the same frustum |

**Shadow casters and receivers:** pop-ups cast. Pages, sheets and the blotter `ShadowMaterial` receive (the bent `transformed` feeds the shadow coordinates).

**Post-processing**

- **High tier:** scene → MSAA HalfFloat target (samples 4 at DPR < 2, else 2).
- **Bloom:** `UnrealBloomPass` at half resolution, threshold 1.0, strength 0.35, radius 0.4. It runs **only while an emitter is visible and the theme is dark**; it composites into the target.
- **Finish:** `ShaderPass` to screen. Neutral tone map with exposure, sRGB OETF, CA radial (0 inside the projected book rect, rising to 0.6 px at the corners), and blue-noise dither. `toneMapped: false`.
- No stock `EffectComposer`: it clones the MSAA target.
- **Mid tier:** direct render with `antialias: true`; halo quads instead of bloom.

**Emitters:** urgent tag frame strips, and the spine accent `#b9dfc9` ×1.3 during handoff shrink (dark, high tier).

**Grain and vignette:** CSS, owned by B.

**Theme switch:** tween lights, paper and ink uniforms, shadow opacity, exposure and env intensity over 360 ms `power2.inOut`. No repaint.

### 5.7 Camera

All placement uses lens shift (`camera.setViewOffset`) and a fit function.

- The fit projects the static spread, `bendBounds` of any live sheet, the tallest raised pop-up and the ribbon tail into the safe rectangle (padding 3%).
- Refit on resize and on a week change, easing over 400 ms (cut when mode ≠ full).

| Breakpoint | vFOV | Elevation | Azimuth | Book centre (stage-normalised) | Safe rect |
|---|---|---|---|---|---|
| ≥ 1001 | 24° | 46° | +6° | (0.64, 0.46) | [0.345, 0.07]–[0.935, 0.93]; spread ≈ 820 px at 1440 |
| 761–1000 | 26° | 52° | +4° | (0.50, 0.60) | [0.05, 0.30]–[0.95, 0.95] |
| ≤ 760 | 30° | 60° | 0° | (0.50, 0.53) | [0.02, 0.05]–[0.98, 0.96]; spread ≥ 360 css px at 390 |

**Drift** (high tier, fine pointer)

- Yaw ±0.5° (17 s), pitch ±0.3° (23 s), dolly ±0.4% (29 s).
- Pointer parallax over the stage: yaw ±1.5°, pitch ±1.0°, τ 0.45 s.
- Runs only while `ambientAllowed()`, the stage is ≥ 50% visible, the mode is full, and 2 s have passed since the last turn, drag or scrub. It fades in and out over 250 ms and renders at 30 fps.
- Mid tier and phones: none.

### 5.8 Choreography (engine-run; GSAP eases via `gsap.parseEase` on the stage clock)

| Moment | Spec |
|---|---|
| Arrival (full) | At scene-ready time T: the canvas crossfades over the poster in 300 ms (linear). Ink develops 0 → 1 over 500 ms `power1.out`. Camera dollies 1.04 → 1.0 over 1200 ms `expo.out`. Pop-ups rise 0 → 1 over 820 ms `back.out(1.15)`, largest first, staggered 140 ms, from T + 250. If T − `arrival.start` > 1200 ms, cut to the settled frame. |
| Turn, \|Δ\| = 1 | 720 ms `power2.inOut` on t; `book-turn` events at start and land |
| \|Δ\| 2–4 | Sequential turns of 460 ms each, staggered 110 ms (mid tier: at most 2 sheets in the air) |
| \|Δ\| > 4 | Riffle of 4 sheets (mid: 2), 380 ms each, staggered 70 ms, ≤ 900 ms total; intermediate sheets use the `riffle` face. The target faces are uploaded before the last sheet lands. |
| Drag or swipe landing | The parameters come from the state (§3.1) |
| Fade (reduced) | 150 ms `uFade` between the old and new face textures on the static pages. Pop-ups cut. |
| Mark done / Undo | Done: flatten 480 ms `power2.in` → desaturate 260 ms → stamp 180 ms (scale 1.15 → 1, opacity 0 → 0.85, `power3.out`). Undo: stamp out 140 ms → resaturate 220 ms → re-raise 620 ms `back.out(1.1)` to the current `r(θ)`. Saving never waits on this. |
| Handoff `setHandoff(p)` | p 0–0.55: the left half (front board, left block, left page) rotates 180° over the spine with 2° board flex, and pop-ups fold by θ. At p = 0.55: the band snaps, a one-shot 550 ms `elastic.out(1, 0.5)`; it reverses when p falls back below 0.55. p 0.55–1: the closed book scales to 0.16 along an authored curve to the projected `dockTarget()`; spine glow; canvas opacity → 0 over p 0.82–1. At p = 1 the scene sleeps. |
| `close({ms})` | Pop-ups fold flat and the cover closes over `min(ms, 350)` ms. Resolves at once unless the mode is full. |
| Stage 5 hooks | Named poses `closed-on-desk`, `open-hero` and `docked`. Build `open-hero` and `docked` now; define `closed-on-desk` but leave it unused. |

### 5.9 Lifecycle (stage and book-scene)

| Concern | Rule |
|---|---|
| Probe | Called by B before importing book-scene: `getContext('webgl2', {failIfMajorPerformanceCaveat: true, antialias: true, alpha: true, powerPreference: 'high-performance'})`. On null → poster and fallback (reason in `data-renderer-reason`); `?tier=` overrides. The probed context is reused. |
| Renderer | One for the whole document (the stage). `outputColorSpace` sRGB, Neutral tone mapping, shadows at high tier. `checkShaderErrors` plus `onShaderError` → fallback. `compileAsync` on the scene and post materials before the first visible frame, while the poster is still up. |
| Ready | `sceneReady` is set only after the first **rendered** frame |
| Scheduler | rAF only while attached, visible and not hidden, **and** (busy, a frame was requested, or drifting). No idle loop. In cut mode, animations jump to their end and one frame renders. |
| Slow frames | Measured on busy frames only: if > 45% of frames exceed 25 ms over 2 s, DPR ×0.8 once; if still slow, `core.downgrade('book frames')`. `onTier` changes segments, textures and post; low → dispose and poster. Week, focus and completion survive (they live in state and data). |
| Context loss | `preventDefault`, stop, poster, `onFallback('lost')`. On restore, if still mounted and tier ≥ mid, do **one** remount. A second loss stays on the poster. |
| Router | On unmount, B calls `controller.dispose()`: textures, geometries, materials and private targets are disposed, and the canvas is parked in a hidden shell holder (the context survives). The renderer, environment and post survive in the stage. |
| bfcache | `pagehide`: if persisted, sleep; otherwise dispose the stage with `forceContextLoss()` |
| Old scenes | `course-scene.mjs` dispose adds `renderer.forceContextLoss()`; book courses never import it |

### 5.10 Picking and pointer input (A: mouse only)

**`pick(x, y)` algorithm**

1. Build NDC from the slot rect and call `raycaster.setFromCamera`.
2. Pop-ups: `intersectObjects` over interactive meshes.
3. Live sheets: transform the ray into sheet-local space and call `Sheet.hit()`, which is `bendHit` with segments = the mesh x segments; the face comes from `sign(dot(dir, bendPoint().normal))`.
4. Static pages: analytic ray–plane intersection at z = zL or zR.
5. The nearest hit wins.
6. `textures.hit(faceId, u, v)` maps the hit to one of `item | corner (outer 12% corners) | page`, using regions recorded while painting.

**Corner drag** (pointerType mouse, mode full)

- Starts on a `pick` result of `corner`, or `page` with x > 0.6W on the top face. A calls `state.grab('drag')` and sets `data-dragging`.
- `turn = startTurn + (x0 − x) / spreadScreenWidth`.
- `release` passes the velocity in turns/s.
- A press that moves < 6 px and lasts < 300 ms is a click. A gesture that ends a turn never activates an item.

**Clicks:** `click` events of any pointer type. Ignored while `data-gesture` is set or the state is not settled.

**Hover:** fine pointer only, one `pick` per rendered frame. Sets `data-cursor` and dispatches `book-hover`.

### 5.11 Posters

- `tools/scene-build/book-posters.mjs` (Playwright, Chromium at `/opt/pw-browsers`) loads `tests/book-capture.html?course=mth140&theme=dark|light&view=wide|tall&poster=1`.
- Poster mode: `preserveDrawingBuffer`, open-hero pose, ink 0, **no pop-ups**, the hero motif, block split 0.5, ribbon in the gutter. Saved as a transparent WebP (q 0.86) over the CSS desk.
- `bookPosterPaths(course, theme)` is exported from `course-styles.mjs`.
- SwiftShader output is acceptable for the file; review on real hardware is still pending.

---

## 6. DOM integration (Side B)

### 6.1 Mount sequence (`course-header.mjs`, when `BOOK_COURSES` includes the route)

1. Build the stage DOM: the art slot (`aria-hidden="true"`, no tabindex, no role), the themed poster `<img>` (`bookPosterPaths`), and the rail (§6.3), all rendered from data with **no WebGL**.
2. Data:
   - `records = recordsForCourse(course, readSaved(course, data))`
   - `weeks = semesterWeeks({ records })`
   - `createBookState({ course, weeks, today: currentWeekIndex(weeks), policy })`
   - `attachBookState(state)`
3. Mount the rail and fallback on `state`.
4. When idle (timeout 900 ms): `probe()`. On failure, go to fallback.
5. Otherwise `import('./book/book-scene.mjs')`, then `mountBook(slot, {...})`. Never import `course-scene.mjs` for book courses.
6. On `route-will-change`, if the stage is ≥ 50% visible and the policy is full: `detail.waitUntil(Promise.race([controller.close({ ms: 350 }), wait(400)]))`.
7. On unmount: `controller.dispose()`, `detachBookState`, restore the DOM.

### 6.2 Hero layout and tokens

**Header grid rows:** stage `clamp(520px, 66vh, 640px)` / rail 96 px / action bar 72 px (desktop). The title column is ≤ 31% of the width and the h1 keeps its current clamp. Phone: copy about 140 px, stage about 300 px, rail auto, action bar.

**Tokens.** Promote the Desk tokens to `:root` in `layout.css` (light, `[data-theme=dark]`, and the Auto `prefers-color-scheme` block):

| Theme | Desk tokens | Stage tokens |
|---|---|---|
| Light | `--ns-desk: #e6dfd1`, `--ns-desk-2: #d5cbb8`, `--ns-desk-light: rgb(255 252 243 / .9)`, `--ns-desk-vignette: rgb(70 52 24 / .14)` | `--ns-stage-ink: #151c1f`, `--ns-stage-muted: #434c49`, `--ns-stage-soon: #8a4f12`, `--ns-stage-hot: #9a3a20` |
| Dark | `--ns-desk: #162024`, `--ns-desk-2: #0b1113`, `--ns-desk-light: rgb(255 196 138 / .16)`, `--ns-desk-vignette: rgb(0 0 0 / .55)` | `--ns-stage-ink: #eef0ea`, `--ns-stage-muted: #a1b0ae`, `--ns-stage-soon: #ffc9a3`, `--ns-stage-hot: #ff9a7c` |

`--ns-stage-strong` (set on `body.workspace`) colours the stage eyebrow and the HUD Next label and chip: light `color-mix(in srgb, var(--strong) 75%, var(--ns-stage-ink))`, dark `var(--strong)`, so both keep 4.5:1 on the desk.

**Replace** the graphite-only values under `html[data-book]`:

- `layout.css`: `.ns-hud` `#c9d2cf`, `[data-ns-title]` `#f4f2e9`, and the `--ns-stage` gradient
- `hero.css`: urgency `#ffc9a3` / `#ff9a7c` / `#a9b5b2`, and the scene-meta colour
- `course-header.css`: the `.header-art:after` overlay and `poster-float` (the fallback poster is static)

**Stage background, grain and touch**

- The stage background is the desk gradient plus the lamp pool (dark) or window light (light).
- Static CSS grain: a 256² blue-noise PNG at 2.5% (dark) / 1.5% (light). Vignette: 35% (dark) / 10% (light). **Never animated.**
- `.header-art` uses `touch-action: pan-y` always (replacing the `none` override). Cursors follow `data-cursor`: `open` → pointer, `turn` → grab, `drag` → grabbing.
- Hide the `visuals.js` `.semester-rail` under `html[data-book]` (keep its `CourseVisuals.rows` feed).
- Scene-meta hint: "Drag a corner to turn" (fine pointer) or "Swipe to turn" (coarse). It hides after the first successful gesture turn (`sessionStorage` `tmu-book-hint-v1`).

### 6.3 Rail: caption plus week controls (`timeline.mjs`)

The rail sits on `--hub-bg`, separated from the stage by 1 px `--hub-line`.

```html
<section class="ns-spread" aria-labelledby="ns-spread-h">
  <h2 id="ns-spread-h" class="ns-sr">Semester book</h2>
  <p class="ns-sr" aria-live="polite" data-ns-spread-live></p>
  <div class="ns-spread-caption">
    <p class="ns-spread-kicker">Week 6 of 16 · <b>This week</b></p>
    <p class="ns-spread-dates"><time datetime="2026-10-12">Mon Oct 12</time> – <time datetime="2026-10-18">Sun Oct 18</time></p>
    <ul class="ns-spread-items"><li><button type="button" data-open="assessment-quiz-2">…kind · title · when…</button>
      <button type="button" class="ns-cta" data-ns-section>Choose your section…</button></li></ul>
  </div>
  <nav class="ns-weeks" aria-label="Semester weeks">
    <button class="ns-week-step" aria-label="Previous week">‹</button>
    <div role="radiogroup" aria-label="Week"><!-- one role=radio per spread, roving tabindex, aria-label = view.aria --></div>
    <button class="ns-week-step" aria-label="Next week">›</button>
    <button class="ns-week-today">Today</button>
    <button class="ns-week-next">Next: <span>Midterm Test · Wk 7</span> →</button>
  </nav>
</section>
```

**What renders when**

- The caption and ticks render `snapshot().index` on `select`.
- The live region gets `view.live` 400 ms after `settle` (debounced) and is never updated per frame.
- Entry activation calls `core.openItem(open)`. Focus or hover on an entry calls `controller.setFocus(id)`, and `book-hover` highlights the matching entry.
- More than 3 entries: a "+N more" disclosure.

**Kicker:** `--ns-mono` 11 px, 0.18em, caps, `--strong`. Dates: Archivo 600 1.25rem, tabular numerals. Entries: ≥ 1rem, 44 px rows.

**Ticks**

- 40 px pitch × 44 px tall. Silhouette mirrors the pop-up height (final tall, midterm medium, quiz short, empty is a hairline; the pending tick is `⊓`).
- Elapsed ticks are filled `--strong`. Today has an `--accent` ring plus a `TODAY` label. Selected has a 2 px underline and `aria-checked`. Completed weeks show a check.

**Keys (radiogroup, APG)**

- ←/→ step (the selection moves with focus).
- Home/End go to the first/last spread.
- PageUp/PageDown move ±4.
- Holding a key collapses to the latest target.

**Buttons**

- **Today:** `openWeek(state.today, { source: 'today' })`. When already there: `aria-disabled="true"` and the title "You're on this week".
- **Next:** from `deadline.currentTarget()`, the week is `weekIndexFor(date || week)` (pending → the pending spread).
  - If that is not the current index: open that week.
  - Otherwise the label becomes "Open <title>" and the button calls `openItem`.
- Pills are 44 px minimum, matching `.ns-dock-actions button`.

**Phone:**

- Layout: caption, then a row of `[‹] [Today] [Next →] [›]`, then the tick scroller with `scroll-snap-type: x proximity`.
- Centre the selected tick by setting `scrollLeft`. Never use `scrollIntoView`.

### 6.4 Scroll scrub and pin (`scroll.mjs` `bindBookScrub(header, state, controller)`)

**Enabled when all of these hold:**

- `finePointer.matches`
- policy is `full`
- `atLeast('mid')`
- `await controller.ready === 'webgl2'`
- `header.offsetHeight ≤ innerHeight`

Otherwise there is no trigger and no spacer (plan §7.6).

```
N      = min(2, count − 1 − anchor)                    // anchor = state.index at pin start
plan   = lead dwell 27vh · [turn 33vh · dwell 15vh]×(N−1) · turn 33vh (if N≥1) · dwell 9vh · close 33vh
         // N=2 → 150vh (0–.18 dwell, .18–.40, .40–.50, .50–.72, .72–.78, .78–1); N=1 → 102vh; N=0 → 69vh
ScrollTrigger.create({ trigger: header, start: 'top top', end: () => '+=' + pinPx, pin: header,
  pinType: 'transform',            // .course-workspace has perspective (guide-motion.css:25)
  pinSpacing: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 1, onUpdate })
onUpdate(self):
  if teleport() || state.consumeAnchorDirty(): anchor = state.index; rebase so offset(p) = 0 here; return
  state.scrub(anchor + offset(p), 'scroll')          // offset: smoothstep within each turn segment
  h = handoff(p); controller.setHandoff(h); header.style.setProperty('--hero-p', h)
teleport = |Δp| > .35 in one update, or a Skip/hash/openItem flag, or |ΔscrollY| > .5·innerHeight without Lenis smoothing
```

- Export the pure `scrubPlan(N)` and `scrubAt(p, plan) → { offset, handoff, dwell }` for tests.
- **Pin owns `--hero-p`.** `hero.mjs` kills its own `--hero-p` trigger while `data-book-pin="on"`.
- **Mode change or tier drop inside the pin:**
  1. `st.kill(true)`.
  2. Compensate scroll immediately: back to the pin start if inside the pin, or `−pinPx` if past it.
  3. `controller.setHandoff(0)`.
  4. `state.openWeek(round(turn), { animate: false })`.
- **Rebinding:** rebind on `workspace-changed` and `route-changed` through `core.track('book-scrub', …)`. Create the trigger before hero's and call `ScrollTrigger.refresh()`.
- **No settle animation** when scroll stops mid-turn: the page stays where the scroll put it, and the caption keeps the last dwell week.

### 6.5 Touch swipe (`scroll.mjs`; pointerType touch or pen; no pin)

- Only while `ready === 'webgl2'`, and the stage keeps `touch-action: pan-y`.
- After 10 px of movement:
  - If |dx| > 1.4|dy| and `state.grab('swipe')`: capture the pointer, set `data-gesture=swipe`, and scrub `turn = start − dx / (0.8 × metrics().pageWidthPx)`.
  - Otherwise do nothing (native pan; `pointercancel`).
- `pointerup` → `release('swipe', { velocity })`, then clear `data-gesture` in the next task.
- When the mode is not full, a swipe past 0.25 page width becomes `step(±1)` on release.

### 6.6 Skip to coursework

- `mth140/index.html`: the first focusable element becomes `<a class="skip-link" href="#panel-assessments">Skip to coursework</a>`, ahead of the shell sidebar in DOM order. Use Desk skip-link styling: 44 px, `--hub-focus` outline.
- Click handler:
  1. `CourseWorkspace?.show('assignments')`.
  2. Set the scroll teleport flag.
  3. Jump with `NightScroll.scrollTo(el, { immediate: true })` or native.
  4. Focus the panel heading (`tabindex="-1"`).
- Without JS or Lenis, the plain anchor still works. It never turns pages, because teleport rebases the pin.

### 6.7 Dock handoff (`deadline.mjs`)

- The dock stays actionable from arrival (not gated by `ns-docked`).
- Pass `dockTarget = () => document.querySelector('.ns-dock-id i')?.getBoundingClientRect()`.
- When handoff reaches 1, add `ns-dock-received` (a static 400 ms glow; none in cut mode).
- Keep the 2 px progress indicator.
- Forward `onTarget` → `state.setWeeks(state.weeks, { reason: 'target' })`.

### 6.8 Fallback timeline (`timeline.mjs`)

- **Book courses:** the week list comes from `state.weeks` (not `TERM`).
- **Shown** when `data-renderer=poster` or the tier is low: the full flat timeline (month labels, elapsed fill, Today, checks, item buttons), with its horizontal scroll positioned near today without moving the page or focus. Ticks call `state.openWeek`.
- **Hidden** while the book is running; the rail stays.
- **Non-book courses** (CEN100, MTH141 until Stage 4) are unchanged.

### 6.9 Palette-ready week API

- `attachBookState` listens for the `book-open-week` event: `preventDefault()`, then `state.openWeek(clamp(index), { source: 'palette' })`. This works in fallback too: the caption and timeline update.
- `currentBookState()` and `paletteEntries()` are exported for Task F. The palette releases its hold before dispatching, so `policy()` is no longer `cut` because of `held`.

### 6.10 Data refresh

| Trigger | Action |
|---|---|
| `guide-completion`, section `change`, cross-tab `storage` (progress or section keys) | Recompute `records` and `weeks`; `state.setWeeks(weeks, { reason })` |
| `onTarget`, minute tick (only when a visible view's signature changes) | `setWeeks(same, { reason: 'target' \| 'minute' })` |
| Toronto midnight (timer to the next 00:00) and `pageshow` | Recompute `today`; `setWeeks(weeks, { reason: 'midnight', today })` |
| `visibilitychange` (shown) | As for the minute tick |

---

## 7. Tiers and budgets

| | High | Mid | Low / no WebGL2 / failure |
|---|---|---|---|
| Entry | `core.tier() === 'high'` and the probe passes | Mid, or coarse pointer with a passing probe | Low, failed probe, shader failure, second context loss |
| DPR cap | min(dpr, 2) × quality | min(dpr, 1.5) × quality | — |
| Anti-aliasing | MSAA target 4 (2 at DPR ≥ 2) | Context AA | — |
| Sheet segments / sheets in the air | 96×2 / 3 | 48×1 / 2 | — |
| Static page / pop-up strip segments | 24×1 / 24 | 1×1 / 12 | — |
| Page texture / LRU / anisotropy | 1024 / 6 / 8 | 768 (512 compact) / 4 / 4 | Poster |
| Shadows | Map 1024 (dark) / 512 (light); pop-ups cast | Analytic only | — |
| Post | Bloom (dark, emitter visible) + Finish | None; halo quads; CSS vignette | — |
| Cover and cloth | Physical with sheen | Standard | — |
| Drift | Yes (gated) | No | — |
| Pin | Fine pointer | Fine pointer | No; flat timeline plus poster |
| **Budgets** (Stage 3 measures and reports) | ≤ 24 draw calls at rest, ≤ 34 turning (+ ≤ 9 post passes); ≤ 15k triangles; textures ≤ 64 MB; render targets ≤ 60 MB at DPR 2 (samples 2); ≤ 2 ms JS per busy frame; face paint ≤ 16 ms | ≤ 22 / 30 draw calls; textures ≤ 28 MB (compact ≤ 14 MB); no render targets | No loop |
| Frame policy | On demand; 60 fps while busy, 30 fps while drifting | On demand | — |

---

## 8. Vendor bundle (who does what)

- **Codex Task H** (`codex/ns-build-sound`) owns `tools/scene-build/vendor-entry.mjs` and the rebuild of the addons: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass` and `ShaderPass` (`RoomEnvironment` is already present). The engine uses `UnrealBloomPass` and `ShaderPass` only.
- **Engine core exports needed (addendum to H):** `CanvasTexture`, `Raycaster`, `Plane`, `WebGLRenderTarget`, `HalfFloatType`, `PCFSoftShadowMap`, `NeutralToneMapping`, `NoColorSpace`, `LinearSRGBColorSpace`, `SpotLight`, `ShadowMaterial`, `DynamicDrawUsage`, `FrontSide`, `BackSide`, `Box3`, `Sphere`, `Vector4`, `MathUtils`, `ClampToEdgeWrapping`.
  - **Lead action:** append this list to `docs/codex/task-h-build-sound-cleanup.md` before H starts.
  - If H has already merged, Side A makes **one** follow-up commit that adds these exports and rebuilds (`cd tools/scene-build && npm ci && npm run build`). Record the sha256 and the size delta; the research measured about +4 KB gzip for a similar set.
- **One Three URL.** Side A adds `assets/app/three.mjs` (`export * from '../vendor/three-0.186.1.mjs?v=<token>'`) and, in the same commit, switches `course-scene.mjs`, `scenes/*.mjs` and the book to import only that file, with a new token.
  - Check: `grep -r "three-0.186.1.mjs?v=" assets` finds only `app/three.mjs`.
- **Night vendor** (`tools/ui-build`, GSAP, ScrollTrigger, SplitText, Lenis): **no change**. The build must stay byte-identical. `pinType: 'transform'` and the pointer gestures need nothing new.
- **GSAP:** the engine imports `../vendor/gsap-3.15.0.mjs` (the same URL as `guide-motion.mjs`) for `parseEase` only. It never adds a ticker callback.

---

## 9. MTH140-only now vs engine-general (Stage 4)

| Area | Stage 2 (MTH140) | General engine (Stage 4 adds CEN100 and MTH141) |
|---|---|---|
| `course-styles.mjs` | `BOOK_COURSES = ['mth140']`; only the `sketchbook` style is filled in | Schema general (dims, cover, band \| null, paper, rules: none \| blueprint \| grid, sketch layer, accent, popup mechanism, sizes, ease, wash). CEN100 and MTH141 values from the visual draft's §11 are kept as Stage 4 targets. |
| Pop-up mechanisms | `arch` (symmetric, double, wave, low) | `box` (CEN100) and `vfold` (MTH141; closed form `θ = atan2(B, A) + acos(C/√(A² + B²))`) are added in Stage 4 with tests. `layoutSpread`, slots, states and picking are already general. |
| Textures | Grid, ledger, honesty states, label atlas (general); pencil `sketch` layer and the MTH140 motif library | Procedural `blueprint` and `grid` rules exist as shader flags (off); technical-pen and fine-liner layers come in Stage 4 |
| Object | Elastic band, ribbon, rounded corners | Band is `null` for others; ribbon and corner radius come from the style |
| State, rail, scrub, swipe, Skip, fallback, palette hook | Course-agnostic | CEN records already work through `weeks.recordsForCourse` (schedule ids are kept distinct from item handles) |
| Stage, post, lighting rig | General | Shared with the Desk in Stage 5 (separate `Scene` per area; a transition pass later) |
| Poses | `open-hero`, `docked` | `closed-on-desk` is used in Stage 5 |

---

## 10. Acceptance checks

### 10.1 Side A (`node --test`, plus the jsdom lifecycle)

**`book-popup.test.mjs`**

- Finite for θ over [0, π] in 1/1000 steps, plus ±1e−6 at both ends.
- Everything coplanar at θ = 0.
- Design heights within 1% at θ = π.
- |LM| and |RM| constant within 1e−9 while flat = 0.
- The wave meets `a_L + c_L = a_R + c_R`.
- flat = 1 → apex ≤ 0.5 mm at any θ.
- Heights ordered final > midterm > quiz > minor.
- ≤ 3 pieces per spread, and slot footprints, including the tag and its back-fold, do not overlap.
- **Hood clearance:** for every turn t in 0..1 (step 0.01), all outgoing and incoming pop-up vertices stay on the correct side of the turning sheet (≤ 0.5 mm, sampled with `bendPoint`).

**`book-bend-adapter.test.mjs`**

- The patched shader replaces `<begin_vertex>` and `<beginnormal_vertex>`, calls `bendPosition` and `bendNormal`, and uses `BEND_KEY`.
- `R(t, v)` stays within `[W·MIN_RADIUS_RATIO, W/π]`.
- The segments used by `hit` equal the mesh `segX` per tier.

**`book-pick.test.mjs`**

- Project `bendPoint` samples through the scene camera, and `pick` returns the same face and (x, y) within half a segment.
- A static page under a sheet never wins. Hidden or folded pop-ups never win.

**`book-textures.test.mjs`** (mock 2D context)

- Only black and pure R/G/B fills are used.
- A theme change causes 0 paints.
- Repaints happen only when the signature changes.
- Poster mode emits no `fillText` containing a digit.
- Keep-out limits are respected.
- Informational text is ≥ 28 px.

**`book-lifecycle.cjs`** (renderer shim from `scene-rendering.cjs`)

- Null probe → poster.
- 0 rAF calls after settle.
- Sleeps offscreen, hidden and held.
- Cut mode renders 1 frame per change.
- Context loss → fallback, with ≤ 1 remount.
- high → mid releases the post targets.
- Dispose leaves 0 listeners and observers.
- 20 mount/unmount cycles keep one renderer and flat counts.

**Captures** (agent-side only, paused frame)

- 1440 dark: recto centre between `#d4c7ab` and `#e6d9bf`; stage corner between `#0f1619` and `#1a2428`; ≥ 2 px of mint board visible around the block.
- 1440 light: recto centre between `#f2efe7` and `#fbfaf6`; contact shadow visible against the blotter.
- Tag line 1 cap height ≥ 11 css px at 1440.
- 390: spread ≥ 360 css px.

**Vendor:** single-URL grep passes; the bundle rebuilds byte-for-byte from the lockfile; `scene-*.cjs` stays green.

### 10.2 Side B

**`book-state.test.mjs`**

- Clamping; cut/fade/full per policy; retargeting collapses.
- Lock precedence (drag over scroll).
- Index timing (immediate for commands; dwell or landing for continuous sources).
- `anchorDirty`; landing rules.
- Discrete vs continuous notifications.
- Runs in plain Node with no `document` and no storage access.

**`book-spread.test.mjs`**

- `describeSpread` returns resolver strings verbatim (the §3.2 check values).
- No `23:59`.
- Quiz week without a section gives a `cta` and no time.
- Pending → "Date pending".
- Partial labels; relative kickers including BEFORE TERM and AFTER TERM.
- Signature is stable, and changes on completion or section.

**`book-scrub.test.mjs`**

- `scrubPlan` and `scrubAt`: monotone; dwell at integers; pin ≤ 150vh; N = 0, 1, 2.
- Teleport rebases.

**`tools/ui-build` workflows (MTH140, motion on and off)**

- Skip to coursework is the first tab stop and lands focus in `#panel-assessments`.
- Radiogroup keys; Today and Next.
- Palette `book-open-week` with index 8 → week 9 shown and the event `defaultPrevented`.
- No-WebGL: poster, flat timeline and coursework, with no pin spacer.
- Touch emulation and reduced motion: no pin; `touch-action: pan-y`.
- Pause mid-pin: spacer removed, scroll position preserved within ±2 px.
- 20 route round trips: ScrollTriggers, listeners and observers flat.
- 390: no horizontal overflow, and the tick strip centres without page scroll.
- The live region fires once per settle.

### 10.3 Joint (M4, before the checkpoint)

- Dark and light × 1440 and 390, each in two states: current-week hero (paused frame), and docked/coursework.
- Task G harness checks `routes`, `modes`, `layout` and `stability` pass if merged; otherwise run the equivalent manual Playwright scripts.
- Report SwiftShader as diagnostic, and real-GPU and WebKit review as pending (plan §11).

---

## 11. Open questions for the Stage 2 checkpoint

1. Should the rail merge into the action bar at ≥ 1280 px?
2. `R_mid` (W/π) against pop-up clearance and how the turn reads. Tune after the hood test.
3. Keep drift after Stage 3 profiling?
4. CEN100 fore-edge month tabs (Stage 4 or later).
5. Does the dark lamp pool tint the rail? (Currently no; the rail stays `--hub-bg`.)

---

## 12. References

**Plan and contracts:** `NIGHT-SHIFT-PLAN.md`, `docs/codex/README.md`, `docs/codex/task-{c,d,e,f,g,h}-*.md`, `assets/book/{weeks,page-bend-math}.mjs`, `assets/night/targets.mjs`, `assets/route-lifecycle.mjs`.

**Persistent world and art direction**
- Unseen Studio SOTM case study: https://www.awwwards.com/unseen-studio-by-unseen-studio-wins-sotm-february-2023.html
- Codrops, Crosswire case study (matcaps, frustum sections): https://tympanus.net/codrops/2023/04/04/case-study-crosswire/
- Codrops, inside Unseen Studio (2026): https://tympanus.net/codrops/2026/07/20/the-craft-behind-memorable-digital-experiences-inside-unseen-studio/
- Bruno Simon on matcaps and baking (Mux): https://www.mux.com/blog/3d-web-development-and-beyond-a-chat-with-bruno-simon
- Three.js Journey lessons (modified materials): https://threejs-journey.com/lessons/modified-materials
- Graphite shine: https://vitruvianstudio.com/blog/3-ways-to-reduce-graphite-shine-in-your-drawings/
- Sketchy pencil post-process (rejected): https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/

**Sketchbook object**
- Moleskine Art Sketchbook: https://www.moleskine.com/en-us/shop/notebooks/art-collection/sketchbooks/sketchbook-black-9788862931960.html
- Leuchtturm1917 Sketchbook: https://www.leuchtturm1917.com/sketchbook.html
- Sage colourway: https://www.jetpens.com/Leuchtturm1917-Sketchbook-Medium-A5-Sage/pd/46144
- Elastic closure build: https://makinghandmadebooks.blogspot.com/2014/11/pocket-sketchbook-with-elastic-closure.html

**Pop-up engineering**
- Glassner, Interactive Pop-up Card Design, Part 1: https://www.glassner.com/wp-content/uploads/2014/04/CG-CGA-PDF-02-01-Pop-Up-Cards-1-Jan02.pdf
- MSR-TR-98-03: https://www.glassner.com/wp-content/uploads/2014/04/MSR-TR-98-03-Interactive-Pop-Up-Card-Design.pdf
- Georgia Tech, physics of paper engineering: https://paper.gatech.edu/kinetic-joy/physics-paper-engineering
- Science Friday: https://www.sciencefriday.com/educational-resources/pop-up-book-engineering/
- Arch tutorial: https://www.youtube.com/watch?v=RiI5abrvpCQ
- Curved shapes tutorial: https://www.youtube.com/watch?v=16ZXEEW4VaQ
- V-fold tutorial: https://juditorosz.substack.com/p/v-fold-pop-up-tutorial-bringing-your
- Smithsonian, *Fold, Pull, Pop & Turn*: https://www.sil.si.edu/pdf/fppt_brochure.pdf
- Li et al., Popup (2010): https://www.cs.wustl.edu/~taoju/research/popup_final.pdf
- Multi-style pop-ups (SA 2013): https://www.comp.nus.edu.sg/~lowkl/publications/multistyle_popup_sa2013.pdf
- ASME kinematic representations: https://asmedigitalcollection.asme.org/mechanismsrobotics/article/1/2/021009/478086/Kinematic-Representations-of-Pop-Up-Paper

**Page curl and picking**
- Project Austin page curling: https://devblogs.microsoft.com/cppblog/project-austin-part-2-of-6-page-curling/
- Paperlab twin deformers: https://github.com/NourMtir0722/Paperlab
- Page-curl shader breakdown: https://andrewhungblog.wordpress.com/2018/04/29/page-curl-shader-breakdown/
- Anatomy of a page curl: https://blog.flirble.org/2010/10/08/the-anatomy-of-a-page-curl/
- three.js forum, animating book pages: https://discourse.threejs.org/t/animating-pages-of-a-book/28883
- Wawa Sensei book slider: https://wawasensei.dev/tuto/3d-book-slider-landing-page-threejs-and-react
- Raycasting displaced geometry: https://sbcode.net/threejs/raycast-to-displacementmap/
- Lighting with custom vertex shaders: https://discourse.threejs.org/t/custom-vertex-shader-with-lambert-lights/2798

**Rendering and textures**
- MeshPhysicalMaterial: https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- PerspectiveCamera (`setViewOffset`): https://threejs.org/docs/pages/PerspectiveCamera.html
- UnrealBloomPass: https://threejs.org/docs/pages/UnrealBloomPass.html
- r186 selective bloom example: https://github.com/mrdoob/three.js/blob/r186/examples/webgl_postprocessing_unreal_bloom_selective.html
- Threshold-based selective bloom: https://discourse.threejs.org/t/is-there-a-selective-bloom-pass-other-than-the-threejs-example/60155
- Khronos PBR Neutral: https://www.khronos.org/news/permalink/khronos-pbr-neutral-tone-mapper-released-for-true-to-life-color-rendering-of-3d-products
- Canvas text blur and sRGB: https://discourse.threejs.org/t/after-migration-canvas-text-more-blurry/66540
- Anisotropic filtering: https://sbcode.net/threejs/anisotropic/
- MDN `fontStretch`: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fontStretch
- Bump to normal maps: https://dev.to/ndesmic/webgl-engine-from-scratch-15-normal-maps-3227
- Post-processing guide 2026: https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026
- 100 performance tips: https://www.utsubo.com/blog/threejs-best-practices-100-tips

**DOM, input and platform**
- GSAP ScrollTrigger (`pinType`, `refreshPriority`): https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- WAI-ARIA APG radio group: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- MDN `touch-action`: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- MDN `getContext` (`failIfMajorPerformanceCaveat`): https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
- MDN `WEBGL_lose_context`: https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context
