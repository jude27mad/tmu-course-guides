# Math studio

The course pages remain static HTML, CSS and JavaScript with no build step or new runtime dependency.

## Interaction model

- MTH140: select an equation term, then tap a shift/scale choice. Limits and secants use deliberate example actions. Numeric entry is available under **Use your own values** and commits on blur or Enter.
- MTH141: compose two matrix operations and compare the two orders on one shared scale. The rightmost matrix acts first for column vectors. Play steps demonstrates both sequences; rotation uses angle interpolation so it preserves length throughout.
- Both courses: **Find the mistake** contains four authored worked examples. Select the first incorrect line. Other selections offer retry feedback; finding the error reveals its correction and matching figure or numerical check. Challenge state lasts while the page is open.
- Expanded view moves the same studio into a native dialog, preserving the current exercise. Course checklists, section selection and saved study progress are separate.

## Source

- `assets/math-labs.mjs`: navigation, equation exploration and existing concept plots.
- `assets/math-studio.css`: shared studio layout and touch controls.
- `assets/lab-composition*.mjs` and `.css`: composition UI and pure calculations.
- `assets/lab-challenges.mjs`, `lab-challenge-data.mjs`, `lab-challenges.css`: worked examples and feedback.

All primary actions work with buttons. Exact inputs have labels and bounds. Animation respects `prefers-reduced-motion`. No account, remote computation, or tracking is required by the studio.

## Verification

Run `node --test tests/*.test.mjs`.

The numerical suite covers function domains and shifts, secant limits, complex multiplication, systems, all 25 matrix operation pairs, order, area/orientation, intermediate rotations, and finite in-bounds camera coordinates. It also verifies the examples' corrected values and retains the existing schedule/calendar tests.

`tests/studio-preview.html` is a manual development fixture that frames either course at 390, 820 or 1280 CSS pixels. It is not linked in the student interface. Use it to check:

1. Equation actions, exact values (including negatives and bounds), and reset.
2. Matrix playback, reverse order, collapse, and both plots drawing finite geometry.
3. Challenge retry, correct feedback, next/previous and mode-switch state.
4. Expanded view, Escape, keyboard focus, and at least 44px button heights.
5. No document or studio overflow at phone/tablet widths; no aspect-ratio letterboxing.

Bump the relevant asset query versions when shipping changes, including changed ES module imports. GitHub Pages and browser caches can otherwise mix old and new modules.


## Editorial design (October 11, 2026)

`assets/editorial.css` supplies the shared page composition and the dark math studio. `assets/editorial.mjs` enhances the existing header, adds tool shortcuts, and moves the studio above the semester timeline. The original course scripts remain responsible for schedules, checks, storage and grading. The new toolbar opens those existing controls.

- All three course shells share a 1240px maximum width and matching responsive gutters.
- Hero diagrams show actual mathematical relationships: the tangent to x² at (1, 1), and multiplication of 1 + i by i.
- New hero motion draws once and respects reduced motion. Interactive experiment motion remains action-driven.
- Studio color variables are scoped to the studio so the plots remain legible in both page appearances.
- The expanded studio has a sticky close/header region.
- `/tests/editorial/` is a noindex responsive review fixture pointing to the live course pages. The isolated course snapshots used before release were removed after review.

Before releasing: use the fixture to inspect all three pages at 320, 390, 820, 1024 and 1280px; check tool shortcuts, theme contrast, plot controls, matrix playback, mistake feedback and expanded-view close.
