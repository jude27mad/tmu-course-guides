# Project documents

How to use the website is in the [main README](../README.md). How to build it is in [site/README.md](../site/README.md). This folder keeps the reference material behind the course data and the records of earlier versions.

## Plans

| Document | What it covers | Status |
|---|---|---|
| [plans/2026-10-23-course-site-review.md](plans/2026-10-23-course-site-review.md) | Six phases from the October 23 design review: current course data, first-load weight, a clearer Work view, a shorter Desk, calendar feeds and moving progress between devices. | Mostly open. The update lists (1.6) are done, the iPhone history fix (2.1) landed another way, and the Desk took a different shape (Next up card, badges, the companion game). |
| [plans/2026-10-23-shorter-course-views.md](plans/2026-10-23-shorter-course-views.md) | Focused Work, Schedule, Study and Course info views with one shared assignment detail. | Done in #36. |
| [plans/2026-10-23-ui-consistency.md](plans/2026-10-23-ui-consistency.md) | Readable minimum sizes, Guide tools motion and direct Course info answers. | Done in #45. The sticky course bar was later dropped (#46). |
| [superpowers/plans/2026-10-23-delayed-navigation-feedback.md](superpowers/plans/2026-10-23-delayed-navigation-feedback.md) | Loading feedback only after a 250 ms wait. | Done in #57. |
| [plans/remove-repetition.md](plans/remove-repetition.md) and [codex/remove-repetition/](codex/remove-repetition/README.md) | The earlier staged plan to remove repeated content, with Codex briefs R1–R5. | Superseded by the shorter course views (#36), which took over its layout goals. |

## Current reference

These still describe how the website behaves today.

| Document | What it covers |
|---|---|
| [qa/giats-artwork/README.md](qa/giats-artwork/README.md) | Published Giats artwork, code provenance, lifecycle checks, deployment evidence and the known saved-Pause menu limitation. |
| [qa/giats-artwork/subject-imagery/README.md](qa/giats-artwork/subject-imagery/README.md) | Current engineering, calculus and linear-algebra photographs, responsive screenshots and 159 focused browser checks. |
| [qa/toronto-deadline-test-cases.md](qa/toronto-deadline-test-cases.md) and [.json](qa/toronto-deadline-test-cases.json) | Deadline boundary cases in Toronto time. The site's data tests run all 40 cases in four time zones. |
| [qa/toronto-deadline-results.md](qa/toronto-deadline-results.md) | Results of the deadline boundary tests on the previous version, the correction made to the test adapter, and the end-of-day rule for CEN100 submissions without a posted time. |
| [math-source-audit.md](math-source-audit.md) | Where the MTH140 and MTH141 dates, sections and coverage come from, and how conflicts between sources were handled. Its "Integration and maintenance" section describes the previous version. |
| [copy/interface-copy.md](copy/interface-copy.md) | Wording rules for deadlines, status labels and actions. The deadline and status wording is still in use. Labels for controls that only existed in the previous version no longer apply. |
| [privacy-audit.md](privacy-audit.md) | The October 12 privacy review. The commitments still hold in the new design: no analytics, no outside requests, progress kept in the browser. File and font details refer to the previous version. |

## Previous version (archived)

Records of the design that the current website replaced, and that design's own files. They are kept for history and are not maintained.

| Document | What it was |
|---|---|
| [visual-overhaul.md](visual-overhaul.md), [immersive-motion.md](immersive-motion.md) | Subject headers, course scenes and motion of the previous design. |
| [math-studio.md](math-studio.md) | The interactive math examples of the previous design. |
| [book/semester-book-spec.md](book/semester-book-spec.md) | The 3D semester book for MTH140. |
| [qa/device-checklist.md](qa/device-checklist.md) | Device checks written for the previous interface. |
| [qa/night-shift/](qa/night-shift/), [qa/subject-headers/](qa/subject-headers/) | Review reports for the previous design's stages (`night-shift`) and screenshots from the subject-header review (`subject-headers`). |
| [codex/](codex/) | Coding task briefs used to build the previous version. |
| Repository root: `index.html`, `cen100/`, `mth140/`, `mth141/`, `privacy.html`, `colour-preview.html`, `assets/` | The previous website itself. It is no longer published (only `site/` is, through `.github/workflows/pages.yml`), but CI still tests it. View it locally with `npm run dev` at the repository root (port 4173). |
| [../next/](../next/) | The earlier `/next/` preview export, kept as it was and no longer published. |
| [superpowers/](superpowers/) | Design plans for the previous subject headers. |
| [../NIGHT-SHIFT-PLAN.md](../NIGHT-SHIFT-PLAN.md), [../design-qa.md](../design-qa.md) | The previous version's implementation plan and header review. |

The release history for every version is in [CHANGELOG.md](../CHANGELOG.md).
