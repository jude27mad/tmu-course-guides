# Night Shift Stage 1 (part 1) — CEN100 move, root compatibility and the Desk placeholder

Recorded 2026-10-12 on `night-shift` (parent `0a03590`), Node `v22.22.0`, Playwright Chromium (SwiftShader). Nothing was pushed or deployed.

## What changed

- `index.html` → `cen100/index.html` (`git mv`). Relative URLs were rebased to `../`. The calendar `URL:` is now `…/tmu-course-guides/cen100/`, and the ICS `UID:cen100-f26-<id>-jude27mad-github-io` is unchanged. The page also got a CEN-only meta description. `<body data-course="cen100">` is kept, so every storage key is unchanged.
- The CEN `SCHEDULE` (24 records) moved unchanged to `assets/cen-schedule.js`. This classic script defines `window.CEN_SCHEDULE`, or reuses it if it already exists. `assets/cen-schedule.mjs` imports that script and exports it as `SCHEDULE`, so only one copy exists. `cen100/index.html` and `colour-preview.html` (which held an identical copy) load the classic script before their inline scripts and use `const SCHEDULE=window.CEN_SCHEDULE`.
- New root `index.html` is the Desk placeholder: `<body data-page="desk">`, the same CSP, `assets/legacy-route.js` as the first script in `<head>`, plain links to `cen100/`, `mth140/`, `mth141/` and `privacy.html`, plus `hub.js`. It loads no course module.
- `assets/legacy-route.js` decides root forwarding (allowlist below) and runs once at load. It derives the site base from its own script URL, forwards only from the Desk path (`<base>` or `<base>index.html`), and always forwards to `<base>cen100/` plus the raw query and hash.
- `assets/hub.js`: the CEN link is now `cen100/`. A first **Desk** link (`.course-link.desk-link`, `data-course-link="desk"`) pointing at the site base appears on every page. The CEN default was removed, so the Desk link is the one marked current on the Desk. `hub.css` gives the Desk link a neutral accent, and `workspace.css` shows four phone columns.
- Cache strings: `hub.js`, `hub.css` and `workspace.css` use `?v=20261012-desk1` on all three course pages.
- `tools/preview-server.mjs`: new `--base /tmu-course-guides/` option. Requests outside the base return 404, and the base root serves `index.html`. Bare directories now get a 301 to the trailing slash, as on Pages. It exports `normalizeBase`, `mapPath` and `createPreview`.
- `tools/ui-build/workflow-check.cjs`: CEN runs at `cen100/`. New assertions check the seeded CEN plan, note and section at `cen100/`, the Desk link, and that CEN is marked current. A Desk check (motion off and on) was added.
- Other path updates: `colour-preview.html` "Open the main guide" now goes to `cen100/`; the CEN routes in `tests/header-preview.html` and `tests/editorial/index.html`; and README links and the file table.

## Root forwarding allowlist (raw `location.hash`, case-sensitive)

`^#assignment-[a-z]\d+$` · `^#(assignments|course-info|guide-tools|guide-search|workspace-timeline)$` · `^#(nextsign|board|course-main)$` · `^#(t|p)-(team|you|rules)$` · `^#guide-item-[a-z]\d+$`

No query key triggers forwarding: `QUERY_KEYS=[]`, because the old guide read no query key of its own. All of these stay on the Desk: no hash, `#`, `#top`, math ids, and query-only URLs such as `?motion=off`, `?tier=low` and `?theme=dark`.

## Results

| Check | Result |
|---|---|
| `node --test tests/legacy-route.test.mjs tests/preview-server.test.mjs tests/cen-schedule.test.mjs` | 18/18 pass |
| `node --test tests/*.test.mjs tests/scene-*.cjs` | 67 tests: 59 pass, 8 fail. The 8 failures are the same ones recorded in `baseline-tests.md` (`scene-rendering.cjs` ×6, `subject-headers.test.mjs` ×2). |
| `tools/ui-build` `npm test` | `test.cjs` passes. `workflow-check.cjs`: Desk off and on pass. Its first course case (`cen100/`, off) then fails only on the final runtime-error assertion, with the same three `night/{warp,palette,feel}.css` 404s as the baseline (`boot.mjs` FEATURES). |
| All six course × motion cases run independently (scratch runner) | Every assertion passes, including the new seeded-progress ones. Each case's only failure is the final error list, which is exactly those three CSS 404s, as in the baseline. |
| Chromium, `--base /tmu-course-guides/` and plain `/` | Root CEN links (`?motion=off#assignment-y4`, `#assignments`, `index.html?tier=low&utm_source=x%20y#guide-item-m3`, `?to=https://example.com/#course-info`) arrive once at `<base>cen100/` with the query and hash intact, and `#assignment-y4` opens its item. Generic-only URLs and math hashes stay on the Desk. `cen100/#assignment-y4` does not loop. Seeded `cen100-contact-choice-v1`, `cen100-personal-plan-v1` (integrity done, note) and `mth140-section-v1` are read at the new routes and left unchanged. The Desk loads with no failed request and no horizontal overflow at 1440 or 390 px. The only 404s on course pages are the known `night/{warp,palette,feel}.{css,mjs}`. |

Not done here: the legacy forwarder edit (see `forwarder.md`), Desk deadlines and Desk mode in `core`/`boot`, and any screenshot matrix.
