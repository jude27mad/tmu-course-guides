# TMU Course Guides: website source

This folder holds the source of the TMU Course Guides website, a Next.js app exported as static files and served by GitHub Pages. For how to use the website, see the [main README](../README.md).

## Build

```sh
npm ci
npm test                    # data, storage, artwork, lifecycle and publishing tests (node --test)
npm run build               # static export in out/
```

- **Publishing.** `.github/workflows/pages.yml` publishes the website at https://jude27mad.github.io/tmu-course-guides/ on every push to `main` that changes `site/`. It runs the tests, builds with `SITE_BASE_PATH=/tmu-course-guides`, adds the forwarding pages (`scripts/pages-site.mjs`), checks the result in Chromium (`scripts/check-pages-site.mjs --local`), deploys it, and then checks the live address (`--live`). GitHub Pages must be set to **Source: GitHub Actions**; with any other source the workflow builds and checks but does not deploy. Changing the source does not start a run, so after switching to GitHub Actions run the workflow on `main` once (Actions → Pages → Run workflow) unless a push to `site/` follows.
- **What is published.** Only this site. The previous version's addresses (`privacy.html`, `colour-preview.html`) and the earlier preview (`/next/` and its pages) forward to the matching page, keeping the query and hash; `cen100/`, `mth140/` and `mth141/` are the same addresses as before. The previous version's files at the repository root, `docs/`, `tests/` and `tools/` are not published.
- **Checking a publish locally:**
  ```sh
  export SITE_BASE_PATH=/tmu-course-guides
  npm run build
  rm -rf /tmp/pages
  node scripts/pages-site.mjs build --out out --dest /tmp/pages
  node scripts/pages-site.mjs check /tmp/pages
  PLAYWRIGHT_PATH=/path/to/node_modules/playwright node scripts/check-pages-site.mjs --local /tmp/pages
  ```
- `SITE_BASE_PATH` (or `NEXT_PUBLIC_BASE_PATH`) sets the base path. Without it, builds use `/tmu-course-guides/next`, which the QA scripts (`check-guide-tools-popup.mjs`, `verify-*.mjs`) expect. Use an empty value for a domain root.
- `npm run export:preview` copies a build to `../next` and only replaces a folder it created itself (marked with `.site-export`). The committed `next/` folder is the earlier preview, kept as it was and no longer published.
- `npm run fonts` rebuilds the Inter Display subsets (needs Python fontTools).
- Add `?stats` to any page URL for a frame-rate panel.

The repository root keeps its `.nojekyll` file for the case where Pages is switched back to publishing the `main` branch. CI runs `npm test` and `npm run build` for this folder on every push to `main`.

## Structure

| Path | Contents |
|---|---|
| `src/lib/` | Course data, deadlines, progress, search index and the motion preference. Pages import only `@src/lib` and `@src/lib/react`. Documented in [`src/lib/README.md`](src/lib/README.md). |
| `src/pages/` | Routes: the Desk (`index`), `courses`, the course guides (`[course]`, built for `cen100`, `mth140` and `mth141`), `privacy` and `404`. |
| `src/pages/course/components/workspace/` | Compact Work, Schedule, Study and Course info views; shared assignment details; hash/history restoration. |
| `src/components/` | The shared shell: loader, navbar, menu, search panel, pre-footer, footer, background and fluid canvases, and the animation components. |
| `src/utils/theme.js` | Per-course colour schemes: `applyPalette`, `resetPalette` and `usePalette` set the CSS variables and the fluid tint. |
| `src/hooks/` | `useIsMobile`, `useInView`, `useStill` (reduced motion or the saved Pause motion setting) and `useScroll`. |
| `tests/` | Course-data/storage parity tests and focused signal-field, image-reveal and navbar lifecycle regressions. |

## Data and saved progress

- Course navigation resolves old and new hashes through `workspace/location.mjs`. All assignment entry points use the same detail renderer. History snapshots retain list filters, scroll and focus without adding progress storage keys.
- Notes save on every edit, including immediately before navigation. Checklist preparation and submission records remain separate.
- Course controls become available after hydration and a brief entrance, independently of fonts, photographs and 3D downloads. Tabs acknowledge navigation immediately and accept input during the new view's entrance. Page navigation shows status while Next fetches a route; failed navigation offers a normal-link retry. `scripts/check-interaction-feedback.mjs` exercises these cases with delayed image and route downloads in Pages CI.
- Course tabs and filters change content in place. Detail links still scroll to their target, and Back restores the saved position. The header and Menu leave with page scroll; offscreen controls are inert. Scroll snapshots stay in memory and are persisted on navigation/page exit instead of rewriting history every frame. Pages CI covers these behaviours with motion enabled and reduced motion.
- Schedule-X is loaded only when the calendar is displayed. The independent deadline list stays usable if its chunk fails. React 18 compatibility, date precision, Toronto time and the pinned MIT dependencies are documented in [the redesign QA record](../docs/qa/shorter-course-views/README.md).

- Deadlines and course content come from the same data as the previous version, copied into `src/lib/vendor/` and `src/lib/content/`. Deadline results are tested against the previous modules.
- Progress uses the previous version's `localStorage` keys and value formats, so existing progress carries over. The key table is in `src/lib/README.md`.
- Updates are kept in two lists in `src/lib/content/updates.mjs`. `COURSE_UPDATES` holds changes to a course's information (dates, coverage, policy, grading), shown under **Course updates** in that course's Guide tools; a new entry shows the unread badge until the list is opened. `WEBSITE_UPDATES` holds changes to the website itself, shown on the **Website updates** page (`/updates/`, linked from the menu, the footers and Course updates); these never show the badge. Add an entry (`id` starting with today's ISO date, `date`, `title`, `text`, `items`, and `courses` for a website change that affects only some guides) at the top of the right list. `GUIDE_VERSION` no longer drives the badge.

After building, run `PLAYWRIGHT_PATH=/path/to/playwright node scripts/verify-course-views.mjs` for focused-view browser checks. `QA_CHROMIUM_PATH` can select an installed Chromium binary; `QA_REPORT_DIR` selects the report directory. The script reads the build's base path and tests browser emulation, not physical devices.

## Motion and accessibility

- Glass is limited to course navigation and small utility controls. `styles/glass.scss` provides the shared material and fallback; the decorative selection in `CourseNavigation.jsx` follows the existing routing state. No new rendering loop or runtime dependency is added. Reading content and the Guide tools body stay solid.
- The Pages workflow runs `scripts/check-glass-controls.mjs` in Chromium and WebKit, uploads screenshots, interaction traces and paired glass on/off timing diagnostics, and provides a `site-preview` artifact for pull requests. These are browser-emulated checks; physical iPhone/iPad Safari testing is separate. Development for this change uses GitHub CI for tests and builds.

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


The artwork is published on the [website](https://jude27mad.github.io/tmu-course-guides/). See the [QA record](../docs/qa/giats-artwork/README.md) and [subject-image screenshot gallery](../docs/qa/giats-artwork/subject-imagery/README.md).

Implementation lives in `src/components/artwork/` (signal field) and `src/components/courseArtwork/` (image mapping and reveal). Update `artworks.mjs` and the individual asset credits together when changing photographs. The engineering image is the unresolved/empty Next Up fallback. Source images are local 800/1600-pixel WebPs; no image host is contacted at runtime.
