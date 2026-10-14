# MTH140 book: art direction (Phase 2)

The owner opened the live book and called it "very low quality": blurry, plain, choppy and broken in places. Phase 1 fixes sharpness, stutter and layout. This document sets the look for Phase 2. It overrides the visual values in `semester-book-spec.md` §5.1–5.7 where they differ. Behaviour, data, accessibility, motion policy and lifecycle rules stay as the spec says.

## The picture we are making

**A late-night study desk, shot like a macro product photo.** One warm desk lamp throws a pool of light onto a real open notebook. Everything outside the pool falls into deep teal-black. The book is the hero object: tactile, heavy, slightly worn, with real paper.

In light theme, the same desk is in soft morning daylight through a window, which throws a faint window-frame shadow across the desk.

What makes it read as premium, in priority order:

1. **Light with contrast.** A clear pool of light, soft shadows from every object on every tier, and darkness at the edges. Today it is evenly lit and flat.
2. **Pages that are not flat.** Real open books arch: each page rises out of the gutter and rolls gently down towards the fore-edge. Today they are flat planes.
3. **Materials with texture.** Paper fibre, cloth-bound boards with lit bevelled edges, a wood desk with a felt or leather blotter.
4. **A camera that feels like a lens.** Closer, slightly lower and longer, so the book is bigger and the perspective richer.
5. **Pop-ups made of card.** Thick coloured card stock with printed faces and real shadows, not blank white strips.
6. **Pages worth reading.** Larger type, a hand-drawn calculus sketch per week, a highlighter swipe on today, and a sticky-note callout for the next assessment.
7. **A few props for scale and life.** A pencil lying beside the book and a small stack of sticky notes, both casting shadows. Nothing else.

## Targets

### Camera and composition (`book-geometry.mjs` OPEN_HERO, `book-scene.mjs`)
- Desktop (≥ 1001 px): fov 20–22, elevation 36–40°, azimuth 8–10°. The spread fills about 70% of the stage width on the right; the whole spread stays visible. Loosen the safe rectangle accordingly. The hero copy on the left must stay clear.
- Tablet: fov 22–24, elevation 42–46°.
- Phone: fov 26–28, elevation 48–52°. The spread fills the full stage width minus 12 px per side.
- Keep the arrival, drift and handoff behaviour; re-tune their numbers to the new framing so the dock handoff still lands in the dock dot.

### Light, shadow and tone (`book-scene.mjs`, `course-styles.mjs`, `stage.mjs`)
- Shadows on **high and mid** tiers: one shadow-casting key light, PCF soft, map 2048 (high) / 1024 (mid). The book, pop-ups, turning sheets, pencil and notes cast; pages, desk and blotter receive. Keep the analytic contact shadow under the book as well (it anchors the book on low-res shadow maps).
- Dark theme (lamp): key spot about 0.55 m up-left of the book, angle ≈ 20°, penumbra ≈ 0.9, physical decay. Tune intensity so the paper's centre reads at about 85% brightness while the desk corners fall to near black. Fill ≤ 0.2, environment ≈ 0.06. The rim is a cool teal from behind-right, picking out the page edges and board bevels.
- Light theme (window): a distant soft key from up-left with a projected window-frame pattern (`SpotLight.map`, a procedural canvas of two mullions and soft edges, very low contrast, about 15%). Fill ≈ 0.6, environment ≈ 0.35. No harsh blacks.
- Tone: Neutral tone mapping. Dark exposure ≈ 1.0. Subtle warm grade in the lamp pool. Keep CSS grain and vignette; strengthen the vignette in dark theme.

### Pages (`page-bend.mjs`, `book-geometry.mjs`, new `page-rest.mjs`)
- Rest profile: `restLift(x)` in `assets/book/page-rest.mjs` (x = metres from the spine, 0…W). The page dives into the gutter with z ≈ 0 at x = 0, rises with a smooth ease to a peak of about 5–7 mm near x ≈ 0.22 W, then falls gently to about 1.5 mm at the fore-edge. C¹-continuous, finite, and identical for both pages (mirrored).
- Static pages and the page block top follow it, with enough segments to look smooth (high 48, mid 24 across x).
- Turning sheets start and end exactly on the rest profile, so a turn has no pop at either end. Blend the lift by how flat the sheet is (full lift at t = 0 and 1, none at mid-turn). Positions, normals and bounds stay finite for t in [0, 1].
- Pop-up feet sit on the curved surface. Picking and `faceUV` follow it.
- Paper: a fine fibre normal map (procedural, tiling, ≤ 512 px) at low strength; slight warm brightening near page edges (cheap fake translucency). Gutter ambient occlusion stays, tuned to the deeper valley.

### Book object (`book-geometry.mjs`)
- Boards: cloth texture visible in the lit areas; bevelled edges catch the rim light.
- Page block: visible stacked page lines on the fore-edge and tail, slightly uneven.
- Ribbon: lies in the gutter from the head and hangs out of the tail. It must never pass over a pop-up: route it under the pop-up feet.

### Desk and props (new `assets/book/props.mjs`)
- Desk: a large plane with a procedural wood texture (dark walnut in dark theme, pale oak in light), fine grain, roughness about 0.6, filling the whole stage. On top sits a blotter: dark green felt or leather, slightly larger than the open book, with a stitched edge. The current blotter colour values are the starting point.
- Pencil: a hexagonal pencil with a sharpened cone tip and a metal ferrule plus eraser, about 17 cm long. It lies at about 20° to the book's fore-edge, below and right of the right page. Painted in the course accent colour.
- Sticky notes: a small square stack (7.6 cm) in a warm yellow, at about −8°, upper-left of the left page, partly in shadow. Its top note carries the next assessment's short title and date (from the same view data as the pages).
- Props are static, low-poly and share materials. They are not interactive and are excluded from picking. They obey theme changes.
- On phones, props stay outside the spread's bounds or are dropped where they would crowd it.

### Pop-ups (`popup.mjs`, label atlas in `textures.mjs`)
- Card stock 0.4 mm thick with a visible edge. Colours by kind: midterm in warm terracotta, quiz in the course green, final in deep ink blue, minor items in cream. Completed items keep the desaturated, stamped state.
- Each arch carries a printed face: a fine line pattern or a small calculus motif, not blank paper.
- The label tag is larger: the title is readable at desktop rest without zooming. Typography is Archivo, tabular dates.
- Real cast shadows onto the page, on high and mid.

### Page design (`textures.mjs`)
- Minimum text size at rest pose: 7 device px for secondary text and 11 device px for titles.
- Per week, a hand-drawn calculus sketch in pencil (limit asymptote, tangent line, area under a curve and so on), chosen by the week's topic, never covering text.
- Today's date gets a translucent highlighter swipe in the accent colour.
- The next assessment gets a small taped sticky-note callout on the right page.
- Keep all wording from `describeSpread()`; no new copy that contradicts the DOM.

## Budgets
- Mid tier (phones): ≤ 30 draw calls at rest, 1 shadow map at 1024, textures ≤ 64 MB, 60 fps target on a recent iPhone. High tier: ≤ 40 draw calls at rest.
- No change to the poster/low path except new posters regenerated from the renderer at the end.
- No new runtime dependencies. Fonts stay local.

## Verification
Every agent captures before/after crops at 1440×900 (DPR 2) and 390×844 (DPR 3) in both themes, at rest and mid-turn, and records draw calls, triangles and texture memory from `controller.stats()`.
