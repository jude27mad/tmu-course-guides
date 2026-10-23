# Code provenance and licences

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
