# TMU Course Guides: website source

This folder holds the source of the TMU Course Guides website, a Next.js app exported as static files and served by GitHub Pages. For how to use the website, see the [main README](../README.md).

## Build

```sh
npm ci
npm test                    # data tests (node --test)
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
| `tests/` | Data tests, including parity checks against the previous version's modules in `../assets`. |

## Data and saved progress

- Deadlines and course content come from the same data as the previous version, copied into `src/lib/vendor/` and `src/lib/content/`. Deadline results are tested against the previous modules.
- Progress uses the previous version's `localStorage` keys and value formats, so existing progress carries over. The key table is in `src/lib/README.md`.
- Bumping `GUIDE_VERSION` (CEN100 in `src/lib/content/cen-literals.mjs`, the math guides in `src/lib/content/math.mjs`) shows the **What's changed?** unread badge once. Add the matching entry to `updates` in `src/lib/content/pages.mjs`.

## Motion and accessibility

- `prefers-reduced-motion` and the saved Pause motion setting (`guide-motion-paused`) turn off the loader curtain, route transitions, appear animations, background drift, fluid effect, pre-footer physics and marquee.
- Pinch zoom, text selection, keyboard scrolling, visible focus, a skip link and 44 px tap targets on phones. Content renders without JavaScript.

## Privacy

No analytics and no requests to other hosts. Each exported page carries a Content Security Policy (`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`; `connect-src`, `font-src` and `worker-src` limited to the site itself).

## Credits and licences

- Design based on the open-source portfolio by Evangelos Giatsidis ([giats.me](https://giats.me)), used under the MIT licence in [`LICENSE`](LICENSE). The licence notice must stay with the code, and the credit line stays in the site footer. The author asks that the design is not used commercially without permission.
- Inter Display (The Inter Project Authors), SIL Open Font License 1.1: `public/fonts/OFL.txt`.
- `public/other/warehouse.hdr`: Poly Haven "Empty Warehouse 01", CC0.
- `public/other/grain.png`, the icons and the course-code textures are generated for this website.
