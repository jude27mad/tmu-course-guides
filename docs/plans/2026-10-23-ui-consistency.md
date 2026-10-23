# UI consistency pass

Approved by the owner's “Make it consistent” instruction after the consistency audit.

Base: `3154ec9` (includes the neutral palette, course-view motion and the merged Safari footer tint fix). Branch: `codex/consistent-course-ui`. Keep the Giats shell, new palette, touch effect, data, dates and saved-state formats. PR #42 merged during implementation and was incorporated before final checks. PR #37 still owns the independent fluid allocation work; its files were left unchanged.

- [x] Give shared text and action controls readable minimum sizes at phone, tablet and desktop widths; retain the existing typeface, proportions and hover treatment.
- [x] Keep course navigation reachable while working. Account for the sticky bar in hash navigation, focus and scroll restoration, including zoom/reflow.
- [x] Animate Guide tools with the existing GSAP motion character. Preserve native modal semantics, Escape, backdrop dismissal, focus, scrolling, interrupted animations and reduced motion.
- [x] Put recommended practice before skills. Give Course info questions individual destinations and Back, using existing facts and qualifications; preserve legacy hashes, search and no-JavaScript reference access.
- [x] Present shared backup guidance once and label upcoming menu deadlines accurately.
- [x] Extend existing CI browser coverage for these behaviours, run the relevant tests and production export, inspect representative layouts, and deliver a draft PR. Merge/publish requires a new explicit instruction.

The existing shorter-course-views plan remains the routing/storage baseline. The saved less-reading plan's practice-first and direct-answer structure applies; no onboarding wizard or new UI framework is needed for this pass. No official course fact is refreshed or inferred from the calendar date.
