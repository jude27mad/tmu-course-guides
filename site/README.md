# TMU Course Guides — site source

The Next.js source of TMU Course Guides (Fall 2026): an unofficial TMU course companion with a Desk, a Courses index, one guide per course (CEN100, MTH140, MTH141) and a Privacy page. Progress is saved only in the visitor's browser (localStorage); there are no analytics and no requests to other hosts.

Original portfolio design and development by Evangelos Giatsidis — [giats.me](https://giats.me)

The look, motion and much of the code (layout grid, paper-and-window sections, background shader, fluid simulation, loader and route curtain, menu, marquee, appear animations, 3D sections) come from his portfolio, used under the MIT licence in `LICENSE` (copyright Evangelos Giatsidis; attribution required, no commercial use without his permission). His name, wordmark, portraits, project images, client branding, logos and copy are not part of this site.

## Build

```sh
npm ci
npm run export:preview      # next build (static export) + copy out/ to ../next
```

- `SITE_BASE_PATH` (or `NEXT_PUBLIC_BASE_PATH`) sets the base path; the default is `/tmu-course-guides/next`. Use `SITE_BASE_PATH=/tmu-course-guides` for the Pages root, or `SITE_BASE_PATH=` for a domain root.
- `npm run fonts` rebuilds the Inter Display files (needs Python fontTools).
- Add `?stats` to any URL for an FPS panel.

## Where things are

- `src/lib/` — course data, deadlines, progress (the old site's storage keys and formats), search index, motion preference. Pages import only `@src/lib` and `@src/lib/react`.
- `src/pages/` — routes. `src/components/` — the shell (loader, navbar, menu, search panel, pre-footer, footer) and Giats's animation components.
- `src/utils/theme.js` — per-course palettes: `applyPalette(palette)` / `resetPalette()` / `usePalette(palette)` (CSS variables plus the fluid tint).
- `src/hooks/` — `useIsMobile` (right on the first client render), `useInView`, `useStill` (reduced motion or the saved "Pause motion"), `useScroll` (Lenis).

## Accessibility and motion

- `prefers-reduced-motion` and the saved "Pause motion" setting (`guide-motion-paused`) turn off the loader curtain, route transitions, appear animations, the background drift, the fluid, the pre-footer physics and the marquee.
- Pinch zoom, text selection, keyboard scrolling, visible focus, a skip link and 44 px tap targets on phones.
- Without JavaScript the content is still shown.

## Third-party assets

- Inter Display (The Inter Project Authors), SIL Open Font License 1.1: `public/fonts/OFL.txt`.
- `public/other/warehouse.hdr`: Poly Haven "Empty Warehouse 01", CC0.
- `public/other/grain.png`, the icons and every course-code texture are generated for this site.
