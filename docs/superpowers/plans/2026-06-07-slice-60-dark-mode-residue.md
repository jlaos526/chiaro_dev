# Slice 60 — Dark-mode residue + token hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last `COLORS.*`/inline-hex residue in the apps (district map + panel respect dark mode) via a new `DISTRICT_TIER_COLOR` token + `useDistrictTierColors` hook, plus two small hygiene fixes (a re-export + a type cast).

**Architecture:** Mirror the established slice-37 per-domain-palette pattern: token (light + `_DARK`) in `@chiaro/ui-tokens`, mode-aware hook in `@chiaro/officials-ui/brand-hooks.ts` (like `useMapColors`), consumers call the hook. The leftover text colors migrate to `useBrandTokens().semantic.*`. No schema.

**Tech Stack:** TypeScript, react-native-web, react-leaflet (web map) / react-native-maps (mobile), vitest.

**Branch:** `slice-60-dark-mode-residue` (spec `882f3c9` committed).

**Conventions:** Sequential implementers (Gotcha #25). **Gotcha #29:** any token hex change needs a cross-package test grep — done in Task 6, but each task that touches a hex also greps.

---

### Task 1: E2 — `DISTRICT_TIER_COLOR` token in `@chiaro/ui-tokens`

**Files:**
- Create: `packages/ui-tokens/src/district-tier.ts`
- Modify: `packages/ui-tokens/src/index.ts`
- Test: `packages/ui-tokens/test/district-tier.test.ts`

- [ ] **Step 1: Write the failing test** `packages/ui-tokens/test/district-tier.test.ts` (match the import-path convention of an existing ui-tokens test, e.g. `test/map-colors` or `test/domain-palette-dark.test.ts` — likely `from '../src/district-tier.ts'`):
```ts
import { describe, expect, it } from 'vitest'
import { DISTRICT_TIER_COLOR, DISTRICT_TIER_COLOR_DARK } from '../src/district-tier.ts'

const KEYS = ['county', 'federal_house', 'federal_senate', 'place', 'state_house', 'state_senate']

describe('DISTRICT_TIER_COLOR', () => {
  it('light + dark have identical keys (all 6 tiers)', () => {
    expect(Object.keys(DISTRICT_TIER_COLOR).sort()).toEqual(KEYS)
    expect(Object.keys(DISTRICT_TIER_COLOR_DARK).sort()).toEqual(KEYS)
  })
  it('light values', () => {
    expect(DISTRICT_TIER_COLOR.federal_house).toBe('#5b6cff')
    expect(DISTRICT_TIER_COLOR.place).toBe('#c9a84c')
  })
  it('dark values lighten the hue', () => {
    expect(DISTRICT_TIER_COLOR_DARK.federal_house).toBe('#8a96ff')
    expect(DISTRICT_TIER_COLOR_DARK.place).toBe('#e0c06a')
  })
})
```

- [ ] **Step 2: Run — verify FAIL.** `pnpm --filter @chiaro/ui-tokens test district-tier`. Expected: module not found.

- [ ] **Step 3: Create the token** `packages/ui-tokens/src/district-tier.ts`:
```ts
// Domain palette: per-district-tier accent colors for the map legend + polygon
// strokes/fills (web Leaflet + RN react-native-maps). Light values from the
// slice-2 location TIER_COLOR; dark variants (slice 60) lighten each hue for
// legibility on the dark map base (MAP_COLORS_DARK.districtFill #3a3e45).
// ui-tokens is a leaf package and cannot import @chiaro/location's DistrictTier,
// so it declares its own structurally-identical key union.
export type DistrictTierKey =
  | 'federal_house'
  | 'federal_senate'
  | 'state_senate'
  | 'state_house'
  | 'county'
  | 'place'

export const DISTRICT_TIER_COLOR: Record<DistrictTierKey, string> = {
  federal_house:  '#5b6cff',
  federal_senate: '#1f9b88',
  state_senate:   '#9c64b9',
  state_house:    '#7e54a8',
  county:         '#7a8d4b',
  place:          '#c9a84c',
} as const

export const DISTRICT_TIER_COLOR_DARK: Record<DistrictTierKey, string> = {
  federal_house:  '#8a96ff',
  federal_senate: '#4fc4b0',
  state_senate:   '#c08fd9',
  state_house:    '#a87fd0',
  county:         '#a8bd75',
  place:          '#e0c06a',
} as const
```

- [ ] **Step 4: Export from the barrel** — in `packages/ui-tokens/src/index.ts`, add:
```ts
export { DISTRICT_TIER_COLOR, DISTRICT_TIER_COLOR_DARK, type DistrictTierKey } from './district-tier.ts'
```

- [ ] **Step 5: Run — verify PASS.** `pnpm --filter @chiaro/ui-tokens test district-tier` + `pnpm --filter @chiaro/ui-tokens typecheck`.

- [ ] **Step 6: Commit.**
```bash
git add packages/ui-tokens/src/district-tier.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/district-tier.test.ts
git commit -m "feat(slice-60): DISTRICT_TIER_COLOR token (light+dark) (E2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: E2 — `useDistrictTierColors` brand hook

**Files:**
- Modify: `packages/officials-ui/src/brand-hooks.ts`
- Test: `packages/officials-ui/test/...` (mirror the existing `useMapColors` brand-hook test — find it first)

Context: mirror `useMapColors()` (`brand-hooks.ts:139`):
```ts
export function useMapColors(): { districtStroke: string; districtFill: string } {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? MAP_COLORS_DARK : MAP_COLORS
}
```

- [ ] **Step 1: Find the existing `useMapColors` test** — `grep -rln "useMapColors" packages/officials-ui/test` — to mirror its harness (how it sets light vs dark mode: via the `BrandModeOverrideContext` provider or a `useColorScheme` mock).

- [ ] **Step 2: Write the failing test** (place beside the `useMapColors` test or in a new `test/brand-hooks/useDistrictTierColors.test.tsx`, matching the sibling's structure):
```tsx
// (adapt mode-setup to the sibling useMapColors test's pattern)
import { DISTRICT_TIER_COLOR, DISTRICT_TIER_COLOR_DARK } from '@chiaro/ui-tokens'
import { useDistrictTierColors } from '../../src/brand-hooks.ts'
// render a tiny probe component under light vs dark and assert:
//   light → useDistrictTierColors() === DISTRICT_TIER_COLOR
//   dark  → useDistrictTierColors() === DISTRICT_TIER_COLOR_DARK
// (assert e.g. result.federal_house equals the light/dark hex respectively)
```

- [ ] **Step 3: Run — verify FAIL.** `pnpm --filter @chiaro/officials-ui test useDistrictTierColors`.

- [ ] **Step 4: Implement** in `brand-hooks.ts` — add `DISTRICT_TIER_COLOR`, `DISTRICT_TIER_COLOR_DARK`, `DistrictTierKey` to the existing `from '@chiaro/ui-tokens'` import block, and add the hook next to `useMapColors`:
```ts
export function useDistrictTierColors(): Record<DistrictTierKey, string> {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? DISTRICT_TIER_COLOR_DARK : DISTRICT_TIER_COLOR
}
```
Ensure `useDistrictTierColors` is exported from the package barrel if the package re-exports brand-hooks (check how `useMapColors` is exported from `packages/officials-ui/src/index.ts` and mirror it).

- [ ] **Step 5: Run — verify PASS.** `pnpm --filter @chiaro/officials-ui test useDistrictTierColors` + `pnpm --filter @chiaro/officials-ui typecheck`.

- [ ] **Step 6: Commit.**
```bash
git add packages/officials-ui/src/brand-hooks.ts packages/officials-ui/src/index.ts packages/officials-ui/test/
git commit -m "feat(slice-60): useDistrictTierColors brand hook (E2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: E2 + E1 — delete `TIER_COLOR`, wire both `DistrictMap`s to the hook + migrate the web map's text color

**Files:**
- Modify: `packages/location/src/groups.ts` (delete `TIER_COLOR`)
- Modify: `apps/web/components/DistrictMap.tsx`, `apps/mobile/components/DistrictMap.tsx`

Context: `groups.ts:12-19` `TIER_COLOR` is consumed ONLY by the 2 `DistrictMap`s. web map: `TIER_COLOR[d.tier]` at `:70` (legend span) + `:92` (GeoJSON style); also `COLORS.neutral.textMuted` at `:56` (E1). mobile map: `TIER_COLOR[d.tier]` at `:53` (toggle bg) + `:71` (strokeColor). Both import `TIER_COLOR, TIER_LABEL, DISTRICT_GROUPS, type DistrictTier` from `@chiaro/location` + `useMapColors` from `@chiaro/officials-ui` + `COLORS` from `@chiaro/ui-tokens`.

- [ ] **Step 1: Confirm no other `TIER_COLOR` consumer** — `grep -rn "TIER_COLOR" packages apps --include=*.ts --include=*.tsx | grep -v "groups.ts"`. Expected: only the 2 DistrictMaps. If anything else, STOP.

- [ ] **Step 2: Delete `TIER_COLOR`** from `packages/location/src/groups.ts` (the `export const TIER_COLOR: Record<DistrictTier, string> = {...}` block at `:12-19`). Keep `TIER_LABEL`, `DISTRICT_GROUPS`, `DistrictGroup`, etc.

- [ ] **Step 3: Update `apps/web/components/DistrictMap.tsx`:**
  - Import: remove `TIER_COLOR` from the `@chiaro/location` import (keep `TIER_LABEL, DISTRICT_GROUPS, type DistrictTier`). Add `useDistrictTierColors` (and `useBrandTokens` for E1) to the `@chiaro/officials-ui` import.
  - In the component body (near `const mapColors = useMapColors()`): add `const tierColors = useDistrictTierColors()` and `const { semantic } = useBrandTokens()`.
  - `:56` `color: COLORS.neutral.textMuted` → `color: semantic.text.muted`.
  - `:70` + `:92` `TIER_COLOR[d.tier]` → `tierColors[d.tier]`.
  - If `COLORS` is now unused in the file, remove the `import { COLORS } from '@chiaro/ui-tokens'`.

- [ ] **Step 4: Update `apps/mobile/components/DistrictMap.tsx`:**
  - Import: remove `TIER_COLOR` from `@chiaro/location` (keep the rest). Add `useDistrictTierColors` to the `@chiaro/officials-ui` import.
  - In the body (near `useMapColors()`): add `const tierColors = useDistrictTierColors()`.
  - `:53` + `:71` `TIER_COLOR[d.tier]` → `tierColors[d.tier]`.
  - Grep the file for any `COLORS.*` usage; if `COLORS` is unused after, remove its import. (The mobile map imports `COLORS` — confirm whether it's used in a StyleSheet; leave/remove accordingly.)

- [ ] **Step 5: Verify** `tierColors[d.tier]` typechecks without a cast (`DistrictTier`'s 6 literals match `DistrictTierKey`). Run `pnpm -r typecheck` (all 12 — confirms no other package referenced `TIER_COLOR` + the maps resolve the hook). If TS complains about the index type, the `DistrictTier`/`DistrictTierKey` unions diverge — reconcile (don't add a blanket `as any`; align the union or use a precise cast).

- [ ] **Step 6: Commit.**
```bash
git add packages/location/src/groups.ts apps/web/components/DistrictMap.tsx apps/mobile/components/DistrictMap.tsx
git commit -m "refactor(slice-60): DistrictMap uses useDistrictTierColors + semantic text (E1,E2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: E1 — `DistrictPanel` (web + mobile) text colors → brand tokens

**Files:**
- Modify: `apps/web/components/DistrictPanel.tsx` (`:58`), `apps/mobile/components/DistrictPanel.tsx` (`:66/:71/:72`)

Context: web `DistrictPanel` is `'use client'`. mobile uses a static `StyleSheet`.

- [ ] **Step 1: Web** `apps/web/components/DistrictPanel.tsx` — add `import { useBrandTokens } from '@chiaro/officials-ui'` (if not already), call `const { semantic } = useBrandTokens()` in the component, change `:58` `color: COLORS.neutral.textMuted` → `color: semantic.text.muted`. If `COLORS` becomes unused, remove its import. (The panel renders inside the home page's provider tree, so `useBrandTokens` resolves.)

- [ ] **Step 2: Mobile** `apps/mobile/components/DistrictPanel.tsx` — read the file. The 3 color sites (`:66` `color: COLORS.neutral.textMuted`, `:71` `link: { color: COLORS.brand.primary }`, `:72` `banner: { …, backgroundColor: COLORS.neutral.surfaceAlt, … }`) live in a static `StyleSheet.create`. Move ONLY the color properties out of the static StyleSheet into dynamic inline styles driven by `useBrandTokens()` (the slice 34-37 split pattern): keep layout props (padding/borderRadius/gap/fontSize) static; apply `{ color: semantic.text.muted }`, `{ color: semantic.link.fg }`, `{ backgroundColor: semantic.bg.subtle }` inline at the respective `<Text>`/`<View>` sites. Add `const { semantic } = useBrandTokens()` at the top of the component (before any early return). Remove the `COLORS` import if now unused.

- [ ] **Step 3: Verify** — `pnpm --filter @chiaro/web test` + `pnpm --filter @chiaro/mobile test` (existing DistrictPanel render tests still green) + `pnpm -r typecheck`. Then confirm **0 `COLORS.*` references remain in `apps/`**: `grep -rn "COLORS\." apps/web apps/mobile --include=*.tsx --include=*.ts` → empty.

- [ ] **Step 4: Commit.**
```bash
git add apps/web/components/DistrictPanel.tsx apps/mobile/components/DistrictPanel.tsx
git commit -m "fix(slice-60): DistrictPanel text colors use semantic tokens (E1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: E3 + E4 — officials re-export + state-bills join type

**Files:**
- Modify: `packages/officials/src/index.ts` (E3)
- Modify: `packages/state-bills/src/queries.ts` (E4)

- [ ] **Step 1: E3** — in `packages/officials/src/index.ts`, find the `export { … } from './queries.ts'` block and add `fetchOfficialStateFinanceSummary,` + `fetchOfficialStateDonors,` to it (the hooks `useOfficialStateFinanceSummary`/`useOfficialStateDonors` are already exported; this adds the underlying fetchers for parity). Confirm both fns exist in `queries.ts` first (`grep -n "export async function fetchOfficialStateFinanceSummary\|fetchOfficialStateDonors" packages/officials/src/queries.ts`).

- [ ] **Step 2: E4** — in `packages/state-bills/src/queries.ts`, extract the join shape to a named type and drop the `as never` casts:
  - Add near the top (after the imports / `SELECT_BILL_WITH_SPONSORS`): `type StateBillJoinRow = StateBillRow & { sponsors: unknown[]; subjects: { subject: string }[] }`.
  - Change `normalizeBill`'s signature (`:144`) from the inline intersection to `function normalizeBill(row: StateBillJoinRow): StateBillWithSponsors {`.
  - At `:35` + `:56`, change `normalizeBill(row as never)` → `normalizeBill(row as StateBillJoinRow)` (a precise shape cast instead of `never` — restores type-checking of `normalizeBill`'s body against the join shape; `row` is whatever PostgREST infers from the string select, so a cast to the known shape is still required, but it's now meaningful, not `never`).

- [ ] **Step 3: Verify** — `pnpm -r typecheck` (all 12) + `pnpm --filter @chiaro/officials test` + `pnpm --filter @chiaro/state-bills test`. All green.

- [ ] **Step 4: Commit.**
```bash
git add packages/officials/src/index.ts packages/state-bills/src/queries.ts
git commit -m "refactor(slice-60): re-export state finance fetchers + type state-bills join (E3,E4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verify-all + closeout

**Files:**
- Modify: `CLAUDE.md` (slice-60 entry), `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md` (mark T4 done)

- [ ] **Step 1: Gotcha #29 cross-package hex grep.** Run:
```
grep -rn "#5b6cff\|#1f9b88\|#9c64b9\|#7e54a8\|#7a8d4b\|#c9a84c" packages/*/test apps/*/test
```
The only matches should be the new `district-tier.test.ts` (Task 1). If another test pins one of these as the OLD `TIER_COLOR` value, update it. **Caveat:** `#5b6cff` is also `COLORS.brand.primary` and `#1f9b88` is `COLORS.brand.accent` — a test pinning those for a NON-district-tier reason is a coincidental collision; leave it. Only touch district-tier-related pins.

- [ ] **Step 2: Full verification sweep.** Run, expecting green:
- `pnpm -r typecheck`
- `pnpm --filter @chiaro/ui-tokens test` · `pnpm --filter @chiaro/officials-ui test`
- `pnpm --filter @chiaro/web build` + `pnpm --filter @chiaro/web test`
- `pnpm --filter @chiaro/mobile test`
Confirm `grep -rn "COLORS\." apps/web apps/mobile --include=*.tsx --include=*.ts` is empty (the dark-mode-residue goal).

- [ ] **Step 3: CLAUDE.md** — add the slice-60 entry after the slice-59 entry:
```markdown
- **Slice 60 — Dark-mode residue + token hygiene (audit T4)** (2026-06-07): Compressed Slice (~12 files). Fifth audit-track remediation; **closes the comprehensive-audit backlog's dark-mode track**. E1: the last `COLORS.*` consumers in the apps — web `DistrictMap`/`DistrictPanel` + mobile `DistrictPanel` text/legend colors — migrate to `useBrandTokens().semantic.*` (map *geometry* already used `useMapColors` since slice 37; this was the residual text). **0 `COLORS.*` references remain in `apps/`.** E2: `location/groups.ts` `TIER_COLOR` (6 inline hexes) → new `DISTRICT_TIER_COLOR` + `DISTRICT_TIER_COLOR_DARK` token in `@chiaro/ui-tokens` (dark stops lighten each hue for the dark map base) + `useDistrictTierColors()` brand hook (mirrors `useMapColors`); both `DistrictMap`s consume the hook, so per-tier district colors are now mode-aware. E3: re-export `fetchOfficialStateFinanceSummary` + `fetchOfficialStateDonors` from `@chiaro/officials` (hook/fetcher export parity). E4: `state-bills` `normalizeBill(row as never)` → a named `StateBillJoinRow` cast, restoring type-checking on the join. No schema (pgTAP stays 490).
```

- [ ] **Step 4: Mark audit T4 done** — in `docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md`, prepend `✅ SHIPPED (slice 60). ` to the T4 row's Note cell.

- [ ] **Step 5: Commit.**
```bash
git add CLAUDE.md docs/superpowers/audits/2026-06-05-comprehensive-app-audit.md
git commit -m "docs(slice-60): CLAUDE.md slice entry + mark audit T4 done

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (controller, after all tasks)
- [ ] All 4 CI jobs green. `build` + `test` exercise the token/hook/map/panel changes.
- [ ] `git log --oneline master..HEAD` shows spec + plan + Tasks 1–6.
- [ ] PR title: "Slice 60 — Dark-mode residue + token hygiene (audit T4)". Squash-merge + delete branch; sync master.

## Notes
- **DistrictTierKey vs DistrictTier:** they're separate types with identical 6 string members; `tierColors[d.tier]` typechecks structurally (no cast). If it doesn't, the unions have diverged — align them, don't `as any`.
- **`#5b6cff` collision:** it equals `COLORS.brand.primary`; the Gotcha-#29 grep must distinguish district-tier pins from brand-primary pins.
- **0 `COLORS.*` in apps** is the success criterion for the dark-mode goal — assert it in Task 4 + Task 6.
