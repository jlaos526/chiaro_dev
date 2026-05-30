# Brand Migration Reference

> Canonical `COLORS.* → BRAND.semantic.*` migration map.
> Source of truth for slices 33-37.

Consumers read tokens via the `useBrandTokens()` hook in `@chiaro/officials-ui`:

```ts
import { useBrandTokens } from '@chiaro/officials-ui'

function MyComponent() {
  const { mode, semantic } = useBrandTokens()
  return <View style={{ backgroundColor: semantic.bg.card, color: semantic.text.primary }} />
}
```

The tables below are the per-key migration. Slices 34-37 grep against this doc.

## Brand colors

| Legacy | New (mode-aware) | Notes |
|---|---|---|
| `COLORS.brand.primary` | `semantic.accent.primary` | Light: `#c46a2a`; Dark: `#e8a060`. Use for primary CTAs, focus rings, logo. |
| `COLORS.brand.accent` | `semantic.accent.secondary` | Was teal (`#1f9b88`); now light orange. |
| `COLORS.brand.text` | `semantic.text.primary` | Hex unchanged in light (`#1a1714`); dark inverts to cream. |

## Neutral / surface

| Legacy | New (mode-aware) | Notes |
|---|---|---|
| `COLORS.neutral.background` | `semantic.bg.elevated` | Unchanged in light (`#ffffff`); dark = `#3a2e26`. |
| `COLORS.neutral.surface` | `semantic.bg.app` | Slight warmth shift: `#f7f6f4` → `#efece5` (cream). |
| `COLORS.neutral.surfaceAlt` | `semantic.bg.subtle` | Was `#f3f4f6` cool; now `#f7efe2` warm. |
| `COLORS.neutral.border` | `semantic.border.default` | Was `#e6e3df` cool; now `#e8d8c2` warm. |
| `COLORS.neutral.mute` | `semantic.text.muted` | Was `#807a72`; now `#6b5e52`. |
| `COLORS.neutral.textMuted` | `semantic.text.muted` | Same target as `.mute`. |
| `COLORS.neutral.outline` | `semantic.border.strong` | Was `#888` mid-gray; now `#d6c3a8` warm. |

## Signal

| Legacy | New (mode-aware) | Notes |
|---|---|---|
| `COLORS.signal.error` | `semantic.alert.danger.fg` | Was `#c5364a`; now `#a83a3a` (light) / `#d05050` (dark). |
| `COLORS.signal.warning` | _no direct equivalent yet_ | Slice 37 may introduce `alert.warning`. For slices 33-36, keep `COLORS.signal.warning` references unchanged. |
| `COLORS.signal.success` | _no direct equivalent yet_ | Same as warning — defer. |

## Maps

| Legacy | Status | Notes |
|---|---|---|
| `MAP_COLORS.districtStroke` | _unchanged_ | Map components retrofit in slice 37. |
| `MAP_COLORS.districtFill` | _unchanged_ | Same. |

## Domain palettes

Domain-specific palette exports (`PARTY_COLOR`, `CATEGORY_ACCENT`, `ALIGNMENT_CHIP_COLORS`, `INDUSTRY_COLOR`, `SCORECARD_LEAN_COLOR`, `SUB_CASCADE_ACCENT`, `CATEGORY_CARD_GRADIENT`, `FINANCE_SUB_SECTION_SHADES`) remain as their own exports through slice 36. Dark variants land in slice 37; a philosophy decision on AlignmentChip colors (stay red/orange/yellow/green tier, or rebase to brand?) also lands in slice 37.

### `semantic.portrait` (slice 40)

Mode-aware portrait gradient + initials text for `BioPortrait`. Decouples portrait rendering from `semantic.link.fg` (the slice 33-37 derivation).

- `semantic.portrait.gradient.from` — gradient start hex
- `semantic.portrait.gradient.to` — gradient end hex
- `semantic.portrait.initials` — text color for initials fallback

Light mode: brand orange `#c46a2a → #e8a060` + white initials.
Dark mode: sage `#6b7a5d → #9caa8e` + warm cream initials `#fff0dc`.

Only consumer is `packages/officials-ui/src/bio/BioPortrait.tsx`. Native (no CSS gradient primitive) falls back to `gradient.from` as the solid color, same as the slice 33 pattern.

## Per-slice scope

- **Slice 33:** auth components only (6 files)
- **Slice 34:** shared foundation (`BioHeader`, `OfficialsCard`, `OfficialsList`, `AlignmentChip`, `ComingSoonCard`, `CardSubsection`, `BioContactLinks`, `BioAlignmentChipRow`, `TopAmountBreakdown`, `MetricCardShell`)
- **Slice 35:** federal cards (5 cards + 11 sub-lists)
- **Slice 36:** state cards (6 cards + ~15 sub-lists)
- **Slice 37:** domain palettes + maps + AlignmentChip philosophy decision

## After this track

Slices 38+ target full visual re-skin: aggressive accent use, gradient retuning, marketing surfaces, dark mode toggle UI. Tangle brand work with IA decisions intentionally. Not in scope for slices 33-37.

### Category palette (slice 41)

Re-derived 4 category accent colors for stronger semantic fit, collapsed light/dark variants to single-hex-per-category, and reordered the enum for a narrative card flow.

**Accent hex changes:**
- `CATEGORY_ACCENT['community-presence']`: `#1f9b88` teal → `#b86340` terracotta (town square clay, gathering)
- `CATEGORY_ACCENT['finance']`: `#3da75b` medium green → `#1a8f5a` emerald (money, deeper saturation)
- `CATEGORY_ACCENT['ethics-accountability']`: `#d68a1f` amber → `#8a3a4d` burgundy (judicial gravitas)

**Light/dark collapse:**
- `CATEGORY_ACCENT_DARK` now mirrors `CATEGORY_ACCENT` per category (single-hex across both modes). Export name preserved for slice 37 `useCategoryAccent` hook back-compat.

**Card bg + gradient refresh:**
- `CATEGORY_CARD_BG_SOLID` light → Level B medium saturation (cards now identify as their category color).
- `CATEGORY_CARD_BG_SOLID_DARK` → cool slate base with hue tints (replaces slice 33-37 warm-brown leftovers).
- `CATEGORY_CARD_GRADIENT_DARK` endpoints → `#16181c` (slice 40 bg.app cool slate; was warm `#1a1714`).

**Sub-cascade refresh:**
- `SUB_CASCADE_ACCENT` + `SUB_CASCADE_ACCENT_DARK` re-derived for the 4 changed categories.

**Map palette cascade:**
- `MAP_COLORS_DARK.districtFill` → `#3a3e45` cool slate (was warm `#3a2e26`).

**Enum reorder:**
- New `CategoryId` + `CATEGORY_LABEL` order: Service Record → Community Presence → Finance → Issue Positions → Ethics & Accountability → Voting & Bills.

Federal officials detail pages (web + mobile) reorder to match. State-officials pages out of scope (different card composition per Gotcha #15).

### AlignmentChip palette reskin (slice 42)

Re-derived all 20 hex values across `ALIGNMENT_CHIP_COLORS` + `ALIGNMENT_CHIP_COLORS_DARK` as a cool-to-warm thermal gradient with V2 deeper-saturation Strongly emphasis. Mixed tier borrows slice 41 Service Record gold family as the on-the-fence pivot.

**Light mode changes:**
- `strongly-aligned`: `{ bg: '#c5e3c7', fg: '#1f4d24' }` → `{ bg: '#a8d4b0', fg: '#0f3a1c' }` (V2 deeper emerald)
- `mostly-aligned`: `{ bg: '#d4ecd5', fg: '#2a6b30' }` → `{ bg: '#d8ecda', fg: '#2a6b30' }` (bg tweak only)
- `mixed`: `{ bg: '#f0eee5', fg: '#5a5751' }` → `{ bg: '#eedbb5', fg: '#7c5a1e' }` (gold pivot — closes slice 37 "blends into cream page bg" problem)
- `mostly-differs`: `{ bg: '#f4d3c0', fg: '#7a3e1c' }` → `{ bg: '#f0d3c0', fg: '#6a3e1c' }` (slight bg tweak + fg clean)
- `strongly-differs`: `{ bg: '#f0b8a0', fg: '#5a2812' }` → `{ bg: '#dca088', fg: '#4a1e0c' }` (V2 deeper terracotta)

**Dark mode changes:**
- `strongly-aligned`: `{ bg: '#1f3a25', fg: '#a8d8ad' }` → `{ bg: '#143020', fg: '#a8e0b0' }`
- `mostly-aligned`: `{ bg: '#26482e', fg: '#b8e0bd' }` → `{ bg: '#24462d', fg: '#a8c9af' }`
- `mixed`: `{ bg: '#3a3830', fg: '#d4d0c5' }` → `{ bg: '#23211a', fg: '#e1c896' }` (matches `CATEGORY_CARD_BG_SOLID_DARK['service-record']` byte-for-byte)
- `mostly-differs`: `{ bg: '#4a2e1c', fg: '#f0c2a5' }` → `{ bg: '#3e2820', fg: '#e0a890' }`
- `strongly-differs`: `{ bg: '#5a2a18', fg: '#f5b095' }` → `{ bg: '#5e2418', fg: '#f5a888' }`

**Consumer cleanup:**
- `packages/officials-ui/src/cards/ComplianceIcon.tsx` refactored from inline hex literals to `useAlignmentChipColors(tier)` consumption (`on-time → strongly-aligned`, `late → mostly-differs`). Closes a CLAUDE.md "inline hex forbidden" deviation.

**Not touched (coincidental hex collision):**
- `packages/officials-ui/src/cards/PillChevron.tsx` uses literal `#f0eee5` (was the slice 37 Mixed bg) as a generic expand-affordance pill. Not semantically alignment-related; hex collision is coincidental. Migrating PillChevron to a brand token is a separate inline-hex cleanup unrelated to slice 42's reskin scope.

### Category card bg stripe cascade (slice 43)

Replaces the slice 41 per-category gradient + bg pattern with a universal neutral card bg + 3px top stripe consuming the existing `useCategoryAccent(id)` (slice 41 unchanged).

**New tokens:**
- `CATEGORY_CARD_BG`: `#fffaf2` (light) — V2b medium-pop elevation above page `#efece5`
- `CATEGORY_CARD_BG_DARK`: `#2a2e34` — above slice 40 `surface.elevated` `#262a30`

**New hook:**
- `useCategoryCardBg()` (no id arg, universal across all 6 categories)

**Deleted tokens:**
- `CATEGORY_CARD_GRADIENT` + `CATEGORY_CARD_GRADIENT_DARK` (12 gradient strings)
- `CATEGORY_CARD_BG_SOLID` + `CATEGORY_CARD_BG_SOLID_DARK` (12 per-category hexes)
- `FINANCE_CARD_BG` + `FINANCE_CARD_BG_DARK` (slice 37 abstraction — orphan after the slice 43 cascade)

**Deleted hooks:**
- `useCategoryCardGradient(id)`
- `useCategoryCardBgSolid(id)`
- `useFinanceCardBg()`

**Component refactors:**
- `MetricCardShell`, `FinanceSummaryStrip`, `TopAmountBreakdown` — all 3 dropped the Pattern B createElement gradient escape hatch (CLAUDE.md Gotcha #19f) and now render a single `<View>` with `borderTopWidth: 3` + `borderTopColor` (category accent) + `backgroundColor` (universal bg).

**Placeholder/unavailable variant in `MetricCardShell`:** renders without the 3px stripe (1px top border + `semantic.bg.subtle`) so the visual distinction with "live" cards holds.

**Signal.success untouched.** The slice 43 prep audit at `docs/superpowers/audits/2026-05-29-finance-green-overlap.md` recommended collapsing `signal.success` to equal `CATEGORY_ACCENT.finance`, but the user picked Option D (status quo) during brainstorm. `BRAND_SEMANTIC.signal.success` stays `#3da75b` light / `#5dc97f` dark. The actual user-flagged problem was card bg blend; this slice ships the cascade fix.

---

### Brand primitives + alert palette retune (slice 45)

5 new primitives in `@chiaro/officials-ui` + retune `BRAND_PALETTE.alert.*` from slice 32 generic colors to slice 41/42 brand-family.

**New primitives:**
- `BrandButton` (variant: primary/secondary, size: sm/default/lg, disabled)
- `BrandHeading` (level: 1/2/3 — real `<h1>`/`<h2>`/`<h3>` on web)
- `BrandBodyText` (size: default/sm, muted)
- `BrandLink` (smart-anchor inlined per YAGNI)
- `BrandAlert` (severity: danger/warning/success/info — P2 pill design)

**Palette retune:**
- `alert.danger`: red `#a83a3a` → burgundy `#8a3a4d` (slice 42 ethics family + slice 41 SUB_CASCADE)
- `alert.warning`: amber `#d68a1f` → gold `#c89a4e` (slice 41 Service Record family)
- `alert.success`: teal `#1f9b88` → emerald `#1a8f5a` (slice 41 Finance family)
- `alert.info`: NEW key, terracotta `#b86340` (slice 41 Community Presence family)

**Consumer cascade:**
- 6 existing `semantic.alert.*.fg` consumers (FederalSponsoredBillsList passed-bill status, etc.) auto-shift colors via the brand-hooks layer.
- `AuthForm.tsx:169` inline `#fef2f0` migrated to `semantic.alert.danger.bg` via useBrandTokens.

**Smart-anchor duplication:** `BrandLink` inlines slice 14 + 18 pattern — 3rd copy. Future consolidation deferred per YAGNI; documented as Risk #2 in spec.

**Slice scope:** ~21 files. Mega Slice tier. Closes slice 44 audit F5. Unblocks slice 46 (F4 inline-hex sweep) + slice 47 (F1 web page rewrites) + slice 48 (F2 mobile screen rewrites + F3 BrandStack nav theming).

### Inline-hex sweep + new icon namespace (slice 46)

Closes audit F4 (8 remaining inline hex literals after slice 45's AuthForm migration). 4 consumer source files migrate to `useBrandTokens()`; 1 stays mode-invariant (Logo native fallback).

**New token:**
- `BRAND_SEMANTIC.icon.location`: `#e74c3c` light / `#f08074` dark — saturated signal red for DistrictBadge map-pin. NEW `icon` namespace; first key. Future location-related icons can extend; non-location icons should NOT colonize.

**Consumer migrations:**
- `PillChevron.tsx`: bg `#f0eee5` → `semantic.bg.subtle`; text `#1a1714` → `semantic.text.primary`
- `Logo.tsx`: native fallback `#e8a060` → `BRAND_PALETTE.light.accent[400]` direct import (mode-invariant — Logo IS brand identity)
- `EvidenceExpand.tsx`: borderTopColor `#d8d4c9` → `semantic.border.default`; 2× text `#1a1714` → `semantic.text.primary`
- `DistrictBadge.tsx`: pin fill `#d13b3b` → `semantic.icon.location` (NEW); text `#3a352b` → `semantic.text.body`

**Mode-aware impact:** 5 of 8 sites had NO dark variant before slice 46. After: PillChevron, EvidenceExpand (3 sites), DistrictBadge (2 sites) all repaint with mode toggle.

**Test-side change:** `packages/officials-ui/test/stubs/react-native-svg.tsx` upgraded from `<View>` to real DOM `<svg>`/`<path>` rendering so DistrictBadge SVG fill can be asserted via `querySelector('svg path').getAttribute('fill')`. Single-file stub change; zero runtime cost on native (stub only loads on web jsdom).

**Remaining hex literals in `packages/officials-ui/src/`:**
- `bio/BioPortrait.tsx` — intentional `linear-gradient(...)` template-string per slice 40
- `primitives/BrandAlert.tsx:17-20` — slice 45 SEVERITY_BANDS map (deferred per slice 45 final-review minor #4: "duplicates BRAND_PALETTE.alert.*.fg; could derive but defensible — band ≠ fg semantically")

---

*See `docs/brand-book.md` (slice 32) for the brand reference.*
