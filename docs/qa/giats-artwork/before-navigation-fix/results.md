# Giats artwork browser verification

2026-10-15T22:42:26.960Z

Chromium headless; software rendering; browser viewport/touch emulation, not physical iPhone testing. Chromium 154.0.8037.57. Export build _XqXe7JZIBqPzXc_-5GiC.

128/130 assertions passed.

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
- FAIL: saved Pause motion: menu navigation restores the page — {"route":"mth140/","menuRemainsOpen":false,"mainX":-576,"baseline":"Also reproduced in original committed export; see baseline-paused-navigation.json"}
- PASS: section selection persists
- PASS: checklist saves existing progress format
- PASS: saved checklist survives reload
- PASS: Mark done exposes Undo
- PASS: Undo restores mark action
- FAIL: motion enabled: menu return restores navbar — {"observation":{"url":"http://127.0.0.1:43025/tmu-course-guides/next/","main":{"x":0,"y":0,"width":1440,"height":900,"top":0,"right":1440,"bottom":900,"left":0},"menu":"true","header":{"visibility":"hidden","opacity":"0","inert":false}},"baseline":"Comparison recorded separately in baseline-active-navigation.json"}
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


This is pre-fix evidence, not the final build. See [archive context and preserved screenshots](README.md) and [final browser results](../results.md).
## Preserved failure captures

- [Hidden navbar](hidden-navbar.jpg)
- [Pre-existing paused-menu offset](paused-menu.jpg)
- [Rapid navigation comparison](rapid-comparison.json)

This is the earlier build `_XqXe7JZIBqPzXc_-5GiC`, preserved as failed-before evidence. Current results and screenshots are in the parent directory.
