# UI consistency verification

Branch: `codex/consistent-course-ui`, based on `3154ec9` (including PR #42).

## Changes checked

- Shared body text has a 16 px floor; secondary metadata has a 14 px floor. Primary action labels are at least 16 px, with 44 px targets on phones, tablets and desktops.
- Course tabs remain visible below the header. Fragment navigation accounts for both bars; history still restores the previous filter, scroll position and focused opener.
- Guide tools uses the course transition's `power2.inOut` easing, 0.4 s entrance and 0.18 s exit. Native modal focus and background locking last through the exit. Reopening, Escape, route cleanup and a motion-preference change cancel or finish animations safely.
- Course info is a question index with one full-width answer and Back. Grading, contacts, rules, confirmations, textbooks and sources keep their content. The source blocks supply both the answer and search index. A no-JavaScript reference preserves every policy answer.
- Both searches resolve policy questions and exercise references directly. Existing assignment, assessment, topic and broad help links still resolve.
- Study shows recommended exercises before skill checks and links the textbooks with their edition qualifications. Backup guidance appears once; the menu calls its next deadlines “Coming up”.
- Course info's phone group gaps fell from approximately 109 px to 24 px; the old global section padding no longer applies there.

## Verification

| Check | Result |
| --- | --- |
| `npm --prefix site test` | 219 passed |
| Production build with `SITE_BASE_PATH=/tmu-course-guides` | Passed, including Next.js lint |
| `check-consistency.mjs` | 18 passed |
| `verify-course-views.mjs` | 27 passed |
| `check-touch-fluid.mjs` | 29 passed, including footer browser-surface behaviour from PR #42 |
| `check-palette-site.mjs` | 30 passed |
| Published-file assembly/check and `check-pages-site.mjs --local` | Passed; 34 browser/link checks |
| Layout review | 42 combinations at 390, 834 and 1440 px; no horizontal overflow or page errors |

The course checks cover immediate note saving before navigation, reload persistence, checklist/submission separation, multiple submissions, targets, backup/import, section selection, search, legacy URLs, browser Back/Forward, keyboard focus, interrupted motion, reduced motion, the calendar's failure fallback, and 200% equivalent reflow. Additional consistency checks cover 320 px navigation, tools focus/scroll locking, direct policy links after reload, and no-JavaScript policy access. These checks are included in the Pages PR workflow.

Representative screenshots were inspected for Work, Schedule, Study, Course info, policy answers, Guide tools, menu/search, Desk and the wider shared pages. The existing Giats font, palette, artwork and touch/fluid treatment remain in place. No data, checklist IDs, saved-state keys or Toronto date rules were changed.

## Limits and delivery

Testing used local Chromium with browser viewport/touch emulation. No physical phone/tablet or native Safari/Firefox device test was performed; 200% reflow is an equivalent CSS viewport, not a physical browser's zoom UI. The production build retains the pre-existing warnings in the fluid pointer hook and Portal hook.

This is a draft PR for review. Neither merging nor production publishing is part of this pass. PR #37's independent fluid allocation changes remain separate.
