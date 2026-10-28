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
| `src/hooks/` | `useIsMobile`, `useInView`, `useStill` (reduced motion or the saved Pause motion setting), `useWebGL` (whether the 3D layer can run) and `useScroll`. |
| `tests/` | Course-data/storage parity tests and focused signal-field, image-reveal and navbar lifecycle regressions. |

## Data and saved progress

- Course navigation resolves old and new hashes through `workspace/location.mjs`. All assignment entry points use the same detail renderer. History snapshots retain list filters, scroll and focus without adding progress storage keys.
- Notes save on every edit, including immediately before navigation. Checklist preparation and submission records remain separate.
- Course controls become available after hydration and a brief entrance, independently of fonts, photographs and 3D downloads. Tabs acknowledge navigation immediately and accept input during the new view's entrance. Loading feedback for course views, page requests and the lazy calendar waits 250 ms: fast work stays quiet, while a pending request still gets a status. Feedback disappears as soon as the content is ready, without holding up content or waiting for a cosmetic entrance to finish. Replaced requests and unmounted views cancel their timers; failed page navigation still offers an immediate normal-link retry. `scripts/check-interaction-feedback.mjs` and `scripts/check-delayed-feedback.mjs` exercise these cases in Pages CI, including Chromium and iPhone WebKit.
- Course tabs and filters change content in place. Detail links still scroll to their target, and Back restores the saved position. The header and Menu leave with page scroll; offscreen controls are inert. Scroll snapshots stay in memory and are persisted on navigation/page exit instead of rewriting history every frame. Pages CI covers these behaviours with motion enabled and reduced motion.
- Schedule-X is loaded only when the calendar is displayed. The independent deadline list stays usable if its chunk fails. React 18 compatibility, date precision, Toronto time and the pinned MIT dependencies are documented in [the redesign QA record](../docs/qa/shorter-course-views/README.md).

- Deadlines and course content come from the same data as the previous version, copied into `src/lib/vendor/` and `src/lib/content/`. Deadline results are tested against the previous modules.
- Progress uses the previous version's `localStorage` keys and value formats, so existing progress carries over. The key table is in `src/lib/README.md`.
- Updates are kept in two lists in `src/lib/content/updates.mjs`. `COURSE_UPDATES` holds changes to a course's information (dates, coverage, policy, grading), shown under **Course updates** in that course's Guide tools; a new entry shows the unread badge until the list is opened. `WEBSITE_UPDATES` holds changes to the website itself, shown on the **Website updates** page (`/updates/`, linked from the menu, the footers and Course updates); these never show the badge. Add an entry (`id` starting with today's ISO date, `date`, `title`, `text`, `items`, and `courses` for a website change that affects only some guides) at the top of the right list. `GUIDE_VERSION` no longer drives the badge.

After building, run `PLAYWRIGHT_PATH=/path/to/playwright node scripts/verify-course-views.mjs` for focused-view browser checks. `QA_CHROMIUM_PATH` can select an installed Chromium binary; `QA_REPORT_DIR` selects the report directory. The script reads the build's base path and tests browser emulation, not physical devices.

## Motion and accessibility

- Glass is limited to course navigation and small utility controls. `styles/glass.scss` provides the shared material and fallback; the decorative selection in `CourseNavigation.jsx` follows the existing routing state. Phones keep the translucent backing, sheen and rim without backdrop blur after repeated WebKit rendering-cost checks. No new rendering loop or runtime dependency is added. Reading content and the Guide tools body stay solid.
- The Pages workflow runs `scripts/check-glass-controls.mjs` in Chromium and WebKit, uploads screenshots, interaction traces and paired glass on/off timing diagnostics, and provides a `site-preview` artifact for pull requests. These are browser-emulated checks; physical iPhone/iPad Safari testing is separate. Development for this change uses GitHub CI for tests and builds.

- WebGL is optional. `utils/webgl.mjs` asks the browser once whether it can create a WebGL 2 context, and every three.js `<Canvas>` (four: the shared one that draws the course badges, the pointer fluid, the background and the pre-footer game) sits in `components/canvas/WebGLGate.jsx`: it mounts the canvas only where WebGL works and catches anything the canvas throws, so a browser with WebGL turned off or blocked gets the page without them instead of Next.js's application-error screen. The background keeps its solid ink panel (on iPhone and iPad's document scrolling the page colour shows instead), the pointer fluid and the game are left out, and each course badge shows its HTML card (`courseBadge/CourseBadge.jsx`; the 3D card hides it only once drawn, and sets it back when it is taken down). The server render and the hydration pass see "not asked yet" (`useWebGL()` is `null`), so the static HTML is the same for every browser. Add every new `<Canvas>` inside a `<WebGLGate>`: `tests/webgl.test.mjs` fails on one without it, and `scripts/check-no-webgl.mjs` (CI's own `no-webgl` job, Chromium and WebKit) loads every route with WebGL disabled, blocked and failing late, loses and resets the GPU after load, and runs with WebGL working as a control. A lost context is ridden out (three.js and R3F restore it): only one that is still lost, and still on the page, five seconds later turns the layer off, and a canvas that failed meanwhile tries again when a context returns (`utils/webgl.mjs`, `WebGLGate.jsx`).
- `prefers-reduced-motion` and the saved Pause motion setting (`guide-motion-paused`) turn off the loader curtain, route transitions, appear animations, background drift, fluid effect, pre-footer physics and marquee, and render the 3D scenes on demand so they hold still. Lenis wheel smoothing stays on.
- Motion keeps its 60 Hz look at any refresh rate. A constant tuned per drawn frame (an easing factor, a decay, an impulse) is applied through `src/utils/frameStep.mjs` for the share of a 60 Hz frame each frame covers; 60 Hz screens keep the exact original values. The pointer trail's canvas draws only while its trail moves or fades. `?stats` shows the frame rate a device reaches.
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
Next Up and the individual course headers reuse the original physics lanyard
badges. Each position mounts only its relevant course: the Desk derives it from
its live next deadline, and each course header uses its own course ID. The
separate `/courses/` directory remains the place to browse all three courses.

`src/components/courseBadge/` owns the shared registry, original textures and
lanyards. `BadgeWorld` is mounted once beside `View.Port` in the existing shared
canvas, independently of any first View. Stable instance slots keep bodies
separate; changing the Desk course changes its face without replacing its
lanyard. Pausing retains the current pose, while initially reduced motion uses
an upright resting pose. Offscreen bodies stop stepping, and unmounting a badge
removes its bodies and disposes its textures. No second badge physics engine or
carousel is introduced.

See [animation code provenance and notices](public/licenses/README.md) and
[individual artwork sources and permissions](public/licenses/ARTWORK-CREDITS.md). Kairo's
code licence is MIT; its photographs are expressly excluded. Atelier North's
README declares MIT but its linked licence file is absent at the checked revision,
so the included notice comes from Codrops' official licensing page. Neither
template's photographs are reused.


The historical [QA record](../docs/qa/giats-artwork/README.md) and [subject-image screenshot gallery](../docs/qa/giats-artwork/subject-imagery/README.md) document the earlier photograph implementation.

The signal field remains in `src/components/artwork/`. The inactive legacy photograph components and their asset notices are retained for provenance; active Desk, directory and course headers do not render them. Badge loading/error states use a local HTML course label, and an empty Next Up has no image window.

