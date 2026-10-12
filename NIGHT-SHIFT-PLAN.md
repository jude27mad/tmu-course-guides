# TMU Course Guides — "Night Shift" (revised after review)

## Context
The user wants the course guide (`jude27mad/tmu-course-guides`: static GitHub Pages, native ES modules, no page build step) to feel like Active Theory, Locomotive and Bruno Simon. That means cinematic motion, big confident type, and a site that feels sophisticated on desktop (today it's "small on PC"). Heavier is acceptable, but it must not lag.

The settled screenshots show strong WebGL subject heroes over a flat, undersized editorial list. The page also starts with a 0.95 s entrance that is blurred by 7 px (`enterPage` in `assets/guide-motion.mjs`).

The user chose every upgrade:
- scroll-docking hero
- live countdown
- semester timeline
- dark glass content
- ⌘K palette
- faster intro
- hero HUD and kinetic title
- aurora and grain
- course-switch warp
- sound and haptics

**Auto theme stays**, so every effect needs a dark and a light variant.

Hard constraints:
- Course data, saved progress and storage keys are untouched.
- The `tools/ui-build` workflows keep passing.
- Reduced motion is respected.
- Coursework stays sharp and easy to read.

## Design direction
**The spectacle lives in the hero, the docking, the typography and course switches. Coursework stays calm.**

### Motion hierarchy (what leads, when)
| Visitor is… | Leads visually | Held back |
|---|---|---|
| Arriving | Subject art + kinetic title | Backdrop at rest, no marquee motion yet |
| Scrolling into coursework | Hero docking, section entrances, timeline draw-in | Cursor effects minimal |
| Reading an assessment | Stable text, quiet backdrop, brief interaction feedback | Marquee, pulses and backdrop drift slow to near-still |
| Switching course | The warp | Everything else |

Only one ambient "pulse" is visible at a time. The urgency glow takes priority over the Today beacon, which takes priority over the section dot. The marquee and backdrop slow down while the pointer is idle over content.

### Per-course visual vocabulary, echoing the existing scenes
- **CEN100, mechanisms:** gear-tooth tick marks on the timeline, an interlocking rotation on the warp edge, and a ratchet-step countdown ring.
- **MTH140, flow and tangency:** curved timeline track, flowing-curve warp edge, and a ring drawn as a smooth arc with a tangent marker.
- **MTH141, planes and transforms:** a grid or basis-vector motif in the backdrop, a planar shear warp, and a ring drawn as rotating basis segments.

### Composition
- **Desktop (≥1001 px):** content up to 1440 px wide.
  - A generous hero.
  - Directly under it, a dominant next-assessment card showing the countdown and the actual date and Toronto time.
  - A timeline that spans the content width.
  - Assessment rows on an aligned grid: big tabular date numerals, title, meta chips and the action on the right.
- **Reading width:** descriptive and body text capped at about 68ch, even inside the wider layout.
- **Typography:**
  - Condensed Archivo (`wdth` 75) for display titles and prominent labels only.
  - Instructions, dates and controls use normal width, 1rem or larger, at high contrast.
  - Page titles `clamp(2.6rem, 4.5vw, 5.5rem)`.
  - Row titles 1.25–1.5rem.
- **Dark:** graphite unified with the hero (`#0f1619`). Glass is reserved for a few surfaces (next card, dock, palette, sheets); rows use solid panels. Accent-tinted hairlines.
- **Light ("paper"):** warm off-white, the same layout, frosted white for those same few surfaces, ink accent. Tokens are redefined in the same selector pattern `editorial.css` uses, plus CEN's `--bg/--tile/--line`.
- The page must look excellent **with motion paused**. That is the first gate.

## Architecture
- **Optional vendor chunk, lazy-loaded:** a new `assets/vendor/night-vendor.mjs` built by a second esbuild entry in `tools/ui-build`.
  - It contains ScrollTrigger and SplitText (free in the installed `gsap@3.15.0`) and Lenis (new pinned dependency plus a license file).
  - These plugins take GSAP through `registerPlugin`, so the chunk registers them against the **single existing** `gsap` instance from `assets/vendor/gsap-3.15.0.mjs`. No second GSAP core.
  - The size is measured and reported after the build, not assumed.
- **New layer** `assets/night/`:
  - `core.mjs`: the shared controller.
  - `layout.css`: the composition and themes. It loads eagerly because it is static and carries no motion.
  - Lazily loaded feature modules: `scroll.mjs`, `deadline.mjs`, `timeline.mjs`, `palette.mjs`, `feel.mjs`, `backdrop.mjs`, `warp.mjs`, and `night.css` for motion and effects.
- **Rules in `core.mjs`:**
  - **One clock.** `gsap.ticker` drives Lenis (`autoRaf: false`, `lenis.raf` subscribed) and the backdrop. The backdrop caps its own frame rate inside its callback; the global ticker is never throttled. The existing Three hero keeps its own scheduler (`course-scene.mjs`), coordinated only through the hold API below.
  - **Services vs view effects.** The palette, sound, haptics, clock, deadline resolver and backdrop initialise **once**. View-bound effects (reveals, SplitText wrappers, ScrollTriggers, observers, timers) register through `core.track(view, disposer)` and are disposed on `workspace-changed` before rebinding.
  - **Temporary holds vs saved preference.** `core.hold(reason)` and `core.release(reason)` keep an in-memory set that pauses the hero, backdrop and marquee while the palette or a sheet is open. They never call `setScenePaused`, which writes storage, so a manual pause survives.
  - **Reduced motion precedence:**
    - The OS reduce setting wins over a *saved* "full" preference. `guide-motion.mjs` will stop persisting `motion=full` across visits.
    - An explicit `?motion=full` URL applies to that page view only, for testing.
    - `?motion=off` always wins.
  - **Never hide visible content.** Late-loading modules may enhance content that is already visible, but must not set it back to hidden or replay its entrance. Reveals apply only to elements still below the viewport when the module mounts.
- **One "open item" routine** (`core.openItem(id)`), shared by the palette and the timeline:
  1. Switch to the right view (`CourseWorkspace.show`).
  2. Clear the hide-completed filter and turn on show-past if the item is hidden.
  3. Wait for render, then for the existing reveal to settle, using `requestAnimationFrame` ×2 and `GuideMotion.cancel`.
  4. Open the existing tile, sheet or assessment, unless it's already open.
  5. Move focus into the opened content.

## Features
1. **Faster intro (`guide-motion.mjs`).** Content is visible and sharp from the first frame. `enterPage` becomes a 0.35 s opacity 0.85→1 and y 12→0 with no blur and no rotateY. No full-screen cover and no loading counter on normal loads. The only branded flourish is the title's SplitText rise and the art fading in. Update `tools/ui-build/test.cjs:29` to match.
2. **Hero → dock (`scroll.mjs`).**
   - ScrollTrigger scrubs `--hero-p` over the hero: the title lifts behind a line mask and the art scales to about 0.7 and recedes.
   - At about 70 %, a sticky **dock** slides in with course mark, code and title, the countdown chip, the section pill, ⌘K and **Pause motion**.
   - A 2 px accent progress bar runs at the top.
   - Lenis runs only on fine-pointer devices; touch keeps native scroll. Lenis stops while dialogs are open.
3. **Countdown, card, dock and HUD (`deadline.mjs`).** One resolver produces a single target object that all three surfaces read. It is computed in America/Toronto.

   | Information available | Shown |
   |---|---|
   | Confirmed date + time | Countdown + "Fri Oct 23 · 6:30 PM Toronto" |
   | Quiz week + saved section | Countdown labelled "Your lab quiz starts" + lab day/time/room |
   | Quiz week, no section | Week range + "Choose your section for your quiz time" (button). No timer |
   | Date, no time | Date + "Time not posted". Day-level countdown ("in 2 days"), no clock digits |
   | Date pending | "Date pending" |

   - The actual deadline text is always visible beside the timer.
   - The 23:59 fallback is used only for internal sorting and is never displayed as a deadline time.
   - **At zero:** "Happening now" for windows with an end time, otherwise "Due time passed". The resolver advances to the next item 2 h after.
   - **On completion:** the resolver re-runs; Undo restores the previous target.
   - **On `visibilitychange` or `pageshow`:** recompute from the clock, never from accumulated ticks.
   - The ticker digits are `aria-hidden`. A polite live region updates once a minute.
   - Urgency glow under 48 h; a stronger state under 6 h.
   - **Hero HUD:** a small line under the title reading `NEXT · Lab Quiz 2 · <state>`. "Drag to explore" stays until the visitor actually drags the art (pointer drag or arrow key on `.header-art`). After that the hint fades out and is remembered for the session.
4. **Timeline (`timeline.mjs`).**
   - Covers Sep 8 → Dec 21, with week ticks, an elapsed fill and a Today beacon.
   - Nodes come from the data (CEN `SCHEDULE` exposed as `window.CEN_SCHEDULE` in `index.html`; math `COURSES[course].assessments`). Completed items are dimmed with a check.
   - Nodes are real buttons with tooltips, and clicking one calls `core.openItem`.
   - The track draws in once.
   - On phones it uses horizontal scroll-snap, centred on today.
5. **⌘K palette (`palette.mjs`).**
   - Opened by ⌘K/Ctrl+K, the visible Search button and the dock button. There is **no** bare-character shortcut.
   - Indexes assessments (opened via `openItem`), views, courses, math topics and actions: This week's work, Contacts, Guide tools, Export calendar, Theme, **Pause motion**, Sound, D2L.
   - Fuzzy, grouped results with ↑/↓/Enter/Esc.
   - The final row hands the query to the existing `#guide-search`.
   - It's a modal `<dialog>` with focus return, and it calls `core.hold('palette')` while open.
6. **Pause motion.** One control in the dock, the hero and the palette pauses everything that moves or updates on its own: hero scene, backdrop, marquee, pulses and countdown animation (digits then update per minute without animating). It's built on the existing `setScenePaused` preference, extended so the night layer obeys it too.
7. **Feel (`feel.mjs`), fine pointer only where relevant.**
   - Custom cursor (dot + ring, labels "Open", "Drag"), never shown over form fields.
   - Magnetic primary buttons (≤ 6 px).
   - Spotlight on glass surfaces.
   - **Mark done:** the row drops with a short gravity and bounce through the existing Flip reflow, plus a particle burst in course colours. Undo reverses it.
   - **Sound:** opt-in, stored in the new key `tmu-guide-sound-v1`; synthesised WebAudio ticks, pop, chime and whoosh.
   - **Haptics:** `navigator.vibrate` on Mark done and course switch.
8. **Marquee + reveals.** A velocity-reactive outlined course marquee between the hero and the content, slowed by the hierarchy rules. SplitText line reveals on section titles, and a batched stagger for rows. Rows skew ≤ 2° with scroll velocity on the high tier only.
9. **Backdrop (`backdrop.mjs`).**
   - A raw-WebGL2 single-quad noise field in the course accent, reacting to the cursor and scroll velocity, plus SVG grain and a CSS aurora.
   - The rendered pixel count is capped at about 0.6 MP. It renders at 30 fps on mid tier and is replaced by the static CSS aurora on low tier.
   - It stops while the tab is hidden, under hold, when paused, and while the hero is the only thing in view (the hero already provides the motion there).
10. **Warp (`warp.mjs`).**
    - Clicking a course link plays a 450 ms full-screen shader wipe from the click point. The colour is the new course's accent and the edge uses that course's vocabulary.
    - It sets a `sessionStorage` flag; the arriving page starts covered and wipes away in 400 ms.
    - Normal loads never show a cover.
    - Reduced motion: a 150 ms fade.

## Performance and tiers
- **Profile early.** Build one representative screen with the hero, backdrop, glass, grain and cursor before polishing anything else. Use the measurements to decide:
  - which surfaces keep live `backdrop-filter`
  - the backdrop pixel cap
  - what each tier removes
  - when the hero and backdrop stop
- **Tier hints:** `hardwareConcurrency`, touch/coarse pointer, and a 2 s frame-time probe. `deviceMemory` is used only when present; a missing value is not treated as weak hardware. A runtime watchdog downgrades a tier after sustained slow frames.
- Animate only `transform`, `opacity` and `clip-path`. ScrollTrigger batches its layout reads.

## Critical files
- **New:**
  - `assets/night/*`
  - `assets/vendor/night-vendor.mjs`
  - `assets/vendor/LENIS-LICENSE.md`
  - `tools/ui-build/night-entry.mjs`
- **Edit:**
  - `tools/ui-build/{build.mjs,package.json,package-lock.json}`
  - `assets/guide-motion.mjs` (intro timings, reduced-motion precedence, scene-pause hook)
  - `index.html` (expose `CEN_SCHEDULE`, tags, release notes)
  - `mth140/index.html`, `mth141/index.html` (tags, notes)
  - `tools/ui-build/test.cjs`
  - `README.md`, `docs/visual-overhaul.md`
- **Reuse:**
  - from `guide-motion.mjs`: `motionAllowed`, `setScenePaused`, `preference`, `capture`, `reflow`, `cancel`
  - from `workspace.mjs`: `CourseWorkspace.show/refresh`
  - from `course-data.mjs`: `COURSES`
  - events: `workspace-changed`, `guide-completion`, `guide-motion-change`

## Build order
1. Record the baseline: settled screenshots, test results, and the initial blur timing. Fix the intro.
2. **Composition checkpoint (no new motion):**
   - desktop hero plus the first coursework
   - docked state (static)
   - populated assessment list
   - dark and light
   - phone

   Send the screenshots to the user.
3. Build one complete course (MTH140) with `core`, the vendor chunk, dock, countdown resolver, timeline, palette and Pause motion.
4. Profile hero + backdrop + glass + cursor, then set the tiers.
5. Add the remaining polish (feel, marquee, warp, sound) and carry everything to CEN100 and MTH141. Then run the full verification matrix.

## Verification
1. `npm ci && npm run build && npm test` in `tools/ui-build`. All six course × motion workflows must pass.
2. `node --test tests/*.test.mjs tests/scene-*.cjs`. Tests 32–37, 47 and 48 already fail on `main`; confirm nothing new fails.
3. **Settled screenshots** with Playwright, Chromium and SwiftShader. Capture only after fonts are ready and the wrapper has no leftover transform, filter or opacity, plus 1.5 s. Matrix: 3 courses × {1440, 1024, 390} × {dark, light} × {top, docked, timeline}. Check for no horizontal overflow and no console errors. Motion frames are captured separately and labelled as such.
4. **Clock and state are frozen** (`page.clock.install` at fixed dates; seeded sections and completions):
   - CEN integrity quiz → 2026-10-14 15:00 Toronto
   - MTH140 midterm → 2026-10-23 18:30
   - quiz week with no section → shows "Choose your section", no timer
   - Undo restores the previous target
   - background/resume recomputes the countdown
5. **Behaviour:**
   - ⌘K → "midterm" → Enter opens and focuses the midterm, including when it's filtered out or in another view
   - timeline node → same
   - Pause motion stops every loop
   - the palette's temporary hold leaves the saved pause untouched
   - `?motion=off` and the OS reduced-motion setting override a saved "full" preference
6. **Performance:**
   - frame pacing during a 5 s scripted scroll (share of frames over 16.7 ms, plus long tasks over 50 ms)
   - a stability loop: switch views ×20, open and close the palette ×20, complete and undo ×10, while asserting that the counts of active rAF loops, ScrollTriggers, observers and listeners stay flat
   - vendor chunk size reported
7. **Limits.** WebKit isn't installed in this container (only Chromium under `/opt/pw-browsers`), so Safari, iPhone and iPad behaviour and real-GPU smoothness stay unverified. This will be stated plainly in the final report.
8. Commit to a feature branch and push. No PR unless asked.
