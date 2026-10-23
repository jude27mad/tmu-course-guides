# Neutral palette: screenshots

The site moved to one neutral palette with a single TMU Blue accent (`site/src/lib/palette.mjs`).

- `before/`: the previous palette at 390 px wide (phone, reduced motion), taken from the build on `main` before the change.
- After: every Pages run on a pull request takes the same twelve views with `site/scripts/check-palette-site.mjs` and uploads them in the `pages-site-qa` artifact, folder `palette/`, with the same file names. The live site shows the result once merged.

| File | View |
| --- | --- |
| 01-desk-top | Desk, top |
| 02-desk-next-up | Desk, Next up and countdown |
| 03–05-desk-badge-* | Desk, the CEN100, MTH140 and MTH141 lanyard badges |
| 06–07-desk-course-cards-* | Desk, course cards |
| 08-courses-page | Courses |
| 09-cen100, 10-mth140, 11-mth141 | Course pages with the next-deadline card |
| 12-cen100-work | CEN100, Work list |
