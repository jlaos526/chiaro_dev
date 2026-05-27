# Inline-Hex Sweep Audit — Slice 34

> Catalogs every inline hex site touched in slice 34: migrated to `BRAND.semantic.*` or deferred to slice 37 with a `// TODO slice 37` marker.
>
> **Slice 37 reads this doc as its inheritance manifest.** Every deferred site below must be addressed (token introduction or brand-philosophy decision) before slice 37 closes.

## Summary

- **Files swept:** 8 (5 `bio/` + 1 `cards/MetricCardShell` + 2 `finance/`)
- **Sites migrated:** 30
- **Sites deferred:** 21
- **New tokens introduced this slice:** 0 (BRAND surface unchanged)
- **Pending slice-37 tokens:** finance signal green, finance mint bg, category card bg solids, placeholder card bg, link blue, `PARTY_COLOR.unknown`, portrait gradient brand-decision

## Migrated sites

Sites where an inline hex was replaced with a `semantic.*` token via `useBrandTokens()`.

### bio/BioServiceCard.tsx

| Line (post) | Old | New |
|---|---|---|
| 17 | `'#f0eee5'` | `semantic.bg.subtle` |
| 24 | `'#807a72'` | `semantic.text.muted` |
| 27 | `'#1a1714'` | `semantic.text.primary` |
| 28 | `'#fff'` | `semantic.bg.elevated` |
| 31 | `'#5a5751'` | `semantic.text.muted` |

### bio/BioHeader.tsx

| Line (post) | Old | New |
|---|---|---|
| 39 | `'#1a1714'` | `semantic.text.primary` |

### bio/BioIdentityRow.tsx

| Line (post) | Old | New |
|---|---|---|
| 31 | `'#fff'` | `semantic.bg.elevated` |
| 33 | `'#f0eee5'` | `semantic.bg.subtle` |
| 34 | `'#3a3631'` | `semantic.text.body` |
| 38 | `'#f0eee5'` | `semantic.bg.subtle` |

### bio/BioContactLinks.tsx

| Line (post) | Old | New |
|---|---|---|
| 86 | `'#cfc8be'` | `semantic.border.default` |

### cards/MetricCardShell.tsx

| Line (post) | Old | New |
|---|---|---|
| 57 | `'#807a72'` (unavailable dot) | `semantic.text.muted` |
| 77 | `'#807a72'` / `'#1a1714'` (valueStyle) | `semantic.text.muted` / `semantic.text.primary` |
| 83 | `'#807a72'` / `'#1a1714'` (labelStyle) | `semantic.text.muted` / `semantic.text.primary` |
| 88 | `'#807a72'` (captionStyle) | `semantic.text.muted` |
| 144 | `'#cfc8be'` (border) | `semantic.border.default` |

### finance/TopAmountBreakdown.tsx

| Line (post) | Old | New |
|---|---|---|
| 59 | `'#cfc8be'` (border) | `semantic.border.default` |
| 75 | `'#1a1714'` (row label) | `semantic.text.primary` |
| 81 | `'#1a1714'` (amount) | `semantic.text.primary` |
| 82 | `'#807a72'` (pct) | `semantic.text.muted` |
| 85 | `'#e7e2d9'` (bar track) | `semantic.border.default` |
| 109 | `'#fff'` (toggle bg) | `semantic.bg.elevated` |
| 111 | `'#cfc8be'` (toggle border) | `semantic.border.default` |
| 121 | `'#1a1714'` (toggle label) | `semantic.text.primary` |
| 124 | `'#807a72'` (toggle counter) | `semantic.text.muted` |

### finance/FinanceSummaryStrip.tsx

| Line (post) | Old | New |
|---|---|---|
| 43 | `'#807a72'` (cell label) | `semantic.text.muted` |
| 56 | `'#1a1714'` (cell value) | `semantic.text.primary` |
| 87 | `'#cfc8be'` (outer border) | `semantic.border.default` |
| 94 | `'#cfc8be'` (separator 1) | `semantic.border.default` |
| 96 | `'#cfc8be'` (separator 2) | `semantic.border.default` |

## Deferred sites — slice 37 must address

### Link blue (`#3b6ed1`, `#5b8de1`)

| File | Sites (post-migration line numbers) |
|---|---|
| `bio/BioPortrait.tsx` | 13 (gradient stop 1), 14 (solid native), 13 (gradient stop 2 `#5b8de1`) |
| `bio/BioContactLinks.tsx` | 24 (`linkStyle` const) |
| `cards/MetricCardShell.tsx` | 103 (onExpand CTA), 120 (externalSourceUrl CTA) |
| `finance/TopAmountBreakdown.tsx` | 145 (web anchor), 160 (native Pressable text) |

**Recommended slice-37 action:** introduce `semantic.link.fg` token; decide whether it resolves to deep orange `accent.primary` or stays blue. Migrate all sites at once. Note that `bio/BioPortrait.tsx` lines 13–14 are a portrait-gradient pair, not generic link blue — they share the hex value but belong to the portrait-gradient decision (see below). Treat them separately if the link/portrait decisions diverge.

### Finance signal green (`#3da75b`)

| File | Sites |
|---|---|
| `finance/TopAmountBreakdown.tsx` | 89 (bar fill) |
| `finance/FinanceSummaryStrip.tsx` | 26 (`DOT` const) |

**Recommended slice-37 action:** introduce `semantic.signal.success` token (light + dark). Update slice 32 spec §4.1 to add the `alert.success` row (currently only `alert.danger` exists). Audit any other usages of "positive money / inflow / success" green across the codebase before committing the token shape.

### Finance mint background (`#f4faf6`)

| File | Sites |
|---|---|
| `finance/TopAmountBreakdown.tsx` | 26 (`SOLID_NATIVE` const) |
| `finance/FinanceSummaryStrip.tsx` | 28 (`SOLID_NATIVE` const) |

**Recommended slice-37 action:** introduce `FINANCE_CARD_BG` token in `@chiaro/ui-tokens/finance.ts` alongside existing finance domain palette. Light + dark variants. This is the native-side fallback for the finance `CATEGORY_CARD_GRADIENT` top stop — keep the two values in sync or wire `FINANCE_CARD_BG` as the gradient's literal top stop.

### MetricCardShell category palette (`#fcfaf2`, `#f6f8fc`, `#f3faf8`, `#f4faf6`, `#fcf7f0`, `#f7f4fc`)

| File | Sites |
|---|---|
| `cards/MetricCardShell.tsx` | 27–32 (6 sites inside `CATEGORY_CARD_BG_SOLID` const) |

**Recommended slice-37 action:** move `CATEGORY_CARD_BG_SOLID` to `@chiaro/ui-tokens/category.ts` alongside existing `CATEGORY_CARD_GRADIENT`. Add dark variants. The current map is the native-side solid fallback for each category's web-only `linear-gradient(...)`; pair the migration with a `category.bg.solid[categoryId]` getter that reads the gradient's top stop literal, so the two stay in sync structurally.

### MetricCardShell placeholder backgrounds (`#fafaf6`, `#f6f4ed`, `#fcfaf2`)

| File | Sites |
|---|---|
| `cards/MetricCardShell.tsx` | 52 (`UNAVAILABLE_BG` const), 64 (placeholder bg literal), 66 (`CATEGORY_CARD_BG_SOLID` fallback `?? '#fcfaf2'`) |

**Recommended slice-37 action:** introduce `semantic.bg.placeholder` token (or fold into existing `bg.subtle` if visual diff is acceptable). The line-66 fallback (`?? '#fcfaf2'`) should be replaced by an exhaustive `CATEGORY_CARD_BG_SOLID` type guarantee once the const moves to ui-tokens — the fallback exists only as a `Record<CategoryId, string>` index-signature safety net and disappears under a stricter type.

### PARTY_COLOR fallback (`#807a72`)

| File | Sites |
|---|---|
| `bio/BioIdentityRow.tsx` | 26 (fallback when party unknown) |

**Recommended slice-37 action:** add `PARTY_COLOR.unknown` to `@chiaro/ui-tokens/party.ts` with explicit light + dark values. Today's fallback overlaps semantically with `semantic.text.muted`, but party colors are a domain palette — keep them in the party module rather than collapsing into the semantic surface.

### BioPortrait white-on-blue + gradient (`#fff`, `#3b6ed1`, `#5b8de1`)

| File | Sites |
|---|---|
| `bio/BioPortrait.tsx` | 13 (`PORTRAIT_GRADIENT_WEB`), 14 (`PORTRAIT_SOLID_NATIVE`), 59 (initials `#fff` text) |

**Recommended slice-37 action:** pair these three sites with a single portrait-gradient brand-decision. If portrait stays blue, the `#fff` initials text stays white. If portrait rebases to orange `accent.primary`, the white-on-orange contrast must be re-verified for WCAG AA. Introduce either `portrait.bg.{light,dark}` + `portrait.fg.{light,dark}` tokens or fold portrait into the existing `accent.*` family.

## Guidance for future authors

If you reach for an inline hex value in `@chiaro/officials-ui`, check this audit first:

1. **Does the hex match a `BRAND.semantic.*` token?** Use `useBrandTokens()` instead. The semantic surface today covers `text.{primary,body,muted}`, `bg.{subtle,elevated}`, `border.default`, and `accent.primary`. See `docs/brand-migration.md` for the canonical migration vocabulary.
2. **Is the hex in this audit's "Deferred sites" section?** Match the existing `// TODO slice 37` comment style and add yourself to the list (extend the table for the relevant category). Do NOT introduce yet another deferred-but-uncatalogued hex; the audit doc is the registry.
3. **Is the hex truly novel (no existing token, no existing TODO)?** File an issue or update this audit before committing. Slice 37 will close the deferred list — anything not in here at slice-37 start is an unbounded surprise.

The CLAUDE.md Code Style rule "Inline hex colors are forbidden" stands; this audit catalogs the known exceptions awaiting slice 37.

---

*Generated alongside slice 34. See `docs/superpowers/specs/2026-05-27-shared-foundation-retrofit-design.md` for the slice 34 design and `docs/brand-migration.md` for the canonical migration vocabulary.*
