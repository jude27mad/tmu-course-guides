# Delayed Navigation Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep fast navigation quiet while retaining useful feedback for a genuine wait.

**Architecture:** Keep immediate selection and routing independent of feedback visibility. A small shared React hook delays the existing status by 250 ms, keyed to the pending destination; completion, replacement and unmount invalidate it. Page feedback tracks the route request, not the decorative route animation. The lazy calendar uses the same delayed visibility rule.

**Tech Stack:** Existing Next.js 14 / React 18 / GSAP; Playwright in GitHub Actions. No new dependencies.

**Spec:** The user's approved conversation proposal: immediate tab response; delayed loading feedback; no artificial wait or flash on a fast interaction; preserve the recent smooth transitions; support slower devices without device-model detection.

## Global Constraints

- Delay loading feedback by 250 ms of pending work, not by phone model.
- Never delay content availability or extend loading just to display a message.
- Keep immediate selected-tab response, existing animation, reduced motion, focus, scroll and history behavior.
- Cancel stale timers; a replaced request cannot reuse the previous request's visible state.
- Keep navigation errors/retry and calendar failure fallback immediate.
- All tests and builds run on GitHub CI, not locally, at the user's request.
- Do not edit course data, saved progress, fluid effects, the menu, or the old exported site.

## Review Focus

- Fast switches must not flash status between rendered frames.
- A genuinely slow request must still expose a readable live status.
- Rapid switches, repeat taps and Back must not leave a stale destination/message.
- A completed route must not keep reporting loading during its cosmetic entrance.
- Reduced motion and unmount must not strand timers or disable the new content.

## Task 1: Navigation feedback and its CI regressions

**Files:**
- Create: `site/src/hooks/useDelayedFeedback.js`
- Modify: `site/src/pages/course/components/workspace/useCourseNavigation.js`
- Modify: `site/src/components/dom/NavigationFeedback.jsx`
- Modify: `site/src/pages/course/components/workspace/Schedule.jsx`
- Test: `site/scripts/check-delayed-feedback.mjs`
- Modify test: `site/scripts/check-interaction-feedback.mjs`
- Wire CI: `.github/workflows/pages.yml`
- Document: `site/README.md`

**Interfaces:** `useDelayedFeedback(pendingKey, delay = 250) -> boolean`. A null key means no pending work. A stable key identifies the same pending destination across acknowledgement and the hash transition; a different key starts a new delay. The hook does not control routing or animation.

- [ ] Add browser regressions against the unchanged production code. Assert immediate selected state without immediate status, then delayed status only while a real/controlled request remains pending. Exercise replacement, cancellation, fast route animation, errors, and calendar loading.
- [ ] Push a test-only commit to a dedicated PR and inspect the failing GitHub Actions assertions. Do not merge the red commit.
- [ ] Add the shared delayed-feedback hook and connect the three existing loading presentations. Keep request lifecycle and content transitions intact.
- [ ] Update the source README, push, and inspect the full CI and Pages build/browser results. Fix task-related failures without weakening assertions.
- [ ] Obtain an independent code review and verify the final branch diff. Report exact CI and publication status; do not claim physical-device testing.
