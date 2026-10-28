# Release history

Latest first. Students see course changes under **Course updates** in each guide's Guide tools, and website changes on the **Website updates** page. Older entries record the behaviour at the time; later releases supersede them.

## Unreleased — The website opens without WebGL

- **The Desk no longer crashes in browsers with WebGL turned off.** Chrome with WebGL disabled (a browser setting or policy, or no usable graphics) showed "Application error: a client-side exception has occurred" on the home page, and on every other page, because the 3D layer could not create its WebGL context. Every 3D canvas is now mounted only where WebGL works and sits inside an error boundary, so a browser without it gets the page without the background's slow drift, the pointer effect and the pre-footer game.
- Each course badge shows its HTML card with the course code and name, the badges' own fallback, which now also returns when the 3D layer is taken down. Everything else is unchanged, and browsers with WebGL get the same page as before.
- If WebGL goes away after the page has loaded (a GPU reset or crash), the page keeps working: contexts that come back within a few seconds carry on, a canvas that failed meanwhile tries again, and a context that stays lost turns the 3D layer off and shows the flat badges.
- The Desk's **Mark done** button is announced with the assessment's name again; screen readers had read it as "Mark undefined done".
- Pages CI loads every route (including the 404 page) with WebGL disabled, blocked and failing after the capability probe passes or after the first canvas is built, loses the GPU after load, resets it, and works with WebGL as a control that also checks the 3D badges paint and the pre-footer game appear; Chromium and WebKit. The new `tests/webgl.test.mjs` fails on a 3D canvas that is not in the gate.

## Unreleased — Smoother page changes

- **iPhone and iPad.** A page change no longer fades the page out over the dark background artwork. A paper layer sits behind the page during the change (`#routePaper`, in the page's flow and never fixed, so Safari's bars are unaffected). The page fades into it in 0.18 s and the next page rises 14 px out of it in 0.34 s. The header stays put while it is on screen. Leaving from an open Menu or Search, the swap happens under the panel, which dissolves into the new page.
- **Between courses** every screen uses a quicker fade (0.12 s out, 0.22 s in). **Other changes on computers and Android** keep Giats's card slide, shortened from about 0.75 s to 0.6 s. The card's arrival no longer loses its first frames to the new page's setup.
- The fades run as Web Animations, so they keep moving while a slower phone sets up the new page. A tap or key press finishes a change at once, Pause motion finishes one in progress, and Safari's swipe back changes pages without a second animation.
- The footer now changes with the page instead of under the outgoing one, and Back no longer scrolls the outgoing page to its top before it fades.
- `scripts/check-route-filter-motion.mjs` samples every frame of Desk → course, course → course, footer → Desk and Menu → course changes in iPhone WebKit. It fails if the dark artwork shows through more than 10% of a changing page, if the paper does not cover the screen, if a change does not fade with motion on, or if it fades with reduced motion.

## Unreleased — Course updates and website updates in separate places

- **What's changed?** is now two lists. **Course updates**, in each course's Guide tools, lists changes to that course's dates, coverage, policy and grading, and only these show the unread badge. The new **Website updates** page (`/updates/`) lists changes to the website itself; it is linked from the menu, the footers and the end of Course updates.
- Every existing entry is kept: 8 course entries across the three guides, and the website entries, with duplicates shared by several guides shown once and labelled when they apply to only some guides. The 22 untitled CEN100 entries now have titles, and the October 21 and October 23 releases have entries.
- Students who opened the October 16 notes see no new badge. Saved values keep their key and format, and a saved value is never replaced by an older one.
- The entries moved from the generated `pages.mjs` to `site/src/lib/content/updates.mjs`; the extractor no longer emits them.

## October 23, 2026 — Shorter course views

- Courses open in a compact Work list, with Open, All and Done filters. Schedule, math Study and Course info have separate views.
- Work, calendar, search and old assignment links open one full-width detail. Back restores the list filter, scroll and focus; browser Back/Forward remains available.
- One course photograph, a small deadline/progress summary and a compact ending replace repeated images, pinned sequences and duplicate overview sections. Requirements stay visible; optional references and course information use native disclosures.
- Section/group selection, D2L and Guide tools stay near the top. Notes save immediately on edit. Existing progress formats, checklist IDs, backups and multi-submission records are preserved.
- Schedule provides a phone agenda, a lazily loaded Schedule-X calendar on wider screens, and a deadline list that works when the calendar cannot load. Official date precision and Toronto time are retained.
- Verification and browser-emulated screenshots: [redesign QA record](docs/qa/shorter-course-views/README.md).

## October 21, 2026 — Current design at the main address

The current design now opens at the [main address](https://jude27mad.github.io/tmu-course-guides/), and the previous version is no longer published.

- **One website.** The main address and `cen100/`, `mth140/` and `mth141/` open the current design. The previous version's Privacy page (`privacy.html`) and the CEN100 colour preview forward to the current Privacy page and the CEN100 guide.
- **Old links keep working.** Links to the earlier preview at `/next/` open the same page at the main address, keeping any section link such as `#assignment-m2`. Links to the original `cen100-guide` address and old CEN100 links to the main address still reach the right guide.
- **Saved progress.** Unchanged. Both versions use the same browser storage at the same address, so sections, ticks, completion records, notes and target dates carry over.
- **Calendar files.** Events in CEN100 calendar files downloaded earlier link to `…/cen100/`, which now opens the current CEN100 guide. Files from October 11–12 and from the colour preview link to the main address, which opens the Desk.
- **Previous version kept.** Its files stay in the repository and are still tested by CI, but they are no longer published. Development pages and repository documents are no longer reachable on the website either.
- **Publishing.** A GitHub Actions workflow now builds the website, checks it in a browser, deploys it and checks the live address on every change to the site.

## October 16, 2026 — Course artwork and signal field

Published at [`/next/`](https://jude27mad.github.io/tmu-course-guides/next/). The previous website remains at the root address.

- Replaced the home spheres with Kairo's charcoal signal field, fine light points, orange pulses and pointer response beneath the existing moving windows.
- Replaced Next Up and course hero, deadline and checklist marbles with subject photographs: a steel bridge mechanism for CEN100, a worked integral for MTH140 and linear equations for MTH141. Atelier North's pixel-to-sharp reveal preserves the existing frames. The bridge image also covers unresolved or empty Next Up states.
- Pause motion and reduced motion show a static signal composition and finished photographs. Real HTML images remain available when canvas or JavaScript is unavailable. Effects pause offscreen and in hidden documents and clean up on navigation.
- Kept the Giats layout, transitions, typography and course tools. Fixed a navbar animation conflict exposed by faster artwork mounting. Course content, deadline rules and saved-progress formats are unchanged.
- Bundled optimized photographs locally with individual Unsplash permissions and credits; retained Giats, Kairo and Atelier North code notices. Removed unused sphere/marble code and the unused warehouse lighting asset.
- Updated all three guides' **What's changed?** entries and unread release markers.
- Artwork verification: 79 unit tests passed, export succeeded, 159 focused subject-image browser assertions passed, and 35 public-site checks passed after deployment. The earlier full lifecycle run passed 133/134 checks; its pre-existing saved-Pause menu offset remains documented. See the [QA record and screenshots](docs/qa/giats-artwork/README.md). Browser checks use Chromium emulation, not physical iPhone testing.

## October 15, 2026 — New website design (preview)

The new design is available for review at [`/next/`](https://jude27mad.github.io/tmu-course-guides/next/). The previous version remains at the site root until the switch. Both read the same saved progress.

- **New design.** The website now has a full-screen animated background, 3D sections, a fluid effect that follows the pointer, a loading intro, page transitions and smooth scrolling. Each course has its own colour scheme. Typography is set in Inter Display.
- **Desk.** The home page shows the next deadline across all courses with a live countdown, **Mark done** and **Undo**, followed by a card for each course and a list of the course guides. A new **Courses** page lists all three guides.
- **Course guides.** CEN100, MTH140 and MTH141 share one layout: next deadline, deadlines grouped under This week, Next week and Later, the weekly checklist, assessments with weights and dates, course information for the selected section, guide tools and a link to the next course.
- **Search and menu.** Search opens from the top bar, from the Menu on phones, or with Ctrl K / ⌘ K. The Menu lists every page, the next deadlines across courses, **Pause motion** and official sources.
- **Saved progress.** Sections, groups, checklist ticks, completion records, notes and target dates use the same browser storage keys and formats as before, so existing progress carries over. Calendar and backup files keep their formats, and old backups still import.
- **Deadlines.** Deadline handling is unchanged: Toronto time, the end-of-day rule for untimed CEN100 submissions, quiz weeks, pending dates and the same countdown wording.
- **Accessibility.** Reduced motion and **Pause motion** stop the animations, hold the 3D sections still, remove the pointer effect, and replace the loading intro and page transitions with an immediate change; mouse-wheel scrolling is still smoothed. Pinch zoom, text selection, keyboard scrolling and visible focus are supported, buttons and controls on phones have tap targets of at least 44 px, and course information, rules, grading and contacts are readable without JavaScript.
- **Privacy.** No analytics and no requests to other websites. Fonts and the 3D lighting environment are served from the website itself, and each page carries a Content Security Policy.
- **Appearance.** The new design uses a light appearance only; the Auto and Dark settings are not part of this version.
- **What's changed?** Each guide has a new entry for this release, and its unread badge shows until the notes are opened. The previous version keeps its own badge, so a student who uses both may see each badge again.
- **Verification.** The site's 65 data tests check deadline results against the previous version, including the 40 Toronto boundary cases across several time zones, and check that saved progress is read and written byte for byte as before. The existing 384 repository tests pass. Every page was checked at phone and desktop sizes for errors, failed requests, saved progress, search, menu and page transitions.

## October 12, 2026 — Night Shift foundation

Branch snapshot: `night-shift` at `f4c8342`. This records integrated foundation work. The [Stage 1b report](docs/qa/night-shift/stage1b.md) re-verifies the earlier router-review snapshots in Chromium; Safari/iOS review and the book stages remain pending.

- Added the editorial course layout, live deadline card, semester timeline and dock with course identity, Desk, countdown, section, Search and Pause motion controls.
- Made the site root the Desk directory, with three course links, saved-section summaries and the next deadline across courses. CEN100 lives at `/cen100/`; old CEN-specific root hashes forward once with their query and hash preserved. Generic root links stay on Desk. Existing progress keys are unchanged.
- Centralized Toronto deadline resolution and display states across the Desk and course deadline surfaces, including exact instants, date-only items, unresolved quiz weeks and pending dates. Lab-start countdowns retain their lab wording rather than claiming an exact quiz start.
- Applied the owner's end-of-day rule to dated CEN100 submissions without posted times: count down to the following Toronto midnight, display “Due by end of day” / “by 11:59 PM Toronto”, and keep the whole final minute open. Untimed in-class events remain date-only. Official course records were not changed.
- Integrated the persistent shell, route-module mount/unmount lifecycle and no-reload switching between Desk and the three course routes, with direct-load and normal-navigation fallbacks. The final review records fixes for stylesheet/history restoration, stale caches, route boot failures, deep links and the CEN100 WebGL-context leak.
- Added shared semester-week and page-bend logic for the future books. Toronto term-week labels remain separate from the book's clamped spread index; dated exam records can extend book spreads without inventing an official term week or final-exam date.
- Stopped loading the old animated backdrop and course-switch warp/wipe from Night Shift boot. Backdrop files and dormant wipe remnants remain for the separate cleanup task; they have not all been deleted.
- Added deadline boundary fixtures, corrected the cross-time-zone test adapter and applied the adopted countdown, empty-state and accessibility copy. See the [deadline results and correction](docs/qa/toronto-deadline-results.md) and [QA index](docs/qa/night-shift/README.md) for the exact checkpoints tested.

## October 12, 2026 — Math assessment updates

- Confirmed MTH140 Quiz 2 covers Chapter 3, Sections 3.1–3.5 and takes place in the second hour of the lab; Monday sections write on October 19 after Thanksgiving.
- Kept MTH141 midterm coverage and published dates while removing public question-type breakdowns and other assessment-format details. Official format stays on D2L.
- Updated quiz date handling, calendar export, course notes and assessment-data tests without changing student progress storage.

## October 12, 2026 — Subject headers and privacy

- Replaced the abstract chrome/glass headers with a working planetary gearbox, mint Calculus ribbons and tangent, and a matrix-transformed sphere and basis.
- Added direct mouse/touch rotation with inertial release, continuous idle motion, arrow-key rotation and Home reset. Preserved pause, reduced motion, offscreen sleep and GPU failure fallback.
- Added the folded-page vector logo and responsive subject framing with matching poster assets.
- Removed dormant analytics integration, served licensed Archivo fonts locally, blocked outbound reporting with Content Security Policy and suppressed referrers on external links.
- Replaced course-only staff names with role-based D2L contact guidance and added a visitor Privacy page. Section/group choices, rooms, deadlines and saved progress remain available.
- Refreshed README, architecture, source audit and release notes; updated all course unread-release versions.
- Verification: 48 Node tests and six course/motion workflow checks passed for the implementation. Subject-header browser visual review is documented separately from physical-device performance claims.

## October 11, 2026 — Workspace, study and motion

- Organized the shared layout into Assignments, Study for math, and Course info; aligned course widths and brought Search and Guide tools together above content.
- Added semester timelines and assignment detail sheets while retaining existing completion records, notes and checklist data.
- Simplified math experiments with focused button actions and optional exact values; added matrix operation composition and four Find the mistake examples per course.
- Added GSAP/Flip motion for courses, sections, sheets, search, tools, study and completion, with reduced-motion handling.
- Iterated through circuit/ribbon/lattice and abstract optical headers. The October 12 subject scenes supersede these designs.

## October 9, 2026 — Fewer taps

Visible search, weekly-work and contact shortcuts, and Mark done with Undo improved navigation and completion tracking.

## October 7, 2026 — Three-course guide

Added MTH140 and MTH141, independent saved sections/progress, shared appearance, assessment coverage, topic/practice references, section-aware schedules, calendars and backups. Added source/conflict notes and per-course unread release badges. Retained CEN100 requirements and direct assignment links.

Earlier CEN100 release history is retained in the root page's **What's changed?** panel. The repository was renamed to `tmu-course-guides`; the legacy `cen100-guide` site forwards links to the current guide.
