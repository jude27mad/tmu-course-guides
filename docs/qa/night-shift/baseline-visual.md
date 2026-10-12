# Night Shift Stage 0: visual baseline

Recorded 2026-10-12, before any Stage 1 product change. No product files changed.

- Product files at `406c4a4` (HEAD `a6cd211` only adds `docs/qa/night-shift/*`)
- `node tools/preview-server.mjs --port 4310` from the repo root (pages at `/`, `/mth140/`, `/mth141/`, no project base)
- Playwright 1.56.1, Chromium from `/opt/pw-browsers`, headless, SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`). This is software WebGL, not real-GPU evidence.
- Default motion (no reduced-motion emulation, Pause control not pressed): `data-motion="on"`, `data-ns-tier="mid"` on every page.
- Viewports: 1440×900 (DPR 1); 390×844 with `isMobile`, `hasTouch` and DPR 2 (images are 780×1688). Viewport captures, not full-page.

## Method

**Settled:** `document.fonts.ready`; `document.readyState === 'complete'`; the `.wrap` / `.math-wrap` computed `transform`, `filter`, `translate`, `scale` and `rotate` are `none` and `opacity` is `1`; that clean state has lasted at least 400 ms, so a clean frame before the intro starts does not count; then a 1.5 s wait and the capture. A page that does not settle within 15 s would count as a defect.

**Timing:** an init script samples the wrapper on every `requestAnimationFrame` from navigation start. `performance.now()` is measured from navigation start.

## Screenshots

Directory: `/tmp/claude-0/-home-user/139e7345-1989-51b0-a0bd-904ec500836c/scratchpad/shots/` (outside the repo)

| File | Settled | Last unsettled frame (ms from nav start) | Settle detected (ms after `load`) | scrollWidth / clientWidth |
|---|---|---|---|---|
| `baseline-root-1440-dark.png` | yes | 836 | 1447 | 1440 / 1440 |
| `baseline-root-1440-light.png` | yes | 1822 | 1711 | 1440 / 1440 |
| `baseline-root-390-dark.png` | yes | 830 | 3695 | 390 / 390 |
| `baseline-root-390-light.png` | yes | 1021 | 909 | 390 / 390 |
| `baseline-mth140-1440-dark.png` | yes | 5658 | 5747 | 1440 / 1440 |
| `baseline-mth140-1440-light.png` | yes | 1452 | 4432 | 1440 / 1440 |
| `baseline-mth140-390-dark.png` | yes | 688 | 807 | 390 / 390 |
| `baseline-mth140-390-light.png` | yes | 666 | 3854 | 390 / 390 |
| `baseline-mth141-1440-dark.png` | yes | 1669 | 1642 | 1440 / 1440 |
| `baseline-mth141-1440-light.png` | yes | 1657 | 4841 | 1440 / 1440 |
| `baseline-mth141-390-dark.png` | yes | 670 | 3879 | 390 / 390 |
| `baseline-mth141-390-light.png` | yes | 665 | 4200 | 390 / 390 |

All 12 settled within the 15 s limit. Some settle-detection times are much later than the last unsettled frame because main-thread stalls also delayed the harness's `page.evaluate` polling.

## Intro timing: `/mth140/` at 1440×900, dark

`enterPage` (`assets/guide-motion.mjs`) tweens `.math-wrap` from opacity 0.85 / y 12 to 1 / 0 over 0.35 s. In every run below it started once, with no restart.

| Run | DOMContentLoaded | Intro starts (opacity 0.85) | Wrapper settled | Longest rAF gap before settle |
|---|---|---|---|---|
| 1 | 397 ms | 400 ms | **6053 ms** | 3849 ms, starting at 2179 ms |
| 2 | 371 ms | 321 ms | **5011 ms** | 3335 ms, starting at 1676 ms |
| 3 | 368 ms | 371 ms | **646 ms** | 169 ms |

- An earlier pass with the same sampler gave 1532, 671 and 4854 ms.
- Results are bimodal. With no stall, the wrapper settles about 0.65 s after navigation, roughly 0.28 s after the intro begins.
- In 2 of 3 runs, a 3.3–3.8 s stall with no rendered frames started 1.7–2.2 s after navigation. During it, the content stays partly transparent and offset, so it settles at 5–6 s.
- The stall coincides with the idle-loaded Night Shift features and the scene's WebGL start-up under SwiftShader, which logs `THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported.` The cause was not isolated, and the stall is not confirmed on a real GPU.
- Plan §7 target: settled within 500 ms. The best run (646 ms from navigation start) misses it, because the intro starts only after DOMContentLoaded at about 370 ms.

## Console errors

Every page and run had the same result: 6 console errors and 0 `pageerror`s.

```
Failed to load resource: the server responded with a status of 404 (Not Found)   ×6
  /assets/night/warp.css     /assets/night/warp.mjs
  /assets/night/palette.css  /assets/night/palette.mjs
  /assets/night/feel.css     /assets/night/feel.mjs        (all ?v=20261012-night2)
```

- **Source:** `assets/night/boot.mjs` `FEATURES` lists `warp`, `palette` and `feel`, but those files do not exist.
- **Warnings on every page:** 3 × `Night Shift: <warp|palette|feel> unavailable TypeError: Failed to fetch dynamically imported module …` and the THREE warning above.
- **Effect:** `data-ns-failed="warp palette feel"` is set on `<html>`.

## Horizontal overflow

None. `scrollWidth === clientWidth` on all 12 captures.

## Composition at rest

These observations are from the settled captures, not from the Pause motion state.

- **Light theme does not cover the hero.** In all 6 light captures, the hero and scene stay a dark graphite slab between a light sidebar/header and a light toolbar. The scene and hero have no daytime or white-paper variant, so light mode looks like two themes joined together.
- **No coursework in the first viewport, and the next item is weak.** At 1440×900 the hero runs to about y=648, followed by the toolbar and the decorative outline marquee. No assessment row is visible at either width. The next deadline is a small single line (`NEXT · Academic Integrity Quiz · 1d 21h 59m`) with no actual date or Toronto time. MTH140 shows `Lab Quiz 2 · Quiz week`, and the `Choose section` call to action is separate, in the toolbar. There is no dominant next-assessment card.
- **The desktop hero is two disconnected halves.** The title block sits left and the art floats right. A dead band of about 170 px separates the NEXT line from `DRAG TO EXPLORE` and the pause button. The hero is tall but carries little information.
- **The outline marquee reads as clipped text.** The bottom strip crops the course code at the left edge (`00 —`, `40 —`, `41 —`) and the title at the right edge (`ENGINEERIN…`, `LINEAR ALGE…` at 390 px). In light mode it is a pale outline on a pale wash, so it has low contrast and its purpose is unclear.
- **The scramble in the hero eyebrow can still be running after the wrapper settles.** `baseline-root-390-light.png` caught the eyebrow mid-scramble (`G0 / UXPM1SBKYHL`) 1.5 s after the wrapper settled. A follow-up check showed the 0.38 s decode running from 1.46 s to at least 7.03 s under SwiftShader before it restored the text. So wrapper-based settling does not guarantee readable hero text in software rendering.
- **What already works:**
  - Archivo condensed titles, the mono eyebrow labels and the course accents read clearly in both themes.
  - Course tabs, view tabs and the toolbar have generous tap targets at 390 px.
