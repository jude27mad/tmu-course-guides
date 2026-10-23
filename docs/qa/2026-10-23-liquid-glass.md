# Liquid Glass controls — implementation and QA

## Scope

Started from `164a8ee` (merged #43, #44 and #46), then incorporated `dab3008` (#47) when Safari scrolling merged during implementation. Glass is confined to the course navigation, Menu/Search and Guide tools trigger. The dialog uses a matching rim/header and solid body. The current palette, Giats hover/fluid effects, routing, scroll restoration, native dialog behaviour and saved-data keys remain in place.

Shared SCSS defines the material, 8–12px blur on wider screens and opaque preference fallbacks. Repeated WebKit comparisons still showed rendering overhead with a reduced 4px kernel, so screens up to 600px keep the translucent backing, rim and sheen without backdrop blur. The moving tab selection uses the existing GSAP instance and only measures on selection/resize/font changes; it never delays routing. Wrapping changes use a fade, and reduced motion settles immediately. Pause motion makes all controls solid using the existing `data-motion` preference bridge. Menu and Search share a 16px minimum for their helper text.

## Concurrent work

- #45 remains a separate draft. This branch does not import its older sticky navigation, scroll offsets or view timings. Compatible control text floors are implemented here where the glass controls need them. Direct-answer and content changes remain in that PR.
- #47's Safari document scrolling is incorporated. WebKit phone checks use the iPhone browser profile so the glass controls are exercised in that document-scroll mode. The independent iOS route/scroll workflow is retained.
- #37's fluid allocation work is independent. No new canvas or pointer loop is introduced.

## Verification

Tests and production builds run in GitHub Actions only, per the owner's instruction. Existing data/storage, course views, publishing, touch and interaction-feedback checks remain enabled.

CI setup also covers `/etc/apt/apt-mirrors.txt` in the existing HTTPS mirror workaround. Runner logs showed that this mirror-list indirection still used the slow Azure HTTP mirror after the ordinary source files were updated; one dependency download took over nine minutes. No test assertions or runner permissions are changed by this setup correction.

The new glass browser checks cover 320/390/834/1440px layouts, labels/targets, one selection per bar, rapid taps, history, keyboard focus, 200% CSS zoom, note persistence, dialog focus return, reduced motion, saved Pause motion, available contrast/transparency emulation and a simulated unsupported-filter fallback. Contrast is calculated against black and white backdrops and the endpoints of the sheen. A pixel-level check verifies the Menu label. Visual captures wait for the header reveal, fonts and a paint boundary: WebKit's initial Desk screenshots were blank while the immediate follow-up screenshots painted both labels without an app change. The speculative 3D-text workaround was removed; existing hover effects remain unchanged. Native browser zoom and physical-device GPU performance are not claimed.

CI uploads `pages-site-qa` (including screenshots and traces) and `site-preview` (the production export). Paired on/off timings on the same runner are diagnostics, not physical-device FPS or a guarantee about older phones.

Verification results and exact CI run links are maintained in [PR #48](https://github.com/jude27mad/tmu-course-guides/pull/48), alongside its latest commit. No local tests, build or browser QA were run. No merge or production publish is authorized by this implementation request.
