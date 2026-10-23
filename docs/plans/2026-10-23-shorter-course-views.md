# Shorter course views implementation plan

> **For agentic workers:** execute with superpowers:executing-plans. The owner's 2026-10-23 implementation brief is the approved specification; proceed without another design approval. Leave merge and publishing to the owner.

**Goal:** Reach work quickly, read each assignment in one place, and preserve every saved record and official qualification.

**Architecture:** Keep the current Next.js/Giats shell and Desk palette. Replace the course's pinned sequence with a compact workspace: Work, Schedule, Study (math), Course info, plus one shared detail renderer. Hash navigation preserves old anchors and browser history; per-history-entry snapshots restore filters, focus and the main scroller. Reuse content and progress APIs without changing storage formats.

**Tech stack:** React 18.2, Next 14 static export, SCSS, existing Lenis/GSAP shell. Schedule-X loaded only within Schedule, with an independent agenda and error boundary. Native disclosure controls for optional reference material.

**Spec:** Owner's complete brief in this session; this document captures implementation decisions, not additional scope.

## Global constraints

- Base: `origin/main` at `7b47c97`. Preserve Desk colours and Giats touch work from `7b47c97` and `5ce28b5`.
- Work only on `codex/shorter-course-views`. No merge, production publish, edits to root legacy app or frozen `next/` export.
- Preserve all checklist IDs, storage keys/formats, notes, targets, backup/import, section selection, search and old links.
- Checklist ticks and submission records remain separate. Overdue wording: “Past due · not marked done”.
- Preserve Toronto timezone and official exact/day/week/pending precision. No invented exam times.
- Instructional text >=16px, visible focus, keyboard, reduced motion and zoom support.

## Reconciliation

- `docs/plans/remove-repetition.md`: retain its single-detail, date-precision and saved-data contracts. Replace the decisions preserving long scroll/pinned windows and placing a calendar beside Work with the owner's focused-view design. No list-follow calendar steering is needed.
- Reuse and test R2 (`ef64a8a`, assignment/calendar model) and R3 (`401fe0c`, hash resolver). Adapt routing for full-width details.
- Read R4 (`28ca574`) measurements; do not merge disposable spike. Use pinned MIT dependencies and lazy loading. Calendar needs container-aware responsiveness and a list fallback. Native disclosures avoid the spike's React/Radix hidden-until-found problem; make no Safari find claims.
- R1 (`a1b1d4e`): apply relevant search targets, grading-section fix and duplicate-policy removal only; avoid unrelated stale canvas changes.
- R5 (`b98b7dd`): older script assumes in-place rows/pinned calendar; replace those expectations with a new focused-view browser harness rather than claim the old design checks apply.
- Open PRs #31 and #32: avoid search-normalisation and fluid-effect code; preserve easy integration of those separate performance changes.

## Review focus

1. Immediate note typing followed by view change, browser Back, or another assignment must persist against the original item.
2. Multiple submissions and undated items must remain discoverable; one completed record must not hide the assignment.
3. Direct, encoded, old and search hashes (including completed items) must open the same detail with usable Back.
4. Dynamic height changes and browser history must restore the correct filter, scroll and focus in Lenis's main scroller.
5. Calendar load failure, section changes and Toronto DST must preserve accurate accessible deadlines and qualifiers.

### Task 1: Reuse and verify data/routing groundwork

Files: `site/src/lib/assignments.mjs`, `site/src/lib/index.js`, `site/src/pages/course/components/assignments/deepLinks.mjs`, corresponding tests.
Interfaces: `assignmentList(courseId,{now,items})`, `calendarEvents(courseId,items)` and `resolveCourseLocation(hash,courseId,info)` for focused views.
- [x] Record baseline tests, integrate R2/R3 on this branch, run all site tests.
- [x] Test view aliases, valid/invalid detail hashes, multiple records, undated work, day/week precision and DST.
- [x] Commit data and routing groundwork.

### Task 2: Compact workspace and shared detail

Files: course route; new `workspace/` components, hook and SCSS; existing card bodies, PlanFields, SectionPicker, Layout/footer.
Interfaces: `useCourseNavigation(courseId, info)` exposes location/filter, navigate, back and entry snapshots. Every entry point resolves the same anchor. Existing `CourseContext` remains the progress interface.
- [x] Add browser regression cases for compact opening, view navigation, filter/history restoration and immediate note saves; run against baseline to observe missing workspace.
- [x] Replace pinned course composition; render one header image and immediately visible navigation/tools/section selection/summary.
- [x] Build compact Open/All/Done list with past-due and undated work; full-width shared detail reuses all requirement/checklist/source content.
- [x] Put topics in Study; section/contacts/grading/policies in concise Course info disclosures. Preserve unique text and qualifications.
- [x] Save notes synchronously on edit; retain old keys and formats. Compact course footer with credits.
- [x] Run site tests and build; commit.

### Task 3: Schedule and reliable calendar

Files: `workspace/Schedule.jsx`, `workspace/Calendar.jsx`, calendar styling, package manifests, tests.
Interfaces: accepts existing live deadline rows and `calendarEvents`; clicking uses shared navigation.
- [x] Pin dependencies validated in R4, verify peers/licences against installed packages.
- [x] Add phone agenda and wider Schedule-X month/calendar; handle overflow selection and container resizing.
- [x] Keep full qualifiers in agenda/detail and preserve undated work. Error boundary and rejected-chunk fallback keep agenda usable.
- [x] Test real blocked-chunk failure, section updates, shared details and no calendar code on Work/Desk.
- [x] Run site tests/build and commit.

### Task 4: Verify and deliver draft PR

Files: `site/scripts/verify-course-views.mjs`, docs/QA report, README updates.
- [x] Inspect browser-emulated phone (360/390/430), tablet (768/834/1024) and desktop (1440), plus zoom/reduced-motion/keyboard.
- [x] Verify search/old links, navigation/history, backup/import, saved-state reload, multi-submission completion, blocked calendar and pause/touch regressions.
- [x] Run site tests, production build, applicable publishing/touch checks and root tests; distinguish pre-existing failures.
- [x] Fresh whole-branch review; fix material findings and re-run affected checks.
- [ ] Fetch concurrent changes, reconcile if needed, push only isolated branch and open draft PR with results/limitations. No merge or publish.
