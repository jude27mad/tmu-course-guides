# Flash that serves the task: design and usability plan for TMU Course Guides

**Base and status**
- Date: 2026-10-24.
- Base: remote `main` at `cde92a4`. Local `origin/main` is `7da1f68`, which is behind, so fetch before branching. Line numbers below come from `7da1f68`.
- Paths are relative to `/home/user/tmu-course-guides`.
- This plan builds on the earlier review plan (`docs/plans/2026-10-23-course-site-review.md`). Numbers such as "3.2" refer to items in that plan.
- Every visible effect stays. Two things leave: the empty shared 3D canvas on course pages, and the sticker game on pages where its text is wrong.

---

## 1. Principle: flash that serves the task

Every effect has to do one of two things. Either it does a job for the student (confirms a tap, shows a change, shows where they are), or it runs where it costs the student nothing (no waiting, no battery drain when idle, no text hidden). The more often a student sees an effect, the shorter and quieter it should be.

| # | Rule | What it means on this site | Backed by |
|---|---|---|---|
| 1 | Content never waits for an effect | Deadlines, dates and requirements are in the HTML and visible before JavaScript runs. No effect holds `main` at opacity 0. 3D code loads after the content. | NN/g: show no indicator under 1 s (https://www.nngroup.com/articles/skeleton-screens/); scroll reveals slow down task-focused users (https://www.nngroup.com/articles/scroll-animations/); darkroom: anything drawn in WebGL needs a plain HTML fallback (https://github.com/darkroomengineering/satus/blob/main/lib/webgl/README.md) |
| 2 | How often something is seen sets how long it lasts | Tap: visible response within 100 ms, animation ≤ 200 ms. Moving between views inside a course: ≤ 250 ms. Moving between the Desk and a course: ≤ 600 ms. Once per visit: the intro may take up to 1 s. Exits are shorter than entries. | https://www.nngroup.com/articles/animation-duration/, https://www.nngroup.com/articles/response-times-3-important-limits/, https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration, https://emilkowal.ski/ui/you-dont-need-animations |
| 3 | Nothing blocks input | Any tap, scroll or key press during the intro or a page transition jumps it to the end. The page only stops responding while a panel is open. | Apple HIG, motion: "Let people cancel motion" (https://developer.apple.com/design/human-interface-guidelines/motion); https://vercel.com/design/guidelines; https://rauno.me/craft/interaction-design |
| 4 | Effects cost nothing when idle | Draw only when something changes. Stop when there is no input, the tab is hidden or the effect is off screen. Never keep a WebGL canvas that draws nothing. | darkroom Satus (above); https://r3f.docs.pmnd.rs/advanced/scaling-performance; Active Theory on CPU use (https://medium.com/active-theory/the-story-of-technology-built-at-active-theory-5d17ae0e3fb4) |
| 5 | Glass belongs to controls, not content | Glass is for bars, tabs, chips and panels, never behind paragraphs. Labels keep at least 4.5:1 contrast over the worst background. No shimmer while idle. | https://developer.apple.com/design/human-interface-guidelines/materials, https://www.nngroup.com/articles/liquid-glass/ |
| 6 | Native scrolling on touch | Lenis smooths only the mouse wheel. No scroll-driven layouts on phones. Navigation stays on screen as the way out. | https://www.nngroup.com/articles/scrolljacking-101/, https://scroll.locomotive.ca/docs/, https://github.com/darkroomengineering/lenis |
| 7 | Save the show for rare or earned moments | The first visit, the Desk, finishing work. Not the twentieth tab switch of the day. | https://www.nngroup.com/articles/animation-purpose-ux/; Asana keeps its celebrations occasional (https://zapier.com/blog/asana-celebrations) |
| 8 | Same information at every motion level | Three levels: Full; Calm (switched on automatically); Still (reduced motion or Pause motion). Still uses fades instead of movement, with no scaling, blur or depth. Text and order are identical at every level. Pause motion is one tap away. | Apple HIG, accessibility (https://developer.apple.com/design/human-interface-guidelines/accessibility); WCAG 2.2.2 (https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html); WCAG 2.3.3 and technique C39 (https://www.w3.org/WAI/WCAG22/Techniques/css/C39) |

Flash and usability are not a trade-off in how award sites are judged: Awwwards scores Usability at 30% (https://www.awwwards.com/about-evaluation/).

---

## 2. Keep, tune or move each flashy element

| Element | Keep exactly | Tune | Move | Why |
|---|---|---|---|---|
| **Loader and intro slide** (`Loader.jsx`) | The card, the wordmark, the 0.4 s `power2.inOut` slide and the header fade | Wait for fonts only (race with 800 ms), not for the 3D code. Any input sets `tl.progress(1)`. Add a CSS fallback: if JavaScript has not revealed the page within 3 s, `main` and the header fade in by CSS. Today a failed script leaves students on a white "Opening guide…" screen (`global.scss:175-183` only handles no-JS). | First visit only (see Q1). Repeat visits paint straight from the HTML, with no curtain and no jump to the top (3.2). | NN/g: play once. Apple HIG: don't make people wait for an animation "more than once". |
| **Route curtain** (`Layout.jsx`) | Card slide, page scale to 0.9 and rounded corners, between the Desk or All courses and a course | Total ≤ 0.6 s: one 0.2 s exit step (today 2 × 0.16 s) plus a 0.4 s entry. When leaving from an open Menu, close the Menu at the same time as the exit; today that adds 0.45 s. `main` accepts taps from 50% of the entry. A tap, scroll or key jumps to the end. | Course to course, `/updates/`, privacy, 404, and any page opened from inside a course: a 0.2 s crossfade. Use a same-document View Transition with `::view-transition { pointer-events: none }` and a GSAP fallback (https://caniuse.com/view-transitions, https://frontendmasters.com/blog/view-transitions-careful-not-to-make-stuff-unclickable/). iOS keeps the fade from #54. Reduced motion: fade only, no scale or rounding. | NN/g: 400 ms is very slow. Apple: replace movement with fades under Reduce Motion. |
| **Menu and Search slide** (`panelShell.js`) | The −40vw slide, scale and dim. This is the signature move. | Open 0.45 → 0.4 s (ease-out), close 0.45 → 0.3 s (ease-in) | Still: a 0.2 s fade | M3: exits are shorter than entries |
| **Fluid trail** (`Fluid.jsx`, `_app.page.jsx:232-253`) | Look, colour, difference blend, touch and multi-finger support (#50), and the `test:touch` check | Stop the simulation 120 frames (about 2 s) after the last touch or pointer movement. At 0.96 dissipation per frame the dye is then below 1%. Clear to black (black under the difference blend leaves the page unchanged) and restart on the next input. Pause when the tab is hidden. | Mount after content, when the browser is idle (3.6), outside the first-load bundle. It also becomes the "Done" splat (idea 2). | It runs the full simulation at 60 fps even when nobody is touching the screen |
| **Background shader** | 12 fps on demand, low power, pixel ratio ≤ 1 | Calm: one still frame | Mount when idle (3.6) | Already right |
| **Shared 3D canvas** (`_app.page.jsx:178-204`) | Nothing visible changes | Draw on demand while no views exist | Mount only while the Desk badges need it (3.5–3.6) | It is a third WebGL context drawing an empty scene at 60 fps on every course page |
| **Lanyard badges** | Lanyards, Rapier physics, dragging | Windows 90vw → 70vw on phones (D16). Show a static image and an HTML link when WebGL is missing; today these are blank boxes. Set `prefetch={false}` on links to `/` until Rapier is lazy-loaded. | Load Rapier only when the badges are within one screen (3.5). The "Now" card sits above them, so they are no longer the only course list. | darkroom's fallback rule. Rapier is 765 KB gz and is prefetched from every page today. |
| **Sticker game** (`PreFooter.jsx`) | The physics stickers | Load R3F `Canvas` through `next/dynamic` (3.4) | Remove from `/courses/`, privacy and updates, where "Open a course guide below" has nothing below it. Keep on the 404 page and at the very end of the Desk (Q2). | Delight in places where no task is waiting |
| **Signal field and masthead** | The hole grid and the signal moves | Phone masthead 100svh → at least 70svh (D16). First move after 0.8 s instead of 2 s. | Replace the "Scroll Down" marquee with the top edge of the "Now" card, visible above the fold | The first phone screen should show a deadline |
| **Pixel reveal** (`pixelReveal.mjs:87`) | The effect on the Desk's large images | 1.5 s → 1.0 s. Once per image per session. | Remove from the 104 px course thumbnail (static, D7). Add a 320w file to its `srcset`: today only 800w and 1600w exist, so phones download 173 KB for CEN100. | The effect has no payoff at 100 px |
| **Liquid glass** (`glass.scss`) | Backing, sheen, the 0.2 s moving highlight, and the solid fallbacks | A CI contrast check (≥ 4.5:1) for labels over a fluid splat and over the course photo. A 35% dimming layer wherever clear glass sits over imagery. | Extend to the new phone course bar, the section prompt, the Undo message and the "Now" card. All of these are controls. | Apple HIG, materials |
| **Lenis and scrollbar** | Wheel smoothing and the custom scrollbar on desktop | Turn off `syncTouch` on Android if `test:touch` still passes (the fluid listens to touch events, as it already does on iOS). Set `anchors: true` and remove the 450 ms wait before hash scrolling (`Layout.jsx:199-206`). | Hide the custom scrollbar on touch screens | Lenis turns `syncTouch` off by default. NN/g: don't take over scrolling on mobile. |
| **Stacked cards and footer uncover** (`CourseCards.jsx:45-105`) | The scroll-driven stack on desktop (≥ 1024 px, mouse) | None | Phones: a plain list with a one-time fade using CSS `animation-timeline` inside `@supports`, finished state by default (https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) | Cards 2 and 3 are blank in a static view |
| **Text reveals and hover effects** | AppearTitle, the word-by-word quote, the ButtonLink ball | None | Once per session. Course pages show text at once. | NN/g: play scroll reveals once |
| **Film grain** (`global.scss:71-82`) | The overlay | Measure body-text contrast with it in place. Only if any text falls below 4.5:1, lower opacity 0.65 → 0.45. | None | It slightly lowers contrast |
| **Countdown** | The Desk's live d/h/m/s countdown | None | Add "in 4 d 6 h" to course rows and the Next card, updated each minute. No ticking seconds on course pages: Mathur et al. list countdown timers as an urgency dark pattern (https://arxiv.org/pdf/1907.07032). | Flashy and useful |
| **Tap feedback** (`NavigationFeedback.jsx`) | The "Opening page…" pill | The tapped control shows a pressed state within 100 ms. Show the pill only if the curtain has not started within 150 ms; once shown, keep it at least 300 ms (Vercel). | None | NN/g's 0.1 s limit. Vercel's rule against flicker. |

---

## 3. Usability improvements, prioritised

**P1 (first two PRs)**

1. **Content before effects.**
   - **Change:** a repeat visit paints from the HTML and the intro plays once (3.2). Add the 3 s CSS fallback, and let any input skip the intro.
   - **Files:** `site/src/pages/_document.page.jsx`, `site/src/components/dom/Loader.jsx`, `site/src/pages/app.module.scss:97-99`, `site/src/components/dom/navbar/styles/index.module.scss:55-57`, `site/src/styles/global.scss`, and a new `site/src/components/dom/introGate.mjs`.
   - **Look:** the first visit is unchanged.

2. **3D code after the content, and no cost when idle.**
   - **Change:**
     - Earlier plan items 3.3–3.7.
     - The fluid stops when idle.
     - The shared canvas runs on the Desk only.
     - Add the bundle and timing scripts (2.4).
   - **Files:**
     - Shell: `site/src/pages/_app.page.jsx`, plus new `site/src/components/canvas/SharedViewCanvas.jsx` and `FluidCanvas.jsx`.
     - Effects: `site/src/components/canvas/fluid/Fluid.jsx`, `PreFooter.jsx`, `prefooter/Index.jsx`, `site/src/pages/components/clients/Index.jsx`.
     - State: `site/src/store.js`, `site/src/utils/routes.js`.
     - New scripts: `site/scripts/check-bundle-budget.mjs`, `site/scripts/measure-shell.mjs`.
   - **Look:** identical. The effects appear up to about 1 s later on a first visit.

3. **Navigation that stays on screen.**
   - **Change:**
     - Phones (≤ 700 px): a fixed glass course bar at the bottom with Work, Schedule, Study, Info and Search. It uses the existing moving highlight and never hides or collapses (NN/g warns that collapsing navigation is unpredictable).
     - Wider screens: the tab row sticks under the header.
     - Add "Back to top" to the course footer and a Search button to the phone header.
     - Set `scroll-padding-top` and `scroll-padding-bottom` to the bar heights (WCAG 2.4.11), and use `env(safe-area-inset-bottom)`.
     - Render the bar outside `#layout`, as the Navbar is, so the curtain's scaling does not move it.
   - **Files:** `CourseNavigation.jsx`, `CourseWorkspace.jsx`, `workspace.module.scss`, `site/src/styles/glass.scss`, `navbar/Index.jsx`, `CompactFooter.jsx`.
   - **Look:** the same glass and highlight, now always visible.

4. **Work opens on what is next, and Done takes one tap.**
   - **Change:** items 4.1–4.4, plus urgency:
     - Group order: This week, Next week, Past due, Later, Done. Past due collapses to one row reading "7 past due · Review", with Mark all done and Undo.
     - Each row shows one status and a countdown chip coloured by `countdownStatus` (On track, Soon, Urgent), plus its own 44 px Mark done button.
     - The header counts items, not records.
   - **Files:**
     - Work view: `Work.jsx`, new `workspace/status.mjs` and `workspace/copy.mjs`.
     - Completion and details: `RecordActions.jsx`, `cards/ItemCards.jsx`, `AssignmentDetail.jsx`, `Schedule.jsx`.
     - Library: `site/src/lib/progress.mjs` (`setDoneMany`), `site/src/lib/react.js`; `site/src/lib/palette.mjs` is reused as is.
   - **Look:** the Done moment (idea 2) adds flash.

5. **Ask for the section.**
   - **Change:** item 4.6. The Desk's "Choose section for quiz date" link (`clients/Index.jsx:40`) goes to the prompt. "Choose section" buttons move focus to the prompt instead of pointing at a select that is off screen.
   - **Files:** new `workspace/SectionPrompt.jsx`, `CourseWorkspace.jsx`, `CourseInformation.jsx`, `Schedule.jsx`, `AssignmentDetail.jsx`.
   - **Look:** a glass card in the Next card's place.

6. **Show how current the information is.**
   - **Change:** item 1.4 now: "Checked against D2L: <date>" in the header at every width. Remove the rule at `workspace.module.scss:617-619` that hides it on phones. Also items 1.1–1.3 and 1.5, so that expired notes leave by date (the FMEA note was still live on 10-24).
   - **Files:** `CourseWorkspace.jsx`, `site/src/lib/courses.mjs`, `tools/GuideTools.jsx`, new `site/src/lib/content/freshness.mjs`, `site/src/lib/freshness.mjs`, `site/scripts/check-freshness.mjs`.

**P2**

1. **Motion matched to how often it is seen.** Apply the curtain and Menu numbers from section 2, the crossfade between courses, transitions that can be cut short, and fades under reduced motion. Files: `Layout.jsx`, `navbar/components/panelShell.js`, `global.scss`.
2. **Native touch scrolling on Android.** Also set Lenis `anchors` and remove the 450 ms hash wait. Files: `_app.page.jsx:128-162`, `Layout.jsx:199-206`, `canvas/fluid/hooks/usePointerEvents.jsx`. The gates are `test:touch` and `check-ios-document.mjs`.
3. **Calm level, switched on automatically.**
   - **Triggers:**
     - `PerformanceMonitor` `onFallback`.
     - `navigator.connection.saveData` (Chromium only).
     - A median frame time above 25 ms over 2 s. iOS Low Power Mode caps animation frames at 30 fps and cannot be detected directly (https://bugs.webkit.org/show_bug.cgi?id=215745).
   - **Effect:** the background shows one still frame, the pixel reveal shows the final image, and the shared canvas runs at pixel ratio 1. The fluid stays, because it only runs on input.
   - **Storage:** no new key. The student's control stays Play/Pause motion.
   - **Files:** `store.js`, `_app.page.jsx`, a new `site/src/hooks/useMotionLevel.js`, `background/Index.jsx`.
4. **Pause motion in one tap.** Today it is inside the Menu. Add it to the phone header and to both footers (`CompactFooter.jsx`, `Footer.jsx`). The background and signal field move for more than 5 s alongside content, so WCAG 2.2.2 applies.
5. **Shorter Desk and All courses page.** Items 5.1–5.6, with the "Now" card (idea 1) and the sticker placement from Q2. On touch screens, `/courses/` stops taking over scrolling.
6. **Readable key details.**
   - Due times, the eyebrow and the select label go to 16 px at full opacity (`workspace.module.scss:98-104, 216-221, 381-387`).
   - One-row header and a static thumbnail with a 320w file (4.5; `CourseArtwork.jsx`, `artworks.mjs`).
7. **44 px targets on every touch screen.** The rest of item 2.3: add a `@mixin touch` in `site/src/styles/functions.scss`. `checkRow.module.scss:14-15` misses iPad portrait today.

**P3**

- Items 3.3 (MagicBall leftovers), 4.7 (delete unused legacy components), 2.5 (QA housekeeping) and 1.7 (docs).
- What is left of items 2.1 and 2.2: wrap `replaceState` in try/catch (`useCourseNavigation.js:31`), write history on `visibilitychange`, and add a WebKit `replaceState` count that scrolls the document scroller used on iPhone.
- `content-visibility: auto` with `contain-intrinsic-size` on long Desk and Study sections (https://web.dev/articles/content-visibility).
- Let the custom desktop scrollbar be dragged (`Scrollbar.jsx`).
- Use Popover and `@starting-style` for the section prompt and the Undo message, but only where they replace custom code (https://web.dev/blog/popover-api).

---

## 4. Innovative ideas

### Top 5 to build

1. **The "Now" card (Desk and each course).**
   - **Look and feel:**
     - A glass card that peeks above the fold, with the signal field moving behind its top edge.
     - Top line: "Next: MTH140 Lab · Thu 4:00 pm · POD367".
     - Below it, "Due within 72 h" rows with status-coloured edges and minute-level countdown chips, then a "Tonight" line.
     - When nothing is due: "Nothing due for 5 days".
   - **Why it beats the alternatives:** a widget dashboard or a full calendar needs more taps. Students mostly use phones to check due dates and schedules (https://er.educause.edu/articles/2023/1/the-evolving-landscape-of-students-mobile-learning-practices-in-higher-education).
   - **How:** it replaces the Desk rows planned in item 5.1 by extending `deskRows`, rather than adding a second list.
   - **Data:** lab day, time and room are already in `lib/vendor/course-data.mjs` (read only).
   - **Rule:** the same rows render before mount, with no time baked into the HTML.

2. **The Done moment.**
   - **Look and feel:**
     - The tick draws itself in 0.25 s, one fluid splat fires at the tap point in the "done" colour (through the existing splat stack and `splat.frag`), and the row settles.
     - A line follows: "3 of 7 done this week", with Undo for 6 s.
     - Haptics: a real `<input type="checkbox" switch>` gives a tick on iOS 18+. This is unofficial and may break (https://github.com/ionic-team/ionic-framework/issues/29942). Android uses `navigator.vibrate(10)`.
     - A bigger moment plays only when a whole week or milestone is finished.
     - Still: the tick only.
   - **Why it beats the alternatives:** it puts the site's signature effect on its most meaningful frequent action. Confetti on every checkbox wears out. No animation leaves students unsure whether it saved. The local write repaints at once, in the Linear style (https://performance.dev/how-linear-feels-instant).

3. **What changed since your last visit.**
   - **Look and feel:** a dismissible glass notice ("2 changes since Tue: MTH140 Quiz 3 now covers 3.4 · …"), a "Changed" chip on each affected row until it is opened, and the "Checked against D2L" date in the header.
   - **How:** store a local fingerprint per item (date, time, coverage, weight) and compare it with current data on load. A first visit shows nothing, and only course data is compared. It builds on the unread badge in `lib/content/updates.mjs` and the note expiry (1.1).
   - **Why it beats the alternatives:** students can't be expected to compare the `/updates/` page against what they remember.

4. **Reminders that fire, delivered by the student's calendar app.**
   - **Look and feel:** two labelled buttons in Guide tools: "Subscribe: stays up to date, no alerts" (6a) and "Add with alerts: alerts 1 day and 2 h before".
   - **How:**
     - Extend the CEN alarms (`lib/content/cen.mjs:213-225`) to the math quiz downloads through a site-owned wrapper, because `lib/vendor/schedule.mjs` is byte-locked.
     - Keep event IDs identical so a re-import replaces events instead of duplicating them.
   - **Why it beats the alternatives:**
     - Push notifications need a server, even with Declarative Web Push (https://webkit.org/blog/16535/meet-declarative-web-push/).
     - Scheduled local notifications never launched (https://developer.chrome.com/docs/web-platform/notification-triggers).
     - Subscribed calendars lose their alerts (secondary sources: https://turnabee.com/guides/subscribed-calendar-no-alerts-iphone).

5. **Keep progress safe: Home Screen app and offline.**
   - **Look and feel:**
     - A one-time iOS hint: "Keep your progress safe: add to Home Screen".
     - The manifest switches to `display: standalone`.
     - A footer stamp: "Available offline · checked Oct 23".
     - The service worker fetches from the network first and shows an "Updated, reload" message.
   - **Why it matters:** Safari deletes storage written by scripts after 7 days of Safari use without visiting the site, and Home Screen apps are exempt (https://webkit.org/tracking-prevention/). All progress lives in localStorage.
   - **Risks:**
     - On iOS, a Home Screen app keeps its own storage, so ship this after item 6b's link and QR transfer, as a "Move my progress into the app" step.
     - Old content could be served from the cache. Use network-first, a versioned cache and a switch that turns the worker off. See Q3.

### Later

- **Quiz prep:** "Can you…?" prompts from `info.topics[].skills`, coming back at 1, 3 and 7 days before the quiz (https://pubmed.ncbi.nlm.nih.gov/26173288/).
- **Semester timeline:** 13 weeks drawn in the signal-field style, with a list version.
- **Background that reflects deadlines:** stays in the background only (https://calmtech.institute/calm-tech-principles).
- **Progress ring:** a ring around each badge for the next milestone only.
- **Room chips:** "POD367 → Podium · 350 Victoria St", linking to the TMU map.
- **Search additions:** actions and recent items.
- **Weekly recap:** no streaks.
- **Evening theme:** needs new tokens and contrast tests.

### Rejected, and why

- **Web push or server-scheduled notifications:** they need a server.
- **Manifest shortcuts and Home Screen widgets:** no support on iOS.
- **Streaks:** they frame progress as loss, and Duolingo admits a broken streak demotivates (https://blog.duolingo.com/how-duolingo-streak-builds-habit/).
- **Full-page red urgency or ticking seconds on course pages:** an urgency dark pattern.
- **Focus timer:** the evidence is mixed, 7 of 8 trial users forgot to start it, and iOS suspends JavaScript in the background.
- **App icon badge:** it needs notification permission and goes stale without push.
- **Speculation Rules:** Chromium only, and Next already prefetches.
- **Battery API:** effectively dead in WebKit.
- **darkroom's rule of no WebGL on touch screens:** the touch fluid is part of this site's identity. It was restored on purpose in `5ce28b5` and `test:touch` enforces it. We take darkroom's draw-on-demand and pixel-ratio rules instead.
- **Blur on phone glass:** it costs performance and contrast, and the current backing plus sheen is enough.
- **Voice input:** low value between classes, and it raises privacy questions.

---

## 5. Phased roadmap (one PR per phase)

**How every phase is measured**
- **Setup:** Chromium at 390 × 844 with `isMobile` and `hasTouch`, 4× CPU slowdown (CDP `Emulation.setCPUThrottlingRate`), and the local pages server. WebKit uses the iPhone profile where stated.
- **Time to content:** from navigation start until the first Work row (course) or first "Now" row (Desk) is visible at opacity 1 and not covered by `#loader`.
- **Reporting:** each PR's CI writes `measure-shell.mjs` results against the committed baseline (`docs/qa/review-baseline/`) to the job summary. The owner reads numbers instead of testing by hand.
- **Caveat:** this is browser emulation, not a physical device.

### Phase A: fast shell, same look
Covers P1.1 and P1.2, plus items 2.4 and 3.2–3.7.

**Acceptance**
- **Bundles:**
  - `/[course]` first-load JS ≤ 210 KB gz, with no three, postprocessing or Rapier code.
  - Course pages prefetch ≤ 60 KB gz of `/` chunks.
  - Rapier is requested on `/` only when the badges are within one screen.
- **Speed:**
  - First visit: time to content ≤ 1.5 s at 4× CPU.
  - Repeat visit: with every `_next/static/chunks` request blocked, content is still visible and the loader hidden.
  - First visit with chunks blocked: content visible within 3.5 s (the CSS fallback).
- **WebGL on `/cen100/`:**
  - Contexts: 0 before the reveal; ≤ 2 when idle with motion on; ≤ 1 with motion off; never the shared canvas.
  - After 3 s with no input, the fluid canvas makes 0 draw calls and total frames stay ≤ 13 per second.
  - A swipe after that draws the fluid again.

**Verified by**
- New `check-bundle-budget.mjs` in `ci.yml` and `pages.yml`, enforced by the end of the phase.
- New `measure-shell.mjs`, which counts contexts by wrapping `getContext` and counts draw calls by wrapping `drawArrays` and `drawElements`.
- `check-interaction-feedback.mjs`, extended with startup and blocked-chunk cases.
- `check-touch-fluid.mjs`, extended with a check that the fluid restarts after idle.
- `check-ios-document.mjs` passes unchanged.

### Phase B: course pages you can steer
Covers P1.3–P1.6, P2.6, P2.7, idea 2, and items 1.1–1.5 and 4.1–4.6.

**Acceptance** (fixed clock 2026-10-23T16:00Z)
- **Layout:**
  - CEN100's first Work row is the next upcoming item, with its bottom edge ≤ 760 px.
  - Past due is one row, at least 44 px tall.
  - The course bar is visible and tappable at every scroll depth at 360 and 390 px. Switching view from the bottom of Work takes one tap and no scrolling.
- **Speed:**
  - From tap to visible feedback ≤ 100 ms at 4× CPU, measured from `pointerdown` to the first frame with the changed state. This covers the course bar, Mark done, Undo, filters and the section select.
  - INP ≤ 200 ms for the worst interaction in a scripted session at 4× CPU, using the Event Timing API (https://web.dev/articles/optimize-inp).
- **Storage:**
  - Mark all done makes one storage write.
  - Undo restores `cen100-personal-plan-v1` byte for byte.
  - The `PROGRESS` byte-identity check still passes.
- **Accessibility:**
  - No 44 px violations on touch screens at 390 × 844 and 834 × 1112.
  - Tabbing through `/cen100/#work/all` never leaves a focused control fully covered (WCAG 2.4.11).
  - Bar labels reach at least 4.5:1 contrast, sampled over a fluid splat and over the course photo.
  - Due times are at least 16 px.
- **Freshness:**
  - "Checked against D2L" is visible at 390 px.
  - No expired note text appears at the fixed clock.
- **Reduced-motion parity:** across Full, reduced motion and Pause motion:
  - `main.innerText` (countdowns masked) and the ordered list of control names are identical.
  - In Still, nothing in `main` stays below opacity 1 after load.

**Verified by**
- `verify-course-views.mjs`: Work order, Past due, Done and Undo, the section prompt, the bar.
- `check-interaction-feedback.mjs`: tap-to-feedback and INP.
- `check-consistency.mjs`: parity, focus not covered, 44 px audit.
- `check-glass-controls.mjs` in Chromium and WebKit: contrast.
- `check-palette-site.mjs`: status colours.
- `check-ios-document.mjs`: the bar with document scrolling and the safe area.
- `npm test`: `status.mjs`, `setDoneMany` and freshness tests.
- `check-freshness.mjs`, report-only.

### Phase C: motion matched to how often it is seen
Covers P2.1–P2.4, the `/courses/` scrolling fix on touch screens, and reveals that play once.

**Acceptance**
- **Transition timing:**
  - Desk ↔ course curtain ≤ 600 ms, measured until `#layout` has no transform. From an open Menu ≤ 650 ms (up to 1.2 s today).
  - Course → course ≤ 250 ms.
- **Interruptions:**
  - A tap during the curtain reaches the final state within one frame, and `main` responds.
  - `main` never ignores input for more than 100 ms after content is drawn.
- **Reduced motion and Pause motion:** no change to transform, scale or rounding on `#layout` or `main`, sampled each frame. Fades take ≤ 200 ms.
- **Android profile:**
  - `syncTouch` is false.
  - `test:touch` passes with one and two fingers.
  - Hash scrolling starts within 100 ms.
- **Calm level:** with `saveData` stubbed true or frames capped at 30 fps, the background draws once and stops, and pixel reveals show the final image.
- **All courses page (`/courses/`) at 390 px:**
  - No pinned or scrubbed scrolling.
  - All three cards appear in a full-page screenshot.
  - Height ≤ 2 screens.
- **Pause motion:** one tap away on every page.
- **No regressions:** the Phase B INP and tap targets still pass.

**Verified by**
- `check-interaction-feedback.mjs`: timing, skipping and unresponsive time.
- `check-consistency.mjs`: per-frame sampling under reduced motion.
- `check-touch-fluid.mjs`.
- `check-ios-document.mjs`.
- `check-glass-controls.mjs`.

### Phase D: a Desk that answers "what now?"
Covers P2.5, ideas 1 and 3, and items 5.1–5.6.

**Acceptance**
- **Desk length and layout:**
  - The Desk is ≤ 6 screens at 390 × 844 and 1440 × 900 (11.4 today).
  - The first "Now" row ends at or above 844 px.
  - The masthead is at least 70svh.
- **Without JavaScript:** three rows with "Open guide", and the rows match before and after mount.
- **Badges:** with WebGL stubbed out, a static image and a link appear.
- **What changed:** a stored fingerprint that differs in one date produces exactly one notice and one chip. A first visit produces none.
- **Sticker game:** present only where Q2 says.
- **Bundles:** the `/` budget is re-baselined lower.

**Verified by**
- `check-pages-site.mjs`: rows, no-JS, Desk height.
- `check-palette-site.mjs`.
- `npm test`: `deskRows` and the fingerprint comparison.
- `measure-shell.mjs`.
- `test:touch`.

### After Phase D
1. Item 6a (calendar feeds) together with idea 4 ("Add with alerts").
2. Item 6b (progress link and QR code).
3. Idea 5 (Home Screen app and offline), depending on Q3.

**Lighthouse (optional):** a report-only `pages.yml` step needs `lighthouse` as a dev dependency. The scores are noisy on WebGL pages, so the Playwright gates above are the ones enforced.

---

## 6. Open questions for the owner

1. **How often should the intro replay?** The options are once per tab (the earlier plan; sessionStorage) or at most once every 7 days across tabs (a new localStorage timestamp, `guide-intro-seen-at`).
   - **Recommended: 7 days.** Links from D2L and Messages open new tabs, so a per-tab rule replays the intro on almost every visit.
2. **What happens to the sticker game?** The options are to remove it everywhere (earlier plan, D15) or keep it on the 404 page and at the end of the Desk.
   - **Recommended: keep it on the 404 page and at the end of the Desk**, loaded lazily.
3. **Should we build the offline Home Screen app (service worker)?**
   - **Recommended: yes, but only after progress transfer (6b) ships.** Fetch from the network first and include a switch to turn the worker off. Until then nothing changes, so installing the app can never look like it wiped a student's progress.

### Critical files for implementation
- site/src/pages/_app.page.jsx
- site/src/components/dom/Layout.jsx
- site/src/components/dom/Loader.jsx
- site/src/pages/course/components/workspace/Work.jsx
- site/src/pages/course/components/workspace/CourseNavigation.jsx