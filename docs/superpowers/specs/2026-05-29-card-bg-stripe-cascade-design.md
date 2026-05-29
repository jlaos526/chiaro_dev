# Slice 43 — Category card bg stripe cascade

**Status:** Approved 2026-05-29
**Tier:** Mega Slice (~17 files)
**Branch:** `slice-43-card-bg-stripe-cascade`

---

## 1. Goal

Replace the slice 41 per-category card-bg-gradient pattern (12 hexes + 12 gradient strings) with a **universal neutral card surface** + **3px top stripe** consuming `useCategoryAccent(id)`. The two structural wins:

1. **Readability.** Progress bars and data inside category cards sit on a uniform-contrast surface instead of a top-to-bottom fading bg. Slice 41's Level B saturation + gradient created visible contrast loss at the top of cards where bars meet the deeper bg stop. The user flagged this on the finance card; the same problem applies to all 6 categories.

2. **Architectural simplification.** Drop `CATEGORY_CARD_GRADIENT` + `CATEGORY_CARD_GRADIENT_DARK` (12 strings deleted from `@chiaro/ui-tokens`). Drop the Pattern B createElement gradient escape hatch (CLAUDE.md Gotcha #19f) in 3 component files. Collapse `CATEGORY_CARD_BG_SOLID` + `_DARK` per-category maps (12 hexes) to 2 universal scalars. New `useCategoryCardBg()` hook (no id arg).

3. **Visual elevation.** The new neutral card surface (`#fffaf2` light / `#2a2e34` dark) sits visibly above the page bg (`#efece5` / `#16181c`). Slice 41's "cards barely visible against page" problem closes uniformly.

Closes slice 38+ reskin roadmap follow-up: the slice 41 + 40 final-review observation that category cards visually merge into their page backgrounds across both modes.

## 2. Non-goals

- **No change to `BRAND_SEMANTIC.signal.success`.** The slice 43 prep audit (`docs/superpowers/audits/2026-05-29-finance-green-overlap.md`) recommended Option A (collapse to `CATEGORY_ACCENT.finance`), but during brainstorm the user selected Option D (status quo). `signal.success` stays `#3da75b` light / `#5dc97f` dark. This slice does not touch it.
- **No change to `CATEGORY_ACCENT`, `SUB_CASCADE_ACCENT`, `MAP_COLORS`, or any other slice 41/42 token surface.** Only `CATEGORY_CARD_GRADIENT*` and `CATEGORY_CARD_BG_SOLID*` are affected.
- **No change to `BRAND_SEMANTIC.bg.card`** (slice 32, `#fdf8f3` light / `#1e2126` dark). That token is consumed by non-category surfaces (`SettingsSection`, `BrandModeThemeRow`); narrowing scope to category cards via a new `CATEGORY_CARD_BG` token avoids unintended drift in those consumers.
- **No change to `BioPortrait` gradient pattern** (slice 40 portrait gradient, separate from category gradients). The createElement escape hatch (Gotcha #19f) stays alive for portrait-specific use.
- **No change to component layout beyond the bg + stripe.** Existing padding, font sizes, dot positions, evidence-expand CTAs preserved.
- **No new state-officials specific changes.** State officials cards use the same `MetricCardShell` wrapper as federal; both pick up the new pattern transparently.

## 3. User stories

**As a user reading any of the 6 category cards on an officials detail page,**
the card surface is uniformly neutral (warm cream in light, cool slate in dark) with a single 3px colored stripe at the top identifying the category. Progress bars, dollar amounts, and other data sit on consistent contrast — no perceptual noise from the slice 41 gradient at the top of the card. The category identity is still legible (colored stripe + colored dot in the header row), but it's a sidebar accent rather than a wash.

**As a user in dark mode,**
each card pops above the cool-slate page bg as a slightly brighter slate slab. No card body merges with the page background like the slice 41 gradient endpoint did. The colored stripe is the only saturated element on the card surface.

**As a developer maintaining the brand token surface,**
there are now 2 category bg tokens instead of 24 (12 light + 12 dark across gradient + solid). The Pattern B web/native gradient escape hatch lives only in `BioPortrait` (where it's actually needed). New cards built downstream just need a `useCategoryCardBg()` call + a `<View>` with a colored top border.

## 4. Locked decisions

All values finalized 2026-05-29 across 5 brainstorm screens (5-option signal.success audit visualization → 3 gradient deepen variants → gradient-drop alternatives → 3 V2 elevation levels → all-6 cascade preview).

### New universal card bg tokens

```ts
// packages/ui-tokens/src/category.ts
export const CATEGORY_CARD_BG = '#fffaf2'           // light: near-white, warmer than slice 32 surface.card
export const CATEGORY_CARD_BG_DARK = '#2a2e34'      // dark: brighter than slice 40 surface.elevated
```

Both values were chosen as V2b "medium pop" — visibly elevated above the page bg without overshooting into clinical/material territory.

### Top stripe pattern

```tsx
// Every category card renders a 3px top border in the category accent color.
<View
  style={{
    backgroundColor: cardBg,            // useCategoryCardBg() — universal
    borderWidth: 1,
    borderColor: semantic.border.default,
    borderTopWidth: 3,                  // ← 3px stripe
    borderTopColor: categoryAccent,     // useCategoryAccent(id) — per-category
    borderRadius: 6,
  }}
>
  …
</View>
```

The stripe consumes the existing `useCategoryAccent(id)` hook (slice 41), so all 6 categories cascade automatically:

| Category | Stripe color |
|---|---|
| Service Record | `#c89a4e` (gold) |
| Community Presence | `#b86340` (terracotta) |
| Finance | `#1a8f5a` (emerald) |
| Issue Positions | `#3b6ed1` (blue) |
| Ethics & Accountability | `#8a3a4d` (burgundy) |
| Voting & Bills | `#7d57c1` (purple) |

### Deletions

```ts
// DELETED from packages/ui-tokens/src/category.ts:
export const CATEGORY_CARD_GRADIENT: Record<CategoryId, string>      // 6 light gradient strings
export const CATEGORY_CARD_GRADIENT_DARK: Record<CategoryId, string> // 6 dark gradient strings
export const CATEGORY_CARD_BG_SOLID: Record<CategoryId, string>      // 6 light per-category bgs
export const CATEGORY_CARD_BG_SOLID_DARK: Record<CategoryId, string> // 6 dark per-category bgs
```

```ts
// DELETED from packages/officials-ui/src/brand-hooks.ts:
export function useCategoryCardGradient(id: CategoryId): string
export function useCategoryCardBgSolid(id: CategoryId): string
```

### New hook

```ts
// packages/officials-ui/src/brand-hooks.ts
export function useCategoryCardBg(): string {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? CATEGORY_CARD_BG_DARK : CATEGORY_CARD_BG
}
```

No category id argument — the bg is universal.

## 5. Architecture / file plan

**~17 files. Mega Slice tier.**

### 5.1 Token source

1. **`packages/ui-tokens/src/category.ts`** — delete the 4 deprecated exports listed in §4, add 2 new scalar exports `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK`. Update the slice-41-style comment block to document the slice 43 pattern shift. Re-export from `src/index.ts` (verify barrel file pulls them through).

### 5.2 Token tests

2. **`packages/ui-tokens/test/category.test.ts`** — delete the existing `describe('CATEGORY_CARD_GRADIENT', ...)`, `describe('CATEGORY_CARD_GRADIENT_DARK', ...)`, `describe('CATEGORY_CARD_BG_SOLID', ...)`, `describe('CATEGORY_CARD_BG_SOLID_DARK', ...)` blocks. Add 2 new describe blocks: `describe('CATEGORY_CARD_BG (slice 43 universal)', ...)` asserting `#fffaf2`, and `describe('CATEGORY_CARD_BG_DARK (slice 43 universal)', ...)` asserting `#2a2e34`. `CategoryId` + `CATEGORY_LABEL` + `CATEGORY_ACCENT` + `CATEGORY_ACCENT_DARK` + `SUB_CASCADE_ACCENT` + `SUB_CASCADE_ACCENT_DARK` blocks unchanged.

3. **`packages/ui-tokens/test/domain-palette-dark.test.ts`** — delete the 2 key-parity tests for `CATEGORY_CARD_BG_SOLID` and `CATEGORY_CARD_GRADIENT` (those tokens no longer exist). Delete the per-tier hard-pinned assertions at lines 85-88 that pin `CATEGORY_CARD_BG_SOLID['service-record']` + `.finance`. Keep all other tests (PARTY, ALIGNMENT_CHIP, MAP_COLORS, etc.).

### 5.3 Hook surface

4. **`packages/officials-ui/src/brand-hooks.ts`** — delete `useCategoryCardGradient` + `useCategoryCardBgSolid` + `useFinanceCardBg`. Add `useCategoryCardBg()`. Remove `CATEGORY_CARD_GRADIENT*` + `CATEGORY_CARD_BG_SOLID*` + `FINANCE_CARD_BG*` from imports; add `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK`.

5. **`packages/officials-ui/test/brand-hooks.test.tsx`** — delete `describe('useCategoryCardGradient', ...)`, `describe('useCategoryCardBgSolid', ...)`, and `describe('useFinanceCardBg', ...)` blocks. Add `describe('useCategoryCardBg (slice 43)', ...)` with 2 it-cases: returns light value when mode is light, returns dark when mode is dark.

5a. **`packages/ui-tokens/src/finance.ts`** — delete `FINANCE_CARD_BG` + `FINANCE_CARD_BG_DARK` exports (the slice 37 abstraction collapses; the slice 43 universal token covers all consumers).

5b. **`packages/ui-tokens/src/index.ts`** — remove `FINANCE_CARD_BG*` from the barrel export.

5c. **`packages/ui-tokens/test/finance-shades.test.ts`** (or wherever FINANCE_CARD_BG is asserted) — delete the affected tests. Update `domain-palette-dark.test.ts` to remove the `FINANCE_CARD_BG known values` test case (lines 70-73).

### 5.4 Component refactors (drop Pattern B)

6. **`packages/officials-ui/src/cards/MetricCardShell.tsx`** — delete the `createElement('div', ...)` web gradient wrapper. Replace inner View style with the new pattern: `borderTopWidth: 3`, `borderTopColor: categoryAccent`, `backgroundColor: cardBg`. Drop the placeholder/unavailable gradient suppression logic (just always use the same bg; the dot color already differentiates the variants). Lift `useCategoryCardBg()` call.

7. **`packages/officials-ui/src/finance/FinanceSummaryStrip.tsx`** — same refactor. Drop `useFinanceCardBg()` import (replaced by the universal hook). Lines 70-109 createElement wrapper deleted; inner View gains the top stripe + new bg.

8. **`packages/officials-ui/src/finance/TopAmountBreakdown.tsx`** — same refactor.

### 5.5 Component tests (Gotcha #29 grep aftermath)

9. **`packages/officials-ui/test/cards/MetricCardShell.test.tsx`** — replace the `expect(bg).toMatch(/linear-gradient\(180deg, #d4e8d8 0%, #fff 100%\)/)` regex assertion (line 82) with a stripe-pattern assertion: verify `border-top-style: solid; border-top-width: 3px; border-top-color: rgb(26, 143, 90)` for finance via RNW DOM style parsing. Update other variant tests similarly.

10. **`packages/officials-ui/test/finance/FinanceSummaryStrip.test.tsx`** — replace gradient regex (line 43) with stripe-pattern assertion + bg `rgb(255, 250, 242)` (RNW normalizes `#fffaf2`).

11. **`packages/officials-ui/test/finance/TopAmountBreakdown.test.tsx`** — same.

### 5.6 Docs

12. **`docs/brand-book.md`** — rewrite §11 (Category palette slice 41) to remove the gradient + per-category bg subsections; replace with "Category card bg: `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK`" universal + "3px top stripe via `useCategoryAccent(id)`" pattern note.

13. **`docs/brand-migration.md`** — append slice 43 entry covering: deleted tokens (gradient + per-category bg-solid), new tokens (`CATEGORY_CARD_BG` + `_DARK`), pattern shift (gradient bg → universal bg + colored top stripe), 3 component refactors, and the test-pin updates per Gotcha #29.

### 5.7 Closeout

14. **`CLAUDE.md`** — slice 43 entry in Slices delivered. **Update Gotcha #19f** (Pattern B / createElement gradient escape hatch) to note that category cards no longer use the pattern; only `BioPortrait` remains.

15. **`docs/superpowers/mobile-dod-checklist.md`** — slice 43 section with ~6 verification checkboxes: each of the 6 category cards shows the right top stripe + universal bg + visible elevation above page bg in both modes.

## 6. Cross-platform

- Web + mobile both use a `<View>` with `borderTopWidth: 3` + `borderTopColor` — works identically across RNW and RN. No Platform.OS branch needed for category cards.
- BioPortrait keeps its slice 40 portrait gradient (separate concept; createElement escape hatch stays for that one component).
- Dark mode toggle (slice 38) drives `useBrandTokens().mode` → `useCategoryCardBg()` picks the right value.

## 7. Risks

1. **Test regex updates land in 3 files.** Slice 41 lesson (Gotcha #29) says this is exactly the class of drift that gets missed — but the audit grep against `packages/officials-ui/test` already located all 3 sites (`MetricCardShell.test.tsx:82`, `FinanceSummaryStrip.test.tsx:43`, `TopAmountBreakdown.test.tsx:117`). Each one needs the regex replaced with a stripe-pattern assertion. Pre-flight checked.

2. **`useFinanceCardBg()` + `FINANCE_CARD_BG` retirement.** Pre-flight grep confirms only 2 consumers (`FinanceSummaryStrip` + `TopAmountBreakdown`). Both retire to `useCategoryCardBg()` in slice 43. The `FINANCE_CARD_BG` + `FINANCE_CARD_BG_DARK` tokens in `packages/ui-tokens/src/finance.ts` and the `useFinanceCardBg()` hook become orphans — slice 43 deletes them too (+2 files in scope: `finance.ts` source + `domain-palette-dark.test.ts` key-parity entry). The slice 37 abstraction is collapsed back into the category surface.

3. **Visual regression on the 6 category cards.** The slice 41 gradient was a deliberate design call. Replacing it with a stripe pattern is a substantive visual change. The brainstorm validated the new pattern across all 6 cards, but final smoke (`pnpm --filter @chiaro/web build` + visual diff against current master) is operator follow-up post-merge.

4. **placeholder/unavailable variant differentiation.** `MetricCardShell` currently uses `categoryBgSolid` for the live variant and `semantic.bg.subtle` for placeholder/unavailable variants. Slice 43 needs to preserve this distinction — placeholder/unavailable should NOT get the top stripe (or get a muted stripe). Decision: placeholder/unavailable variants render without the top stripe (border-top-width: 1 like the other borders), so they read as "no data" rather than "active category card."

5. **`semantic.bg.card` not affected.** This is good (settings + other surfaces stay stable) but it does mean Chiaro now has two different "card bg" tokens — `semantic.bg.card` (slice 32 universal) and `CATEGORY_CARD_BG` (slice 43 category-specific). Documented in §2 non-goals.

## 8. Testing

- **TDD per task.** Tests updated first; source change makes them pass.
- **`pnpm --filter @chiaro/ui-tokens test`** — should drop from 166 to ~158 (4 gradient + 4 bg-solid + 1 cross-export key-parity tests deleted; 2 universal-bg tests added; net -7). Acceptable: token surface shrinks.
- **`pnpm --filter @chiaro/officials-ui test`** — should grow from 460 to ~462 (3 test files updated in place; +2 new useCategoryCardBg hook tests).
- **`pnpm -r typecheck`** — must pass after Task 6 (component refactors) and Task 4 (hook surface change). Intermediate states may have transient typecheck failures — operator is expected to land each task as a complete commit so master always typechecks.
- **`pnpm --filter @chiaro/web build`** — should succeed; bundle delta expected to be small (~2-5 kB smaller due to deleted gradient strings).
- **Visual smoke deferred** per slice 38-42 pattern (operator runs `pnpm --filter @chiaro/web dev` post-merge and verifies the 6 category cards on `/officials/[id]` and `/state-officials/[id]`).

## 9. Surface (deliverables)

- 17 files changed: 3 ui-tokens src (category.ts + finance.ts + index.ts) + 3 ui-tokens test (category.test.ts + domain-palette-dark.test.ts + finance-shades.test.ts) + 2 hook (brand-hooks src + test) + 3 component refactors (MetricCardShell + FinanceSummaryStrip + TopAmountBreakdown) + 3 component test updates + 4 docs (brand-book + brand-migration + CLAUDE.md + mobile DoD).
- 6 token exports deleted (2 gradient maps + 2 per-category bg maps + 2 finance card bg scalars), 2 universal scalars added.
- 3 hooks deleted (`useCategoryCardGradient` + `useCategoryCardBgSolid` + `useFinanceCardBg`), 1 hook added (`useCategoryCardBg`).
- 1 CLAUDE.md gotcha updated (#19f scope narrowed to portrait only).
- 0 schema changes.
- 0 new dependencies.
- Test delta: ui-tokens ~-10 (token surface shrinks more after finance retirement); officials-ui ~+0 net (gain useCategoryCardBg test, lose useFinanceCardBg test; 3 component test files updated 1:1).

## 10. Closeout

- Branch merged to master via `--no-ff` merge commit titled `Merge slice 43: category card bg stripe cascade`.
- CLAUDE.md slice 43 entry shipped; Gotcha #19f update shipped.
- Mobile DoD slice 43 section shipped.
- User memory gets a `project_chiaro_slice43_card_bg_stripe_cascade.md` file + 1-line MEMORY.md index entry.
- Audit doc at `docs/superpowers/audits/2026-05-29-finance-green-overlap.md` stays in repo as the prep record showing why slice 43 did NOT touch `signal.success`.

## 11. Unblocks / reskin roadmap progress

After slice 43, reskin roadmap state:
- ✅ #1 Link blue — slice 40 (kept as anchor)
- ✅ #2 AlignmentChip tiers — slice 42
- ✅ #3 BioPortrait gradient — slice 40 (mode-aware)
- ⏳ #4 Industry rainbow — queued (untouched by slice 43)
- ❌ #5 Finance "money in" green — **AUDIT-CLOSED.** The 2026-05-29 audit found zero non-finance consumers and the user picked status quo (Option D). Token unchanged; closes the roadmap item without a code change.
- ⏳ #6 MetricCardShell retune — **slice 43 closes this in a different direction than originally framed.** Slice 38+ roadmap framed it as "heuristic dark variants may need retune"; slice 43 instead drops the gradient pattern entirely and switches to a stripe pattern. MetricCardShell is refactored as part of this slice's Task 6. After slice 43, the roadmap item is closed.

**Remaining queued reskin work:** only #4 industry rainbow (~20 colors used in donor breakdown industry charts). All other slice 38+ roadmap items closed.
