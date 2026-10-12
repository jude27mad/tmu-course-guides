# Task E — Semester weeks and page-bend math (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** create `codex/ns-weeks-bend-math` from the latest `night-shift`. Read `docs/codex/README.md` (shared rules) and `NIGHT-SHIFT-PLAN.md` Sections 5, 6 and 11 ("Geometry, weeks and event correctness") first.

This is pure logic with tests. No rendering, no CSS, no visual decisions. Claude builds the 3D book on top of these modules.

## 1. `assets/book/weeks.mjs` — the single semester week model

Pure functions, no DOM, no storage, explicit `now` parameters. Reuse `assets/schedule.mjs` helpers (`today`, `addDays`, `dateLabel`, `dayLabel`, `resolveAssessment`, `timestamp`); do not add a second calendar implementation.

- `semesterWeeks({start='2026-09-08', end='2026-12-21', records=[]})` → array of spreads: `{index, label, start, end, partial, kind:'teaching'|'reading'|'exam', records:[…]}`.
  - Weeks are **Monday-anchored** to match the existing quiz-week anchors (`assessment.week` values in `assets/course-data.mjs` are Mondays). The first spread (Tue 8 Sep–Sun 13 Sep) is `partial:true` and labelled honestly (e.g. "Week 1 · from Tue Sep 8"). Do not shift any existing quiz dates.
  - Extend the range when a dated record falls after `end` (exam period) instead of dropping it. Undated finals go in a final `kind:'exam'` spread with `pending:true` and are never given a fabricated date.
  - Use the real calendar for the reading week if the data identifies it; otherwise keep `kind:'teaching'` (do not invent one). Document what you found.
- `weekIndexFor(date, weeks)` — Toronto calendar date (`YYYY-MM-DD`) → spread index; before the term → 0, after → last; never an invalid index.
- `currentWeekIndex(weeks, now=new Date())` — uses Toronto `today(now)`.
- `recordsForCourse(course, {courseData, cenSchedule, section, completed})` → normalised records `{id, open, title, kind:'final'|'midterm'|'quiz'|'lab'|'minor', date|null, week|null, time|null, precision, weight|null, completed}` for `mth140`/`mth141` (from `COURSES[course]` + `resolveAssessment` with the saved section) and `cen100` (from `assets/cen-schedule.mjs` `SCHEDULE`, respecting `calendar:false` and the existing item mappings — read `cen100/index.html` and `assets/night/targets.mjs` to classify kinds; keep schedule ids distinct from item handles in `open`).
- `popupRank(record)` → sortable size rank: **final > midterm > quiz or lab > minor**, with the record's real weight (if present) as a secondary cue inside a category. Never alter displayed weights.
- `findWeek(query, weeks)` → index for palette queries like `week 9`, `wk 9`, `w9`, `week of oct 13`, `oct 13`; `null` when no match.

## 2. `assets/book/page-bend-math.mjs` — endpoint-safe cylindrical page curl (CPU reference)

The GPU shader will mirror these exact formulas; the CPU version exists for tests, picking and bounds.

- `bendPoint(x, y, {turn, radius, width})` → `{position:[x,y,z], normal:[x,y,z]}` for a point on a flat page (`x` from the spine at 0 to the outer edge at `width`, `y` along the spine) curled around an axis parallel to the spine, driven by `turn ∈ [0,1]` (0 = page lying on the right, 1 = fully turned onto the left) and curl `radius`.
- Requirements: finite positions and unit normals for every `turn` in [0,1] including exactly 0, 1 and values within 1e-6 of both ends, for all supported radii (clamp radius to `[minRadius, width/π]`, `minRadius > 0`); continuous in `turn`; the page keeps its length (arc length preserved within 1e-3 · width); at `turn=0` the page is flat at `z=0` on the right; at `turn=1` it is flat on the left (mirrored), no NaN/Infinity, no self-intersection through the page block (z ≥ 0 within tolerance).
- `bendBounds({turn, radius, width, height})` → axis-aligned bounds (for frustum culling and hit testing).
- `bendHit(rayOrigin, rayDir, params, {segments})` → nearest hit `{x, y, distance}` in flat-page coordinates, or `null`, using a subdivided-curve intersection that matches what the shader renders (so clicks land where the page visibly is).
- Export the constants and a short GLSL ES 3.00 string `PAGE_BEND_GLSL` implementing the same function (`vec3 bendPosition(vec3 p, float turn, float radius, float width)` and the matching normal) for Claude's shader. Keep it in sync with the JS by testing a table of sampled values against a JS port of the GLSL (straight transliteration in the test).

## 3. Tests (`tests/weeks.test.mjs`, `tests/page-bend.test.mjs`, `node --test`)

- Weeks: partial first week, Monday anchors match every `week` in `course-data.mjs`, Toronto/UTC boundary cases (e.g. `2026-10-13T03:30:00Z` is still Oct 12 in Toronto), before/after term clamping, exam spread extension, undated final stays pending, `findWeek` queries, `popupRank` ordering, CEN `calendar:false` exclusion, completed flags from the same shapes the guides store (see `docs/qa/night-shift/inventory.md`).
- Bend: finiteness sweep (turn 0…1 in 1/1000 steps plus ±1e-6 at both ends, radii from min to max), arc-length preservation, continuity, flat at both ends, normals unit length, bounds contain all sampled points, `bendHit` agrees with sampled geometry, GLSL transliteration matches JS.

Run `node --test tests/*.test.mjs` and `tools/ui-build` `npm test`. Report results and any pre-existing failures by name.
