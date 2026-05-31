# Slice 49 — Delete dead INDUSTRY palette

**Date:** 2026-05-30
**Branch:** `slice-49-industry-rainbow-reskin` (named for reskin roadmap item #4; actual outcome is deletion)
**Tier:** Patch (~5 files)

## 1. Goals & scope

Delete the entire `INDUSTRY_COLOR` / `INDUSTRY_COLOR_DARK` / `INDUSTRY_DEFAULT_COLOR` / `INDUSTRY_DEFAULT_COLOR_DARK` palette + the `useIndustryColor` hook + all related tests. Zero UI consumers exist today — the palette was added speculatively in slice 37 as part of the dark-mode-all-domain-palettes pass without verifying a consumer existed.

Closes the slice 38+ reskin track by canceling #4 entirely. The original "industry rainbow reskin" item assumed a visible palette to retune; pre-implementation discovery surfaced that no such surface exists.

### In scope

- Delete `packages/ui-tokens/src/finance.ts` (entire file — only contains industry exports)
- Remove `INDUSTRY_COLOR` + 3 sibling exports from `packages/ui-tokens/src/index.ts`
- Remove `INDUSTRY_COLOR` parity tests from `packages/ui-tokens/test/domain-palette-dark.test.ts`
- Remove `useIndustryColor` hook + the 4 industry token imports from `packages/officials-ui/src/brand-hooks.ts`
- Remove 4 `useIndustryColor` test cases from `packages/officials-ui/test/brand-hooks.test.tsx`
- Add CLAUDE.md slice 49 entry noting the deletion

### Out of scope

- Wiring industry colors into any consumer (Option A from the brainstorm — rejected as out-of-scope for this slice)
- Speculative retune of the palette hex values (Option C from the brainstorm — rejected; no consumer)
- Edits to historical docs (slice 37 spec, slice 44 audit, slice 37 CLAUDE.md entry) — frozen as-is
- Any other reskin roadmap items (the track closes here)

## 2. Pre-deletion verification

A `git grep -n "INDUSTRY_COLOR\|useIndustryColor"` across the working tree as of master `1c5a2ac` returns matches in:

| Location | Status |
|---|---|
| `packages/ui-tokens/src/finance.ts` | source — DELETE |
| `packages/ui-tokens/src/index.ts:16-21` | re-export — REMOVE |
| `packages/ui-tokens/test/domain-palette-dark.test.ts:8-9,43-46,56` | tests — REMOVE |
| `packages/officials-ui/src/brand-hooks.ts:22-25, 124-138` | hook + imports — REMOVE |
| `packages/officials-ui/test/brand-hooks.test.tsx:16-17, 152-173` | tests — REMOVE |
| `CLAUDE.md` slice 37 entry | historical — LEAVE |
| `docs/superpowers/audits/2026-05-29-comprehensive-ui-audit.md` | historical — LEAVE |
| `docs/superpowers/specs/2026-05-27-domain-palettes-dark-mode-design.md` | historical — LEAVE |
| `docs/superpowers/plans/2026-05-27-domain-palettes-dark-mode.md` | historical — LEAVE |

Zero matches in `apps/web/`, `apps/mobile/`, or any other consumer location. Confirmed dead code.

## 3. File-by-file changes

### `packages/ui-tokens/src/finance.ts` — DELETE

Entire file. Current contents (35 lines): `INDUSTRY_COLOR` + `INDUSTRY_DEFAULT_COLOR` + `INDUSTRY_COLOR_DARK` + `INDUSTRY_DEFAULT_COLOR_DARK`. Nothing else exported from this file.

### `packages/ui-tokens/src/index.ts` — MODIFY (-6 lines)

Remove:

```ts
export {
  INDUSTRY_COLOR,
  INDUSTRY_COLOR_DARK,
  INDUSTRY_DEFAULT_COLOR,
  INDUSTRY_DEFAULT_COLOR_DARK,
} from './finance.ts'
```

### `packages/ui-tokens/test/domain-palette-dark.test.ts` — MODIFY

Remove 4 imports (lines 8-9) and the 2 INDUSTRY-related `it()` cases (around lines 43-46 + 56). After: file still tests other domain palettes (party, alignment, scorecard, category, finance-sub-section, map) for dark-variant key parity.

Test count delta: -2 cases in this file.

### `packages/officials-ui/src/brand-hooks.ts` — MODIFY

Remove the 4 industry imports (around lines 22-25):

```diff
-  INDUSTRY_COLOR,
-  INDUSTRY_COLOR_DARK,
-  INDUSTRY_DEFAULT_COLOR,
-  INDUSTRY_DEFAULT_COLOR_DARK,
```

Remove the `useIndustryColor` function (around lines 124-138):

```diff
-/**
- * Returns the industry color for the active brand mode. Falls back to the
- * default (out-of-top-10) industry color when the industry is not recognized.
- */
-export function useIndustryColor(industry: string | undefined): string {
-  const { mode } = useBrandTokens()
-  const table = mode === 'dark' ? INDUSTRY_COLOR_DARK : INDUSTRY_COLOR
-  const fallback = mode === 'dark' ? INDUSTRY_DEFAULT_COLOR_DARK : INDUSTRY_DEFAULT_COLOR
-  if (industry && industry in table) {
-    const hit = table[industry]
-    if (hit !== undefined) return hit
-  }
-  return fallback
-}
```

### `packages/officials-ui/test/brand-hooks.test.tsx` — MODIFY

Remove 4 imports (lines 16-17) and the entire `describe('useIndustryColor', ...)` block with 4 `it()` cases.

Test count delta: -4 cases in this file.

## 4. Test count impact

| Package | Before | After | Delta |
|---|---|---|---|
| `@chiaro/ui-tokens` | 167 | 165 | -2 |
| `@chiaro/officials-ui` | 568 | 564 | -4 |
| All others | unchanged | unchanged | 0 |

Total: -6 tests. No new tests added (deletion-only slice).

## 5. Risks

### R1 — Future industry-color need

If a future slice wants per-industry color identity (e.g. stripe per industry on `TopAmountBreakdown` rows), the palette + hook would need to be reintroduced. **Acceptable cost** — git history preserves the prior implementation; reintroduction would be a ~30-line add. Removing now drops the maintenance burden on dead code.

### R2 — Historical doc references

Audit doc, slice 37 spec, slice 27 dark-mode spec, slice 44 comprehensive-UI-audit doc all reference `INDUSTRY_COLOR`. Leave those as-is — they're frozen historical artifacts. A reader scanning history will see the slice 49 entry in CLAUDE.md noting the palette was deleted.

### R3 — CLAUDE.md slice 37 entry

Slice 37 entry mentions adding `INDUSTRY_COLOR_DARK` as part of the dark-mode pass. Leave as-is. Add a new slice 49 entry stating the palette was deleted as dead code.

### R4 — Reskin track closure

This slice CLOSES the slice 38+ visual reskin track. Items already closed: #1 (slice 40), #2 (slice 42), #3 (slice 40), #5 (slice 43 audit-D status quo), #6 (slice 43 different direction). Item #4 = canceled via this deletion. After slice 49: no queued reskin roadmap items remain.

## 6. Manual smoke checklist

None — there are no UI surfaces affected by this change. Verify via:

1. `pnpm test` — all workspaces green (ui-tokens 165, officials-ui 564, mobile/web/db unchanged)
2. `pnpm -r typecheck` — all 11 packages pass
3. `pnpm --filter @chiaro/web build` — bundle unchanged
4. `git grep -n "INDUSTRY_COLOR\|useIndustryColor" packages/ apps/` — zero matches after deletion (excluding `docs/` + `CLAUDE.md` historical)
