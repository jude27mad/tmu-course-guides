# TMU Course Guides — Night Shift: The Desk & Semester Books Implementation Plan

> **Status: plan only.** This revision authorizes documentation only, not implementation, dependency installation, builds, tests, asset generation, deployment or a PR. All build steps and verification commands below are for a separately authorized implementation session.
>
> **For future agentic workers:** use `superpowers:executing-plans` to work through this plan task by task. Reuse the existing `night-shift` implementation. Do not create an isolated prototype or a parallel implementation. Stop at the MTH140 visual checkpoint in Stage 2 and wait for the user's approval before continuing.

**Goal:** Make the desk the course directory, the books the containers for real semesters, and Night Shift the immediately usable coursework layer underneath.

**Architecture:** Keep the static GitHub Pages site and native ES modules. Add procedural Three.js books and a desk through the existing scene lifecycle, coordinated with the existing Night Shift runtime, deadline service, dock and workspace. Course data and progress remain authoritative; every 3D interaction has a usable DOM equivalent.

**Tech stack:** bundled Three.js `0.186.1` / WebGL2; the existing GSAP `3.15.0` instance and Flip; a lazy ScrollTrigger / SplitText / Lenis vendor chunk; native HTML/CSS/ES modules; runtime CanvasTextures and WebAudio. Preserve the existing pinned dependencies, including Lenis `1.3.11`, unless an implementation issue establishes a necessary change. No page-build framework or platform migration.

**Spec:** the user's 12 October 2026 integrated Desk / Semester Book direction, recorded in this document. This supersedes the visual direction in `night-shift-plan:NIGHT-SHIFT-PLAN.md`, retaining its useful engineering constraints and verification requirements.

## 0. Branch, scope and existing work

- The source plan was read from `night-shift-plan:NIGHT-SHIFT-PLAN.md` (blob `f85dcb277754f05a6e03993bc298f0f6d6008322`). Leave that branch unchanged as historical reference.
- This revised `NIGHT-SHIFT-PLAN.md` belongs on **`night-shift`**, alongside the implementation. Do not reset the branch to the earlier commit titled `Night Shift foundation: editorial layout, live deadline card, dock and semester timeline`.
- At the read-only inspection for this revision, `night-shift` was at `6514fc4432165bd601529604055e02fb547d8e8b` (`Night Shift work in progress: backdrop layer`). It already contains work beyond the named foundation. Preserve that history and any newer commits; deprecated code is removed only during future implementation.
- Existing files include `assets/night/core.mjs`, `boot.mjs`, `layout.css`, `deadline.mjs`, `timeline.mjs`, `scroll.mjs` / `scroll.css`, `hero.mjs` / `hero.css`, and `backdrop.mjs` / `backdrop.css`. File presence is not a claim that all behavior is complete or tested.
- Reuse the existing runtime APIs (`track`, `dispose`, `hold`, `release`, `onAmbient`, `onTier`, `openItem`, `vendor`), the deadline APIs (`currentTarget`, `onTarget`, `resolve`, `parts`, `compact`), the schedule helpers in `assets/schedule.mjs`, and the implemented layout, dock and timeline. Extend or consolidate them rather than creating competing services.
- Only this plan file changes in the documentation commit. Do not move CEN100, delete scenes, modify the forwarder, regenerate vendors/posters, edit release notes or run any implementation verification now.

## 1. Global constraints

- Preserve course content, assessment IDs, deadlines, completion semantics, existing storage keys and saved progress. New presentation state must not become a second source of course or completion data.
- Keep the static GitHub Pages deployment, native ES modules and no page build step. The existing offline vendor/scene build tools remain development tools only.
- Everything shipped by the new experience is self-hosted: no remote models, glTF assets, CDN scripts, remote textures, model services or added tracking. No Floot/Higgsfield migration or asset-service dependency.
- Preserve the existing course accents and folded-page logo.
- Auto theme stays. Every surface, book, poster and effect has a dark and a light variant.
- The OS reduced-motion setting overrides a saved `full` preference; explicit `?motion=full` is page-local for testing and is never persisted; `?motion=off` always wins.
- Coursework starts visible, sharp and usable. No loading counter, ordinary-load cover screen, forced cinematic navigation or wait for WebGL before using the guide.
- All existing `tools/ui-build` course workflows must remain covered. Add Desk, routing, book and fallback coverage instead of deleting functional assertions to make tests pass.
- Controls have visible focus and at least 44 px hit targets. Preserve native link behavior, keyboard access, search, calendar exports and existing item-opening workflows.
- **First visual gate: the composition must look excellent with motion paused.** Cinematic effects cannot compensate for poor layout or unreadable work.
- Integrate directly on `night-shift`, using implementation checkpoints in the real site rather than an isolated preview. No PR unless the user separately requests one.

### Review focus

1. Project-subpath URLs and old root CEN links must land on the right guide without redirect loops or lost hashes/query parameters; Stage 1 owns these checks.
2. The Desk must resolve deadlines without mounting three course workspaces, defaulting to CEN100 or inventing times; Stages 1–2 own these checks.
3. Scroll scrubbing, direct week selection and deformed-page hit targets must agree; Stage 2 owns these checks.
4. Pauses, dialogs, failed assets and interrupted navigation must never trap the page or change saved preferences; Stages 2 and 5 own these checks.
5. Repeated page turns, theme changes and round trips must release GPU resources and subscriptions; Stages 3, 5 and 7 own these checks.

## 2. Design direction and composition

**The book is the container; the semester is inside it. Night Shift is the working layer underneath.** The spectacle lives in the desk, books, page turns, docking, typography and course transitions. Coursework stays calm.

### Motion hierarchy

| Visitor is… | Leads visually | Held back |
|---|---|---|
| Arriving normally | Book/desk composition, brief kinetic title, art reveal | No cover screen, loading counter or competing pulses |
| Exploring the Desk | The hovered, dragged or focused book | Other books remain quiet; dust is subtle |
| Exploring a semester | Page curl and hinged assessment pop-ups | Other decorative motion is subdued |
| Scrolling into coursework | Book closure and dock handoff | The scene sleeps once offscreen |
| Reading an assessment | Stable text and brief interaction feedback | No page drift, row skew, magnetic movement or animated background |
| Diving between Desk and a course | The camera/cover move | All unrelated motion |

Only one ambient pulse is visible at a time: next-deadline urgency takes precedence over the fallback timeline's Today beacon, which takes precedence over an unset-section dot. These priorities apply across DOM and 3D; do not flash the same urgency on several surfaces simultaneously. Static highlights remain allowed when motion is paused.

### Typography, layout and themes

- Desktop at widths of at least 1001 px: content up to 1440 px wide with generous gutters and a generous book hero.
- Directly below the course hero: a dominant next-assessment card with countdown **and the actual date/Toronto time**. Assessment rows use an aligned grid of tabular date numerals, title, metadata and right-aligned action.
- Keep body/instruction text at about `68ch` maximum even inside the wider layout. Do not stretch prose across the full page.
- Use Archivo condensed (`wdth` 75) only for display titles and prominent labels. Titles use `clamp(2.6rem, 4.5vw, 5.5rem)`; row titles use 1.25–1.5rem. Instructions, dates and controls remain normal-width, at least 1rem, high contrast. Retain prominent tabular dates and editorial section labels/rules.
- Dark: graphite `#0f1619`; restrained accent hairlines. Glass is limited to the next card, dock, palette and sheets; assessment rows are solid panels.
- Light: warm off-white interface, frosted white on those same limited surfaces and readable ink accents. The Desk is lit as daytime and the books' pages use white paper rather than retaining a dark scene under a light interface.
- Use the existing `editorial.css` selector pattern: `:root[data-theme=…]` and the Auto `prefers-color-scheme` block, including CEN's `--bg`, `--tile` and `--line`. Theme changes also update scene materials, lighting, textures and posters without resetting the selected week or progress.
- The semester timeline occupies the full content width **only as a fallback**. Do not display a competing standalone strip above or alongside a functioning book. Its accessible data/mirror remains available.

### Course identities

| Course | Book | Pages | Pop-ups |
|---|---|---|---|
| CEN100 — technical manual | Salmon cloth hardcover, debossed schematic pattern | Blueprint grid | Boxy, machined forms, precise mechanical unfolding |
| MTH140 — sketchbook | Mint linen cover with elastic band | Cream paper with pencil curves in dark mode | Curved paper arcs and flowing folds |
| MTH141 — graph-paper notebook | Lavender cover | Square grid | Faceted, planar folded forms |

Retain the current accent values from `COURSE_META`: CEN100 `#edbba7`, MTH140 `#b9dfc9`, MTH141 `#d3c3ee`, with their existing readable light-theme inks. The identities differ in construction, texture and unfolding, not merely color. Preserve the folded-page logo. Labels, dates and controls remain consistent across courses.

## 3. Site structure and compatibility

### Routes

- `index.html` becomes **The Desk**.
- Move the current CEN100 guide to `cen100/index.html` (`/cen100/`). MTH140 and MTH141 stay at `mth140/index.html` and `mth141/index.html`.
- Route names here are relative to the **site's deployment base**. On GitHub Pages the project base is `/tmu-course-guides/`; do not accidentally send users to an origin-root `/cen100/` outside the project. Preserve local-preview behavior as well.
- Rebase CEN's styles, scripts, icons, privacy links, course navigation, canonical/social metadata and internal/external guide links. Audit path detection in the workspace, course header, schedule feeds, calendar exports and scene poster resolution.
- Add a **Desk** link to every course dock and relevant course navigation. Keep direct DOM links for all three courses on the Desk.

### Old links and the forwarder

- A root URL carrying a recognized CEN100 hash or CEN100-specific query forwards to the new CEN100 URL with the **entire existing query and hash preserved**.
- Inventory the actual CEN query keys, historical view/item hashes and generated links from the existing root guide. Use those as an explicit routing allowlist; generic flags such as `?motion=off`, theme controls or quality diagnostics alone must not misroute the Desk to CEN100.
- Use a same-origin, deployment-base-aware replacement navigation. Do not accept a query-supplied arbitrary redirect destination. No redirect loop on `/cen100/`.
- Update the legacy `jude27mad/cen100-guide` forwarder to the new `/tmu-course-guides/cen100/` destination, preserving its existing query/hash forwarding. This is a **future coordinated edit to the forwarder repository**, not a change in this plan-only commit.
- A fragment cannot be handled by the server before the browser receives it: keep the visible CEN100 course link available even without JavaScript, while the small compatibility script handles automatic forwarding when JavaScript runs.

### Storage and shared course data

- The route move stays on the same origin. Audit every storage read/write and key constructor for `location.pathname`, path-derived namespaces, route-dependent course inference and accidental initialization/reset behavior. Do not rename or migrate existing keys simply because CEN changes path.
- Seed real existing section/completion preferences before a route move and verify that `/cen100/`, the Desk and the other guides read them correctly afterward. Keep storage denial/corrupt-value fallbacks non-destructive.
- The Desk must use the **same deadline rules** as the course pages, without loading hidden course pages or relying on a course page's DOM.
- Refactor the existing resolver into a data-level operation plus presentation adapters. Preserve existing course-page `currentTarget()`, `onTarget()` and `resolve()` integration where possible.
- If CEN `SCHEDULE` remains embedded in the old root script, extract its existing records unchanged into a local `assets/cen-schedule.mjs` and import them from both the Desk and `/cen100/`. Preserve every ID, date, time, item mapping and flag; expose `window.CEN_SCHEDULE` on the CEN guide for compatibility. Do not maintain a second copied schedule.
- Continue using `COURSES` from `assets/course-data.mjs` and the existing completion/section readers. A Desk page has an explicit Desk mode: it must not inherit the current core's default CEN identity or wait for `CourseWorkspace` before rendering its course links.

## 4. Homepage: The Desk

- Cinematic dark surface at night, one warm desk lamp as key light with soft shadows, a cool fill, dust drifting within the lamp beam, grain, vignette and subtle bloom. Daytime lighting is the light-theme counterpart.
- Three course books lie on the desk. Hover lifts the relevant book slightly, tilts it toward the camera and highlights its spine in the course accent.
- Drag rotates the chosen book with inertia, reusing `assets/scenes/drag.mjs`. Arrow keys rotate a focused book. Use real focusable controls with accessible names rather than making canvas picking the only input method.
- Distinguish a click from a drag: ending a rotation gesture must not trigger a course dive. Respect modified clicks/new tabs and provide the normal course link if interaction or rendering is unavailable.
- A visible DOM course list shows each course's next deadline from the shared resolver, plus the overall next deadline. Unknown times, pending exams and quiz weeks retain their uncertainty labels and are not treated as exact instants to manufacture an overall timer.
- The DOM directory is the functioning homepage, not an invisible accessibility afterthought. It remains usable before the scene loads and with WebGL unavailable.

### Camera dive and reverse return

- Clicking a course book starts an approximately **900 ms** camera push into its cover; the cover begins to open before navigation.
- `assets/book/dive.mjs` records a small, versioned session handoff (for example `tmu-guide-book-dive-v1`) containing direction, selected course, validated destination, opening pose and timestamp. Do not reuse the deprecated warp flag for incompatible data.
- A minimal early arrival check consumes only a matching, recent handoff and selects the corresponding opening-book pose/poster before the lazy scene initializes. The destination continues that move rather than playing a second full entrance.
- **Normal loads never show a cover screen.** A failed/late scene or stale handoff must fall back to a visible poster and functioning DOM, not a blocking overlay. Clear one-shot state and provide a bounded recovery path for interrupted navigation or unavailable storage.
- The course dock's Desk link reverses the move: close/pull back from the course book, navigate to the Desk, and settle that course book onto the desk. Keep direct course-to-course links working through the same navigation controller without introducing a second transition handler.
- Coordinate with `guide-motion.mjs`: disable its old course-leave animation when the dive handles navigation. A normal link remains the fallback when the new module is unavailable.
- Under reduced motion use a 150 ms fade with no camera travel; under explicit `?motion=off` or a paused motion preference navigate without animated travel. No mandatory animation is required to reach any course.

## 5. Course pages: The Semester Book

### Weeks and real assessment data

- The hero is the course book lying open. Each spread represents one semester week, covering **8 September–21 December 2026 and the actual exam period**, not just teaching weeks.
- Preserve the schedule's existing Monday-based quiz-week anchors; the initial teaching spread can be partial because the term begins Tuesday 8 September. Label that partial week honestly rather than shifting existing quiz dates.
- Compute the current week with `America/Toronto` helpers from `assets/schedule.mjs`. Before/after the available period, select the first/last appropriate spread without generating invalid indices.
- Include real dated exam records in their correct spread. If existing data extends beyond the base range, extend the data-driven range rather than dropping the record. An undated final remains in an exam-period/pending section with **Date pending**, never at a fabricated day or clock time.
- Open on today's week. When the next known assessment is farther ahead, expose it through the HUD and a direct next-assessment/week action rather than falsifying its placement on today's pages.

### Page turns and pop-ups

- Assessments rise from the pages as pop-up landmarks hinged at the gutter. Their height follows the opening angle using a constrained V-fold-style mechanism; closed pages flatten their pop-ups and open pages raise them coherently.
- Visual size order: **final > midterm > quiz or lab > minor work**. Use actual assessment weight as a secondary size cue within categories when present; do not alter displayed academic weights.
- Completed work lies flat and desaturated with a check stamp. Undo restores the correct fold state for the current opening angle. The next deadline uses the shared resolver's urgency state.
- Each pop-up carries its real name and date/precision label. Clicking or keyboard-activating an assessment calls `core.openItem(id)`; the existing guide owns the actual detail sheet, filtering and completion controls.
- Keep deformed-page picking aligned with visible geometry. Do not leave clickable hit areas on an old flat plane after a shader bends the page. Hidden/backside landmarks must not intercept unrelated input.

### Navigation and coursework access

- Fine-pointer devices with motion enabled: scrolling scrubs turns from the current week through the next few weeks, then closes and shrinks the book into the dock. Cap the added pinned scroll distance at about **150vh**; do not force traversal of the whole semester.
- Dragging a page corner, keyboard controls and clickable week ticks can select any spread. A single selected-week/turn state coordinates these inputs with scroll so the next wheel movement does not unexpectedly reset a manual choice.
- The palette indexes weeks, including queries such as **week 9**, and selects the same spread as the week controls.
- Touch devices: **no hero pinning and no vertical scroll interception**. Use horizontal swipe or week controls for page turns; distinguish horizontal intent and allow vertical panning to remain native.
- **Skip to coursework is the first focusable element** on course pages. It bypasses the scene and pin, reveals the correct coursework view if needed and moves focus to real content. The dock's actions are available immediately, not only after a 70% scroll threshold.
- Keep the 2 px accent progress indicator where it clarifies the handoff. Avoid requiring scene initialization for dock links, search, section selection or Pause motion.

### DOM mirror and fallback timeline

- Render the current spread's week, dates and assessments as a real-text caption under the hero, backed by the same records as the scene and the existing assessment lists. Expose changes without announcing every animation frame.
- `assets/night/timeline.mjs` becomes the shared fallback timeline and accessible semester mirror. Preserve week ticks, month labels, elapsed fill, Today indication, completed checks and real focusable item buttons/tooltips.
- CEN timeline items respect existing `calendar:false` exclusions; preserve `SCHEDULE` entry-to-item mappings. Math items come from `COURSES[course].assessments`.
- When the book is running, do not show a redundant standalone timeline strip. Keep the caption and week controls visible and semantic. When the renderer is unavailable or tier is low, show the complete flat timeline plus poster.
- On phones using the fallback, retain horizontal timeline scrolling/snap and initial positioning near today without moving the whole page or keyboard focus. Capable phones may run the unpinned interactive book.
- Use one proposed `book.openWeek(weekIndex)` operation for controls and palette; `scroll.mjs` updates the same book state. The current spread's records feed both textures and DOM. Do not add a second calendar or week-numbering implementation.

## 6. Rendering and scene lifecycle

- Reuse bundled **Three.js 0.186.1 / WebGL2** and the lifecycle in `assets/course-scene.mjs`: poster before first frame, guarded startup, shader-failure/context-loss fallback, offscreen/hidden sleep and adaptive quality.
- `assets/book/book-scene.mjs` wraps/adapts this lifecycle; do not run the old subject scene underneath the book or start a competing renderer for its pop-ups. The Desk uses the same lifecycle policy.
- Geometry is procedural, **not glTF**: rounded/extruded covers and spine, a page block, a small active set of turning sheets and hinged pop-ups.
- Each turning page is a subdivided plane bent by a vertex shader: cylindrical curl around the spine axis, driven by turn progress and curl radius. Use bounded nonzero radii and endpoint-safe math; positions, normals and bounds remain finite for turn progress 0 through 1.
- Keep only the necessary nearby turning pages/pop-ups live. Reuse buffers and meshes as weeks change instead of allocating the entire semester's high-detail scene every frame.
- Covers, page artwork, week labels and pop-up labels are **runtime CanvasTextures** generated from the current course records. Paper gets a small procedural normal map. Repaint when data, section, completion, fonts, theme or selected week actually changes; do not rebuild textures every render tick.
- Use locally bundled `RoomEnvironment` and PMREM for environment lighting. Dispose temporary PMREM inputs, replaced textures, geometries, materials, render targets and composer passes. No remote environment map.
- Post-processing: subtle grain and vignette, selective bloom for spine glow and the urgent pop-up; chromatic aberration only on high tier. Keep DOM coursework outside post-processing so text stays sharp. A subtle static grain overlay may remain, but no animated noise background or aurora.
- Generate replacement dark/light Desk and book posters from the **real renderer**, not an unrelated mock-up or stock image. Poster geometry, pose, camera and materials must match the live scene. Runtime text remains authoritative; date-dependent text must not become stale baked copy in fallback artwork.

## 7. Night Shift runtime and functional layer

### Vendor loading and initialization

- Keep `assets/vendor/night-vendor.mjs`, built through `tools/ui-build/night-entry.mjs`, with ScrollTrigger, SplitText and pinned Lenis. Register the plugins against the **single** GSAP instance at `assets/vendor/gsap-3.15.0.mjs`; do not bundle/import another core under a different URL.
- Keep the existing development esbuild workflow. Measure the resulting vendor size after a future build rather than repeating an assumed byte estimate.
- `assets/night/layout.css` loads eagerly. Nonessential effects and their CSS load after first paint through the existing boot layer and idle scheduling. Deadline text, DOM navigation and posters do not wait for optional libraries.
- Adapt `assets/night/boot.mjs` to explicit Desk/course modes and the new book modules. Remove its old warp/backdrop imports during implementation; a failed optional feature must not prevent the other services or coursework from starting.

### Core rules

1. **One animation clock per owner.** `gsap.ticker` drives Lenis with `autoRaf:false` and shared DOM animation services. Never throttle the global ticker to cap a visual effect. The existing Three lifecycle retains one coordinated scene scheduler for the active book or Desk, including its dust/pop-ups; it obeys holds, visibility and pause. Do not double-step geometry from both loops.
2. **Services versus views.** The clock, deadline service, palette, sound/haptics and navigation controller initialize once. View-bound SplitText wrappers, reveals, ScrollTriggers, listeners, observers and timers register via `core.track(view, disposer)` and are disposed before rebinding on `workspace-changed`. Dispose render resources when a scene is replaced.
3. **Temporary holds.** `core.hold(reason)` / `core.release(reason)` use the existing in-memory set and never call `setScenePaused` or write a preference. A palette or sheet holds scene/dust/ambient animation and stops Lenis. Releasing one hold does not resume motion while another hold, saved pause, hidden state or reduced-motion restriction remains.
4. **Reduced-motion precedence.** `?motion=off` is absolute. OS reduce overrides saved `full`; stop persisting URL `motion=full`. An explicit full URL only affects that view for testing. Apply the same resolved policy to GSAP, CSS, book/Desk loops, page scrubbing, particles, audio and haptics.
5. **Never hide visible content.** Late modules enhance visible content without setting it back to hidden or replaying entrance animations. Reveal only still-below-viewport elements on first mount. Replace/disable the old reveal owner instead of stacking observers and animations.
6. **Native behavior remains.** Lenis runs only for eligible fine-pointer interaction, stops for dialogs, and preserves anchors, `scrollIntoView` and Skip to coursework. Never attach it to touch scrolling. Paused/reduced modes do not retain pin spacers or transforms that obstruct the page.

### `core.openItem(id)`

Reuse and strengthen the existing routine for pop-ups, timeline buttons and palette results:

1. Switch to the correct view with `CourseWorkspace.show`.
2. Clear hide-completed and enable show-past only when necessary to expose that item, using the existing control events.
3. Wait for rendering (`requestAnimationFrame` twice as a scheduling aid), cancel any blocking old reveal through `GuideMotion.cancel`, and **re-query** the item after the view/filter update.
4. Open the existing tile/sheet/assessment only if not already open; repeated activation must not toggle it closed.
5. Move focus into the opened content and verify that the intended item exists, is visible and is actually open. Two frames alone are not the success condition.

Preserve the current `course-open-item`, `course-schedule`, `workspace-changed`, `guide-completion` and `guide-motion-change` integrations where applicable. Keep CEN schedule IDs distinct from their item-handle IDs, and math assessment IDs distinct from DOM prefixes.

### Deadline resolver and state table

One data-level resolver produces the target consumed by the course card, dock, HUD, pop-up urgency and Desk summaries. Continue using `America/Toronto` calendar/time conversion from `assets/schedule.mjs`; never hard-code a fixed UTC offset or count down by accumulated ticks.

The proposed data-level contract accepts course identity, unchanged schedule records, saved section, completed state and an explicit clock, and returns a target with stable ID/title, item-opening reference, precision, date/start/end where known, label, display text and optional section CTA. Preserve the current precision values (`exact`, `day`, `week`, `pending`) and presentation helpers rather than rewriting independent versions for each surface.

| Information available | Visible result |
|---|---|
| Confirmed date and time | Countdown plus actual date and Toronto time, e.g. `Fri Oct 23 · 6:30 PM Toronto` |
| Quiz week and saved section | Countdown labelled `Your lab quiz starts`, plus that lab's day/start/time/room; preserve timetable-derived confirmation caveats |
| Quiz week without section | Week range and `Choose your section for your quiz time` button; **no timer** |
| Date without time | Actual date and `Time not posted`; day-level wording such as `in 2 days`, no clock digits |
| Date pending | `Date pending`; no fabricated target or countdown |
| Lab falls on a flagged holiday or otherwise needs confirmation | Preserve the existing confirmation warning; do not turn the normal lab slot into a confirmed quiz time |
| No eligible next item | An honest empty/completed state; no invented deadline |

- Math records come from `COURSES[course].assessments` and `COURSES[course].labs`, with saved `<course>-section-v1` read through the existing reader. CEN uses the unchanged schedule and completion/item mappings, now also accessible without the CEN page DOM.
- Keep actual date/time text visible beside the timer. Internal `23:59` sorting fallbacks never appear as published deadline times.
- Preserve large tabular countdown digits and the existing 14-day progress-ring window where appropriate. Ticker digits are `aria-hidden`; a polite live region updates at most once a minute, not each second.
- Urgency: under 48 hours gets a restrained glow; under 6 hours gets the stronger state. Day/week/pending precision must not imply a falsely precise six-hour warning.
- At zero, show `Happening now` only inside a known start/end window; otherwise show `Due time passed`. Retain the foundation's two-hour grace where appropriate for an ended item, but never advance away from an event still in progress merely because two hours elapsed. Featuring a later item must not remove incomplete overdue work from the lists.
- Completion re-resolves all affected surfaces. Undo restores the prior eligible target under the same clock/section state. Do not maintain separate completion flags for scene objects.
- Recompute on section changes, `guide-completion`, `workspace-changed`, `visibilitychange`, `pageshow` and relevant cross-tab storage events. Resume from the real clock; reset after clock jumps without negative digit animations.
- The HUD retains `NEXT · <assessment> · <state>`. Keep Drag/Turn guidance until a successful relevant interaction, remembered only for the session; do not hide it after an arbitrary four-second delay.

### Faster intro, palette and Pause motion

- Retain the fast `enterPage`: about 0.35 s, opacity 0.85→1 and y 12→0, no blur or rotateY. The content is sharp from its first frame and in its settled state within 500 ms. No ordinary-load curtain or counter. A late SplitText load must not hide/re-enter an already readable title.
- The dock includes course identity, **Desk**, countdown chip, section control, Search/⌘K and Pause motion. It remains actionable from arrival and becomes the book's visual resting point at handoff.
- The palette is a real modal `<dialog>`, opened by ⌘K/Ctrl+K, the visible Search button and dock control; no bare-character shortcut. Fuzzy/grouped results support ↑/↓/Enter/Esc and focus return.
- Keep assessments, views, courses, math topics and actions: This week's work, Contacts, Guide tools, Export calendar, Theme, Pause motion, Sound and D2L. Add Desk and **week entries**. Week selection uses the same `book.openWeek`/DOM fallback state; assessments use `core.openItem`.
- The final search row passes the query into the existing `#guide-search`. Close the palette/release its hold before opening another modal, and manage focus without bouncing it back to the old launcher afterward.
- Pause motion uses the existing `setScenePaused` preference and pauses the book, Desk, dust, automatic page motion, ambient pulses, cursor inertia and countdown animation. Paused digits may update once per minute without animation; functional data updates are not stopped.
- Direct keyboard/button navigation still works instantly while paused. Restore the user's manual pause after temporary holds. Reduced/forced-off state must not be silently overridden by a control.

### Feel, completion and sound

- The custom dot/ring cursor exists **only over the 3D stage** on eligible fine-pointer devices, with `Drag`, `Open` and `Turn` labels. Keep the native cursor elsewhere, especially forms and coursework. No cursor on touch/low/reduced/off modes.
- Keep Mark done's brief gravity/bounce through the existing Flip reflow, plus a bounded course-color particle burst. State changes synchronously through the existing guide; animation cannot delay saving. Undo restores the row, card, scene fold and focus appropriately. Under reduced/off modes, apply the state immediately without particles.
- Sound is off by default and opt-in via `tmu-guide-sound-v1`. Keep one shared AudioContext/service; synthesize page turn, cover open/close, book set-down and pop-up unfolding through WebAudio. No audio files, hover ticks, generic completion chime or warp whoosh. Rate-limit scrubbing sounds so one gesture is not a burst of repeated audio.
- Keep supported `navigator.vibrate` haptics on course dive and Mark done; gracefully no-op when unsupported or motion is reduced/off. Do not request unrelated permissions.

## 8. Performance tiers, mobile and fallbacks

| Tier/mode | Rendering and interaction |
|---|---|
| High — capable desktop GPU | Full Desk, shadows, lamp-beam dust, bending pages/pop-ups and all specified post-processing; chromatic aberration only here |
| Mid — capable phones/laptops | Book with bending pages and pop-ups, simplified Desk/shadows, no chromatic aberration, DPR capped at 1.5, fewer page subdivisions and restrained post-processing |
| Low / no WebGL2 / GPU or shader failure | Real-renderer book/Desk posters, complete DOM course list, caption, flat timeline and existing coursework; no active decorative rendering loop |
| Touch | Native vertical scroll, no hero pin; page turns by horizontal swipe or week controls |
| Reduced motion | 150 ms transition fade instead of camera dive; weeks change by crossfade without scroll scrubbing; pop-ups appear already raised except completed ones, which stay flat |
| Explicit motion off | No scene travel, scroll scrub, custom cursor, particles or ambient animation loop; immediate semantic navigation and static visible content |

- Reuse `hardwareConcurrency`, pointer capabilities and a two-second frame-time probe as hints. Use `deviceMemory` only when present; missing memory data is not evidence of a weak device. Touch is not automatically low tier.
- Reuse the runtime watchdog to downgrade after sustained slow frames, not a single startup hitch. A downgrade preserves week selection, focus, deadlines and completion. Release removed passes/buffers; do not leave the old high-tier renderer running under a poster.
- Profile the representative **book + pop-ups + limited glass + cursor** after the Stage 2 approval, before polishing all courses. Profile Desk shadows/dust again when Stage 5 exists.
- Measure frame pacing, shader warmup, texture/render-target memory, draw calls and page-turn costs. Bound texture sizes, page subdivisions, shadow maps and live meshes; report the chosen values instead of claiming that bundle size alone proves smoothness.
- All scene work sleeps offscreen, while hidden, under modal holds and when paused. Disconnect unnecessary animation subscribers when inactive. The minute-based semantic clock is not an ambient rendering loop.
- Use transform, opacity and clip-path for **DOM animation**; shader uniforms and GPU transforms drive the book. Do not reinterpret that DOM rule as prohibiting vertex deformation. Batch layout reads; never rebuild page geometry or CanvasTextures inside scroll handlers.
- Test light/dark, resizing and zoom without horizontal page overflow. Keep DOM labels readable even when a low-resolution scene cannot render small text crisply.

## 9. Architecture and affected files

All paths below describe future implementation work, not changes authorized by this documentation update.

### New book layer

| File | Responsibility |
|---|---|
| `assets/book/book-scene.mjs` | Active course-book scene, selected spread, lifecycle adapter, picking and `openWeek` operation |
| `assets/book/book-geometry.mjs` | Procedural covers, spine, page block and reusable page geometry |
| `assets/book/page-bend.mjs` | Endpoint-safe cylindrical curl shader and shared deformation parameters |
| `assets/book/popup.mjs` | Gutter hinges, V-fold-like height/opening relation, assessment hierarchy and completion states |
| `assets/book/course-styles.mjs` | Manual/sketchbook/notebook identities and dark/light material settings |
| `assets/book/textures.mjs` | Cached CanvasTextures, paper normal map and data/label repaint lifecycle |
| `assets/book/desk.mjs` | Desk scene, books, lights/dust, focused-book rotation and course activation |
| `assets/book/dive.mjs` | Outgoing/reverse camera move, validated arrival state and native-navigation fallback |

### Existing Night Shift and shared code

- Keep/adapt `assets/night/core.mjs`, `layout.css`, `deadline.mjs`, `palette.mjs`, `night.css` and `boot.mjs`. Create missing planned files only when needed; do not treat a missing optional module as completed work.
- `assets/night/scroll.mjs`: page-turn scrub, bounded pin, skip handling and dock handoff. Preserve useful settled-content reveals without skew or duplicate observers.
- `assets/night/timeline.mjs`: fallback semester UI and DOM mirror shared with the book state.
- `assets/night/feel.mjs`: stage-only cursor, paper-interaction sound, haptics and Mark done/Undo. Reuse core's existing sound/haptic service instead of adding a second one.
- Reconcile existing `hero.mjs`/`hero.css` and `scroll.css`: retain useful title/section/lighting integration in the new owners, removing superseded hooks rather than loading both old and new scene control.
- Preserve/adapt `assets/course-scene.mjs`, `assets/course-header.mjs`, `assets/course-header.css`, `assets/guide-motion.mjs`, `assets/workspace.mjs`, `assets/schedule.mjs` and any existing schedule-feed/navigation adapters affected by the root move.
- Preserve `assets/scenes/drag.mjs` and useful lifecycle/framing helpers. Route poster lookup to the new generated book/Desk assets.
- Add `assets/cen-schedule.mjs` only as the unchanged shared extraction described in Section 3; keep the course data and completion semantics intact.

### Pages, build tooling and docs

- New `cen100/index.html`; repurpose `index.html` as the Desk; update `mth140/index.html` and `mth141/index.html` links, tags and module hooks.
- Retain/update `tools/ui-build/{entry.mjs,night-entry.mjs,build.mjs,package.json,package-lock.json,test.cjs,workflow-check.cjs}` as needed. Preserve the lazy vendor and Lenis license. Update assertions by behavior, not by assuming the previous `test.cjs:29` line number is unchanged.
- Update `tools/scene-build` only as needed to bundle local Three addons and generate new posters from the renderer. Preserve the native runtime/no page-build design.
- During final implementation documentation: `README.md`, `docs/visual-overhaul.md`, `docs/immersive-motion.md`, and `CHANGELOG.md`. Keep changes factually aligned with what was implemented and what remains unverified.
- Legacy forwarder: inspect and edit its actual forwarding file in `jude27mad/cen100-guide` during Stage 1; do not merge or publish unrelated work there.

### Retire after replacements are wired

- Old circuit/gear, calculus/ribbon, algebra/sphere and `future-*` subject scenes, `header-geometry.mjs`, and their obsolete posters/geometry tests.
- `assets/night/warp.mjs` and warp styles/flags; camera dive replaces them.
- `assets/night/backdrop.mjs`, `backdrop.css`, animated WebGL noise, CSS aurora, marquee, leaning rows and magnetic buttons.
- Remove obsolete imports, boot feature names, styles, links and tests only after their replacements exist. Preserve `drag.mjs`, shared framing, generic renderer failure handling and unrelated course/workbench functionality. Do not delete an entire shared directory by wildcard.

## 10. Build order — future execution only

### Stage 0 — Record the actual baseline

- [ ] Read the then-current `night-shift` head and inventory completed/incomplete foundation work; preserve newer work rather than resetting to the snapshot in this plan.
- [ ] Record existing test results, failures by name, settled screenshots and intro timing before making product changes. Inventory storage keys, CEN hashes/query keys, route-dependent logic and old scene imports.
- [ ] Confirm the current typography/composition with motion paused as the first gate. Record baseline facts, not assumptions that the old plan's failures are still current.

### Stage 1 — Structure and functional Desk shell

**Files:** root/CEN/math pages; relevant navigation/workspace adapters; core/deadline data adapters; unchanged CEN schedule extraction if required; legacy forwarder.

- [ ] Add focused routing/storage/deadline fixtures before changing those behaviors.
- [ ] Move CEN100 to `/cen100/`, rebase assets/links and preserve every existing storage key and data record.
- [ ] Add the root CEN compatibility forwarding and update the legacy forwarder, preserving query/hash and the project deployment base.
- [ ] Build the visible Desk DOM directory, per-course and overall next deadlines using the shared data-level resolver; make it work without a scene or course workspace.
- [ ] Verify routing, no loops, unchanged seeded progress and the original course workflows before committing this stage.

### Stage 2 — Complete the MTH140 book integration

**Files:** `assets/book/{book-scene,book-geometry,page-bend,popup,course-styles,textures}.mjs`; course header/lifecycle; Night Shift core/scroll/timeline/deadline; MTH140 page.

- [ ] Add focused checks for finite bend endpoints, pop-up hierarchy/folding, Toronto week selection, item opening and keyboard/touch interaction.
- [ ] Build the real MTH140 book with geometry, curl, labels and pop-ups from the existing data, opening to the current week.
- [ ] Integrate bounded fine-pointer scrubbing, corner drag, keys, horizontal touch swipes, week controls, immediate dock/Skip access and the DOM mirror/fallback timeline.
- [ ] Integrate existing deadline, completion/Undo and Pause motion behavior. Confirm the paused composition before polishing movement.
- [ ] Internally verify **dark and light × 1440 and 390 px × current-week hero and docked/coursework state** (agent-side captures only; they are not sent to the user). The phone hero is not pinned.

**MANDATORY CHECKPOINT (revised 12 Oct, see Section 12): merge the integrated MTH140 route to `main` so the user can open the live site themselves, tell them it is ready, and STOP. Do not send screenshots to the user. Wait for explicit approval before Stage 3 or any later stage.**

### Stage 3 — Profile and set tiers

- [ ] After approval, measure the representative book, pop-ups, glass, cursor and page-turn interaction. Report frame pacing and the actual quality settings chosen.
- [ ] Implement/tune high/mid/low behavior and the watchdog; verify offscreen/hidden/hold sleep, downgrade cleanup, posters and no-WebGL fallback.
- [ ] Keep the selected week, focus and completion intact during theme changes, resize, context loss and downgrade.

### Stage 4 — CEN100 and MTH141 identities

- [ ] Apply manual and graph-notebook construction/textures/pop-ups using the same engine and unchanged data adapters.
- [ ] Verify that each course looks and unfolds differently while retaining consistent labels, ordering, section handling and DOM access.
- [ ] Review all three paused layouts in dark and light before moving to the Desk scene.

### Stage 5 — Desk scene and continuous navigation

- [ ] Build the Desk scene on the already-working root DOM shell; add drag/inertia, hover, keyboard selection and data-backed spine/next-item states.
- [ ] Implement the approximately 900 ms dive, destination continuation and reverse Desk return, including early state validation and interrupted-navigation fallback.
- [ ] Verify normal/direct loads never cover content; modified clicks, back/forward cache, expired flags, denied session storage and failed scenes remain navigable.
- [ ] Profile Desk shadows/dust and adjust tiers without sacrificing the DOM shell. Inspect paired departure/arrival frames rather than claiming continuity from still screenshots alone.

### Stage 6 — Finish interactions and retire old effects

- [ ] Add palette week entries wired to the shared book state; finish stage-only cursor and opt-in synthesized book/paper sounds.
- [ ] Finish dive/Mark done haptics and bounded completion feedback with reduced/off alternatives.
- [ ] Remove old scenes/geometry/posters, warp/backdrop, marquee, leaning rows, magnetic behavior and stale loader/style/test references. Generate new Desk/book posters from the renderer.

### Stage 7 — Full verification and documentation

- [ ] Run the full matrix below and compare with the recorded baseline. Fix new regressions; do not classify new failures as legacy without evidence.
- [ ] Perform real-GPU visual review where available and state platform/performance limits honestly.
- [ ] Update the README, visual and immersive-motion docs, changelog and release notes to describe the integrated result and remaining limitations.
- [ ] Commit/push the authorized implementation on `night-shift`; provide checkpoint/final screenshots and a factual report. Do not open a PR or merge/deploy without the relevant authorization.

## 11. Verification matrix — not run in this plan-only update

### Existing suites and coverage

- From `tools/ui-build`, run `npm ci && npm run build && npm test` during implementation. Preserve **all six course × motion workflows**, with CEN now at its new route. Add Desk motion-on/off, routing and fallback workflows.
- From the repo root, run `node --test tests/*.test.mjs tests/scene-*.cjs`.
- The previous plan reported failures numbered 32–37, 47 and 48 on its `main` baseline. That is historical context, not a newly verified result. Stage 0 must record exact current test names/results; numbering may shift. Allow no new unexplained failure.
- Add/extend focused book geometry, week-selection, deadline, route/storage and scene-integration tests. Replace assertions tied to retired scene geometry with equivalent lifecycle/input/fallback coverage for books; do not delete unrelated regression checks.

### Geometry, weeks and event correctness

- Page bend positions/normals/bounds stay finite at turn 0, near both endpoints and throughout 0–1 with supported curl radii. No NaN, infinity or disappearing bounds.
- Pop-up ordering is final > midterm > quiz/lab > minor; closed pages and completed records lie flat; Undo restores the fold implied by the current page opening.
- Freeze clocks and seed sections/completions before navigation. The book opens to the week containing that **Toronto** date, including UTC/Toronto date-boundary cases, week boundaries, the partial first week and before/after the term.
- Preserve the deadline fixtures: CEN integrity quiz → **2026-10-14 15:00 Toronto**; MTH140 midterm → **2026-10-23 18:30 Toronto**. Tests use the real records, not replacement hard-coded application deadlines.
- Quiz week without section shows the section CTA and no timer; date-only and pending entries retain their precision; holiday-derived quiz uncertainty remains visible.
- Pop-up activation opens and focuses the correct assessment. Palette `week N` opens the correct spread; palette `midterm` opens the correct item even when filtered out or in another view.
- Completion/Undo, section changes, hidden/resume and `pageshow` update card, HUD, dock, book and Desk consistently. Expiry does not hide an ongoing event or erase overdue work.

### Routes, storage and input

- Root CEN hash/query URLs forward once to `/cen100/` with all query/hash data preserved under the project base. Generic Desk options alone stay on the Desk. Validate the legacy forwarder destination and preservation behavior.
- Existing seeded CEN progress/section settings survive the move. No path-based storage key, accidental overwrite, new origin or old-root default CEN mount is introduced.
- Touch has no scroll pinning or intercepted vertical gesture. Horizontal page swipes and controls still work; drag release does not activate a course link.
- Skip to coursework is the first tab stop and works before WebGL loads. Dock, labels, course links and item actions have native keyboard paths and visible focus.
- Reduced motion has no camera dive or scroll scrub: only the specified short fade/crossfade, with already-raised uncompleted pop-ups. `?motion=off` has no animated transform/cursor/particle/canvas loop.
- Disabling WebGL2 or forcing shader/context failure leaves matching posters, the course list, caption, flat timeline and normal coursework usable.
- Palette/sheet holds do not write saved pause. Nested holds release correctly; Pause motion stops decorative loops without stopping semantic minute updates or explicit navigation.

### Screenshots and motion review

- Use the existing preview server (`node tools/preview-server.mjs`) and Playwright Chromium/SwiftShader for reproducible layout captures during implementation.
- Wait for fonts, removal of leftover wrapper transform/filter/opacity and then 1.5 s before a **settled** capture. If no settled state is reached, treat it as a defect; do not hide it with a longer arbitrary screenshot delay.
- Preserve the prior matrix, adapted to the new surfaces: **3 courses × {1440, 1024, 390} × {dark, light} × {current-week/top, docked/coursework, fallback timeline}**. Also capture the Desk at all three widths in both themes, with normal and no-WebGL presentation.
- Check no horizontal page overflow, obscured coursework or unexpected console errors. In intentional failure tests, distinguish the expected diagnostic from an unrelated exception.
- Capture labelled **motion frames** separately for page curl, pop-up unfolding, dive and reverse return. A screenshot taken in transit is not a settled-layout approval image.
- Review book and Desk on a **real GPU** where available for materials, curl, shadows, bloom and poster/live matching. SwiftShader screenshots are not real-GPU evidence. If hardware rendering is unavailable, report this review as pending instead of claiming it passed.

### Performance and stability

- Measure a five-second scripted scroll/page-turn sequence: share of frames over 16.7 ms and long tasks over 50 ms. Record environment and distinguish software-renderer diagnostics from real-device smoothness.
- Record the built lazy-vendor size and scene/poster costs. Check DPR/subdivision/post-processing caps per tier and verify that a downgrade actually removes the expensive work.
- Stability sequence: **20 Desk-to-course dives and back**, **20 workspace view changes**, **20 palette open/close cycles**, **10 complete/Undo cycles**, plus repeated week/theme changes. Counts of active rAF subscribers, ScrollTriggers, observers and listeners return to the same idle baseline; textures, render targets and other GPU resources do not grow monotonically.
- Multi-page navigation creates new documents: measure counts in each live/restored document and verify `pagehide`/`pageshow`/back-forward-cache cleanup, not just a meaningless process-wide total.

### Reporting limits and completion

- The previous environment reported Chromium only under `/opt/pw-browsers` and no WebKit. Reconfirm available tools during execution, but do not claim Safari/iPhone/iPad coverage from a narrow Chromium viewport.
- State plainly that **WebKit and real-device smoothness remain unverified** unless those exact checks have actually been performed. A real-GPU desktop screenshot alone does not verify phone GPU pacing or Safari interaction.
- Implementation reports separate files written, behaviors tested, screenshots reviewed and checks not performed. The documentation-only commit of this plan makes no build, test, performance or implementation-completion claim.

## 12. Revision 2 (12 October 2026) — One persistent world, no page reloads

**Decision (user-approved):** navigating between the Desk and the three courses must not reload the page. The site follows the Unseen Studio model (unseen.co; Awwwards Site of the Month, February 2023): the main pages exist as areas of one WebGL world, and moving between them is camera travel through that space rather than a page load. This revision supersedes the cross-document session handoff in Section 4 and the multi-page navigation assumptions in Sections 3, 7 and 10 where they conflict. Everything else stands.

### What stays

- Every route remains a real HTML document at a real URL (`/`, `/cen100/`, `/mth140/`, `/mth141/` under the deployment base). Direct loads, deep links, hashes, bookmarks, the legacy forwarder and no-JavaScript reading all keep working, and each document can still boot on its own.
- Course data, storage keys, saved progress, completion semantics, the deadline resolver, Skip to coursework, the no-loading-screen rule, reduced motion, Pause motion, tiers and the DOM-first accessibility rules are unchanged.
- No entry gate, loader or "Enter" screen: unlike Unseen's showcase, coursework is readable the moment any route opens.

### Architecture

- **Persistent shell.** The hub sidebar, dock, palette, sound service, Night Shift clock and **one** 3D stage (a single WebGL renderer and canvas) live in the shell and survive navigation. The Desk and each course book are scenes/areas inside that one world; the dive from Desk to book and the return are continuous camera moves in the same renderer, not a handoff between documents.
- **Router** (`assets/app/router.mjs`): intercepts same-origin primary clicks on links to the four routes (respecting modified clicks, `target`, downloads and external links), fetches the destination document (prefetched on hover/focus/idle and cached), swaps the route region and route-specific head assets (stylesheets added/removed without flashes of unstyled content), updates `document.title`, metadata and `body` data attributes, and uses `history.pushState`/`popstate` with scroll restoration. Focus moves to the new route's main heading or Skip target; a polite live region announces the route. Hash targets on the destination still open their item. Same-document View Transitions may crossfade DOM regions as progressive enhancement while the camera moves.
- **Route lifecycle.** Every route-specific module exposes `mount(root)` / `unmount()` and keeps no one-shot module-level state: `math-guide.mjs`, `math-labs.mjs`, `editorial.mjs`, `workspace.mjs`, `course-header.mjs`, `visuals.js`, `guide-motion.mjs` page hooks, the CEN100 guide script (moved from the inline script into an ES module with unchanged behaviour), and the Night Shift deadline/timeline/scroll layers. Unmount removes every listener, observer, timer, tween, ScrollTrigger and DOM node it created and resets globals (`CourseWorkspace`, `CourseVisuals`, `CEN_SCHEDULE`) so the next course binds cleanly. Services that belong to the shell initialise once.
- **Fallback.** If the router is unavailable, fails to fetch, or meets an unexpected document, it performs a normal full navigation. A failed scene keeps the DOM route working with posters.

### Verification additions

- Navigating Desk → each course → another course → back/forward never reloads the document (assert a shell-lifetime marker survives), lands on the right route, title, view and focus, and preserves saved state.
- Repeated route round trips (20×) keep listener/observer/ScrollTrigger/rAF/GPU resource counts flat; the previous route's handlers never fire after unmount.
- Direct loads of each route and no-JS reading still work; `tools/ui-build` workflows cover both direct loads and in-app navigation.

### Revised stage order

1. **Stage 1** (in progress): CEN100 at `/cen100/`, shared schedule, legacy forwarding, data-level resolver, Desk DOM directory.
2. **Stage 1b — Persistent shell and router:** route lifecycle refactor (mount/unmount everywhere, CEN guide as a module), router, prefetch, history/focus/scroll, shell-owned services, and the single stage host the books and Desk will render into. Merge to `main` when verified so the user can try reload-free switching.
3. **Stage 2 — MTH140 book** built inside the persistent stage, then the checkpoint above (live merge, user opens it, stop for approval).
4. Stages 3–7 as written, with Stage 5's dive and return implemented as in-world camera travel.

### Working agreements recorded 12 October

- The user reviews by opening the live site; do not send screenshots.
- Verified stages are merged directly to `main` (no pull request).
- Keep usage proportionate: verify what the plan requires, without exploratory capture loops.

