# Liquid Glass controls — implementation and QA

## Scope

Based on `164a8ee` (merged #43, #44 and #46). Glass is confined to the course navigation, Menu/Search and Guide tools trigger. The dialog uses a matching rim/header and solid body. The current palette, Giats hover/fluid effects, routing, scroll restoration, native dialog behaviour and saved-data keys remain in place.

Shared SCSS defines the material, 8–12px blur and opaque fallback. The moving tab selection uses the existing GSAP instance and only measures on selection/resize/font changes; it never delays routing. Wrapping changes use a fade, and reduced motion settles immediately. Pause motion also removes the blur using the existing `data-motion` preference bridge.

## Concurrent work

- #45 remains a separate draft. This branch does not import its older sticky navigation, scroll offsets or view timings. Compatible control text floors are implemented here where the glass controls need them. Direct-answer and content changes remain in that PR.
- #47 changes Safari document scrolling. This branch avoids the scrolling implementation; any merged changes will be incorporated before final CI verification.
- #37's fluid allocation work is independent. No new canvas or pointer loop is introduced.

## Verification

Tests and production builds run in GitHub Actions only, per the owner's instruction. Existing data/storage, course views, publishing, touch and interaction-feedback checks remain enabled.

The new glass browser checks cover 320/390/834/1440px layouts, labels/targets, one selection per bar, rapid taps, history, keyboard focus, 200% CSS zoom, note persistence, dialog focus return, reduced motion, saved Pause motion, available contrast/transparency emulation and a simulated unsupported-filter fallback. Contrast is calculated against black and white backdrops and the endpoints of the sheen. Native browser zoom and physical-device GPU performance are not claimed.

CI uploads `pages-site-qa` (including screenshots and traces) and `site-preview` (the production export). Paired on/off timings on the same runner are diagnostics, not physical-device FPS or a guarantee about older phones.

Status: awaiting GitHub CI on the implementation commit. No local tests, build or browser QA were run. No merge or production publish is authorized by this implementation request.
