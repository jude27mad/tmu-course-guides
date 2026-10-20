# R3 — Deep-link resolver

Branch: `codex/rr-deep-links`, created from the latest fetched `origin/main`,
`e51b2e1` (`Add Codex briefs for the code-only parts of the repetition plan`).
Before pushing, `origin/main` advanced to `b4d79c6` (`Pin the clock in the
fix-header test fixture (#24)`); the branch was fast-forwarded to that base and
the full root suite was rerun successfully.

## Changes

- Added the pure, DOM-free `resolveHash(id, { courseId, entries, panels })` in
  `site/src/pages/course/components/assignments/deepLinks.mjs`.
- Known assignment/assessment entries resolve to their own row; Done entries
  request `openGroup: 'done'`. Exact entry membership prevents unknown IDs and
  card-body IDs ending in `-details` from being mistaken for assignment rows.
- Added all five legacy assignment-section aliases, course-specific `study`,
  `t-rules`, and supplied accordion panel IDs. Unused result fields are `null`;
  unclaimed IDs return `{ kind: 'none', target: null, openGroup: null, openPanel: null }`.
- Added `immediate` to the cancelable `guide-hash` event detail. It includes the
  existing paused/reduced-motion (`still`) setting, so it describes instant
  scrolling accurately. Parameters, cancellation, post-event destination lookup,
  Lenis options and focus behavior remain in place.
- Added 52 resolver tests, covering every current item anchor in all five groups,
  all required aliases and panels, unrelated/unknown IDs and empty input. Added
  five event behavior tests covering both `immediate` and `still` values, event
  order, scrolling/focus and cancellation.

This is groundwork only. The resolver is not wired into current components; the
assignment list and accordion integration remain with the owner. No visible
design, saved-progress formats, deadlines, grading or protected files changed.

## Verification

Final checks used Node `22.23.3`, matching the repository CI's Node 22 major,
and the unchanged lockfiles. No existing tests were changed, skipped or weakened.

| Required command | Result |
| --- | --- |
| `cd site && npm ci` | passed (624 packages) |
| `npm ci --prefix tools/scene-build` | passed (3 packages) |
| `npm ci --prefix tools/ui-build` | passed (40 packages) |
| `cd site && npm test` | **145 passed, 0 failed, 0 skipped** |
| `cd site && npm run build` | passed, including ESLint and all 8 static pages |
| `node --test tests/*.test.mjs tests/scene-*.cjs` | **384 passed, 0 failed, 0 skipped** |
| `git diff --check` | passed |

The initial root run against `e51b2e1` had one existing failure at
`tests/fix-header.test.mjs:96`, in “Mark done and Undo reach the book from the
committed record, though guide-completion fires before the save (§6.10)”. It
expected `/^quiz-2:false:/`, but the real clock on 2026-10-20 selected
`midterm:false:null`. An unchanged `origin/main` archive in
`/tmp/rr-r3-root-baseline` reproduced it (that file: 4 passed, 1 failed).
Upstream commit `b4d79c6` then pinned that fixture's clock; after fast-forwarding,
all 384 root tests pass. R3 changes no existing tests. Root `assets/`, `tests/`,
and `tools/` are identical to the final `origin/main` base.

Environment setup: npm's default cache was unwritable, so installs used
`npm_config_cache=/tmp/rr-r3-npm-cache`. Checks requiring subprocesses or a local
server ran with the execution tool's network permission. The browser root check
used `QA_CHROMIUM_PATH=/usr/bin/chromium` with the installed Chromium; the default
Playwright browser path is absent. Initial restricted runs failed
`site/tests/boundaries.test.mjs`, `tests/deadline-boundaries.test.mjs`,
`tests/preview-server.test.mjs`, and `tests/fix-rail.test.mjs` because of those
execution constraints; all pass in the final runs above.

The build reports existing warnings in `Fluid.jsx`, `useOpts.jsx`,
`usePointerEvents.jsx` and `Portal.jsx`, plus outdated Browserslist data. No
dependency, lockfile or generated `next/` output was changed to address them.
The new tests were observed failing before implementation, and an independent
review found no remaining issues after the motion-flag case was covered.

## Anchor inventory from the current components

Inventory commands, run from the repository root:

```sh
rg -n '\bid\s*=|\bid\s*:|\.id\s*=|setAttribute\(|anchor' \
  site/src/pages/course 'site/src/pages/[course].page.jsx' \
  site/src/components site/src/pages/_app.page.jsx site/src/pages/_document.page.jsx \
  site/src/utils/scrollToHash.js site/src/lib/info.mjs site/src/lib/content site/src/lib/search.mjs
rg -n '\bid\s*=|\bname\s*=|dangerouslySetInnerHTML|createElement\(' \
  site/src --glob '*.{jsx,js,mjs}'
rg -n 't-team|t-you|t-rules|math-tools|p-confirmed|p-open|sources|id=' \
  site/src/pages/course site/src/lib/content/pages.mjs
rg -n 'id:|section:' site/src/lib/vendor/cen-schedule.mjs
```

Dynamic card IDs were expanded from the same data the components consume:

```sh
node --input-type=module <<'EOF'
import { courseInfo } from './site/src/lib/info.mjs';
for (const courseId of ['cen100', 'mth140', 'mth141']) {
  const info = courseInfo(courseId);
  console.log(courseId, {
    tabs: info.page.tabs,
    items: (info.items || info.assessments).map(({ anchor }) => anchor),
    topics: info.topics?.map(({ anchor }) => anchor),
  });
}
EOF
```

Below, **row** means `kind: 'row'`, `target` equal to the ID, and
`openGroup: 'done'` only when its supplied entry is in Done. Other groups leave
`openGroup: null`. **Panel** sets both `target` and `openPanel` to the panel ID
when it is in the supplied course's `panels`. **None** leaves existing handlers
in charge. All unmentioned result fields are `null`.

### Current section and panel IDs

Paths in the source column below are relative to `site/src/`.

| Course | Rendered ID | Resolver result | Component source |
| --- | --- | --- | --- |
| All | `assignments` | none; direct scrolling already finds it | `pages/course/components/deadlines/Deadlines.jsx:255` |
| CEN100 | `study` | section → `assignments` | `pages/course/components/checklist/Checklist.jsx:110` |
| Both math courses | `study` | section → `study` | `pages/course/components/cards/ItemCards.jsx:340` |
| All | `course-grading` | none | `pages/course/components/overview/Assessments.jsx:28` |
| CEN100 | `p-team`, `p-you` | section → `assignments` | `pages/course/components/cards/ItemCards.jsx:304` (tab data from `courseInfo`) |
| Both math courses | `panel-assessments` | section → `assignments` | `pages/course/components/cards/ItemCards.jsx:339` |
| All | `course-info`, `contacts` | none | `pages/course/components/info/CourseInfo.jsx:98,105,139,146`; `Block` emits IDs at line 16 |
| CEN100 | `p-rules` | panel → `p-rules` | `pages/course/components/info/CourseInfo.jsx:120` |
| Both math courses | `rules-help` | panel → `rules-help` | `pages/course/components/info/CourseInfo.jsx:155` |
| Both math courses | `textbooks` | panel → `textbooks` | `pages/course/components/info/CourseInfo.jsx:161` |

### Every current assignment and assessment row

`site/src/lib/info.mjs:38,92` creates the anchors;
`site/src/pages/course/components/cards/ItemCards.jsx:230` renders each on a `<li>`.
Every ID in this table resolves as **row** when present in `entries`.

| Course | Rendered row IDs |
| --- | --- |
| CEN100, team (8) | `assignment-m1`, `assignment-m2`, `assignment-m3`, `assignment-m4`, `assignment-y6`, `assignment-m5`, `assignment-m6`, `assignment-m7` |
| CEN100, individual (9) | `assignment-y1`, `assignment-y2`, `assignment-y3`, `assignment-y4`, `assignment-y5`, `assignment-y7`, `assignment-y8`, `assignment-m8`, `assignment-y9` |
| MTH140 (6) | `assessment-quiz-1`, `assessment-quiz-2`, `assessment-quiz-3`, `assessment-quiz-4`, `assessment-midterm`, `assessment-final` |
| MTH141 (7) | `assessment-quiz-1`, `assessment-quiz-2`, `assessment-quiz-3`, `assessment-quiz-4`, `assessment-quiz-5`, `assessment-midterm`, `assessment-final` |

Done status is supplied at runtime, not fixed to any particular anchor.

### Every current topic row

`site/src/lib/info.mjs:104` generates these IDs and `ItemCards.jsx:230` renders
them. Every ID below resolves **none**; existing topic-row handling stays in charge.

| Course | Rendered topic IDs |
| --- | --- |
| MTH140 | `topic-functions`, `topic-limits`, `topic-derivatives-1`, `topic-integration-1`, `topic-derivatives-2`, `topic-integration-2`, `topic-applications-d`, `topic-applications-i` |
| MTH141 | `topic-complex`, `topic-systems`, `topic-matrices`, `topic-determinants`, `topic-rn`, `topic-transformations`, `topic-diagonalization`, `topic-abstract` |

### Card-body IDs

Every concrete row ID in the preceding two tables also has a companion DOM ID
formed by appending `-details`. This exhaustively defines that set, including
`assignment-m1-details`, `assessment-final-details`, and `topic-abstract-details`.
Every companion resolves **none** with the normal assignment entries.

Source: `ItemCards.jsx:227,240`. These IDs connect each row button's ARIA controls
to its body; they are not independent assignment-list entries. The body element
remains mounted while its content is conditional on the row being open.

### Dynamic deadline IDs

`site/src/pages/course/components/deadlines/Deadlines.jsx:211,232` emits two IDs
for every rendered record: `deadline-${id}` and `deadline-details-${id}`. All
resolve **none**. The full possible record suffixes are:

| Course | Record IDs used in both deadline ID families |
| --- | --- |
| CEN100 | `intro`, `entry`, `syllabus`, `email`, `contract`, `outline`, `matlab-1`, `whmis`, `integrity`, `failure`, `reflection-1`, `review`, `notebook-1`, `matlab-2`, `prototype`, `presentation-1`, `presentation-2`, `notebook-2`, `reflection-2`, `exit`, `peer`, `report`, `failure-lab`, `showcase-signup`, `item:y7`, `item:y9` |
| MTH140 | `quiz-1`, `quiz-2`, `quiz-3`, `quiz-4`, `midterm`, `final` |
| MTH141 | `quiz-1`, `quiz-2`, `quiz-3`, `quiz-4`, `quiz-5`, `midterm`, `final` |

The undated CEN IDs retain their literal colon, e.g. `deadline-item:y7` and
`deadline-details-item:y9`. Scheduled IDs come from
`site/src/lib/vendor/cen-schedule.mjs:4`; undated records come from
`site/src/lib/deadlines.mjs:151,248`.

These elements appear after live data initializes, and only for current
`thisWeek`, `nextWeek`, and `later` buckets. The current component omits `earlier`.
Completed records are filtered out; reminders can retire. `failure-lab` appears
only for Section 29. Time, saved progress and the selected section therefore
determine which members of these families exist at any moment.

### Picker, tools and form IDs

All IDs in this table resolve **none**.

| Course | Rendered IDs / exhaustive generated family | Source relative to `site/src/pages/course/components/` |
| --- | --- | --- |
| All | `section-picker`, `section-picker-heading` | `info/SectionPicker.jsx:22,25`; picker ID supplied by `../hooks/useCourseState.js:17` |
| CEN100 | `section-picker-group-heading` | `info/SectionPicker.jsx:42` |
| All | `guide-tools`, `guide-tools-title` | `tools/GuideTools.jsx:125,127` |
| All | `tools-updates` | `tools/GuideTools.jsx:149`; inside the collapsible updates row |
| All | React `useId()` file input ID | `tools/GuideTools.jsx:33,168` |
| All, conditional | React `useId()` checkbox IDs | `CheckRow.jsx:11,15` |
| Open assignment/assessment bodies | React `useId()` note and target IDs | `cards/PlanFields.jsx:11,12,38,62` |

Generated form IDs depend on the React tree; they are not stable link contracts.
Checkboxes occur in the weekly checklist, CEN requirements/records, math
preparation/records and topic skills. `guide-tools` continues to be handled by
the cancelable event listener in `tools/dialog.mjs`.

### Shared shell, menu, search and framework IDs

All IDs/families below resolve **none**. Paths are relative to `site/src/`.

| Rendered ID / family | Source |
| --- | --- |
| `loader` | `components/dom/Loader.jsx:166` |
| `scrollbar` | `components/dom/Scrollbar.jsx:44` |
| `layout` | `pages/_app.page.jsx:215` |
| `fluidCanvas` (motion enabled) | `pages/_app.page.jsx:219` |
| `main`, `mainContainer` | `pages/_app.page.jsx:242,243`; skip link targets `mainContainer` |
| `menu` | `components/dom/navbar/components/MenuLinks.jsx:105` |
| `menu-motion-note` (reduced motion) | `components/dom/navbar/components/MenuLinks.jsx:158` |
| `menu-button` | `components/dom/navbar/components/MenuButton.jsx:18` |
| `search`, `search-title`, `search-input`, `search-results` | `components/dom/navbar/components/SearchPanel.jsx:209,212,221,266` |
| `search-option-${index}` (zero-based, current result set) | `components/dom/navbar/components/SearchPanel.jsx:283` |
| `__next`, `__NEXT_DATA__` | Next's `Main` / `NextScript` in `pages/_document.page.jsx:49,50` |
| `__next-route-announcer__` (client runtime) | Next's route announcer |

The header, footer, PreFooter, GoTop, course hero/details/tiles and next-course
components add no other DOM IDs. Menu and search remain mounted even when closed.
As a supplementary read-only cross-check, the existing checked-in
`next/{cen100,mth140,mth141}/index.html` IDs were parsed with Python's HTMLParser;
the current tools file input happens to be `:R2bqm:` in those exports. That value
is generated, not a literal contract, and the export was not changed.

### Legacy and future IDs not currently rendered

| ID | Current status | Resolver result |
| --- | --- | --- |
| `t-team`, `t-you` | Legacy aliases, no current component ID | section → `assignments`, on all three courses |
| `t-rules` | Legacy alias, no current component ID | panel → `p-rules`, even without `p-rules` in supplied panels |
| `p-confirmed`, `p-open` | Stage 7 additions; their content is currently inside `p-rules` | panel when supplied in CEN panels |
| `sources` | Stage 7 addition; sources currently sit inside math `textbooks` | panel when supplied in math panels |
| `math-tools` | Legacy dialog alias in `tools/dialog.mjs:60` | none; existing dialog handler opens it |
| Other unknown IDs; empty input | No matching resolver contract | none |

All five assignment-section aliases (`p-team`, `p-you`, `t-team`, `t-you`,
`panel-assessments`) resolve on both CEN and math, including aliases that are
not currently rendered by that course family.

Grep also finds non-DOM identifiers: `course-details`, `course-deadlines`,
`course-deadlines-${index}`, `course-checklist`, `course-checklist-${index}` and
`footerTrigger` are GSAP ScrollTrigger IDs. Checklist/record IDs and search entry
IDs are data/React keys, and `fruit.id` passed to `Sticker` is Three.js bookkeeping.
None adds another HTML anchor.

## Limitations and open questions

This task does not establish accordion/browser find-in-page support, calendar
behavior, or device behavior; those remain the later stages and owner checks in
the plan. The report inventories current anchors and future resolver contracts;
it does not claim the future UI exists. No R3 requirements remain blocked;
every R3 test, both complete suites, and the production build pass.
