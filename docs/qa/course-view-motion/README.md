# Course view motion repair

23 October 2026. Application baseline: `73efd61`. The branch also reuses the existing CI integration from PR #39 (`d6d155c`); no duplicate workflow was introduced.

## Problem and change

Work, Schedule, Study and Course info use hash navigation, which intentionally bypasses the full route curtain. Their content was conditionally replaced without any local transition. The regression check reproduced an outgoing Work view disappearing without an animated frame.

The course navigation controller now keeps the outgoing view mounted for a 0.18-second slide/fade, then reveals the new view over 0.4 seconds. It uses the same GSAP `power2.inOut` easing as the site's route animation. Assignment/topic details and Back use the same transition. Initial page loading remains owned by the existing route/loader effects; filters and disclosures within one view do not replay the view transition.

The latest URL cancels any unfinished transition. Only the transitioning content is inert; course navigation remains available. Scroll restoration happens before the reveal, focus follows it, and temporary styles are removed when finished or unmounted. Reduced motion and saved Pause Motion bypass the effect, including a preference change during an animation.

A keyboard regression also exposed deferred navigation focus stealing focus from an already selected control. Navigation now respects focus deliberately moved into the new content.

## Verification

- `cd site && npm test`: 205 passed.
- `SITE_BASE_PATH=/tmu-course-guides npm run build`: passed. Existing fluid console and legacy Portal hook warnings remain unchanged.
- `node site/scripts/verify-course-views.mjs`: 27 passed, no page errors. Includes animation-frame sampling, rapid interruption, motion preference changes, immediate note saving, animated Back/Forward with filter/scroll/focus restoration, keyboard/search, legacy links, backup/import, multiple submissions, calendar failure fallback, zoom/reflow and no-JavaScript information.
- Motion frame sampling and screenshots cover phone (390px), tablet (834px) and desktop (1440px) widths. The broader layout checks also cover 360, 430, 768 and 1024px. The motion case includes every course view.
- `npm run test:touch`: passed, including the existing Giats fluid effect, Desk colours, Pause/Play Motion, saved Pause Motion, system reduced motion and keyboard scrolling.
- The existing Pages workflow integration from PR #39 runs this expanded browser suite before deployment and uploads its reports with the Pages QA artifact.

These are Chromium browser-emulation checks using software rendering, not physical iPhone or iPad tests or a hardware frame-rate benchmark. No merging or production publication is part of this repair's delivery.
