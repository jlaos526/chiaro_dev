# Slice 37 — Domain Palettes + Dark Mode Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the retrofit track. Add `alert.warning/success` + `signal.success` + `link.fg` BRAND tokens. Ship dark variants for all 7 domain palettes via per-domain hooks. Migrate all remaining `COLORS.signal.*` refs + every slice-34 audit deferred site. Wire map components into dark mode.

**Architecture:** Same `useBrandTokens()` foundation from slices 33-36. Domain palette dark variants exposed via new per-domain hooks (`usePartyColor`, `useAlignmentChipColors`, etc.) that read mode from `useBrandTokens()` and pick the right table. No brand-philosophy rebases — hex values stay identical, dark variants are lightness-shifted equivalents.

**Spec:** `docs/superpowers/specs/2026-05-27-domain-palettes-dark-mode-design.md`
**Branch:** `domain-palettes-dark-mode` (already created; spec committed at `f0dd951`)

---

## File overview

```
packages/ui-tokens/src/                        Tasks 1-2
├── brand/palette.ts                           T1 (alert.warning/success + signal/link palette stops)
├── brand/semantic.ts                          T1 (alert.warning/success + signal + link semantic)
├── party.ts                                   T2 (PARTY_COLOR_DARK + .unknown stop)
├── alignment.ts                               T2 (ALIGNMENT_CHIP_COLORS_DARK)
├── scorecard.ts                               T2 (SCORECARD_LEAN_COLOR_DARK)
├── category.ts                                T2 (CATEGORY_CARD_BG_SOLID + 4 _DARK exports)
├── finance.ts                                 T2 (INDUSTRY_COLOR_DARK + FINANCE_CARD_BG + _DARK)
├── finance-shades.ts                          T2 (FINANCE_SUB_SECTION_SHADES_DARK)
├── map-colors.ts                              T2 (MAP_COLORS_DARK)
└── index.ts                                   T2 (re-export new symbols)

packages/officials-ui/src/
├── brand-hooks.ts                             T3 (10 new per-domain hooks)
├── PartyBadge.tsx                             T5
├── bio/{BioPortrait,BioContactLinks,BioIdentityRow}.tsx   T5
├── cards/{AlignmentChip,MetricCardShell}.tsx              T6
├── finance/{TopAmountBreakdown,FinanceSummaryStrip}.tsx   T7
├── federal/{FederalEthicsAccountabilityCard,FederalMissedVotesList,FederalStockTransactionsList,FederalSponsoredBillsList,FederalCosponsoredBillsList,FederalScorecardRatingsList}.tsx   T4 + T8
└── state/{StateEthicsComplaintsList,StateOfficialEventsList,StateIssueVotesEvidence,StateIssuePositionsCard}.tsx   T4 + T8

apps/web/components/DistrictMap.tsx            T9
apps/mobile/components/DistrictMap.tsx         T9

docs/superpowers/audits/2026-05-27-inline-hex-sweep.md  T10
CLAUDE.md                                      T10
```

---

## Migration vocabulary additions (T1-T2 establish; T4-T9 consume)

### New BRAND.semantic paths

| New | Light hex | Dark hex |
|---|---|---|
| `semantic.alert.warning.fg` | `#d68a1f` | `#f0b558` |
| `semantic.alert.warning.bg` | `#fef7e8` | `#3a2a14` |
| `semantic.alert.warning.border` | `#f5c878` | `#6e4a20` |
| `semantic.alert.success.fg` | `#1f9b88` | `#4dbfb0` |
| `semantic.alert.success.bg` | `#e8f5f2` | `#1a302c` |
| `semantic.alert.success.border` | `#7fc5b5` | `#3a6e62` |
| `semantic.signal.success` | `#3da75b` | `#5dc97f` |
| `semantic.link.fg` | `#3b6ed1` | `#7a98e1` |

### Signal.* → alert.* mapping

| Was | Becomes |
|---|---|
| `COLORS.signal.warning` | `semantic.alert.warning.fg` |
| `COLORS.signal.success` | `semantic.alert.success.fg` |
| `COLORS.signal.error` | `semantic.alert.danger.fg` (already canonical from slice 32) |

For chip-style usage (`${color}22` alpha overlay), keep the existing string-concat pattern — slice 38+ may introduce dedicated `alert.*.chipBg` tokens, but this slice preserves the existing visual idiom.

### Domain hook naming

| Palette | Hook |
|---|---|
| `PARTY_COLOR` | `usePartyColor(party)` |
| `ALIGNMENT_CHIP_COLORS` | `useAlignmentChipColors(tier)` |
| `SCORECARD_LEAN_COLOR` | `useScorecardLeanColor(lean)` |
| `CATEGORY_CARD_GRADIENT` | `useCategoryCardGradient(categoryId)` |
| `CATEGORY_ACCENT` | `useCategoryAccent(categoryId)` |
| `CATEGORY_CARD_BG_SOLID` | `useCategoryCardBgSolid(categoryId)` |
| `INDUSTRY_COLOR` | `useIndustryColor(industry)` |
| `FINANCE_CARD_BG` | `useFinanceCardBg()` |
| `FINANCE_SUB_SECTION_SHADES` | `useFinanceSubSectionShade(category)` |
| `MAP_COLORS` | `useMapColors()` returns `{ districtStroke, districtFill }` |

---

## Task 1: BRAND palette + semantic — alert.warning/success/signal/link

**Files:**
- Modify: `packages/ui-tokens/src/brand/palette.ts`
- Modify: `packages/ui-tokens/src/brand/semantic.ts`
- Modify: `packages/ui-tokens/test/brand-palette.test.ts` (extend)
- Modify: `packages/ui-tokens/test/brand-semantic.test.ts` (extend)

- [ ] **Step 1: Read existing palette.ts + semantic.ts** to understand the current structure.

- [ ] **Step 2: Extend `BRAND_PALETTE.light` and `BRAND_PALETTE.dark`** with the 4 new namespaces. Each mode gets:
  - `alert.warning = { fg, bg, border }` (3 hex per mode)
  - `alert.success = { fg, bg, border }` (3 hex per mode)
  - `signal = { success }` (1 hex per mode)
  - `link = { fg }` (1 hex per mode)

Use the hex values from the migration vocabulary table above.

- [ ] **Step 3: Extend `buildSemantic` in `semantic.ts`** to expose the new tokens:

```ts
alert: {
  danger: { fg: p.alert.danger.fg, bg: p.alert.danger.bg, border: p.alert.danger.border },
  warning: { fg: p.alert.warning.fg, bg: p.alert.warning.bg, border: p.alert.warning.border },   // NEW
  success: { fg: p.alert.success.fg, bg: p.alert.success.bg, border: p.alert.success.border },   // NEW
},
signal: {                                                                                          // NEW
  success: p.signal.success,
},
link: {                                                                                            // NEW
  fg: p.link.fg,
},
```

Note: slice 32 had `alert.danger.fg/bg/border` at the palette-level too. If the slice-32 palette didn't store alert as nested objects, refactor `BRAND_PALETTE.light.alert` from a flat keys-by-number table to a `{ danger: { fg, bg, border } }` shape — make this refactor backward-compatible by keeping the legacy keys as well, OR fully migrate the test assertions.

If the simpler option is to nest in semantic only (not palette), do that: keep the palette flat as `alert.100/300/500/700` and synthesize the new semantic shape from those. Implementer chooses the cleaner option. Document the choice in the commit message.

- [ ] **Step 4: Extend tests**

`brand-palette.test.ts`:
- Add assertions for new alert.warning/success palette stops in both modes
- Add assertions for signal.success + link.fg
- Update mode-parity assertions to include new keys

`brand-semantic.test.ts`:
- Add assertions for `BRAND_SEMANTIC.light.alert.warning/success/danger`, `.signal.success`, `.link.fg`
- Verify dark mode resolves to dark palette values
- Update key-shape parity assertions

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/ui-tokens test
pnpm --filter @chiaro/ui-tokens typecheck
pnpm -r typecheck
```

Expected: all green. The workspace typecheck check is critical — adding new semantic keys must not break existing consumers (they only fail if a downstream `.test.tsx` asserts on exact `Object.keys()` shape; spot-check those).

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts \
        packages/ui-tokens/src/brand/semantic.ts \
        packages/ui-tokens/test/brand-palette.test.ts \
        packages/ui-tokens/test/brand-semantic.test.ts
git commit -m "$(cat <<'EOF'
feat(ui-tokens): BRAND alert.warning + alert.success + signal.success + link.fg

Adds 4 new BRAND.semantic namespaces with light + dark palette stops.
Migration map (docs/brand-migration.md updated separately).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Domain palette dark variants + CATEGORY_CARD_BG_SOLID + FINANCE_CARD_BG

**Files:**
- Modify: `packages/ui-tokens/src/party.ts`
- Modify: `packages/ui-tokens/src/alignment.ts`
- Modify: `packages/ui-tokens/src/scorecard.ts`
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/src/finance.ts`
- Modify: `packages/ui-tokens/src/finance-shades.ts`
- Modify: `packages/ui-tokens/src/map-colors.ts`
- Modify: `packages/ui-tokens/src/index.ts` (re-export new symbols)
- New: `packages/ui-tokens/test/domain-palette-dark.test.ts`

For each domain palette file, add a `_DARK` export with the same keys but mode-appropriate values. Existing light export stays byte-identical (back-compat).

- [ ] **Step 1: Read each domain palette file** to understand the existing export shape.

- [ ] **Step 2: For each palette, add `_DARK` export**:

```ts
// party.ts example
export const PARTY_COLOR = { D: '#...', R: '#...', I: '#...', /* etc */ } as const

// NEW
export const PARTY_COLOR_DARK = {
  D: '#...', // lighter blue for dark
  R: '#...', // lighter red for dark
  // ... derive each by lightening ~20%
} as const

// NEW: also add to PARTY_COLOR
export const PARTY_COLOR = { ..., unknown: '#807a72' } as const
export const PARTY_COLOR_DARK = { ..., unknown: '#7a7268' } as const
```

For dark variant derivation, use **HSL lightness shift up by ~20%** as a heuristic. The implementer can use any HSL-aware converter or eyeball it. Reasonable values for the common parties:
- D (blue ~#1f5fa0 light): dark ~`#5b8de1`
- R (red ~#c5364a light): dark ~`#e87680`
- I (gray ~#666 light): dark ~`#a8a8a8`
- L, G, IND, Nonpartisan: similar shift

For `category.ts` specifically:
- Add `CATEGORY_CARD_BG_SOLID` (light) AND `CATEGORY_CARD_BG_SOLID_DARK` — move the 6 values currently in `MetricCardShell.tsx` (`#fcfaf2` service-record, `#f6f8fc` issue-positions, etc.) and add dark equivalents (deeper warm versions on the brown spectrum).
- Add `CATEGORY_ACCENT_DARK`, `SUB_CASCADE_ACCENT_DARK`, `CATEGORY_CARD_GRADIENT_DARK`.

For `finance.ts`:
- Add `FINANCE_CARD_BG = '#f4faf6'` (light) + `FINANCE_CARD_BG_DARK = '#1a2820'` (deep warm-mint for dark)
- Add `INDUSTRY_COLOR_DARK` + `INDUSTRY_DEFAULT_COLOR_DARK`

For `map-colors.ts`:
- Add `MAP_COLORS_DARK = { districtStroke: '#fdf8f3', districtFill: '#3a2e26' }` (inverts from light's `#1a1714` stroke + `#f5f0e8` fill)

- [ ] **Step 3: Re-export the new symbols from `packages/ui-tokens/src/index.ts`**.

- [ ] **Step 4: Write a parity test**

Create `packages/ui-tokens/test/domain-palette-dark.test.ts` asserting:
- Every `XXX_DARK` export has identical key shape to its light counterpart
- Spot-check: PARTY_COLOR_DARK.unknown === '#7a7268', CATEGORY_CARD_BG_SOLID.service-record === '#fcfaf2', etc.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/ui-tokens test
pnpm -r typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/party.ts packages/ui-tokens/src/alignment.ts \
        packages/ui-tokens/src/scorecard.ts packages/ui-tokens/src/category.ts \
        packages/ui-tokens/src/finance.ts packages/ui-tokens/src/finance-shades.ts \
        packages/ui-tokens/src/map-colors.ts packages/ui-tokens/src/index.ts \
        packages/ui-tokens/test/domain-palette-dark.test.ts
git commit -m "$(cat <<'EOF'
feat(ui-tokens): dark variants for all 7 domain palettes

PARTY_COLOR_DARK, ALIGNMENT_CHIP_COLORS_DARK, SCORECARD_LEAN_COLOR_DARK,
CATEGORY_{ACCENT,CARD_GRADIENT,CARD_BG_SOLID}_DARK + light bg-solid,
INDUSTRY_COLOR_DARK + FINANCE_CARD_BG + _DARK, FINANCE_SUB_SECTION_SHADES_DARK,
MAP_COLORS_DARK. PARTY_COLOR + PARTY_COLOR_DARK gain '.unknown' key.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Per-domain hooks in officials-ui

**Files:**
- Modify: `packages/officials-ui/src/brand-hooks.ts` (extend with 10 new hooks)
- Modify: `packages/officials-ui/test/brand-hooks.test.tsx` (extend with hook tests)

Each hook reads `useBrandTokens()` for mode and indexes the right table.

- [ ] **Step 1: Read existing `brand-hooks.ts`** (from slice 33).

- [ ] **Step 2: Add the 10 hooks at the bottom**

```ts
import {
  PARTY_COLOR, PARTY_COLOR_DARK, type PartyCode,
  ALIGNMENT_CHIP_COLORS, ALIGNMENT_CHIP_COLORS_DARK, type AlignmentTier,
  SCORECARD_LEAN_COLOR, SCORECARD_LEAN_COLOR_DARK, type ScorecardLean,
  CATEGORY_CARD_GRADIENT, CATEGORY_CARD_GRADIENT_DARK,
  CATEGORY_ACCENT, CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG_SOLID, CATEGORY_CARD_BG_SOLID_DARK,
  INDUSTRY_COLOR, INDUSTRY_COLOR_DARK, INDUSTRY_DEFAULT_COLOR, INDUSTRY_DEFAULT_COLOR_DARK,
  FINANCE_CARD_BG, FINANCE_CARD_BG_DARK,
  FINANCE_SUB_SECTION_SHADES, FINANCE_SUB_SECTION_SHADES_DARK,
  MAP_COLORS, MAP_COLORS_DARK,
  type CategoryId,
} from '@chiaro/ui-tokens'

export function usePartyColor(party: PartyCode | string | undefined): string {
  const { mode } = useBrandTokens()
  const table = mode === 'dark' ? PARTY_COLOR_DARK : PARTY_COLOR
  if (party && party in table) return (table as Record<string, string>)[party]
  return table.unknown
}

// ... 9 more hooks following same pattern
```

For `useAlignmentChipColors` — returns the chip color OBJECT (not a single string), since ALIGNMENT_CHIP_COLORS is `{ bg, text, border }` per tier.

For `useMapColors` — returns `{ districtStroke, districtFill }`.

For consumers that pass a value that may not exist in the dark table (e.g. unknown party), the hook falls back to `.unknown`.

- [ ] **Step 3: Add hook tests**

In `brand-hooks.test.tsx`, add one describe block per hook:

```ts
describe('usePartyColor', () => {
  it('returns light value when mode is light', () => {
    const { result } = renderHook(() => usePartyColor('D'), { wrapper: wrapper('light') })
    expect(result.current).toBe(PARTY_COLOR.D)
  })
  it('returns dark value when mode is dark', () => {
    const { result } = renderHook(() => usePartyColor('D'), { wrapper: wrapper('dark') })
    expect(result.current).toBe(PARTY_COLOR_DARK.D)
  })
  it('falls back to unknown for unrecognized party', () => {
    const { result } = renderHook(() => usePartyColor('XYZ' as any), { wrapper: wrapper('light') })
    expect(result.current).toBe(PARTY_COLOR.unknown)
  })
})
```

Aim for 2-3 tests per hook (light + dark + fallback). ~25-30 new tests total.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test brand-hooks
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/brand-hooks.ts \
        packages/officials-ui/test/brand-hooks.test.tsx
git commit -m "$(cat <<'EOF'
feat(officials-ui): 10 per-domain hooks for dark-aware palette reads

usePartyColor, useAlignmentChipColors, useScorecardLeanColor,
useCategoryCardGradient/Accent/CardBgSolid, useIndustryColor,
useFinanceCardBg, useFinanceSubSectionShade, useMapColors. Each
reads useBrandTokens() mode + indexes the appropriate table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: COLORS.signal.* → semantic.alert.* migration (8 files)

**Files:**

- Modify: `packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx`
- Modify: `packages/officials-ui/src/federal/FederalMissedVotesList.tsx`
- Modify: `packages/officials-ui/src/federal/FederalStockTransactionsList.tsx`
- Modify: `packages/officials-ui/src/federal/FederalSponsoredBillsList.tsx`
- Modify: `packages/officials-ui/src/federal/FederalCosponsoredBillsList.tsx`
- Modify: `packages/officials-ui/src/state/StateEthicsComplaintsList.tsx`
- Modify: `packages/officials-ui/src/state/StateOfficialEventsList.tsx`
- Modify: `packages/officials-ui/src/state/StateIssueVotesEvidence.tsx`
- Update: corresponding test files (if exist)

Migration:
- `COLORS.signal.warning` → `semantic.alert.warning.fg`
- `COLORS.signal.success` → `semantic.alert.success.fg`
- `COLORS.signal.error` → `semantic.alert.danger.fg`

After: `grep "COLORS\\." packages/officials-ui/src/` returns ZERO matches.

- [ ] **Step 1: Read each source file + identify all signal.* refs** (~13 refs total per the slice 36 closeout report).

- [ ] **Step 2: Migrate each file**

For each file:
- If the `COLORS` import is still alongside `useBrandTokens` (kept for signal exceptions), the `COLORS` import can now be REMOVED entirely.
- Each `COLORS.signal.warning` → `semantic.alert.warning.fg`. Similarly for success / error.
- For chip-style `${color}22` patterns, the inline string-concat continues to work — `${semantic.alert.warning.fg}22`.
- Module-level helpers (`statusColor`, `typeColor`, `complianceColor`) already accept `semantic` as a parameter from slices 35+36 — just update the return-value references from `COLORS.signal.x` to `semantic.alert.x.fg`.

- [ ] **Step 3: Update existing tests**

Any test that asserts on the OLD signal hex literals (`#d68a1f`, `#1f9b88`, `#c5364a`) needs to update to the new ones, OR shift to structural assertions. Most tests are structural already.

- [ ] **Step 4: Verify COLORS sweep**

```bash
grep -nE "COLORS\\." packages/officials-ui/src/
```

Expected: empty.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/federal/FederalEthicsAccountabilityCard.tsx \
        packages/officials-ui/src/federal/FederalMissedVotesList.tsx \
        packages/officials-ui/src/federal/FederalStockTransactionsList.tsx \
        packages/officials-ui/src/federal/FederalSponsoredBillsList.tsx \
        packages/officials-ui/src/federal/FederalCosponsoredBillsList.tsx \
        packages/officials-ui/src/state/StateEthicsComplaintsList.tsx \
        packages/officials-ui/src/state/StateOfficialEventsList.tsx \
        packages/officials-ui/src/state/StateIssueVotesEvidence.tsx
git add packages/officials-ui/test/**/*.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): migrate all COLORS.signal.* refs to BRAND.semantic.alert

Closes the last signal exceptions across federal + state. COLORS import
removed from all 8 files. Zero COLORS.* references remain in officials-ui.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Audit cleanup — bio cluster + PartyBadge

**Files:**
- Modify: `packages/officials-ui/src/bio/BioPortrait.tsx`
- Modify: `packages/officials-ui/src/bio/BioContactLinks.tsx`
- Modify: `packages/officials-ui/src/bio/BioIdentityRow.tsx`
- Modify: `packages/officials-ui/src/PartyBadge.tsx`
- Update: corresponding tests

Closes slice 34 audit deferrals + migrates PartyBadge to `usePartyColor`.

- [ ] **Step 1: Read all 4 source files + tests.**

- [ ] **Step 2: Migrate each file**

`BioPortrait.tsx`:
- Add `import { useBrandTokens } from '../brand-hooks.ts'`
- Add `const { semantic } = useBrandTokens()` at component body top
- Replace the 3 inline blue hex values (`#3b6ed1` × 2 + `#5b8de1`) — these are part of gradient strings. The gradient construction stays inline (it's a CSS gradient string), but the constants come from `semantic.link.fg` for the deep stop and a derived lighter stop for the gradient end.
  - For the native solid `PORTRAIT_SOLID_NATIVE`: read `semantic.link.fg` from the hook
  - For web gradient: rebuild the gradient string per render with `semantic.link.fg` substituted in. Use `useMemo` keyed on `mode` to avoid per-render allocation.
  - For the `#5b8de1` lighter stop: since this is a derivation of `#3b6ed1`, keep it as inline hex with a comment "slice 38+ may centralize gradient derivation tokens" — OR introduce a `semantic.link.fgLight` helper in slice 37 (cleaner; do this).
- Replace the `#fff` initials text → `semantic.text.onAccent` (or `bg.elevated` — pick the one that matches "white text on accent" semantic)
- Remove all `// TODO slice 37` markers from this file
- For dark mode: gradient + initials both flip automatically via the hook

Actually — given the spec says "no philosophy decisions" + "BioPortrait stays blue," the simplest approach:
- Keep the gradient CONSTRUCTION inline
- Replace `#3b6ed1` with `semantic.link.fg` (a function call result inside the gradient template)
- Replace `#5b8de1` with a manually-derived lighter token OR keep it as a small inline hex with a code comment explaining the derivation. The implementer can pick.

`BioContactLinks.tsx`:
- Add `useBrandTokens` import + hook call
- Replace `linkStyle.color: '#3b6ed1'` → `semantic.link.fg`. Since this was a module-level const, lift `linkStyle` inside the component body OR construct it via `useMemo` inline at the JSX site.
- Remove the TODO marker

`BioIdentityRow.tsx`:
- Add `usePartyColor` import from `../brand-hooks.ts`
- Replace `const partyColor = PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? '#807a72'` → `const partyColor = usePartyColor(party)`
- The hook handles the unknown fallback (slice 37's PARTY_COLOR.unknown)
- Remove the inline `#807a72` and its TODO marker

`PartyBadge.tsx`:
- Add `usePartyColor` import + use it instead of direct `PARTY_COLOR[party]`
- This is a small component (~30 lines); the refactor is mechanical

- [ ] **Step 3: Update existing tests**

For files with existing tests, ensure tests still pass; if any assert on the inline-hex fallback `#807a72` or the link blue `#3b6ed1`, update to use the canonical token values via assertions on `useBrandTokens` output or structural checks.

For `PartyBadge.test.tsx` (if exists): may need to wrap with `BrandModeOverrideContext.Provider` for the hook to work in tests. Adapt per slice 35-36 precedent.

- [ ] **Step 4: Verify TODO markers gone**

```bash
grep -nE "TODO slice 37" packages/officials-ui/src/bio/ packages/officials-ui/src/PartyBadge.tsx
```

Expected: empty.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test BioPortrait BioContactLinks BioIdentityRow PartyBadge
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/bio/BioPortrait.tsx \
        packages/officials-ui/src/bio/BioContactLinks.tsx \
        packages/officials-ui/src/bio/BioIdentityRow.tsx \
        packages/officials-ui/src/PartyBadge.tsx
git add packages/officials-ui/test/bio/*.test.tsx packages/officials-ui/test/PartyBadge.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): bio cluster + PartyBadge close slice 34 audit

BioPortrait + BioContactLinks use semantic.link.fg (gradient stop +
anchor color). BioIdentityRow + PartyBadge use usePartyColor() hook
(handles unknown fallback). All // TODO slice 37 markers removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Audit cleanup — cards cluster (AlignmentChip + MetricCardShell)

**Files:**
- Modify: `packages/officials-ui/src/cards/AlignmentChip.tsx`
- Modify: `packages/officials-ui/src/cards/MetricCardShell.tsx`
- Update: corresponding tests

MetricCardShell is the heaviest file in slice 37. It currently has the CATEGORY_CARD_BG_SOLID const (moving to ui-tokens in T2), 13 TODO markers, and consumes CATEGORY_ACCENT + CATEGORY_CARD_GRADIENT.

- [ ] **Step 1: Read both source files + tests.**

- [ ] **Step 2: Migrate `AlignmentChip.tsx`**

- Add `useAlignmentChipColors` import from `../brand-hooks.ts`
- Replace direct `ALIGNMENT_CHIP_COLORS[tier]` with `useAlignmentChipColors(tier)` — same shape returned, mode-aware
- Remove the `ALIGNMENT_CHIP_COLORS` import from `@chiaro/ui-tokens`

- [ ] **Step 3: Migrate `MetricCardShell.tsx`**

This is a substantial refactor:
- Add hook imports: `useBrandTokens`, `useCategoryCardGradient`, `useCategoryAccent`, `useCategoryCardBgSolid`
- Add `const { semantic } = useBrandTokens()` at component body top
- DELETE the local `CATEGORY_CARD_BG_SOLID` const (moved to ui-tokens in T2)
- Replace inline category bg literals with `useCategoryCardBgSolid(categoryId)` — that's the placeholder branches at lines ~52 + ~64
- Replace placeholder bg literals `#fafaf6` (UNAVAILABLE_BG const) + `#f6f4ed` → `semantic.bg.subtle`. Delete the `UNAVAILABLE_BG` const.
- Replace 2 chip blue refs `#3b6ed1` → `semantic.link.fg`
- Remove top-of-file JSDoc note about slice 34 deferrals (closed in this slice)
- Remove all `// TODO slice 37` markers

After: zero inline hex in MetricCardShell.tsx (verify via grep).

- [ ] **Step 4: Verify TODO + inline hex sweep**

```bash
grep -nE "TODO slice 37|#[0-9a-fA-F]{3,8}" packages/officials-ui/src/cards/MetricCardShell.tsx packages/officials-ui/src/cards/AlignmentChip.tsx
```

Expected: empty.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test AlignmentChip MetricCardShell
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/cards/AlignmentChip.tsx \
        packages/officials-ui/src/cards/MetricCardShell.tsx
git add packages/officials-ui/test/cards/AlignmentChip.test.tsx packages/officials-ui/test/cards/MetricCardShell.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): AlignmentChip + MetricCardShell close slice 34 audit

AlignmentChip uses useAlignmentChipColors() hook. MetricCardShell
uses useCategoryCardBgSolid/Accent/Gradient hooks + semantic.bg.subtle
for placeholder bg + semantic.link.fg for chip text. CATEGORY_CARD_BG_SOLID
const deleted (lives in ui-tokens now). All TODO slice 37 markers removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Audit cleanup — finance cluster

**Files:**
- Modify: `packages/officials-ui/src/finance/TopAmountBreakdown.tsx`
- Modify: `packages/officials-ui/src/finance/FinanceSummaryStrip.tsx`
- Update: corresponding tests

Closes the last slice 34 audit deferrals.

- [ ] **Step 1: Read both source files + tests.**

- [ ] **Step 2: Migrate `TopAmountBreakdown.tsx`**

- Add `useFinanceCardBg` import
- Replace `SOLID_NATIVE = '#f4faf6'` const → call `useFinanceCardBg()` inside the component body
- Replace 2 link blue refs `#3b6ed1` → `semantic.link.fg`
- Replace progress fill green `#3da75b` → `semantic.signal.success`
- Remove all `// TODO slice 37` markers

- [ ] **Step 3: Migrate `FinanceSummaryStrip.tsx`**

- Add `useFinanceCardBg` import
- Replace `DOT = '#3da75b'` const → `semantic.signal.success` inline
- Replace `SOLID_NATIVE = '#f4faf6'` const → `useFinanceCardBg()` inside the component
- Remove all `// TODO slice 37` markers

If `Cell` (helper component inside FinanceSummaryStrip per slice 36 T3) needs the hook, give it its own hook call (it's a real React FC).

- [ ] **Step 4: Verify TODO + hex sweep**

```bash
grep -nE "TODO slice 37|#[0-9a-fA-F]{3,8}" packages/officials-ui/src/finance/TopAmountBreakdown.tsx packages/officials-ui/src/finance/FinanceSummaryStrip.tsx
```

Expected: empty.

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test TopAmountBreakdown FinanceSummaryStrip
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/finance/TopAmountBreakdown.tsx \
        packages/officials-ui/src/finance/FinanceSummaryStrip.tsx
git add packages/officials-ui/test/finance/*.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): finance cluster closes slice 34 audit

TopAmountBreakdown + FinanceSummaryStrip use useFinanceCardBg() +
semantic.link.fg + semantic.signal.success. SOLID_NATIVE + DOT
consts replaced by hook-driven values. All TODO slice 37 markers
removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: ScorecardRatings + IssuePositions consumers

**Files:**
- Modify: `packages/officials-ui/src/federal/FederalScorecardRatingsList.tsx`
- Modify: `packages/officials-ui/src/state/StateIssuePositionsCard.tsx`
- Update: corresponding tests

Both consume `SCORECARD_LEAN_COLOR` directly. Migrate to `useScorecardLeanColor()` hook.

- [ ] **Step 1: Read both source files + tests.**

- [ ] **Step 2: Migrate each**

For each:
- Add `useScorecardLeanColor` import from `../brand-hooks.ts`
- Replace direct `SCORECARD_LEAN_COLOR[lean]` lookup with `useScorecardLeanColor(lean)`
- If used in a module-level helper, thread the hook's value as a parameter from the component body (slice 35 Task 2 `statusColor(..., semantic)` precedent applied to the lean fn)
- Remove the `SCORECARD_LEAN_COLOR` import from `@chiaro/ui-tokens`

- [ ] **Step 3: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test FederalScorecardRatings StateIssuePositions
pnpm --filter @chiaro/officials-ui typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/officials-ui/src/federal/FederalScorecardRatingsList.tsx \
        packages/officials-ui/src/state/StateIssuePositionsCard.tsx
git add packages/officials-ui/test/federal/FederalScorecardRatingsList.test.tsx packages/officials-ui/test/state/StateIssuePositionsCard.test.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(officials-ui): ScorecardRatings + IssuePositions use useScorecardLeanColor

Both consumers now read mode-aware lean colors via the hook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Map components dark mode wiring

**Files:**
- Modify: `apps/web/components/DistrictMap.tsx` (react-leaflet)
- Modify: `apps/mobile/components/DistrictMap.tsx` (react-native-maps)
- Possibly: `apps/web/components/DistrictPanel.tsx` + `apps/mobile/components/DistrictPanel.tsx` if they also use `MAP_COLORS`

The map components live in `apps/` (platform-specific per slice 10 — Leaflet on web, RN Maps on mobile). They currently consume `MAP_COLORS` directly.

- [ ] **Step 1: Find every `MAP_COLORS` reference in apps/**

```bash
grep -rnE "MAP_COLORS" apps/web/ apps/mobile/
```

- [ ] **Step 2: Migrate each file**

For each:
- Add `useMapColors` import from `@chiaro/officials-ui`
- Inside the component, add `const colors = useMapColors()` at top of body
- Replace direct `MAP_COLORS.districtStroke` with `colors.districtStroke` (etc.)
- Remove the `MAP_COLORS` import from `@chiaro/ui-tokens`

- [ ] **Step 3: Verify**

```bash
grep -rnE "MAP_COLORS\." apps/web/ apps/mobile/
```

Expected: empty.

- [ ] **Step 4: Run typechecks**

```bash
pnpm --filter @chiaro/web typecheck
pnpm --filter @chiaro/mobile typecheck
pnpm -r typecheck
```

- [ ] **Step 5: Web build smoke**

```bash
pnpm --filter @chiaro/web build
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/DistrictMap.tsx apps/web/components/DistrictPanel.tsx 2>/dev/null
git add apps/mobile/components/DistrictMap.tsx apps/mobile/components/DistrictPanel.tsx 2>/dev/null

git commit -m "$(cat <<'EOF'
refactor(apps): map components use useMapColors() hook

DistrictMap + DistrictPanel (web + mobile) now read mode-aware
MAP_COLORS via the @chiaro/officials-ui hook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Audit doc closeout + CLAUDE.md slice 37 + final verify

**Files:**
- Modify: `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full workspace verify**

```bash
pnpm -r typecheck
pnpm test
pnpm --filter @chiaro/web build
```

Expected: 11 packages green; full test suite green (except known Supabase-env failures); web build clean.

- [ ] **Step 2: Final COLORS + TODO + inline-hex sweep**

```bash
grep -rnE "COLORS\\." packages/officials-ui/src/
grep -rnE "TODO slice 37" packages/officials-ui/src/ apps/
grep -rnE "#[0-9a-fA-F]{3,8}" packages/officials-ui/src/
```

Expected:
- `COLORS.*` sweep: ZERO matches across officials-ui src/
- `TODO slice 37` sweep: ZERO matches
- Inline hex sweep: only intentional/legitimate hex remains (LOGO_FILLS constants in Logo.tsx; auth screens may have a few that are spec-locked; document any remaining in the audit doc closeout note)

- [ ] **Step 3: Update the audit doc**

In `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`, add a new section at the top (after the title) marking the audit as **CLOSED**:

```markdown
## Status

**CLOSED 2026-05-27** by slice 37.

Every deferred site below has been migrated to proper BRAND tokens:
- Link blue (7 sites) → `semantic.link.fg`
- Finance signal green (2 sites) → `semantic.signal.success`
- Finance mint background (2 sites) → `useFinanceCardBg()` / `FINANCE_CARD_BG`
- MetricCardShell category palette (6 sites) → moved to `@chiaro/ui-tokens/category.ts` `CATEGORY_CARD_BG_SOLID`
- MetricCardShell placeholder backgrounds (3 sites) → folded into `semantic.bg.subtle`
- PARTY_COLOR fallback (1 site) → `usePartyColor()` hook handles `.unknown`
- BioPortrait white-on-blue (1 site) → `semantic.text.onAccent`

Total: 22 sites closed. Zero `// TODO slice 37` markers remain.
```

Leave the rest of the doc (the per-file inventory) intact — it's historical record.

- [ ] **Step 4: Update CLAUDE.md**

Find the slice 36 bullet (starts with `- **Slice 36 — State cards retrofit**`). Insert immediately after:

```markdown
- **Slice 37 — Domain palettes + dark mode closeout** (2026-05-27): Closes the retrofit track (slices 33-36). Adds `BRAND.semantic.alert.warning` + `alert.success` + `signal.success` + `link.fg` tokens (light + dark palette stops). Ships dark variants for all 7 domain palettes (`PARTY_COLOR_DARK`, `ALIGNMENT_CHIP_COLORS_DARK`, `SCORECARD_LEAN_COLOR_DARK`, `CATEGORY_{ACCENT,CARD_GRADIENT,CARD_BG_SOLID}_DARK` — the latter moved from MetricCardShell to `@chiaro/ui-tokens/category.ts`, `INDUSTRY_COLOR_DARK`, `FINANCE_SUB_SECTION_SHADES_DARK`, `MAP_COLORS_DARK`) plus new `FINANCE_CARD_BG`/`_DARK`. 10 per-domain hooks (`usePartyColor`, `useAlignmentChipColors`, `useScorecardLeanColor`, `useCategoryCardGradient/Accent/CardBgSolid`, `useIndustryColor`, `useFinanceCardBg`, `useFinanceSubSectionShade`, `useMapColors`) in `@chiaro/officials-ui/brand-hooks.ts`. All 13 `COLORS.signal.*` refs migrated to `semantic.alert.*`. All 22 slice-34-audit deferred sites resolved. Map components (`apps/web` + `apps/mobile` DistrictMap/DistrictPanel) wired into dark mode. **Zero `COLORS.*` references remain in officials-ui src/.** No brand-philosophy rebases — slice 38+ owns the visual reskin. ~40 files; no schema work; pgTAP unchanged at 428 plans.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/audits/2026-05-27-inline-hex-sweep.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(brand): close slice 34 audit + record slice 37

Slice 34 audit marked CLOSED (all 22 deferred sites resolved by
slice 37). CLAUDE.md slice 37 entry added.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Final state check**

```bash
git log --oneline master..domain-palettes-dark-mode
git status --short
```

Expected: ~12 commits on branch since master (spec + plan + 9 task commits + audit/CLAUDE.md); clean working tree.

---

## Notes for the implementer

1. **No brand-philosophy decisions.** Link stays blue. Finance green stays green. AlignmentChip tiers stay red/orange/yellow/green. BioPortrait stays blue. Industry rainbow stays rainbow. If a hex value reaches you and you're not sure what dark equivalent to pick, lighten by ~20% in HSL and ship it — slice 38+ will retune.

2. **Domain palette `_DARK` exports use heuristic derivations.** Aim for "same hue, lifted lightness." Don't agonize over individual values; slice 38+ visual reskin will audit and tune.

3. **Module-level helpers thread `semantic`** when needed. Slice 35 Task 2 `statusColor(item, semantic)` precedent applies — pass the semantic table as a parameter rather than calling hooks at module scope.

4. **`bg.placeholder` folds into `semantic.bg.subtle`.** No new token introduced for placeholder backgrounds.

5. **The `${color}22` alpha-overlay idiom continues to work** with the new `semantic.alert.*.fg` values. No new chip-bg tokens introduced this slice — slice 38+ may add them if the idiom becomes painful.

6. **`apps/` map components migrate.** Slice 37 is the first slice in the retrofit track to touch `apps/` files (previously off-limits). The DistrictMap + DistrictPanel migrations are small and contained.

7. **PartyBadge.tsx may be a new file to touch.** Verify it has an existing test; if not, skip test backfill.

8. **`MetricCardShell.tsx` is the heaviest single migration.** It's already in tasks 6 (audit cleanup) — handle the deletion of CATEGORY_CARD_BG_SOLID const + JSDoc removal as part of T6's commit.

9. **`COLORS` import removal across signal-migrated files.** After slice 37 T4, files that previously kept `COLORS` alongside `useBrandTokens` (per slices 35-36 `COLORS.signal.*` exception handling) drop the `COLORS` import entirely.

10. **Slice 37 closes the retrofit track.** After this lands, slice 38+ becomes the "full visual reskin together" track — where the user wants hands-on philosophy work.
