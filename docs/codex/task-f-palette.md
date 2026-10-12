# Task F — ⌘K command palette (start now)

Paste this whole file into Codex.

**Repository:** `jude27mad/tmu-course-guides`. **Branch:** `codex/ns-palette` from the latest `night-shift`. Read `docs/codex/README.md` (shared rules, route lifecycle contract) and `NIGHT-SHIFT-PLAN.md` Section 7 ("Faster intro, palette and Pause motion") and Section 12 first.

Build the behaviour and accessibility completely. Keep the visual styling plain and token-based (use the variables in `assets/night/layout.css`: `--hub-panel`, `--hub-ink`, `--hub-muted`, `--hub-line`, `--hub-soft`, `--hub-focus`, `--ns-glass`, `--ns-glass-line`, `--strong`, `--ns-mono`); Claude will restyle it later. No animation beyond what `motionAllowed()` permits.

## Owns

New `assets/night/palette.mjs`, new `assets/night/palette.css`, adding `'palette'` to boot's feature loading in `assets/night/boot.mjs`, new tests. The palette is a **shell service**: it initialises once and survives route changes (re-index on `route-changed`).

## Behaviour

1. A real modal `<dialog>` appended to `document.body`: a combobox input plus a grouped listbox (`aria-activedescendant` pattern). ↑/↓/Home/End/Enter/Esc, mouse hover selects, click runs. Focus returns to the opener on close, without bouncing back to an old launcher after the palette has handed off to another modal.
2. Opens with ⌘K / Ctrl+K anywhere (also from inside fields — but never intercept ordinary typing), the dock's `[data-ns-search]` button and the header's `.workspace-search` button (intercept its click in the capture phase). **No bare-character shortcut.**
3. While open: `core.hold('palette')`; release on close (and before opening another modal). Never write the saved motion preference.
4. Index (rebuilt on `route-changed`, `guide-completion`, section changes):
   - **Assessments** of the current course — math from `COURSES[course].assessments` (via `core.courseData()`), CEN from `assets/cen-schedule.mjs` plus the item titles — opened with `core.openItem(id)`; show date/precision hint from `assets/night/targets.mjs` helpers.
   - **Weeks**: queries like `week 9`, `wk 9`, `w9`, `oct 13` resolve with `findWeek` from `assets/book/weeks.mjs`; running a week result dispatches `document.dispatchEvent(new CustomEvent('book-open-week',{detail:{index}}))` (the book listens; if nothing handles it — check `event.defaultPrevented` after dispatch — fall back to scrolling the semester timeline `.ns-timeline` to that week and focusing its first item).
   - **Views**: Assignments, Study (math), Course info → `window.CourseWorkspace.show(view, true)`.
   - **Places**: Desk and the three courses → navigate through the router (`window.TMURouter.navigate(url)`, falling back to a normal link) so the transition and no-reload behaviour apply.
   - **Math topics**: open Study and focus `#topic-<id>` (see `assets/math-guide.mjs`).
   - **Actions**: This week's work (`#quick-work`), Contacts (`#quick-contacts`), Guide tools (`.workspace-tools`), Export calendar (open Course info and the calendar disclosure, focus it), Theme (`.hub-theme`; show current mode), Pause/Play motion (`core.toggleMotion`; label reflects state; disabled when the device setting forces reduced motion), Sound on/off (`core.setSound`/`soundEnabled`), Open D2L (`https://courses.torontomu.ca/`, new tab, `rel="noopener noreferrer"`).
5. Fuzzy matching: case-insensitive subsequence with scoring for prefix and word starts, matched characters highlighted with `<mark>`; groups ordered by best score; empty query shows a curated default (next deadline first, then views, places, actions).
6. Final row always: `Search the guide for "<query>"` → close the palette, open the existing inline search panel (`#workspace-search`; provide a bypass for your own `.workspace-search` interception) and hand the query to `#guide-search` (set value, dispatch `input`, focus).
7. Works on the Desk route too (places, weeks disabled, actions that exist there).

## Tests

`tests/palette.test.mjs` (pure fuzzy scorer, week query routing, index building from real data) and `tools/ui-build/workflow-check.cjs` additions: ⌘K opens, "midterm" + Enter opens and focuses the midterm even when hidden by Hide completed or in another view, Esc restores focus, the hold is released, 20 open/close cycles leave listener counts flat, palette survives a route change and re-indexes.
