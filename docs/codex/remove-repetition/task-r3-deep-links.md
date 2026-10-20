# Task R3 — Deep-link resolver (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/rr-deep-links` from the latest `origin/main`.

**Read first:**
- `docs/codex/remove-repetition/README.md` (the rules for every task)
- Sections C2 and C5 and Stages 5 and 7 of `docs/plans/remove-repetition.md`

This is groundwork with no visible change. It produces a pure function and its tests.

## Background

Links into a course page go through `scrollToHash()` in `site/src/utils/scrollToHash.js`. It sends a cancelable `guide-hash` event with `{ id, element }` before scrolling, so a component can open the target first (see `useOpenRows` in `site/src/pages/course/components/cards/ItemCards.jsx` and `bindGuideTools` in `site/src/pages/course/components/tools/dialog.mjs`).

When the assignment list and the accordion replace today's sections, old links must keep working and new ones must open the right thing.

## Add `site/src/pages/course/components/assignments/deepLinks.mjs`

```js
resolveHash(id, { courseId, entries, panels })
// entries: [{ anchor, group }]   (group is 'pastDue'|'thisWeek'|'nextWeek'|'later'|'done')
// panels:  ['p-rules', 'p-confirmed', 'p-open'] for CEN100, ['rules-help', 'textbooks', 'sources'] for math
// returns { kind: 'row'|'section'|'panel'|'none', target, openGroup, openPanel }
```

**Item anchors** (`assignment-*`, `assessment-*`):
- return `kind:'row'`;
- if the entry is in `done`, also return `openGroup:'done'`, so the collapsed Done group opens first.

**Old section anchors** become aliases of the new sections:

| Old anchor | Resolves to |
|---|---|
| `p-team`, `p-you`, `t-team`, `t-you`, `panel-assessments` | `kind:'section'`, `target:'assignments'` |
| `study` on CEN100 only | `kind:'section'`, `target:'assignments'` |
| `study` on MTH140 / MTH141 | stays `study` (the study topics) |
| `t-rules` | `kind:'panel'`, `target:'p-rules'`, `openPanel:'p-rules'` |

**Panel ids** in `panels` return `kind:'panel'` with `openPanel` set.

**Everything else**, including `contacts`, `course-info`, `section-picker`, `guide-tools`, `math-tools`, `topic-*` and unknown ids, returns `kind:'none'`. The existing handling stays in charge of those.

**Also:** add `immediate` to the `guide-hash` event detail in `scrollToHash.js`, so listeners know whether the scroll will be instant. Keep the existing parameters and behaviour.

## Tests

New file `site/tests/deep-links.test.mjs`. It covers:
- every alias in the table, for both CEN100 and math;
- `study` behaving differently by course;
- Done items returning `openGroup:'done'`;
- each panel id;
- `t-rules`;
- unknown ids;
- empty input.

Run everything listed in the README rules.

## Finish

Write `docs/codex/remove-repetition/reports/r3-deep-links.md`. In it, list every anchor the current course pages render, with what each resolves to, from a grep of the components. Push `codex/rr-deep-links`. Never push to `main`.
