# Slice 60 — Dark-mode residue + token hygiene Design Spec

**Date:** 2026-06-07
**Branch:** `slice-60-dark-mode-residue`
**Status:** Approved (design) — pending spec review → writing-plans
**Tier:** Compressed Slice (~10 files)
**Source:** Audit track **T4** from `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`

## 1. Goal / problem

Close the last `COLORS.*` / inline-hex residue in the apps so the district map + panel respect dark mode, plus two small adjacent hygiene fixes. All findings verified against current code 2026-06-07 (post slices 56–59). No schema.

## 2. Findings

### E1 — leftover `COLORS.*` text colors (dark-mode break)
The district map *geometry* already uses `useMapColors()` (slice 37); these are the residual TEXT/legend colors:
- web `apps/web/components/DistrictMap.tsx:56` — `color: COLORS.neutral.textMuted` → `useBrandTokens().semantic.text.muted`.
- web `apps/web/components/DistrictPanel.tsx:58` — `color: COLORS.neutral.textMuted` → `semantic.text.muted` (the file is `'use client'`, so the hook is legal).
- mobile `apps/mobile/components/DistrictPanel.tsx:66/71/72` — `COLORS.neutral.textMuted` → `semantic.text.muted`; `COLORS.brand.primary` (`link`) → `semantic.link.fg`; `COLORS.neutral.surfaceAlt` (`banner` bg) → `semantic.bg.subtle`. Move these from the static `StyleSheet.create` into the dynamic `useBrandTokens()` path (split layout-static / color-inline, the slice 34-37 pattern).

After this, **0 `COLORS.*` references remain in `apps/web` + `apps/mobile`** (confirm with a grep).

### E2 — `TIER_COLOR` inline hex → `DISTRICT_TIER_COLOR` token + hook
`packages/location/src/groups.ts:12-19` `TIER_COLOR: Record<DistrictTier, string>` holds 6 inline hexes, consumed by both `DistrictMap`s (web + mobile) for per-tier district coloring. Replace with a token + mode-aware hook:
- New `packages/ui-tokens/src/district-tier.ts`: `DISTRICT_TIER_COLOR` (light) + `DISTRICT_TIER_COLOR_DARK`, keyed by a local `DistrictTierKey` union (`'federal_house' | 'federal_senate' | 'state_senate' | 'state_house' | 'county' | 'place'`) — ui-tokens is a leaf package and cannot import `@chiaro/location`'s `DistrictTier`, so it declares its own structurally-identical key union. Export both + `DistrictTierKey` from `packages/ui-tokens/src/index.ts`. Values:

| Tier | Light | Dark |
|---|---|---|
| federal_house | `#5b6cff` | `#8a96ff` |
| federal_senate | `#1f9b88` | `#4fc4b0` |
| state_senate | `#9c64b9` | `#c08fd9` |
| state_house | `#7e54a8` | `#a87fd0` |
| county | `#7a8d4b` | `#a8bd75` |
| place | `#c9a84c` | `#e0c06a` |

- New `useDistrictTierColors()` brand hook in `packages/officials-ui/src/brand-hooks.ts` (mirror `useMapColors()` at `:139`): returns `DISTRICT_TIER_COLOR` or `DISTRICT_TIER_COLOR_DARK` based on the resolved brand mode.
- Delete `TIER_COLOR` from `location/groups.ts` (keep `DISTRICT_GROUPS` etc.). Update both `DistrictMap`s: `import { useDistrictTierColors }` and index the returned record by tier (`tierColors[tier]`) instead of `TIER_COLOR[tier]`. (The map colors many districts by tier, so a whole-record hook called once — not a per-tier hook in a loop — is the correct shape.)

### E3 — re-export parity
`packages/officials/src/index.ts` exports the hooks `useOfficialStateFinanceSummary`/`useOfficialStateDonors` but NOT the underlying query fns `fetchOfficialStateFinanceSummary` + `fetchOfficialStateDonors` (every other state fetcher is re-exported). Add both to the `export { … } from './queries.ts'` block.

### E4 — type the `state-bills` join
`packages/state-bills/src/queries.ts:35,56` do `normalizeBill(row as never)` — the `as never` defeats type-checking on the joined select. `normalizeBill` (`:144`) already declares the real shape `StateBillRow & { sponsors: unknown[]; subjects: { subject: string }[] }`. Replace `as never` with a cast to that exact join shape (extract it to a named type, e.g. `StateBillJoinRow`, used by both the `.select()` result typing and `normalizeBill`'s param), so the row's `sponsors`/`subjects` access is type-checked. No behavior change.

## 3. Scope

**In:** E1 (5 color sites across 3 files) + E2 (new token file + hook + delete `TIER_COLOR` + 2 map consumers) + E3 (2 re-exports) + E4 (cast fix + named type). **Out:** the remaining audit track T6 (consistency/polish); any map-geometry/visual restyle beyond the tier-color dark stops; any new dark-mode surface coverage. E3 + E4 are small adjacent hygiene bundled per the audit's T4 grouping.

## 4. Testing

- `@chiaro/ui-tokens`: a `district-tier.test.ts` asserting light/dark key parity (both records have the same 6 keys) + the exact values (mirror the existing `domain-palette-dark.test.ts` / `map-colors` test shape).
- `@chiaro/officials-ui`: a `useDistrictTierColors` brand-hook test (light mode → light record, dark override → dark record), mirroring the existing `useMapColors`/brand-hook tests.
- E1/E3/E4 are covered by `pnpm -r typecheck` + existing render tests (the DistrictPanel/Map changes don't alter structure; E3 is a pure re-export; E4 is a type-only change).
- **Gotcha #29:** before committing E2, grep the 6 old `TIER_COLOR` hex values (`#5b6cff` etc.) across `packages/*/test` + `apps/*/test` to catch any test pinning them; update if found. (`#5b6cff` is also `COLORS.brand.primary` — a coincidental collision; only touch district-tier usages.)

## 5. Verification (Gotcha #30)

`pnpm -r typecheck` (all 12) · `pnpm --filter @chiaro/ui-tokens test` · `pnpm --filter @chiaro/officials-ui test` · `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/web test` · `pnpm --filter @chiaro/mobile test`. Ship via PR with all 4 CI jobs green.

## 6. Open items for the plan to reconcile against live code

1. The mobile `DistrictPanel` `StyleSheet` → dynamic-color split: confirm which styles are color-only (move to inline `useBrandTokens()`) vs layout (stay static).
2. `useDistrictTierColors` return-record key typing vs the maps' `DistrictTier` index: confirm `DISTRICT_TIER_COLOR`'s `DistrictTierKey` union matches `@chiaro/location`'s `DistrictTier` literals so `tierColors[tier]` typechecks without a cast (add a cast only if the unions diverge).
3. The exact `SELECT_BILL_WITH_SPONSORS` shape (E4) so the extracted `StateBillJoinRow` type matches what PostgREST returns (`sponsors`/`subjects` nesting).
4. Confirm `useBrandTokens()`/the brand-mode context is reachable from the web + mobile `DistrictPanel`/`DistrictMap` (they render inside the app's provider tree — the home page already wraps them).
5. Confirm `@chiaro/location` has no other `TIER_COLOR` consumer beyond the 2 maps before deleting it.
