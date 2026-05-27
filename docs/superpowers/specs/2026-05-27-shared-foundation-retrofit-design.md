# Slice 34 — Shared Foundation Retrofit + Inline-Hex Sweep

> **Type:** Mechanical retrofit + technical-debt sweep
> **Scope:** Migrate the shared `@chiaro/officials-ui` foundation components (OfficialsCard/List/Avatar + bio/* + cards/ComingSoonCard + CardSubsection + MetricCardShell + finance/*) from `COLORS.*` and inline hex to `BRAND.semantic.*` via `useBrandTokens()`. Defer domain-palette values to slice 37 with explicit annotations.
> **Tier:** Mega Slice (~25-30 files).

---

## 1. Goal

Slice 33 shipped the migration pattern (`useBrandTokens()` + `docs/brand-migration.md`) and proved it on the auth surface. Slice 34 applies the same pattern to the shared foundation components touched by every officials detail page.

Two retrofit tracks land together:

1. **Part A — `COLORS.*` mechanical migration** (5 files / 18 occurrences). Pure pattern application from slice 33.

2. **Part B — Inline-hex sweep** (8 files / 52 hex strings). The slice 33 spec flagged inline-hex audit as a follow-up risk; drift is confirmed. Brand-aligned values auto-migrate to `BRAND.semantic.*`; domain-specific values (category palette, finance signal colors, link blue) get a `// TODO: slice 37` annotation and ship as audit follow-ups.

The slice produces a smaller-but-cleaner shared-foundation surface that slices 35-37 inherit.

## 2. In scope / out of scope

**In scope:**
- Part A: `OfficialsCard`, `OfficialsList`, `OfficialAvatar`, `cards/ComingSoonCard`, `cards/CardSubsection`
- Part B: `bio/BioServiceCard`, `bio/BioHeader`, `bio/BioIdentityRow`, `bio/BioPortrait`, `bio/BioContactLinks`, `cards/MetricCardShell`, `finance/TopAmountBreakdown`, `finance/FinanceSummaryStrip`
- Mode-awareness on all 13 files via `useBrandTokens()`
- Per-file test update: one new mode-awareness test asserting render-without-throw under both wrappers
- New audit doc `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md` tracking what was migrated vs what was deferred

**Out of scope:**
- `AlignmentChip` + `BioAlignmentChipRow` — depend on `ALIGNMENT_CHIP_COLORS` domain palette; deferred to slice 37
- Federal cards (slice 35) and state cards (slice 36)
- Domain palette exports (`PARTY_COLOR`, `CATEGORY_ACCENT`, `ALIGNMENT_CHIP_COLORS`, `INDUSTRY_COLOR`, `SCORECARD_LEAN_COLOR`, `SUB_CASCADE_ACCENT`, `CATEGORY_CARD_GRADIENT`, `FINANCE_SUB_SECTION_SHADES`) — slice 37
- New token definitions in `@chiaro/ui-tokens` — none added in this slice (BRAND surface is unchanged)
- Link blue (`#3b6ed1`) brand-philosophy decision — slice 37
- Finance signal colors (success green, mint backgrounds) — slice 37
- MetricCardShell category palette migration to `@chiaro/ui-tokens` — slice 37 (when `CATEGORY_CARD_GRADIENT` gets dark variants)
- Apps (`apps/web`, `apps/mobile`) — no changes

## 3. Migration tables

### 3.1 Part A — `COLORS.*` references (mechanical migration)

| File | `COLORS.*` count | Mapping target |
|---|---|---|
| `OfficialsCard.tsx` | 9 | per `docs/brand-migration.md` |
| `OfficialsList.tsx` | 1 | per `docs/brand-migration.md` |
| `OfficialAvatar.tsx` | 2 | per `docs/brand-migration.md` |
| `cards/ComingSoonCard.tsx` | 4 | per `docs/brand-migration.md` |
| `cards/CardSubsection.tsx` | 2 | per `docs/brand-migration.md` |

Each file follows the slice 33 mechanical pattern:
1. Replace `import { COLORS } from '@chiaro/ui-tokens'` with `import { useBrandTokens } from '../brand-hooks.ts'`
2. Add `const { semantic } = useBrandTokens()` at top of component body
3. Map each `COLORS.*` reference per `docs/brand-migration.md`
4. RN StyleSheet split layout-static / color-inline

### 3.2 Part B — Inline-hex sweep: MIGRATE

Brand-aligned hex values that map cleanly to `BRAND.semantic.*`:

| Hex value | New | Files touching it |
|---|---|---|
| `#1a1714` | `semantic.text.primary` | BioServiceCard, BioHeader, TopAmountBreakdown, FinanceSummaryStrip, MetricCardShell |
| `#807a72` | `semantic.text.muted` (light value shifts to `#6b5e52`) | BioServiceCard, BioIdentityRow (party fallback), MetricCardShell |
| `#5a5751` | `semantic.text.muted` (close to `#6b5e52`; same role) | BioServiceCard, TopAmountBreakdown, FinanceSummaryStrip, MetricCardShell |
| `#3a352b` | `semantic.text.body` (matches `#3a322c`) | BioIdentityRow |
| `#fff` / `#ffffff` | `semantic.bg.elevated` | BioServiceCard, BioPortrait, BioIdentityRow, TopAmountBreakdown |
| `#f0eee5` | `semantic.bg.subtle` (close to `#f7efe2`; cream chip backdrop) | BioServiceCard, BioIdentityRow |
| `#d8d4c9` | `semantic.border.default` (close to `#e8d8c2`; warm border) | BioContactLinks, TopAmountBreakdown, FinanceSummaryStrip |
| `#e8e6dd` | `semantic.border.default` (progress-bar neutral track) | TopAmountBreakdown |

**Note on value drift:** several "migrate" entries shift hex values slightly (e.g., `#807a72` → `#6b5e52`). This is the intentional brand-cream-warming shift codified in slice 32. Visual delta is intentional and small. Validate with a spot-check screenshot smoke if concerned.

### 3.3 Part B — Inline-hex sweep: DEFER (annotate with `// TODO slice 37`)

Domain-specific or brand-philosophy-pending values that stay inline with a TODO marker:

| Hex value | Role | Files | Why deferred |
|---|---|---|---|
| `#3b6ed1` | Link blue (anchor color) | BioPortrait, BioContactLinks, TopAmountBreakdown | Needs brand-philosophy decision: do anchors stay blue, or go to `accent.primary` deep orange? Slice 37. |
| `#5b8de1` | Gradient stop (lighter blue) | BioPortrait | Pairs with `#3b6ed1`. Same decision. |
| `#3da75b` | Success green / "money in" | TopAmountBreakdown, FinanceSummaryStrip | Finance signal palette. Slice 37 (alongside `signal.success` token introduction). |
| `#f4faf6` | Mint background tint | TopAmountBreakdown, FinanceSummaryStrip | Finance domain palette. Slice 37. |
| `#fcfaf2`, `#f6f8fc`, `#f3faf8`, `#f4faf6`, `#fcf7f0`, `#f7f4fc` | Per-category card backgrounds | MetricCardShell | Already a domain palette (`CATEGORY_CARD_BG_SOLID` in MetricCardShell). Move to `@chiaro/ui-tokens` in slice 37 alongside `CATEGORY_CARD_GRADIENT`. |
| `#fafaf6` | `UNAVAILABLE_BG` for metric placeholders | MetricCardShell | Domain-specific placeholder visual. Slice 37. |
| `#f6f4ed` | Placeholder card backdrop | MetricCardShell | Same as above. Slice 37. |

Each deferred site gets a single-line comment:
```ts
// TODO slice 37: link color brand-decision (anchor blue vs accent.primary)
color: '#3b6ed1',
```

The audit doc enumerates each deferred site by file:line for slice 37's reference.

### 3.4 Per-file inline-hex disposition summary

| File | Migrate | Defer | Net hex remaining |
|---|---|---|---|
| `bio/BioServiceCard.tsx` | 5 | 0 | 0 |
| `bio/BioHeader.tsx` | 1 | 0 | 0 |
| `bio/BioIdentityRow.tsx` | 4 | 1 (PARTY_COLOR fallback) | 1 (deferred) |
| `bio/BioPortrait.tsx` | 0 | 3 (blue gradient) | 3 (deferred) |
| `bio/BioContactLinks.tsx` | 1 | 1 (link blue) | 1 (deferred) |
| `cards/MetricCardShell.tsx` | 3 (`#1a1714`, `#5a5751`, `#807a72`) | 13 (category palette + placeholder + link blue) | 13 (deferred) |
| `finance/TopAmountBreakdown.tsx` | 6 (text + border) | 7 (mint, green, blue) | 7 (deferred) |
| `finance/FinanceSummaryStrip.tsx` | 4 (text + border) | 3 (mint, green) | 3 (deferred) |

Total: 24 inline hex migrated; 28 inline hex deferred with TODO markers.

## 4. Architecture decisions

### 4.1 No new tokens

The BRAND surface from slice 32 stays unchanged. Slice 34 only migrates consumers; if a hex value can't map cleanly to an existing BRAND.semantic.* token, it goes in the DEFER bucket. New tokens for finance success-green, link blue, category backgrounds, etc., are slice 37's scope.

### 4.2 `useBrandTokens()` placement

Same pattern as slice 33: `const { semantic } = useBrandTokens()` at the top of every component body. RN StyleSheet split layout-static / color-inline. CSS-in-JS templates rebuild per `(className, semantic)` via `useMemo` (only MetricCardShell + TopAmountBreakdown have CSS-in-JS templates; bio + OfficialsCard/List/Avatar are pure RN StyleSheet).

### 4.3 Audit doc

A new permanent reference at `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`. Documents:
- The 24 inline hex sites migrated (file:line + before/after)
- The 28 deferred sites with reason + slice 37 owner
- A guidance table for future authors: "if you reach for an inline hex, check here first"

The doc is the load-bearing artifact for slice 37 — it pins what slice 37 must own.

## 5. Files

```
packages/officials-ui/src/
├── OfficialsCard.tsx                 MODIFY (Part A)
├── OfficialsList.tsx                 MODIFY (Part A)
├── OfficialAvatar.tsx                MODIFY (Part A)
├── bio/
│   ├── BioServiceCard.tsx            MODIFY (Part B — full migrate)
│   ├── BioHeader.tsx                 MODIFY (Part B — full migrate)
│   ├── BioIdentityRow.tsx            MODIFY (Part B — partial)
│   ├── BioPortrait.tsx               MODIFY (Part B — all defer; useBrandTokens not added since no migrate; TODO comments only)
│   └── BioContactLinks.tsx           MODIFY (Part B — partial)
├── cards/
│   ├── ComingSoonCard.tsx            MODIFY (Part A)
│   ├── CardSubsection.tsx            MODIFY (Part A)
│   └── MetricCardShell.tsx           MODIFY (Part B — partial)
└── finance/
    ├── TopAmountBreakdown.tsx        MODIFY (Part B — partial)
    └── FinanceSummaryStrip.tsx       MODIFY (Part B — partial)

packages/officials-ui/test/
└── (corresponding *.test.tsx files)  UPDATE (one mode-awareness test per file)

docs/superpowers/audits/
└── 2026-05-27-inline-hex-sweep.md    NEW

CLAUDE.md                             MODIFY (slice 34 entry)
```

Approximate total: **~28 files**.

## 6. Testing

### 6.1 Per-component

Each of the 13 modified components gets ONE new mode-awareness test asserting render-without-throw under both `BrandModeOverrideContext.Provider value="light"` and `value="dark"`. Existing structural tests stay.

Some components don't have an existing test file (verify per-file during impl). If a file has no existing test, this slice does NOT add one — slice 34 is mechanical retrofit, not test backfill.

### 6.2 Snapshot guardrail (optional)

For `OfficialsCard` + `BioHeader` (the two highest-visibility surfaces), consider a brief snapshot test that asserts the rendered output contains the new hex values (`#c46a2a` for accent, `#1a1714` for text.primary). Defer if it adds friction.

### 6.3 Workspace gates

- `pnpm --filter @chiaro/officials-ui test` all green (~328+ tests, baseline from end of slice 33)
- `pnpm -r typecheck` 11 packages green
- `pnpm --filter @chiaro/web build` Next 15 build clean (no bundle-size regression > 5kB per route)

## 7. Acceptance criteria

- 5 Part A files: zero `COLORS.*` references via `grep "COLORS\\." packages/officials-ui/src/{OfficialsCard,OfficialsList,OfficialAvatar}.tsx packages/officials-ui/src/cards/{ComingSoonCard,CardSubsection}.tsx`
- 8 Part B files: every brand-aligned hex migrated; every deferred hex has a `// TODO slice 37` comment
- Audit doc `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md` exists with per-file inventory
- `pnpm -r typecheck` green
- `pnpm test` workspace green (except known Supabase-env integration failures)
- `pnpm --filter @chiaro/web build` clean; First Load JS per route within ±2 kB of baseline
- CLAUDE.md slice 34 entry added

## 8. Risks & open questions

**Risk:** Visual drift from value shifts (`#807a72` → `#6b5e52`, `#f0eee5` → `#f7efe2`, `#d8d4c9` → `#e8d8c2`). These are documented in slice 32 as the intentional brand-cream-warming shift. Verify by visual smoke (a single dev-server load of `/officials/[id]` for a known official); if a specific surface looks wrong, it's a bug to fix not a brand-system question.

**Risk:** MetricCardShell has 13 deferred hex strings (most of the file). It ships as a half-migration. Acceptable per the spec's deliberate scoping (category palette = slice 37). Could lead to confusion if someone reads MetricCardShell looking for "where the colors come from" — mitigation: the file gets a top-level JSDoc note pointing to the audit doc.

**Risk:** Test count grows by ~13. If individual auth tests are slow (slice 33 tests ran 4 minutes in CI), workspace test time creeps up. Mitigation: keep new mode-awareness tests minimal (one `it(...)` per file).

**Risk:** `BioPortrait.tsx` keeps all 3 hex as deferred. The file gets `// TODO slice 37` comments but does NOT add `useBrandTokens()` — there's nothing to migrate. Worth confirming this is the right call vs. adding `useBrandTokens()` purely for forward-compat. Decision: do not add — slice 34 is mechanical retrofit; no speculative refactors.

**Locked at design:**
- Auto-migrate table in §3.2 (8 hex values mapped to specific semantic tokens)
- Defer table in §3.3 (8 hex categories deferred to slice 37)
- Audit doc location (`docs/superpowers/audits/`)
- One mode-awareness test per modified component
- No new tokens in `@chiaro/ui-tokens`

## 9. After slice 34 — roadmap context

- **Slice 35**: Federal cards retrofit (5 cards + 11 sub-lists). MetricCardShell host migration to clean state (the deferred MetricCardShell hex values get sorted alongside CATEGORY_CARD_GRADIENT updates).
- **Slice 36**: State cards retrofit (6 cards + ~15 sub-lists).
- **Slice 37**: Domain palettes + link blue brand decision + finance signals + MetricCardShell category palette + map components dark variants + AlignmentChip philosophy. Closes all `// TODO slice 37` annotations from slices 34-36.
- **Slice 38+**: Full visual re-skin.

---

*See `docs/brand-book.md` for the brand reference and `docs/brand-migration.md` for the canonical migration vocabulary.*
