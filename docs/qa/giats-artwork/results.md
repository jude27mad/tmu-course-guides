# Giats artwork browser verification

Final export build `lMK_JvjVNpFTFtpP9cphE`, based on `main` at `2668ada`.

**133/134 assertions passed.** All artwork, responsive, touch-scroll, motion, image fallback, saved-progress and lifecycle checks passed. The one retained failure is an existing paused-menu offset, reproduced in the original committed preview: after a menu route change with saved Pause motion, the page can remain shifted left. See [baseline evidence](baseline-paused-navigation.json) and [final reproduction](screenshots/desktop-paused-menu-known-issue.jpg). A normal browser reload was used to continue independent checks; the failure remains recorded.

The rapid menu/header regression found in the earlier artwork export now passes on this build: the navbar stays visible and the menu can be used again. The [failed-before evidence](before-navigation-fix/README.md) is preserved separately. The source fix also has a real-GSAP regression test that failed before the correction.

The fresh full matrix ran 2026-10-15T22:53:03.223Z with Chromium 154.0.8037.57. Four additional homepage-header assertions used fresh contexts on the **same build**, recorded in [home-navbar-verification.json](home-navbar-verification.json); no results from a different build were combined. Browser/page/HTTP errors and third-party runtime requests: **0**.

Viewport coverage: 390 × 844, 430 × 932, 820 × 1180, 1440 × 900. Home windows, Next Up, all three course heroes, menu/search, course navigation and browser Back/Forward were checked. All three course images remained loaded and their decorative canvases hidden under saved Pause, reduced motion, missing Canvas2D and no JavaScript. The unresolved server-rendered Next Up used the local fallback image. Section choice, checklist persistence after reload, Mark done and Undo passed.

Five real course-link/browser-Back round trips followed a warm-up in a fresh motion-enabled context:

| Resource | Before | After |
| --- | ---: | ---: |
| Live listeners | 419 | 419 |
| Retained listeners | 421 | 421 |
| Active observers | 42 | 42 |
| Recurring animation-frame callbacks | 4 | 4 |
| Pending animation-frame callbacks | 4 | 5 |
| Connected canvases | 5 | 5 |

The extra pending callback is a finite frame request; recurring callbacks did not grow. Full resource details are in [results.json](results.json).

These are Chromium browser-emulated viewports and touch input, **not physical iPhone or Safari testing**. Software rendering does not establish device GPU performance. Hidden-document pause uses a synthetic visibility event. No empty coursework/completion state or dates were fabricated: unresolved fallback is verified in the no-JavaScript export and null/unknown artwork mapping is covered by component tests. No deployment was performed.

## Selected screenshots

- [390 px home windows](screenshots/phone390-home.jpg)
- [Active orange pointer pulse](screenshots/desktop-signal-pointer.jpg)
- [Actual pixel reveal in progress](screenshots/phone390-pixel-reveal.jpg)
- [Finished Next Up](screenshots/desktop-next-up.jpg)
- [CEN100 hero](screenshots/phone390-cen100.jpg)
- [MTH140 hero](screenshots/phone430-mth140.jpg)
- [MTH141 hero](screenshots/phone430-mth141.jpg)
- [Desktop checklist artwork](screenshots/desktop-checklist.jpg)
- [No-JavaScript fallback](screenshots/desktop-no-js-next-up.jpg)

Supplemental pointer/reveal captures are tied to this final build in [supplemental-captures.json](supplemental-captures.json). The pointer capture recorded 2,234 orange canvas pixels after a real mouse click, with no errors. The intermediate reveal screenshot is deliberately pixelated; finished images were captured after the decorative canvas hid.

## Assertions

- PASS: phone390 home: no horizontal overflow
- PASS: phone390: one continuous signal canvas and original window mask
- PASS: phone390: touch scroll passes through artwork
- PASS: phone390 Next Up: locally loaded photo and stable dimensions
- PASS: phone390: menu opens
- PASS: phone390: search returns course results
- PASS: phone390: cen100 navigation heading
- PASS: phone390 cen100: no horizontal overflow
- PASS: phone390 cen100 hero: locally loaded photo and stable dimensions
- PASS: phone390: cen100 reveal finishes at initial scroll position
- PASS: phone390 checklist: no horizontal overflow
- PASS: phone390: mth140 navigation heading
- PASS: phone390 mth140: no horizontal overflow
- PASS: phone390 mth140 hero: locally loaded photo and stable dimensions
- PASS: phone390: mth140 reveal finishes at initial scroll position
- PASS: phone390: mth141 navigation heading
- PASS: phone390 mth141: no horizontal overflow
- PASS: phone390 mth141 hero: locally loaded photo and stable dimensions
- PASS: phone390: mth141 reveal finishes at initial scroll position
- PASS: phone390: browser Back
- PASS: phone390: browser Forward
- PASS: phone430 home: no horizontal overflow
- PASS: phone430: one continuous signal canvas and original window mask
- PASS: phone430: touch scroll passes through artwork
- PASS: phone430 Next Up: locally loaded photo and stable dimensions
- PASS: phone430: menu opens
- PASS: phone430: search returns course results
- PASS: phone430: cen100 navigation heading
- PASS: phone430 cen100: no horizontal overflow
- PASS: phone430 cen100 hero: locally loaded photo and stable dimensions
- PASS: phone430: cen100 reveal finishes at initial scroll position
- PASS: phone430: mth140 navigation heading
- PASS: phone430 mth140: no horizontal overflow
- PASS: phone430 mth140 hero: locally loaded photo and stable dimensions
- PASS: phone430: mth140 reveal finishes at initial scroll position
- PASS: phone430: mth141 navigation heading
- PASS: phone430 mth141: no horizontal overflow
- PASS: phone430 mth141 hero: locally loaded photo and stable dimensions
- PASS: phone430: mth141 reveal finishes at initial scroll position
- PASS: phone430: browser Back
- PASS: phone430: browser Forward
- PASS: tablet home: no horizontal overflow
- PASS: tablet: one continuous signal canvas and original window mask
- PASS: tablet: touch scroll passes through artwork
- PASS: tablet Next Up: locally loaded photo and stable dimensions
- PASS: tablet: menu opens
- PASS: tablet: search returns course results
- PASS: tablet: cen100 navigation heading
- PASS: tablet cen100: no horizontal overflow
- PASS: tablet cen100 hero: locally loaded photo and stable dimensions
- PASS: tablet: cen100 reveal finishes at initial scroll position
- PASS: tablet: mth140 navigation heading
- PASS: tablet mth140: no horizontal overflow
- PASS: tablet mth140 hero: locally loaded photo and stable dimensions
- PASS: tablet: mth140 reveal finishes at initial scroll position
- PASS: tablet: mth141 navigation heading
- PASS: tablet mth141: no horizontal overflow
- PASS: tablet mth141 hero: locally loaded photo and stable dimensions
- PASS: tablet: mth141 reveal finishes at initial scroll position
- PASS: tablet: browser Back
- PASS: tablet: browser Forward
- PASS: desktop home: no horizontal overflow
- PASS: desktop: one continuous signal canvas and original window mask
- PASS: desktop Next Up: locally loaded photo and stable dimensions
- PASS: desktop: menu opens
- PASS: desktop: search returns course results
- PASS: desktop: cen100 navigation heading
- PASS: desktop cen100: no horizontal overflow
- PASS: desktop cen100 hero: locally loaded photo and stable dimensions
- PASS: desktop: cen100 reveal finishes at initial scroll position
- PASS: desktop checklist: no horizontal overflow
- PASS: desktop: mth140 navigation heading
- PASS: desktop mth140: no horizontal overflow
- PASS: desktop mth140 hero: locally loaded photo and stable dimensions
- PASS: desktop: mth140 reveal finishes at initial scroll position
- PASS: desktop: mth141 navigation heading
- PASS: desktop mth141: no horizontal overflow
- PASS: desktop mth141 hero: locally loaded photo and stable dimensions
- PASS: desktop: mth141 reveal finishes at initial scroll position
- PASS: desktop: browser Back
- PASS: desktop: browser Forward
- PASS: motion enabled: signal field draws
- PASS: canvas resolution capped
- PASS: offscreen signal pauses
- PASS: hidden document pauses artwork
- PASS: Pause motion saves existing key
- PASS: Pause motion stops signal field
- PASS: saved Pause motion survives reload with static field
- FAIL: saved Pause motion: menu navigation restores the page — {"route": "mth140/", "menuRemainsOpen": false, "mainX": -576, "baseline": "Also reproduced in original committed export; see baseline-paused-navigation.json"}
- PASS: section selection persists
- PASS: checklist saves existing progress format
- PASS: saved checklist survives reload
- PASS: Mark done exposes Undo
- PASS: Undo restores mark action
- PASS: motion enabled: menu return restores navbar
- PASS: route round trips do not accumulate live listeners
- PASS: route round trips do not accumulate active observers
- PASS: route round trips do not accumulate animation loops
- PASS: route round trips do not accumulate canvases
- PASS: saved-pause Next Up: locally loaded photo and stable dimensions
- PASS: saved-pause cen100: locally loaded photo and stable dimensions
- PASS: saved-pause cen100: finished image without decorative overlay
- PASS: saved-pause mth140: locally loaded photo and stable dimensions
- PASS: saved-pause mth140: finished image without decorative overlay
- PASS: saved-pause mth141: locally loaded photo and stable dimensions
- PASS: saved-pause mth141: finished image without decorative overlay
- PASS: reduced Next Up: locally loaded photo and stable dimensions
- PASS: reduced cen100: locally loaded photo and stable dimensions
- PASS: reduced cen100: finished image without decorative overlay
- PASS: reduced mth140: locally loaded photo and stable dimensions
- PASS: reduced mth140: finished image without decorative overlay
- PASS: reduced mth141: locally loaded photo and stable dimensions
- PASS: reduced mth141: finished image without decorative overlay
- PASS: reduced motion uses static signal frame
- PASS: canvas-failure Next Up: locally loaded photo and stable dimensions
- PASS: canvas-failure cen100: locally loaded photo and stable dimensions
- PASS: canvas-failure cen100: finished image without decorative overlay
- PASS: canvas-failure mth140: locally loaded photo and stable dimensions
- PASS: canvas-failure mth140: finished image without decorative overlay
- PASS: canvas-failure mth141: locally loaded photo and stable dimensions
- PASS: canvas-failure mth141: finished image without decorative overlay
- PASS: unresolved SSR Next Up uses fallback artwork
- PASS: no-js Next Up: locally loaded photo and stable dimensions
- PASS: no-js cen100: locally loaded photo and stable dimensions
- PASS: no-js cen100: finished image without decorative overlay
- PASS: no-js mth140: locally loaded photo and stable dimensions
- PASS: no-js mth140: finished image without decorative overlay
- PASS: no-js mth141: locally loaded photo and stable dimensions
- PASS: no-js mth141: finished image without decorative overlay
- PASS: no new browser errors or third-party runtime requests
- PASS: phone390: homepage navbar visible
- PASS: phone430: homepage navbar visible
- PASS: tablet: homepage navbar visible
- PASS: desktop: homepage navbar visible
