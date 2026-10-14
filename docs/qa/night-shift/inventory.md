# Night Shift Stage 0 — route, storage and deadline inventory

Read-only inventory of `night-shift` at `406c4a4` (merge of `origin/main` after plan commit `a4ba395`). No product files were changed. Line numbers refer to that head.

## 1. Storage

No storage key, namespace or key constructor uses `location.pathname`, `location.href` or the route. All keys are literals or derive from a course id (`document.body.dataset.course` or a fixed list). Moving CEN from `/` to `/cen100/` on the same origin changes no key **as long as `cen100/index.html` keeps `<body data-course="cen100">`**.

### localStorage

| Key | Format | Written by | Read by | Notes |
|---|---|---|---|---|
| `cen100-g9-ticks` | JSON `{"<itemId>-<groupIdx>-<checkIdx>": 1}` | `index.html:738` (tick change 875, Clear my ticks 876, backup import 1121) | `index.html:737` | Checklist ticks only. Separate from completion records. |
| `cen100-contact-choice-v1` | JSON `{section:Number, group:Number\|null}` or `null` | `index.html:961` `rememberProfile` | `index.html:964`; `assets/hub.js:11` (`.section`, valid 1–39) | **Written on load** when a saved profile exists: restore dispatches `change` (966–967), which rewrites the normalized value (briefly `{section, group:null}`, then with group). `validProfile` (941–947): section must be in `STAFFING` (1–39); invalid group → `null`. |
| `cen100-hide-completed-v1` | JSON boolean | `index.html:1005, 1031, 1187` | `index.html:1004` | Hides tiles whose checklist boxes are **all ticked** (ticks, not completion records). |
| `cen100-personal-plan-v1` | JSON `{completed:{<scheduleId>\|"item:<itemId>": 1}, notes:{<itemId>: string≤2000}, targets:{<itemId>: "YYYY-MM-DD"}}` | `index.html:1169` (`setCompletion`), 1121, 1222, 1223 | `index.html:1153` via `cleanPlan` (1132–1152) | **CEN completion records.** `cleanPlan` keeps only keys in `completionKeys` (1130) with value `1`/`true` (stored as `1`). `completionKeys` = every `SCHEDULE` id with `calendar!==false`, plus `item:y7`, `item:y9` (items with no schedule rows, `recordsFor` 1129). `failure-lab`/`showcase-signup` are never completion keys. |
| `cen100-last-seen-update-v1` | JSON string (`"2026-10-12-subject-privacy"`, 1128) | `index.html:1294` | `index.html:1293` | Unread-update badge. |
| `<course>-progress-v1` (`mth140`, `mth141`) | JSON `{checks:{"<assessmentId>-<i>":true}, completed:{<assessmentId>:true}, notes:{<assessmentId>:string≤2000}, targets:{<assessmentId>:date}, topics:{"<topicId>-<i>":true}}` | `assets/math-guide.mjs:23` `save()` | `math-guide.mjs:22` via `cleanProgress` (13–20) | **Math completion** = `completed[assessmentId]` (true/1 accepted, written as `true`) set by `[data-completed]` checkbox or Mark done (`setCompleted` 55). `checks` = prep checklist, `topics` = skill review; both separate from completion. |
| `<course>-section-v1` | JSON number (0 when none) | `math-guide.mjs:125` | `math-guide.mjs:10` (reset to 0 if not a lab section); `assets/night/deadline.mjs:12`; `assets/hub.js:11` (valid 1–34) | |
| `<course>-view-v1` | JSON string `assessments`\|`topics`\|`help` | `math-guide.mjs:100` `showTab(remember)` | `math-guide.mjs:121` | **Written on every math load**: `workspace.mjs` `show()` (164) clicks `#tab-…`, whose handler calls `showTab(view)` with `remember=true`. |
| `<course>-last-seen-update-v1` | JSON string (`"2026-10-12-assessments2"`) | `math-guide.mjs:124` | `math-guide.mjs:123` | |
| `tmu-guide-theme-v1` | **raw string** `auto`\|`light`\|`dark` (not JSON) | `assets/hub.js:10` | `assets/hub.js:7` | `core.read()` would `JSON.parse` it and fall back; read raw. |
| `guide-motion-paused` | **raw string** `true`\|`false` | `assets/guide-motion.mjs:10` `setScenePaused` | `guide-motion.mjs:5`; cross-tab `storage` listener (102) | |
| `guide-motion-level` | legacy | removed on every load, `guide-motion.mjs:5` | — | Write on load (cleanup). |
| `tmu-guide-sound-v1` | JSON boolean | `assets/night/core.mjs:152` | `core.mjs:150` | Opt-in sound. |

### sessionStorage

| Key | Format | Writer | Reader |
|---|---|---|---|
| `night-warp` | JSON `{t, color, …}` | **none** (`assets/night/warp.mjs` does not exist) | inline head script `index.html:9`, `mth140/index.html:9`, `mth141/index.html:9` (read + remove; adds `html.ns-warp-in`, fail-safe in `layout.css:19–22`). Dormant. |
| `night-dragged` | `'1'` | `assets/night/hero.mjs:146` | `hero.mjs:135` |
| `tmu-book-hint-v1` | `'1'` | `assets/course-header.mjs` (first drag or swipe page turn) | `course-header.mjs` mountBook (adds `ns-explored`) |

### Not real storage

- `colour-preview.html` runs its guide copy against an in-memory shim (`1132–1140`, passed as `localStorage` at 420). It never reads or writes the real keys above.
- Backup files (not storage): CEN `{format:"cen100-guide-backup", version:2, exportedAt, ticks, personal}` (`index.html:1104`, import accepts v1/v2); math `{format:"tmu-math-guide", version:1, course, progress}` (`math-guide.mjs:136`).

### Course inference that a Desk page would inherit

These default to CEN when `data-course` is missing: `core.mjs:19` (`course=…||'cen100'`, so `META`, `isMath`, deadline and timeline use CEN), `hub.js:2` (`aria-current` on the CEN link), `workspace.mjs:3–4` and `editorial.mjs:2–3` (non-math path). `visuals.js:23` throws if none of `.cen-next-layout`, `#board`, `#quick-confirm` and `.quick-find` exist. `boot.mjs` waits up to 8 s (`whenWorkspace`, `core.mjs:89–95`) for a course workspace. A Desk needs explicit Desk mode and should not load `visuals.js`, `workspace.mjs`, `editorial.mjs` or `course-header.mjs` unchanged.

Other cross-tab listeners: `hub.js:12` refreshes profile labels on `storage`. `guide-motion.mjs:102` syncs pause. No guide re-renders on a cross-tab progress, section or plan change.

## 2. CEN routes, hashes and query keys

### Query keys

The root CEN guide reads **no** query key. Git history of `index.html` since the repo's first commit (2026-09-27) has no `location.search` or `URLSearchParams`. Copy-link removes the query (`url.search=""`, 1201). Query keys read on the CEN page come only from shared modules:

| Key | Reader | Values | Course-specific? |
|---|---|---|---|
| `motion` | `guide-motion.mjs:6–7` | `full` (page-local, not persisted), `off` (forced) | No, generic |
| `tier` | `core.mjs:104` | `high`\|`mid`\|`low` | No, generic diagnostic |
| `v` | none (cache-buster in `tests/editorial/index.html:6`, `tests/studio-preview.html:4`) | any | No |
| `background`, `accent` | `colour-preview.html:1156–1171` only | | Colour-preview path only |
| `course`, `width` | `tests/scene-capture.html:7`, `tests/header-preview.html:9` | | Test harness only |

`theme` is not read from the URL anywhere.

### Hashes read on the CEN page

| Hash | Handler | Effect |
|---|---|---|
| `#assignment-<id>` matching `^#assignment-([a-z]\d+)$` with a known id | `index.html:1193` `readAssignmentLink` (on load 1298 and `hashchange` 1226) → `openAssignment` (1184) | Opens the item. Known ids: Team `m1 m2 m3 m4 y6 m5 m6 m7`, Individual `y1 y2 y3 y4 y5 y7 y8 m8 y9`. |
| `#assignments` or no hash | `workspace.mjs:229` `route()` | Assignments view |
| `#course-info`, `#guide-tools`, `#workspace-timeline` | `workspace.mjs:227` | Course info view |
| `#guide-search` | `workspace.mjs:228` | Opens search |
| `#math-tools` | `workspace.mjs:227` | Course info (math id; also matches on CEN) |
| `#study`, `#math-lab`, `#topic-*` | `workspace.mjs:226` | `show('study')`, but CEN has no Study panel → Assignments |
| `#assessment-*` | `workspace.mjs:229` | Assignments (math id) |

### Hashes and links the CEN page generates

- `#assignment-<itemId>`: next card and board links (808, 812); **Copy assignment link** builds `location.href` without its query plus this hash (1201).
- `#assignments`, `#course-info`: workspace nav hrefs (`workspace.mjs:33`) and `history.pushState` (167).
- `#course-main`: skip link (`workspace.mjs:21,26`; `.wrap` has no id).
- `#nextsign`, `#board`: editorial hero links (`editorial.mjs:14`). `workspace.mjs:41` removes them after mount, but they could be in older bookmarks.
- `#top`: dock id link (`deadline.mjs:179`). Its default is prevented, so it never reaches the URL.
- CEN DOM ids that native fragment navigation would scroll to but nothing generates: `#t-team #t-you #t-rules #p-team #p-you #p-rules #guide-item-<id> #contactlookup #profile-picker #calendar-tools #course-grading #work-tools #backup-tools #guide-updates #circuit-head`.

### Item and record ids (keep distinct)

- Item handles (`TEAM`/`YOU` ids above) are used in `#assignment-`, `guide-item-`, `b-`, `personal-`, `note-`, `target-`, `completion-` and `recorded-` DOM ids, in `course-open-item` detail (CEN) and timeline `target`.
- Schedule ids (24, `index.html:708–733`): `intro entry syllabus email contract outline matlab-1 whmis integrity failure reflection-1 review notebook-1 matlab-2 prototype presentation-1 presentation-2 notebook-2 reflection-2 exit peer report failure-lab showcase-signup`. These are completion keys and ICS UIDs.
- Math: assessment ids (`quiz-1…`, `midterm`, `final`). DOM/route id = `assessment-<id>`; topics `topic-<id>`.

### Proposed forwarding ALLOWLIST (root → `cen100/`)

Forward once, at load, before first paint, with `location.replace`. Carry the **entire** `location.search` and `location.hash` unchanged. Do not re-run on `hashchange`.

Hash patterns (match the raw, case-sensitive `location.hash`):

1. `^#assignment-[a-z]\d+$`. This uses the same regex as the guide, so unknown ids still land on CEN.
2. `^#(assignments|course-info|guide-tools|guide-search|workspace-timeline)$`
3. `^#(nextsign|board|course-main)$`
4. `^#(t|p)-(team|you|rules)$` and `^#guide-item-[a-z]\d+$` (CEN-only DOM ids)

Query keys that trigger forwarding on their own: **none**. No CEN-specific query key exists.

Must NOT forward (stay on the Desk): no hash; `#`; `#top`; math ids `#study`, `#math-lab`, `#math-tools`, `#math-main`, `#topic-*`, `#assessment-*`; and any URL whose only distinguishing part is a query: `motion`, `tier`, `v`, `theme`, `background`, `accent`, `course`, `width`, `utm_*` or anything else.

Constraints for implementers:

- Desk element ids must not collide with any allowlisted hash. In particular, do not give the Desk's skip-link target the id `course-main`.
- Compute the destination relative to the Desk document: `new URL('cen100/', document.baseURI)` plus search and hash. This gives `/tmu-course-guides/cen100/` on Pages and `/cen100/` on the local preview. Never use origin-root `/cen100/` or a destination supplied in the query.
- `cen100/index.html` must not include the forwarder (no loop).
- Always link with the trailing slash. GitHub Pages redirects `/cen100` to `/cen100/`. `tools/preview-server.mjs` instead serves `cen100/index.html` at `/cen100` without redirecting, so relative assets would break there.
- Legacy forwarder (`jude27mad/cen100-guide`, not inspected in this stage): the README (line 23) says it keeps paths, queries and assignment hashes. When its destination becomes `/tmu-course-guides/cen100/`, root-level paths it may forward (`colour-preview.html`, `privacy.html`) must still map to the site root, not under `cen100/`.

## 3. Route-dependent logic and relative URLs

### `index.html`: changes if moved to `cen100/index.html`

| Line | Reference | Action needed |
|---|---|---|
| 6 | `assets/fonts/archivo.css?…` | `../assets/…` |
| 12–13 | `assets/hub.css`, `assets/visuals.css?…` | `../` |
| 277–280 | `editorial.css`, `workspace.css`, `course-header.css`, `guide-motion.css` | `../` |
| 282–285 | modules `editorial.mjs`, `workspace.mjs`, `course-header.mjs`, `night/boot.mjs` | `../` |
| 286 | `assets/night/layout.css` | `../` |
| 489 | `mth140/`, `mth141/` (What's changed text) | `../mth140/`, `../mth141/` |
| 525 | `privacy.html` | `../privacy.html` |
| 1306–1307 | `assets/hub.js`, `assets/visuals.js` | `../` |
| 9 | inline `night-warp` reader | Comment only, no URL |
| 10–11 | `<title>CEN100 \| …>` (also rewritten at 955); meta description describes all three courses | Site-level description belongs to the Desk; CEN gets a CEN one |
| 1053 | ICS `URL:https://jude27mad.github.io/tmu-course-guides/` (absolute) | Point to `…/tmu-course-guides/cen100/` |
| 1050 | ICS `UID:cen100-f26-<scheduleId>-jude27mad-github-io` | **Keep unchanged** (calendar dedupe); path-independent |
| 1073, 1105 | download names `cen100-<id\|deadlines>-2026.ics`, `cen100-progress-<date>.json` | Path-independent |
| 1201 | Copy link `new URL(location.href)` | Correct automatically at `/cen100/` |
| 5 | CSP (`script-src 'self' 'unsafe-inline'`, `connect-src 'none'`, `worker-src 'none'`) | Inline forwarder is allowed. **`fetch` of JSON is blocked**, so share data through ES module imports such as `assets/cen-schedule.mjs`. |

There are no `<link rel=icon>`, manifest, canonical, `og:` or `twitter:` tags on any page. CSS `url()` appears only in `assets/fonts/archivo.css` (relative to the stylesheet, so path-safe).

### Shared modules

| File:line | Logic | From `/cen100/` |
|---|---|---|
| `assets/hub.js:2` | `base=new URL('../', currentScript.src)` = site root | OK (resolves from `../assets/hub.js`) |
| `assets/hub.js:5` | brand `href=base` (root); CEN course link `new URL(id==='cen100'?'./':id+'/', base)` → **root** | **Change CEN to `cen100/`.** Brand → root = Desk. Logo `assets/guide-mark.svg` resolves from base (OK). Default `course||'cen100'` must not mark CEN current on the Desk. |
| `assets/guide-motion.mjs:114` | `.course-link,.hub-brand` leave-page transition; same-page test `u.pathname===location.pathname` | OK; direction uses the `aria-current` index (−1 on the Desk) |
| `assets/workspace.mjs:21,26,33,167,224–231` | hash-only routing; `main.id='course-main'` | OK |
| `assets/course-header.mjs:2,12,20` | `posterPaths` and dynamic `course-scene.mjs`, both relative to the module | OK |
| `assets/scenes/framing.mjs:10` | posters `new URL('./posters/<course>-{wide,tall}.webp?v=…', import.meta.url)` | OK |
| `assets/night/core.mjs:8,37,118` | `asset()` = `import.meta.url`; course data `../course-data.mjs?v=20261012-privacy1`; vendor chunks | OK |
| `assets/night/boot.mjs:15` | `./<feature>.mjs?v=` and `.css` via `asset()` | OK |
| `assets/visuals.js` | No URLs | OK (but see the Desk caveat in §1) |
| `assets/math-guide.mjs:114`, `schedule.mjs:68` | math share link (`location.href`); ICS UID `<code>-<id>-<section\|all>-f26@jude27mad.github.io`, no URL field | Path-independent |
| `assets/editorial.mjs:14,64` | hero hashes; `#math-lab` | Hash-only |

Module versions differ: `math-guide.mjs` imports `course-data.mjs?v=20261012-assessments2` and `schedule.mjs?v=20261012-assessments1`, while `core.mjs` imports `course-data.mjs?v=20261012-privacy1` and an unversioned `../schedule.mjs`. These are separate module instances of the same pure data, so behaviour is unaffected.

### Other pages, tests and docs that point at root-as-CEN

- `colour-preview.html:283` "Open the main guide" `href="./"` → should become `cen100/`. Lines 6 and 416 (fonts, `privacy.html`) stay at the root.
- `privacy.html:13` `href="./"` "← Course guides" → root = Desk (fine).
- `mth140/index.html`, `mth141/index.html`: links to CEN come only from `hub.js`. `../privacy.html` and `../assets/…` are unaffected.
- `tools/ui-build/workflow-check.cjs:16,19,134`: `check('', 'cen100')` reads root `index.html` at `https://guide.test/` → becomes `'cen100/'`. Seeds `cen100-contact-choice-v1 {section:29, group:9}` (25).
- `tests/header-preview.html:7` `'../index.html?motion=full'` for CEN; `tests/editorial/index.html:6` CEN → `'../../'`.
- `README.md`: line 3 ("at the site root"), 7 and 90 (CEN links to `/tmu-course-guides/`), 23 (legacy forwarder), 205/226/228 (`index.html` holds CEN content and version).

## 4. Next-deadline logic, as a data-level spec

### CEN (`index.html`)

- Helpers: `D` (739, `T12:00:00Z`), `days` (740), `cd` (745), `torontoToday` (749–752), `torontoTimestamp` (753–759).
- `eventPassed` (761): a timed event passes when `torontoTimestamp(date,time) < now`. A **date-only event stays eligible through its whole Toronto day** (`date < torontoToday(now)`). No grace period.
- `sortEvents` (762): `(date + (time||"23:59"))`, then id. `23:59` is only a sort fallback; `report` has a real published `23:59`.
- `itemDeadlines(item)` (763): the item's `calendar!==false` rows, sorted.
- `upcomingSchedule(completed, selected, now)` (776–782) drops an event when:
  1. it has passed, or
  2. it has `section` and `section !== selected`, or
  3. `completed[e.id]`, or
  4. it has `calendar:false` and the item has calendar rows that are **all** completed.

  Then it sorts.
- `renderTop(completed)` (797–813):
  - `selected = Number(#contact-section.value)` (798), which is the restored profile section.
  - `up[0]` is "Next up" (807); `up[1..3]` is the board (812).
  - Signature `id:days|…` of the first four goes in `#nextsign[data-schedule]` (803–804). `deadline.mjs` reads this.
  - Mark done appears only if the event is one of `itemDeadlines(event.item)` (811), so never for `calendar:false`.
  - Header urgency (783, 788): `n=max(0,days(date))`; `<=2` close, `<=6` soon, else calm.
- State sources:
  - First call `renderTop()` (862) uses `{}` and section 0.
  - The final state comes from `syncCompletionCounts` → `renderTop(personal.completed)` (1182) and `updateSectionContent` → `refreshDateDisplays` (1264).
  - Refresh triggers: `visibilitychange`, window `focus`, a 60 s interval (1295–1297) and `course-visuals-ready` (1302).
- Data-level reproduction without the DOM:
  - `selected = validProfile(read('cen100-contact-choice-v1'))?.section ?? 0`, with sections 1–39.
  - `completed = cleanPlan(read('cen100-personal-plan-v1')).completed`, which is equivalent to counting only `calendar!==false` schedule ids whose value is `1`/`true`.
  - `next = upcomingSchedule(completed, selected, now)[0]`.
- Presentation mapping today is `deadline.mjs:28–34` `resolveCen`, which reads `#nextsign[data-schedule]` and `window.CEN_SCHEDULE`:
  - title = `title` without a trailing ` due`; `open=item`.
  - With a time: `exact`, label `Due`, when `Wed Oct 14 · 3:00 PM Toronto`.
  - Without a time: `day`, label `Time not posted · check D2L`.
- Example state for implementers: `now = 2026-10-12 12:00 Toronto`.
  - No section and no records: `integrity` (2026-10-14 15:00), then `whmis`, `failure`, `reflection-1`.
  - Section 29: `failure-lab` (calendar:false reminder) is second.
  - Section 29 with `integrity` done: next is `failure-lab`.
  - After Oct 14 15:00: `whmis` (date-only, eligible until the end of Oct 14).

### Math (`assets/math-guide.mjs` + `assets/schedule.mjs`)

- `section` (10): `Number(read('<c>-section-v1',0))`, set to 0 if it is not in `course.labs`. `progress` (22) is `cleanProgress`, so completed = `progress.completed`.
- `renderNext` (61–69):
  - `upcoming(course, section, progress.completed)[0]` (62).
  - Writes `#next-assessment[data-next-id]` (65). `deadline.mjs:15` reads it.
  - Triggers: section change (125), completion (55–60), 60 s interval and `visibilitychange` (137).
- `schedule.mjs`:
  - `resolveAssessment` (28–36): a non-quiz event's `sortDate = date || '9999-12-31'`.
  - For a quiz, the date is `week + lab.day - 1` for the saved section. If that date is 2026-10-12, it uses `mondayMakeupDate` when present (`rescheduled`); otherwise `holiday`, with `date:null`. Without a section the date is `null`, and `sortDate = date || week`.
  - `weekEnd = week + 4`.
- `assessmentPassed` (37–41):
  - Timed events pass at `end||time`, so an event is not passed while it is in progress.
  - Date-only events (quiz with a lab) pass at the end of the Toronto day.
  - Week-only events pass when `weekEnd < today`.
- `upcoming` (42–46) keeps entries that have a `date` or `week`, are not completed and have not passed. It sorts by `sortDate` (date only, no time), then id. Undated finals never appear.
- Presentation today is `deadline.mjs:14–27` `resolveMath`, using `sectionNumber()` (12) from `#section-select` or storage:
  - Holiday: `week`, label `Quiz date needs confirmation`.
  - Quiz with a date and lab: `exact` at lab start, `end` at lab end, label `Your lab quiz starts`, when with the room. This is lab start even for `quizSecondHour` (MTH140 quiz-2), whose `timing()` text says "second hour of your lab". That imprecision exists today.
  - Quiz without a section: `week` with a range and CTA `Choose your section for your quiz time`.
  - Date and time: `exact`, label `Test starts` (midterm).
  - Date only: `day`, label `Time not posted`.
  - Otherwise: `pending`.
- Shared formatting (`deadline.mjs:37–58`):
  - `parts`: `hot` under 6 h, `soon` under 48 h; `live` inside `[at,end)`, else `passed`; 14-day ring window.
  - `day` precision uses Toronto calendar days.
  - `GRACE` 2 h re-resolve (5, 157–158). A CEN timed event leaves `upcomingSchedule` immediately, so `Due time passed` shows until the next 60 s guide refresh.

## 5. Old scene and effect modules (for later retirement; list only)

| Module | Loaded by |
|---|---|
| `assets/course-header.mjs` | `<script type=module>` in `index.html:284`, `mth140/index.html:27`, `mth141/index.html:27`. Imports `guide-motion.mjs` and `scenes/framing.mjs`; dynamically imports `course-scene.mjs` (20). |
| `assets/course-scene.mjs` | `course-header.mjs:20`; `tests/scene-capture.html:8`; `tests/scene-rendering.cjs`, `tests/scene-lifecycle.cjs` (esbuild). Imports `vendor/three-0.186.1.mjs`, `scenes/{circuit,calculus,algebra,future-look,framing,primitives,drag}.mjs`, `guide-motion.mjs`. |
| `assets/scenes/circuit.mjs`, `algebra.mjs` | `course-scene.mjs`; `tests/course-scenes.test.mjs`; `tools/scene-build/export-posters.mjs`. Import `primitives.mjs`, `scene-math.mjs`. |
| `assets/scenes/calculus.mjs` | same importers; imports `primitives.mjs` |
| `assets/scenes/future-look.mjs` | `course-scene.mjs`; `tests/future-look.test.mjs`; `export-posters.mjs` |
| `assets/scenes/future-geometry.mjs` | **No importer** (orphan; imports `primitives.mjs?v=20261012-future1`) |
| `assets/header-geometry.mjs` | Only `tests/header-geometry.test.mjs` |
| `assets/scenes/primitives.mjs`, `scene-math.mjs` | Scene modules and `framing.mjs` (`scene-math`); `tests/subject-headers.test.mjs`, `tests/course-scenes.test.mjs` |
| `assets/scenes/framing.mjs`, `drag.mjs` (keep) | `course-header.mjs`, `course-scene.mjs`, `export-posters.mjs`, `tests/subject-headers.test.mjs` |
| `assets/scenes/posters/{cen100,mth140,mth141}-{wide,tall}.webp` | `framing.posterPaths` (header and scene); generated by `tools/scene-build/export-posters.mjs` and `render-posters.py` |
| `assets/night/{hero,scroll,backdrop}.mjs` (+ `.css`) | `boot.mjs:8` `FEATURES` via `load(name)` (14–18) after idle |
| `assets/night/{warp,palette,feel}.mjs` (+ `.css`) | Listed in `boot.mjs:8` FEATURES but **files do not exist**. Each load 404s, logs `console.warn('Night Shift: <name> unavailable')` and is added to `html[data-ns-failed]`. The `night-warp` head scripts and `ns-warp-in` CSS are the dormant warp remnants. |
| `tests/header-preview.html`, `tests/scene-capture.html` | Manual review harnesses for the old headers |
