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

---

*See `docs/brand-book.md` (slice 32) for the brand reference.*
