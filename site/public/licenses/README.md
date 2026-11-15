# Code provenance and licences

## Noto 3D Emoji game artwork

The slicing game's rocket, brain, laptop, books, hot beverage and gear are the
512 × 512 transparent renders from Google's
[Noto 3D Emoji](https://github.com/googlefonts/noto-emoji) (`3D/png/512/` on the
`main` branch, fetched on November 15, 2026). Copyright 2013 Google LLC. The
repository's licence, the SIL Open Font License 1.1, is reproduced in
[Noto-Emoji-OFL.txt](Noto-Emoji-OFL.txt); its README also lists image resources
under the Apache License 2.0. Both permit hosting the artwork here, and Google
announced the Noto 3D library as open source and free to use.

| Local file under `images/game/` | Upstream file under `3D/png/512/` | SHA-256 of the upstream PNG |
| --- | --- | --- |
| `rocket.webp` | `emoji_u1f680.png` | `7b4711ed742e7c872b97e12e3b3d16e42f32fb050d7ae3ba3d52335b4c69bb2d` |
| `brain.webp` | `emoji_u1f9e0.png` | `beaab83575bfc44c35d6bf4f31d54382f67d68b83748e5bc96de72090a49f994` |
| `laptop.webp` | `emoji_u1f4bb.png` | `86e8c2831f61ea72a5d7f589b6cf8b5de07733a0ca5aaf646cf3927bdf1cf082` |
| `books.webp` | `emoji_u1f4da.png` | `f8de12f54699e34ec9cdd189627d95475817aefc4f22619535fa09f096e3115a` |
| `hot_beverage.webp` | `emoji_u2615.png` | `8dfc51491904004b2b55f26a00070ece252c590a09e3a8cf3293e938d80831b6` |
| `gear.webp` | `emoji_u2699.png` | `666ea1f1626719d8149588a0209c9ca4517ed76152ca1e4bd18111146b1fd592` |

Modification: each PNG was converted to WebP (quality 90, full-quality alpha;
about 129 KB for all six instead of 1.6 MB) and is otherwise unchanged. The
converted files remain under the same licence. They are served locally; the
game clips and separates each image into two halves when sliced, and no
third-party runtime request is made.

## Existing code

The existing Giats licence and attribution remain in effect; the complete
notice is included in [`Giats-MIT.txt`](Giats-MIT.txt). The following upstream source
was fetched and its current terms checked on 2026-10-15.

## Kairo signal field

- Project: [Pixels71/kairo-astro](https://github.com/Pixels71/kairo-astro).
- Revision: `97426fdfa1f3bd812cf0acc364273c28a89f871e`.
- Source: [`components/animation/init/signal-field.ts`](https://github.com/Pixels71/kairo-astro/blob/97426fdfa1f3bd812cf0acc364273c28a89f871e/components/animation/init/signal-field.ts).
- Copyright: 2026 Pixels71.
- Terms: [upstream MIT licence](https://github.com/Pixels71/kairo-astro/blob/97426fdfa1f3bd812cf0acc364273c28a89f871e/LICENSE), reproduced in full in
  [`Kairo-MIT.txt`](Kairo-MIT.txt), including the upstream third-party exclusions.

The adaptation preserves the source's fine bone-coloured point grid, charcoal
background, orange travelling pulses, sinusoidal point motion and pointer
repulsion. Its canvas runs as one field beneath Giats's existing animated window
mask. The React lifecycle replaces Kairo's global initializer, intro-loader
dependency and custom document event. It uses the site's motion preference and
adds bounded canvas resolution, offscreen/document visibility pausing and
complete cleanup.

Kairo's photographs, fonts, brand, loader and other template content are not
reused. Its MIT grant expressly excludes its photographs, fonts and separately
licensed dependencies.

## Atelier North pixel reveal

- Project: [codrops/atelier-north](https://github.com/codrops/atelier-north).
- Revision: `6703fc3f15ec92979964070814a99855d0baa38f`.
- Source: [`src/scripts/global.js`, `pixelateImage()`](https://github.com/codrops/atelier-north/blob/6703fc3f15ec92979964070814a99855d0baa38f/src/scripts/global.js#L366-L429).
- Author credited by the project: [Kaisei Sadatoki](https://github.com/k-datacloud).
- Terms: the [repository README](https://github.com/codrops/atelier-north/blob/6703fc3f15ec92979964070814a99855d0baa38f/README.md#license)
  identifies the code as MIT. The linked `LICENSE` file is absent at this revision.
  [Codrops' official licensing page](https://tympanus.net/codrops/licensing/)
  states, “Our downloadable demos are licensed under the MIT license, if not
  specifically mentioned otherwise,” and supplies the full notice, copyright
  2026 Codrops. That notice is reproduced in
  [`Atelier-North-Codrops-MIT.txt`](Atelier-North-Codrops-MIT.txt); it is not
  represented as a licence file found in the Atelier North repository.

The adaptation retains the actual two-canvas pixel-to-sharp method: downsample
the source image to a temporary canvas, start at 18 pixels across, increase the
sample width using `progress ** 2.5`, and upscale with image smoothing disabled.
The React wrapper integrates with the existing animation/scroller infrastructure
and adds cleanup, responsive dimensions and a persistent ordinary image beneath
the decorative canvas. Reduced motion displays the finished image immediately.

No Atelier North photography, fonts, branding, other page sections or global
initializer is copied. The code licence is not used as permission for photographs.
Each locally bundled course photograph is documented separately in
[`ARTWORK-CREDITS.md`](ARTWORK-CREDITS.md) alongside these notices.

## Schedule calendar

Schedule uses Schedule-X calendar, calendar-controls, events-service and
theme-default 4.9.1, React adapter 4.1.0, Preact 10.29.8, @preact/signals 2.11.3
and signals-core 1.14.4, and temporal-polyfill 0.3.2. These packages use MIT
licences; temporal-spec 0.3.1 (type declarations) uses ISC. Their complete
installed notices are included in [Calendar-dependencies.txt](Calendar-dependencies.txt).
