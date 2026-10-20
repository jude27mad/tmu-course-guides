## 2026-10-20 - Pre-computing normalisation values for full text search
**Learning:** String `normalize` and regex `.replace` are expensive operations to be continuously done on long arrays of texts per user keystroke in the full text search implementation of `site/src/lib/search.mjs`
**Action:** When evaluating full text search, pre-calculate the normalised query inputs to memory at module level in order to only compute this string modification once.
