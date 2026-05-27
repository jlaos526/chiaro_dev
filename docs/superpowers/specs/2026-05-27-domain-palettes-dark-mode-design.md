# Slice 37 — Domain Palettes + Dark Mode Closeout

> **Type:** Token additions + dark variant infrastructure + audit cleanup
> **Scope:** Add `alert.warning`/`alert.success`/`signal.success`/`link.fg` BRAND tokens; ship dark variants for all domain palettes; migrate every `COLORS.signal.*` ref + every slice-34 audit deferred site to proper tokens; wire `useColorScheme()` into map components. No brand-philosophy decisions — hex values stay identical, just wrapped in tokens.
> **Tier:** Mega Slice (~40-45 files).

---

## 1. Goal

Closeout slice for the retrofit track (slices 33-36). After this slice:
- Every `COLORS.signal.*` reference becomes `BRAND.semantic.alert.*`
- Every slice-34 audit `// TODO slice 37` marker is resolved
- Every domain palette (`PARTY_COLOR`, `ALIGNMENT_CHIP_COLORS`, `SCORECARD_LEAN_COLOR`, `CATEGORY_CARD_GRADIENT`, `CATEGORY_ACCENT`, `INDUSTRY_COLOR`, `SUB_CASCADE_ACCENT`, `FINANCE_SUB_SECTION_SHADES`, `MAP_COLORS`) has a dark variant, exposed via per-domain hooks
- All consumers read mode-aware values
- Dark mode works end-to-end across the whole app

**Locked principle:** No visual rebase. Light values stay byte-identical; dark variants are derived. Slice 38+ does the philosophy work (AlignmentChip tier rebase, link → accent, BioPortrait orange, etc.).

## 2. In scope / out of scope

**In scope:**
- New BRAND.semantic tokens: `alert.warning.fg/bg/border`, `alert.success.fg/bg/border`, `signal.success`, `link.fg`
- New @chiaro/ui-tokens domain exports (light + dark variants for each existing palette)
- Per-domain hooks in @chiaro/officials-ui: `usePartyColor`, `useAlignmentChipColor`, `useScorecardLeanColor`, `useCategoryCardGradient`, `useCategoryAccent`, `useMapColors`
- Move `CATEGORY_CARD_BG_SOLID` from MetricCardShell to `@chiaro/ui-tokens/category.ts` (light + dark)
- New `FINANCE_CARD_BG` constant in `@chiaro/ui-tokens/finance.ts` (light + dark)
- Migration of every `COLORS.signal.warning/success/error` ref in officials-ui to `BRAND.semantic.alert.*`
- Closure of every slice 34 audit deferred site (BioPortrait, BioContactLinks, MetricCardShell, TopAmountBreakdown, FinanceSummaryStrip, BioIdentityRow PARTY fallback)
- Domain palette consumer migration (9 files: BioIdentityRow, PartyBadge, AlignmentChip, StateIssuePositionsCard, FederalScorecardRatingsList, MetricCardShell, FinanceSummaryStrip, TopAmountBreakdown)
- Map components (`DistrictMap` + `DistrictPanel` in `apps/web` + `apps/mobile`): wire `useColorScheme()` + `MAP_COLORS_DARK`
- Slice 34 audit doc closeout (mark all deferred sites as resolved)
- CLAUDE.md slice 37 entry

**Out of scope:**
- Brand-philosophy rebases (AlignmentChip tier colors, link→accent, BioPortrait orange, industry rainbow rebase, finance green→orange) — slice 38+ reskin
- New domain palettes (only existing ones get dark variants)
- App-wide dark mode toggle UI (still no Provider component ships; tokens auto-follow system `prefers-color-scheme`)
- Visual changes to existing surfaces (everything renders identically in light mode)

## 3. Token additions (in @chiaro/ui-tokens)

### 3.1 BRAND.semantic additions

Extend `packages/ui-tokens/src/brand/semantic.ts`:

```ts
// In semantic builder:
alert: {
  danger: { fg, bg, border },     // existing
  warning: { fg, bg, border },    // NEW
  success: { fg, bg, border },    // NEW
},
signal: {                          // NEW namespace
  success: '...',                  // finance "money in" green
},
link: {                            // NEW namespace
  fg: '...',                       // anchor color
},
```

### 3.2 BRAND_PALETTE additions

Extend `packages/ui-tokens/src/brand/palette.ts`:

**Light alert.warning:**
- `fg: #d68a1f` (preserves `COLORS.signal.warning` hex)
- `bg: #fef7e8` (derived warm-yellow tint)
- `border: #f5c878` (derived)

**Light alert.success:**
- `fg: #1f9b88` (preserves `COLORS.signal.success` hex — teal)
- `bg: #e8f5f2` (derived)
- `border: #7fc5b5` (derived)

**Light signal.success:** `#3da75b` (preserves finance green from slice 34 audit)

**Light link.fg:** `#3b6ed1` (preserves anchor blue from slice 34 audit)

**Dark alert.warning:**
- `fg: #f0b558` (lighter for dark surface)
- `bg: #3a2a14` (deep warm-amber)
- `border: #6e4a20`

**Dark alert.success:**
- `fg: #4dbfb0` (lighter teal)
- `bg: #1a302c`
- `border: #3a6e62`

**Dark signal.success:** `#5dc97f` (lighter green for dark)

**Dark link.fg:** `#7a98e1` (lighter blue for dark contrast)

### 3.3 Domain palette dark variants

Each existing `@chiaro/ui-tokens/src/*.ts` file gets a new `_DARK` export alongside the existing light export:

| File | Existing export | New dark export |
|---|---|---|
| `party.ts` | `PARTY_COLOR` (also exports `PARTY_LABEL`, `PARTY_SHORT`) | `PARTY_COLOR_DARK` |
| `alignment.ts` | `ALIGNMENT_CHIP_COLORS` | `ALIGNMENT_CHIP_COLORS_DARK` |
| `scorecard.ts` | `SCORECARD_LEAN_COLOR` | `SCORECARD_LEAN_COLOR_DARK` |
| `category.ts` | `CATEGORY_ACCENT`, `SUB_CASCADE_ACCENT`, `CATEGORY_CARD_GRADIENT` | `CATEGORY_ACCENT_DARK`, `SUB_CASCADE_ACCENT_DARK`, `CATEGORY_CARD_GRADIENT_DARK`. Also adds NEW `CATEGORY_CARD_BG_SOLID` (light) + `CATEGORY_CARD_BG_SOLID_DARK` |
| `finance.ts` | `INDUSTRY_COLOR`, `INDUSTRY_DEFAULT_COLOR` | `INDUSTRY_COLOR_DARK`, `INDUSTRY_DEFAULT_COLOR_DARK`. Also adds NEW `FINANCE_CARD_BG` (light) + `FINANCE_CARD_BG_DARK` |
| `finance-shades.ts` | `FINANCE_SUB_SECTION_SHADES` | `FINANCE_SUB_SECTION_SHADES_DARK` |
| `map-colors.ts` | `MAP_COLORS` | `MAP_COLORS_DARK` |

Also adds `PARTY_COLOR.unknown = '#807a72'` and `PARTY_COLOR_DARK.unknown = '#7a7268'` per the slice 34 audit's "PARTY_COLOR fallback" deferred site.

Dark values are derived heuristically (lighten by ~20% lightness, preserve hue). No philosophy rebases — slice 38+ revisits.

### 3.4 Existing light exports stay byte-identical

The pre-slice-37 `PARTY_COLOR` / `ALIGNMENT_CHIP_COLORS` / etc. exports keep their exact hex values. Consumers reading them directly don't break. Slice 37 migrates the 9 known consumers to hooks; future consumers can use either.

## 4. Per-domain hooks (in @chiaro/officials-ui)

Add to `packages/officials-ui/src/brand-hooks.ts` (extend the file from slice 33):

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

// One hook per domain palette. Each reads useBrandTokens() and picks the right table.

export function usePartyColor(party: PartyCode | undefined): string {
  const { mode } = useBrandTokens()
  const table = mode === 'dark' ? PARTY_COLOR_DARK : PARTY_COLOR
  return party ? table[party] ?? table.unknown : table.unknown
}

export function useAlignmentChipColors(tier: AlignmentTier) { ... }
export function useScorecardLeanColor(lean: ScorecardLean) { ... }
export function useCategoryCardGradient(categoryId: CategoryId) { ... }
export function useCategoryAccent(categoryId: CategoryId) { ... }
export function useCategoryCardBgSolid(categoryId: CategoryId) { ... }
export function useIndustryColor(industry: string | undefined) { ... }
export function useFinanceCardBg() { ... }
export function useFinanceSubSectionShade(category: string) { ... }
export function useMapColors() { ... }
```

All hooks return strings (or shape per palette). Consumers update from raw `PARTY_COLOR['D']` to `usePartyColor('D')`.

## 5. Consumer migrations

### 5.1 Signal.* → alert.* migration (~8 files)

Find every `COLORS.signal.warning/success/error` reference across officials-ui:

| File | Signal refs |
|---|---|
| `federal/FederalEthicsAccountabilityCard.tsx` | warning, success |
| `federal/FederalMissedVotesList.tsx` | warning |
| `federal/FederalStockTransactionsList.tsx` | warning |
| `federal/FederalSponsoredBillsList.tsx` | success |
| `federal/FederalCosponsoredBillsList.tsx` | success |
| `state/StateEthicsComplaintsList.tsx` | warning, error, success |
| `state/StateOfficialEventsList.tsx` | warning, error, success |
| `state/StateIssueVotesEvidence.tsx` | success |

Migration:
- `COLORS.signal.warning` → `semantic.alert.warning.fg`
- `COLORS.signal.success` → `semantic.alert.success.fg`
- `COLORS.signal.error` → `semantic.alert.danger.fg` (already canonical — closes the state-side drift)

Module-level helpers (`statusColor`, `typeColor`, `complianceColor`) continue to accept `semantic` as a threaded parameter (slice 35+36 precedent).

### 5.2 Slice 34 audit closeout (~6 files)

| File | Deferred site | Migration target |
|---|---|---|
| `bio/BioPortrait.tsx` | gradient blue stops + white initials | `semantic.link.fg` for gradient solid stop + `text.onAccent` for initials text. Gradient string itself stays — slice 38+ revisits if rebasing. |
| `bio/BioContactLinks.tsx` | line 23 linkStyle blue | `semantic.link.fg` |
| `bio/BioIdentityRow.tsx` | PARTY_COLOR.unknown fallback `#807a72` | Use `usePartyColor(party)` hook; remove the inline fallback (hook handles it) |
| `cards/MetricCardShell.tsx` | category palette, placeholder bg, chip blue | Consume `useCategoryCardBgSolid` hook; `bg.placeholder` folds into `semantic.bg.subtle`; chip blue → `semantic.link.fg` |
| `finance/TopAmountBreakdown.tsx` | mint bg, signal green, link blue | `useFinanceCardBg`, `semantic.signal.success`, `semantic.link.fg` |
| `finance/FinanceSummaryStrip.tsx` | DOT green, mint bg | `semantic.signal.success`, `useFinanceCardBg` |

After all migrations: zero `// TODO slice 37` markers remain. Audit doc gets a "closed" status update.

### 5.3 Domain palette consumer migrations (~9 files)

For each consumer of a domain palette, update to use the new hook:

| File | From | To |
|---|---|---|
| `bio/BioIdentityRow.tsx` | `PARTY_COLOR[party]` | `usePartyColor(party)` |
| `PartyBadge.tsx` | `PARTY_COLOR[party]` | `usePartyColor(party)` |
| `cards/AlignmentChip.tsx` | `ALIGNMENT_CHIP_COLORS[tier]` | `useAlignmentChipColors(tier)` |
| `state/StateIssuePositionsCard.tsx` | `SCORECARD_LEAN_COLOR[lean]` | `useScorecardLeanColor(lean)` |
| `federal/FederalScorecardRatingsList.tsx` | `SCORECARD_LEAN_COLOR[lean]` | `useScorecardLeanColor(lean)` |
| `cards/MetricCardShell.tsx` | `CATEGORY_CARD_GRADIENT[id]` + `CATEGORY_ACCENT[id]` | `useCategoryCardGradient(id)` + `useCategoryAccent(id)` |
| `finance/FinanceSummaryStrip.tsx` | `CATEGORY_CARD_GRADIENT` | `useCategoryCardGradient` |
| `finance/TopAmountBreakdown.tsx` | `CATEGORY_CARD_GRADIENT` | `useCategoryCardGradient` |
| `apps/web/components/DistrictMap.tsx` + `apps/mobile/components/DistrictMap.tsx` | `MAP_COLORS.x` | `useMapColors().x` |

After: every consumer reads mode-aware values; dark mode renders correctly end-to-end.

## 6. Files

```
packages/ui-tokens/src/
├── brand/
│   ├── palette.ts                  MODIFY (add alert.warning/success palette stops + signal.success + link)
│   ├── semantic.ts                 MODIFY (add alert.warning/success + signal + link semantic mapping)
│   └── index.ts                    MODIFY (export new helpers if needed)
├── party.ts                        MODIFY (add PARTY_COLOR_DARK + PARTY_COLOR.unknown)
├── alignment.ts                    MODIFY (add ALIGNMENT_CHIP_COLORS_DARK)
├── scorecard.ts                    MODIFY (add SCORECARD_LEAN_COLOR_DARK)
├── category.ts                     MODIFY (add CATEGORY_ACCENT_DARK + SUB_CASCADE_ACCENT_DARK + CATEGORY_CARD_GRADIENT_DARK + CATEGORY_CARD_BG_SOLID/ _DARK)
├── finance.ts                      MODIFY (add INDUSTRY_COLOR_DARK + INDUSTRY_DEFAULT_COLOR_DARK + FINANCE_CARD_BG/ _DARK)
├── finance-shades.ts               MODIFY (add FINANCE_SUB_SECTION_SHADES_DARK)
├── map-colors.ts                   MODIFY (add MAP_COLORS_DARK)
└── index.ts                        MODIFY (re-export new symbols)

packages/officials-ui/src/
├── brand-hooks.ts                  MODIFY (add ~10 per-domain hooks)
├── PartyBadge.tsx                  MODIFY (use usePartyColor)
├── bio/
│   ├── BioIdentityRow.tsx          MODIFY (use usePartyColor; remove inline TODO)
│   ├── BioContactLinks.tsx         MODIFY (use semantic.link.fg; remove TODO)
│   └── BioPortrait.tsx             MODIFY (use semantic.link.fg + text.onAccent; remove TODOs)
├── cards/
│   ├── AlignmentChip.tsx           MODIFY (use useAlignmentChipColors)
│   └── MetricCardShell.tsx         MODIFY (use 3 category hooks; bg.placeholder → bg.subtle; link.fg; remove TODOs)
├── federal/
│   ├── FederalEthicsAccountabilityCard.tsx MODIFY (signal migration)
│   ├── FederalMissedVotesList.tsx  MODIFY (signal)
│   ├── FederalStockTransactionsList.tsx MODIFY (signal)
│   ├── FederalSponsoredBillsList.tsx MODIFY (signal)
│   ├── FederalCosponsoredBillsList.tsx MODIFY (signal)
│   └── FederalScorecardRatingsList.tsx MODIFY (useScorecardLeanColor)
├── state/
│   ├── StateEthicsComplaintsList.tsx MODIFY (signal)
│   ├── StateOfficialEventsList.tsx MODIFY (signal)
│   ├── StateIssueVotesEvidence.tsx MODIFY (signal)
│   └── StateIssuePositionsCard.tsx MODIFY (useScorecardLeanColor)
└── finance/
    ├── TopAmountBreakdown.tsx      MODIFY (link.fg + signal.success + useFinanceCardBg; remove TODOs)
    └── FinanceSummaryStrip.tsx     MODIFY (signal.success + useFinanceCardBg; remove TODOs)

apps/web/components/
└── DistrictMap.tsx                 MODIFY (useMapColors + useColorScheme; or pass mode through)

apps/mobile/components/
└── DistrictMap.tsx                 MODIFY (same)

packages/ui-tokens/test/             MODIFY (extend brand-palette + brand-semantic tests for new alert/signal/link tokens; add domain palette dark variant parity tests)
packages/officials-ui/test/brand-hooks.test.tsx MODIFY (add tests for new domain hooks)

docs/superpowers/audits/2026-05-27-inline-hex-sweep.md MODIFY (mark all deferred sites as closed)
CLAUDE.md                            MODIFY (slice 37 entry)
```

Approximate total: **~40-45 files**.

## 7. Testing

- `packages/ui-tokens/test/brand-palette.test.ts` extended for new alert.warning/success/signal/link palette stops + parity
- `packages/ui-tokens/test/brand-semantic.test.ts` extended for new semantic refs
- New `packages/ui-tokens/test/domain-palette-parity.test.ts` — asserts every domain palette has identical key shapes between light + dark
- `packages/officials-ui/test/brand-hooks.test.tsx` extended for 10 new per-domain hooks (mode override + correct table selection)
- Existing officials-ui tests adapted to assertions on new semantic paths (alert.warning fg, etc.) where they currently match hex literals
- `pnpm -r typecheck` 11 packages green
- `pnpm --filter @chiaro/web build` clean

## 8. Acceptance criteria

- `grep -nE "COLORS\\." packages/officials-ui/src/` returns ZERO matches across all files (down from ~13 remaining signal exceptions)
- Zero `// TODO slice 37` markers across the codebase
- Every domain palette has `_DARK` export + accessor hook
- All 9 known consumers migrated to hooks
- Map components render correctly in both light and dark (manual smoke via `prefers-color-scheme` dev tools)
- `pnpm -r typecheck` green
- `pnpm test` workspace green (except known Supabase-env failures)
- `pnpm --filter @chiaro/web build` clean
- CLAUDE.md slice 37 entry added
- Slice 34 audit doc marked "closed"

## 9. Risks & open questions

**Risk:** Adding `_DARK` variants for 8 domain palettes means choosing ~50-100 individual hex values. These are best-effort derivations (lighten + preserve hue); without a designer's eye some may look off. Mitigation: visual smoke test on `prefers-color-scheme: dark` post-merge; iterate on values in a follow-up if needed.

**Risk:** Map components (`apps/web/components/DistrictMap.tsx` + apps/mobile equivalent) are platform-specific (react-leaflet vs react-native-maps). They live in `apps/` not in shared `officials-ui`. Migration adds a `useColorScheme()` import and reads `useMapColors()`. The Leaflet side may have its own theming hooks; verify during impl.

**Risk:** Adding new BRAND.semantic tokens (`alert.warning`, `alert.success`, `signal.success`, `link`) changes the BRAND surface — any consumer that destructures `semantic` and asserts exact key shape (like the slice 32 `brand-semantic.test.ts` parity tests) needs updating. Plan for test cascade.

**Risk:** `MetricCardShell.tsx` is the heaviest single migration — currently uses CATEGORY_CARD_BG_SOLID locally (now moving to ui-tokens), CATEGORY_ACCENT (now via hook), CATEGORY_CARD_GRADIENT (now via hook), 3 placeholder bg hex (now folded into bg.subtle), 2 link blue (now semantic.link.fg). The whole component renders differently after the migration but should be visually identical.

**Locked at design:**
- No brand-philosophy rebases (link stays blue, finance green stays green, AlignmentChip tiers stay red/orange/yellow/green, BioPortrait stays blue)
- Per-domain hook naming pattern: `usePartyColor`, `useAlignmentChipColors`, etc.
- `bg.placeholder` folds into `bg.subtle` (no new placeholder token)
- `PARTY_COLOR.unknown` becomes a real key (light: #807a72, dark: #7a7268)
- Slice 34 audit closes in this slice

## 10. After slice 37 — roadmap

- **Slices 38+ (visual reskin together):** AlignmentChip tier rebase decision, link → accent rebase decision, BioPortrait orange rebase, industry rainbow rebase, finance green rebase, MetricCardShell gradient retuning, marketing surfaces, dark mode toggle UI, settings page. The mechanical infrastructure from slices 33-37 makes these centralized changes — slice 38+ updates tokens; consumers auto-flip.

---

*See `docs/brand-book.md`, `docs/brand-migration.md`, and `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`.*
