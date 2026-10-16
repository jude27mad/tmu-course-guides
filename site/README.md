# TMU Course Guides: website source

This folder holds the source of the TMU Course Guides website, a Next.js app exported as static files and served by GitHub Pages. For how to use the website, see the [main README](../README.md).

## Build

```sh
npm ci
npm test                    # data, storage, artwork and lifecycle tests (node --test)
npm run export:preview      # static export, copied to ../next
```

- `SITE_BASE_PATH` (or `NEXT_PUBLIC_BASE_PATH`) sets the base path. The default is `/tmu-course-guides/next`, the preview address. Use `SITE_BASE_PATH=/tmu-course-guides` for the Pages root, or an empty value for a domain root.
- `export:preview` only replaces an output folder it created itself (marked with `.site-export`).
- `npm run fonts` rebuilds the Inter Display subsets (needs Python fontTools).
- Add `?stats` to any page URL for a frame-rate panel.

The repository root has a `.nojekyll` file so GitHub Pages serves the `_next` folder. CI runs `npm test` and `npm run build` for this folder on every push to `main`.

## Structure

| Path | Contents |
|---|---|
| `src/lib/` | Course data, deadlines, progress, search index and the motion preference. Pages import only `@src/lib` and `@src/lib/react`. Documented in [`src/lib/README.md`](src/lib/README.md). |
| `src/pages/` | Routes: the Desk (`index`), `courses`, the course guides (`[course]`, built for `cen100`, `mth140` and `mth141`), `privacy` and `404`. |
| `src/components/` | The shared shell: loader, navbar, menu, search panel, pre-footer, footer, background and fluid canvases, and the animation components. |
| `src/utils/theme.js` | Per-course colour schemes: `applyPalette`, `resetPalette` and `usePalette` set the CSS variables and the fluid tint. |
| `src/hooks/` | `useIsMobile`, `useInView`, `useStill` (reduced motion or the saved Pause motion setting) and `useScroll`. |
| `tests/` | Course-data/storage parity tests and focused signal-field, image-reveal and navbar lifecycle regressions. |

## Data and saved progress

- Deadlines and course content come from the same data as the previous version, copied into `src/lib/vendor/` and `src/lib/content/`. Deadline results are tested against the previous modules.
- Progress uses the previous version's `localStorage` keys and value formats, so existing progress carries over. The key table is in `src/lib/README.md`.
- Bumping `GUIDE_VERSION` (CEN100 in `src/lib/content/cen-literals.mjs`, the math guides in `src/lib/content/math.mjs`) shows the **What's changed?** unread badge until the notes are opened. Update the expected version in `tests/content.test.mjs` and `tests/storage.test.mjs` as well.
- Add the matching entry (`date`, `title`, `text`, `items`) at the top of `updates` in `src/lib/content/pages.mjs`. Do not regenerate that file with `tests/extract/pages.mjs`: it would remove entries added since the move to this design.

## Motion and accessibility

- `prefers-reduced-motion` and the saved Pause motion setting (`guide-motion-paused`) turn off the loader curtain, route transitions, appear animations, background drift, fluid effect, pre-footer physics and marquee, and render the 3D scenes on demand so they hold still. Lenis wheel smoothing stays on.
- Pinch zoom, text selection, keyboard scrolling, visible focus, a skip link and 44 px tap targets for buttons and controls on phones. Without JavaScript the static course content renders; deadlines, checklists, card details and What's changed? need JavaScript.

## Privacy

No analytics and no requests to other hosts. Each exported page carries a Content Security Policy (`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`; `connect-src 'self'`; `font-src 'self'`; `worker-src 'self' blob:`).

## Credits and licences

- Design based on the open-source portfolio by Evangelos Giatsidis ([giats.me](https://giats.me)), used under the MIT licence in [`LICENSE`](LICENSE). The licence notice must stay with the code, and the credit line stays in the site footer. The original project's README asks for that credit line and for no commercial use without permission.
- Inter Display (The Inter Project Authors), SIL Open Font License 1.1: `public/fonts/OFL.txt`.
- `public/other/grain.png` and the icons are generated for this website. Removed marble course-code textures and the unused warehouse HDR are no longer served.

## Artwork replacements

Giats's layout, moving window masks, typography, transitions and scrolling remain
the application shell. The home windows contain one continuous signal field
adapted from Pixels71's Kairo (`97426fdfa1f3bd812cf0acc364273c28a89f871e`).
Next Up and course artwork use locally stored photographs of a steel bridge
mechanism (CEN100), a worked integral (MTH140) and a system of linear equations
(MTH141), with the canvas pixel-to-sharp reveal from Kaisei Sadatoki's Atelier North for Codrops
(`6703fc3f15ec92979964070814a99855d0baa38f`). Both respect the existing Pause
motion and reduced-motion preferences.

See [animation code provenance and notices](public/licenses/README.md) and
[individual artwork sources and permissions](public/licenses/ARTWORK-CREDITS.md). Kairo's
code licence is MIT; its photographs are expressly excluded. Atelier North's
README declares MIT but its linked licence file is absent at the checked revision,
so the included notice comes from Codrops' official licensing page. Neither
template's photographs are reused.


The artwork is published on the live [`/next/`](https://jude27mad.github.io/tmu-course-guides/next/) preview. See the [QA record](../docs/qa/giats-artwork/README.md) and [subject-image screenshot gallery](../docs/qa/giats-artwork/subject-imagery/README.md).

Implementation lives in `src/components/artwork/` (signal field) and `src/components/courseArtwork/` (image mapping and reveal). Update `artworks.mjs` and the individual asset credits together when changing photographs. The engineering image is the unresolved/empty Next Up fallback. Source images are local 800/1600-pixel WebPs; no image host is contacted at runtime.
