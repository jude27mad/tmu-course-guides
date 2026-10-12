# Subject header review — 2026-10-12

Source visual truth: `docs/qa/subject-headers/calculus-concept.webp`, normalized from the selected 853×1844 concept. The approved written brief in `docs/superpowers/plans/2026-10-12-subject-headers.md` supersedes the rejected Engineering and Algebra concept objects. Existing course UI and colors are constraints.

Implementation: actual WebGL2 browser captures in `docs/qa/subject-headers/phone-renders.webp` (three 360×800 CSS viewports, screenshot density 1). Full comparison: `docs/qa/subject-headers/calculus-comparison.webp`. Focused header comparison: `docs/qa/subject-headers/header-detail.webp`. Source normalized to 360×778; headers aligned at their upper boundary, without stretching height. Captured default light UI, unselected section, running animation at different phases. The reference has a selected section and is a still concept, so its content and instantaneous curve shape are not pixel-match targets.

## Findings and iteration history

- Fixed P1: earlier phone captures gave the objects insufficient presence. Replaced conservative box fitting with shape support bounds, increased the artwork viewport, and increased Calculus amplitude and strand visibility. Post-fix phone captures show a full gearbox, a legible flowing surface/tangent and a transformed sphere with visible basis arrows.
- Fixed P2: artwork could crop after rotation; actual geometry and tangent endpoint regression cases now fit. Title/art zones do not intersect at 320, 390, 412, 820 and 1366px for all three courses.
- Fixed P2: pause during a captured gesture could retain the active pointer. Pause, cancellation, hidden page, off-screen state and page-cache lifecycle now cancel it. Paused artwork permits vertical scrolling.
- Fixed P2: unsupported-GPU fallback implied draggable art. Matching scene captures now replace all old posters; static fallback hides motion controls and removes the interactive role and instructions.
- P3: the Calculus reference has stronger photographic glow and full-bleed cropping. The implementation uses a mathematical moving surface, with less glow and an intact silhouette for rotation. It does not claim photographic or pixel-identical fidelity. A separate camera-safe object viewport is deliberate across the three courses.

## Required fidelity surfaces

- Typography: original site font, condensed title treatment, weights and wrapping retained. Engineering uses the requested material name. Titles remain clear; no new explanatory paragraphs.
- Spacing: existing navigation and guide tools retained. Phone stage is taller than the concept to separate the two-line Engineering heading, rotatable objects and controls. Tablet/desktop switch to existing navigation layouts; no horizontal overflow in the checked widths.
- Colors: original salmon, mint and lavender preserved, ivory titles on the existing dark hero. No new site theme.
- Image quality: true rendered geometry, no old chrome/glass art. Fallback WebP images are cropped from the actual 900×600 GPU renderer, rather than unrelated concept renders. Folded-page logo is a sharp native vector. User's interactive 3D and logo requirements take precedence over the build skill's raster-only asset guideline.
- Copy/content: original assignments, study material, contacts and deadlines untouched. One short drag hint in working WebGL; static fallback has an accurate accessible description.

## Verification

- 48 behavior/geometry/lifecycle tests pass, including fixed-ring ratios, rank-two matrix state, direct touch movement, release inertia, pause-during-drag and tangent clipping regression.
- Existing UI suite passes all six course × motion-on/off workflows, plus GSAP interruption/settlement checks.
- Real GPU browser output inspected for all three scenes; observed 19/4/9 draw calls and 30,948/23,416/5,196 triangles. These are render counts, not physical-device frame-rate measurements.
- Browser layout checks cover 320, 390, 412, 820 and 1366px for each course. Search and Guide tools verified through the visible UI.
- Console reviewed: cloud browser lacks WebGL and correctly uses the new static fallback; observed remaining error messages originate in the browser's extension, not course source. GPU captures independently confirm shader rendering.
- Physical iPhone, iPad, Android hardware and Safari performance were not available. Pointer behavior has event-level regression coverage; the cloud browser's GPU limitation prevents a physical drag-performance claim.

## Implementation checklist

- [x] Three distinct subject scenes and folded-page brand mark
- [x] Idle animation, direct drag, inertia, keyboard and pause
- [x] Actual GPU captures, responsive bounds and matching fallbacks
- [x] Existing course workflows preserved
- [x] Independent review findings resolved

final result: passed
