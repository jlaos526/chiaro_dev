# Slice 43 — Category card bg stripe cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slice 41 per-category gradient + per-category bg pattern (24 hexes across `CATEGORY_CARD_GRADIENT*` + `CATEGORY_CARD_BG_SOLID*` and the slice-37 `FINANCE_CARD_BG*` abstraction) with a universal `CATEGORY_CARD_BG` scalar (`#fffaf2` light / `#2a2e34` dark) + a 3px top stripe consuming `useCategoryAccent(id)` across all 6 category cards.

**Architecture:** Bottom-up refactor — add new tokens + hook first (additive), refactor 3 consumer components to use them, then delete the deprecated tokens + hooks once consumers are off them. This keeps the workspace green between tasks. The stripe pattern is a single `View` with `borderTopWidth: 3` + `borderTopColor` — works identically on RNW and RN, dropping the Pattern B createElement gradient escape hatch (CLAUDE.md Gotcha #19f) for category cards. Gotcha #19f stays alive for `BioPortrait` (separate concept).

**Tech Stack:** TypeScript strict + `exactOptionalPropertyTypes`, vitest, React Native + react-native-web (RNW 0.19). Hook consumption via the slice 41 `useCategoryAccent(id)` (unchanged) + new slice 43 `useCategoryCardBg()` (no id arg).

**Spec:** `docs/superpowers/specs/2026-05-29-card-bg-stripe-cascade-design.md`

---

## Task 1: Add universal CATEGORY_CARD_BG + CATEGORY_CARD_BG_DARK tokens (additive)

**Files:**
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/src/index.ts`
- Modify: `packages/ui-tokens/test/category.test.ts`

Add the new universal scalars without removing the deprecated per-category maps yet. Tests pass with both old and new tokens coexisting.

- [ ] **Step 1: Update test assertions**

Edit `packages/ui-tokens/test/category.test.ts`. Update the import block to add `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK`. Current imports already include the per-category bg + gradient symbols; just append the two new names.

Find the existing import statement at the top and replace with:

```ts
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BG_DARK,
  CATEGORY_CARD_BG_SOLID,
  CATEGORY_CARD_BG_SOLID_DARK,
  CATEGORY_CARD_GRADIENT,
  CATEGORY_CARD_GRADIENT_DARK,
  SUB_CASCADE_ACCENT,
  SUB_CASCADE_ACCENT_DARK,
} from '../src/category.ts'
```

Add 2 new describe blocks at the END of the file (after the last existing describe block):

```ts
describe('CATEGORY_CARD_BG (slice 43 universal)', () => {
  it('exports the locked light card bg', () => {
    expect(CATEGORY_CARD_BG).toBe('#fffaf2')
  })
})

describe('CATEGORY_CARD_BG_DARK (slice 43 universal)', () => {
  it('exports the locked dark card bg', () => {
    expect(CATEGORY_CARD_BG_DARK).toBe('#2a2e34')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: FAIL — `CATEGORY_CARD_BG` and `CATEGORY_CARD_BG_DARK` don't exist yet; the import line fails first.

- [ ] **Step 3: Add the new tokens to category.ts**

Edit `packages/ui-tokens/src/category.ts`. Find the END of the file (after the last existing export) and append:

```ts

// Slice 43: universal category card bg + 3px top stripe pattern.
// Replaces the slice 41 CATEGORY_CARD_GRADIENT* + CATEGORY_CARD_BG_SOLID*
// per-category maps. The stripe color comes from useCategoryAccent(id)
// (unchanged); the bg is the same for all 6 categories. Light value is
// V2b "medium pop" — visibly elevated above page bg #efece5 without
// overshooting into clinical white. Dark value sits above slice 40
// surface.elevated #262a30 for clearer card boundaries against page bg
// #16181c. See docs/superpowers/specs/2026-05-29-card-bg-stripe-cascade-design.md §4.
export const CATEGORY_CARD_BG = '#fffaf2'
export const CATEGORY_CARD_BG_DARK = '#2a2e34'
```

- [ ] **Step 4: Add to barrel export**

Edit `packages/ui-tokens/src/index.ts`. Find the `category.ts` export block (currently lines 24-35) and replace with:

```ts
export {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BG_DARK,
  SUB_CASCADE_ACCENT,
  SUB_CASCADE_ACCENT_DARK,
  CATEGORY_CARD_GRADIENT,
  CATEGORY_CARD_GRADIENT_DARK,
  CATEGORY_CARD_BG_SOLID,
  CATEGORY_CARD_BG_SOLID_DARK,
} from './category.ts'
```

(Both old and new exports coexist for now; Task 7 deletes the old ones.)

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- category`
Expected: PASS — both new describe blocks pass; all existing tests still pass.

- [ ] **Step 6: Run workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 projects (additive change; no consumer broke).

- [ ] **Step 7: Commit**

```bash
git add packages/ui-tokens/src/category.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/category.test.ts
git commit -m "feat(ui-tokens): CATEGORY_CARD_BG universal scalars (slice 43 task 1)

Additive. New CATEGORY_CARD_BG (#fffaf2 light) + CATEGORY_CARD_BG_DARK
(#2a2e34 dark) universal scalars in category.ts. V2b medium-pop
elevation above page bg in both modes. Per-category gradient + bg
maps coexist for now; Task 7 deletes them after Tasks 3-5 refactor
the 3 consumer components off them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add useCategoryCardBg() hook (additive)

**Files:**
- Modify: `packages/officials-ui/src/brand-hooks.ts`
- Modify: `packages/officials-ui/test/brand-hooks.test.tsx`

Add the new mode-aware hook without removing the deprecated ones yet.

- [ ] **Step 1: Update test assertions**

Edit `packages/officials-ui/test/brand-hooks.test.tsx`. Add `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK` to the `@chiaro/ui-tokens` import block (alphabetize among existing imports — they slot between `CATEGORY_ACCENT_DARK` and `CATEGORY_CARD_BG_SOLID`).

Add `useCategoryCardBg` to the `../src/brand-hooks.ts` import block (alphabetize — slots between `useBrandTokens` and `useCategoryAccent`).

Append this describe block at the END of the file (after the last existing describe block):

```ts
describe('useCategoryCardBg (slice 43)', () => {
  it('returns light card bg when mode is light', () => {
    const { result } = renderHook(() => useCategoryCardBg(), { wrapper: wrapper('light') })
    expect(result.current).toBe(CATEGORY_CARD_BG)
  })
  it('returns dark card bg when mode is dark', () => {
    const { result } = renderHook(() => useCategoryCardBg(), { wrapper: wrapper('dark') })
    expect(result.current).toBe(CATEGORY_CARD_BG_DARK)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- brand-hooks`
Expected: FAIL — `useCategoryCardBg` doesn't exist yet.

- [ ] **Step 3: Add the hook**

Edit `packages/officials-ui/src/brand-hooks.ts`. Add `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK` to the `@chiaro/ui-tokens` import block (alphabetize — they slot between `CATEGORY_ACCENT_DARK` and `CATEGORY_CARD_BG_SOLID`).

Append this hook at the END of the file (after `useMapColors`):

```ts

/**
 * Returns the universal category card background color for the active brand
 * mode (slice 43). Replaces the slice 41 per-category `useCategoryCardBgSolid`
 * + `useCategoryCardGradient` pair. The stripe color now comes from
 * `useCategoryAccent(id)` and is applied as `borderTopColor` on the card.
 */
export function useCategoryCardBg(): string {
  const { mode } = useBrandTokens()
  return mode === 'dark' ? CATEGORY_CARD_BG_DARK : CATEGORY_CARD_BG
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- brand-hooks`
Expected: PASS — 2 new it-cases pass; existing tests unchanged.

- [ ] **Step 5: Run workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/brand-hooks.ts packages/officials-ui/test/brand-hooks.test.tsx
git commit -m "feat(officials-ui): useCategoryCardBg hook (slice 43 task 2)

Additive. New useCategoryCardBg() reads CATEGORY_CARD_BG /
CATEGORY_CARD_BG_DARK via useBrandTokens().mode -- the universal
slice 43 replacement for useCategoryCardBgSolid +
useCategoryCardGradient. Tasks 3-5 wire it into the 3 consumer
components; Task 6 deletes the deprecated hooks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Refactor MetricCardShell to stripe pattern

**Files:**
- Modify: `packages/officials-ui/src/cards/MetricCardShell.tsx`
- Modify: `packages/officials-ui/test/cards/MetricCardShell.test.tsx`

Drop the Pattern B createElement gradient wrapper. The View renders directly with a 3px top stripe + the universal bg. Placeholder/unavailable variants get a 1px top border (no stripe) to read as "no data."

- [ ] **Step 1: Update test assertion (TDD)**

Edit `packages/officials-ui/test/cards/MetricCardShell.test.tsx`. Find the test `it('applies per-category gradient background when not placeholder/unavailable', ...)` (currently at lines 68-83). Replace the entire test (rename and rewrite) with:

```tsx
  it('applies the universal card bg + per-category 3px top stripe (slice 43)', () => {
    const { container } = render(
      <MetricCardShell
        value="$5.2M"
        label="Total Raised"
        categoryId="finance"
        externalSourceUrl="https://www.opensecrets.org"
      />,
    )
    // Outer card is the only descendant element (no wrapper div post-slice-43).
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    // RNW normalizes #fffaf2 to rgb(255, 250, 242) in inline style.
    expect(style).toMatch(/background-color:\s*rgb\(255,\s*250,\s*242\)/)
    // RNW normalizes #1a8f5a (CATEGORY_ACCENT.finance) to rgb(26, 143, 90).
    expect(style).toMatch(/border-top-color:\s*rgb\(26,\s*143,\s*90\)/)
    expect(style).toMatch(/border-top-width:\s*3px/)
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- MetricCardShell`
Expected: FAIL — the existing MetricCardShell still renders the gradient wrapper, so the new style assertions don't match.

- [ ] **Step 3: Refactor MetricCardShell source**

Edit `packages/officials-ui/src/cards/MetricCardShell.tsx`. Replace the ENTIRE file content with:

```tsx
import { Linking, Pressable, Text, View, type ReactNode } from 'react-native'
import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useBrandTokens,
  useCategoryAccent,
  useCategoryCardBg,
} from '../brand-hooks.ts'

interface BaseProps {
  value: ReactNode
  label: string
  caption?: ReactNode
  categoryId: CategoryId
  placeholder?: boolean
  unavailable?: boolean
}

type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }
  | { onExpand?: never; externalSourceUrl?: never }

export type MetricCardShellProps = BaseProps & DrillDown

export function MetricCardShell(props: MetricCardShellProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { value, label, caption, categoryId, placeholder = false, unavailable = false } = props
  const categoryAccent = useCategoryAccent(categoryId)
  const cardBg = useCategoryCardBg()
  const isLive = !placeholder && !unavailable
  // Live variant: full 3px top stripe in category accent.
  // Placeholder/unavailable: no stripe (1px top border matches the other borders)
  // so the card reads as "no data" rather than "active category card."
  const dotColor = unavailable ? semantic.text.muted : categoryAccent
  const renderedLabel = unavailable ? 'Unavailable' : label

  const valueStyle = {
    fontSize: 22,
    fontWeight: '700' as const,
    color: unavailable || placeholder ? semantic.text.muted : semantic.text.primary,
    fontStyle: unavailable || placeholder ? ('italic' as const) : ('normal' as const),
  }
  const labelStyle = {
    fontSize: 13,
    marginTop: 8,
    color: unavailable || placeholder ? semantic.text.muted : semantic.text.primary,
  }
  const captionStyle = {
    fontSize: 11,
    marginTop: 2,
    color: semantic.text.muted,
    fontStyle: unavailable || placeholder ? ('italic' as const) : ('normal' as const),
  }

  let cta: ReactNode = null
  if (isLive) {
    if ('onExpand' in props && typeof props.onExpand === 'function') {
      const onExpand = props.onExpand
      cta = (
        <Pressable onPress={onExpand} accessibilityLabel={`Expand evidence for ${label}`}>
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              color: semantic.link.fg,
              textDecorationLine: 'underline',
            }}
          >
            view evidence →
          </Text>
        </Pressable>
      )
    } else if ('externalSourceUrl' in props && typeof props.externalSourceUrl === 'string') {
      const url = props.externalSourceUrl
      cta = (
        <Pressable onPress={() => Linking.openURL(url).catch(() => {})}>
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              color: semantic.link.fg,
              textDecorationLine: 'underline',
            }}
          >
            view source →
          </Text>
        </Pressable>
      )
    }
  }

  // Live variant: 3px top stripe in category accent + universal card bg.
  // Placeholder/unavailable: 1px top border + subtle bg.
  const cardStyle = isLive
    ? {
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderTopWidth: 3,
        borderTopColor: categoryAccent,
        borderRadius: 6,
        padding: 12,
      }
    : {
        backgroundColor: semantic.bg.subtle,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderRadius: 6,
        padding: 12,
      }

  return (
    <View
      accessibilityLabel={`${renderedLabel}: ${typeof value === 'string' ? value : ''}`}
      style={cardStyle}
    >
      <Text style={valueStyle}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: dotColor,
            marginRight: 6,
          }}
          testID="category-dot"
        />
        <Text style={labelStyle}>{renderedLabel}</Text>
      </View>
      {caption ? <Text style={captionStyle}>{caption}</Text> : null}
      {cta}
    </View>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- MetricCardShell`
Expected: PASS — slice 43 stripe assertions pass; existing tests for placeholder/unavailable suppression + value rendering still pass.

- [ ] **Step 5: Run full officials-ui suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — should stay at 460 tests (1 test renamed in place; net 0).

- [ ] **Step 6: Run typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/cards/MetricCardShell.tsx packages/officials-ui/test/cards/MetricCardShell.test.tsx
git commit -m "refactor(officials-ui): MetricCardShell stripe pattern (slice 43 task 3)

Drop Pattern B createElement gradient wrapper. Live variant renders
3px top stripe in useCategoryAccent(categoryId) over the universal
useCategoryCardBg(). Placeholder/unavailable variants stay 1px
bordered with semantic.bg.subtle so they read as no-data.

Removes the slice 41 createElement web/native split; same View renders
on both platforms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Refactor FinanceSummaryStrip to stripe pattern

**Files:**
- Modify: `packages/officials-ui/src/finance/FinanceSummaryStrip.tsx`
- Modify: `packages/officials-ui/test/finance/FinanceSummaryStrip.test.tsx`

Same refactor — drop Pattern B, add 3px finance-emerald top stripe + universal bg. `useFinanceCardBg()` consumer goes away.

- [ ] **Step 1: Update test assertion (TDD)**

Edit `packages/officials-ui/test/finance/FinanceSummaryStrip.test.tsx`. Find the test `it('applies the finance category gradient on web', ...)` (currently at lines 35-44). Replace with:

```tsx
  it('applies the universal card bg + finance 3px top stripe (slice 43)', () => {
    const { container } = render(
      <FinanceSummaryStrip cycle="2024" totalRaised={1_000_000} smallDonorPct={28} pacPct={5} />,
    )
    // Outer wrapper is the View itself (no createElement div wrapper post-slice-43).
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    expect(style).toMatch(/background-color:\s*rgb\(255,\s*250,\s*242\)/)  // #fffaf2
    expect(style).toMatch(/border-top-color:\s*rgb\(26,\s*143,\s*90\)/)    // CATEGORY_ACCENT.finance #1a8f5a
    expect(style).toMatch(/border-top-width:\s*3px/)
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- FinanceSummaryStrip`
Expected: FAIL — the existing component still uses Pattern B createElement wrapper.

- [ ] **Step 3: Refactor FinanceSummaryStrip source**

Edit `packages/officials-ui/src/finance/FinanceSummaryStrip.tsx`. Replace the ENTIRE file content with:

```tsx
import { Text, View } from 'react-native'
import { CATEGORY_ACCENT } from '@chiaro/ui-tokens'
import { useBrandTokens, useCategoryAccent, useCategoryCardBg } from '../brand-hooks.ts'

export interface FinanceSummaryStripProps {
  cycle: string
  totalRaised: number | null
  smallDonorPct: number | null
  pacPct: number | null
}

function formatMoney(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function formatPct(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

function Cell({
  label,
  value,
  headline,
}: { label: string; value: string; headline?: boolean }): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dotColor = semantic.signal.success
  return (
    <View style={{ flex: headline ? 1.3 : 1, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor, marginRight: 5 }} />
        <Text
          style={{
            fontSize: 11,
            color: semantic.text.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: headline ? 22 : 18,
          fontWeight: headline ? '800' : '700',
          color: semantic.text.primary,
          marginTop: 6,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

export function FinanceSummaryStrip({
  cycle,
  totalRaised,
  smallDonorPct,
  pacPct,
}: FinanceSummaryStripProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const cardBg = useCategoryCardBg()
  const financeAccent = useCategoryAccent('finance')
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderTopWidth: 3,
        borderTopColor: financeAccent,
        borderRadius: 6,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <Cell label={`Total Raised, ${cycle}`} value={formatMoney(totalRaised)} headline />
      <View style={{ width: 1, backgroundColor: semantic.border.default }} />
      <Cell label="Small-donor %" value={formatPct(smallDonorPct)} />
      <View style={{ width: 1, backgroundColor: semantic.border.default }} />
      <Cell label="PAC %" value={pacPct == null ? '—' : `${pacPct.toFixed(1)}%`} />
    </View>
  )
}
```

Note: removed unused imports (`createElement`, `Platform`, `CATEGORY_CARD_GRADIENT`, `useFinanceCardBg`). Added `CATEGORY_ACCENT` for the type-check completeness — but actually we only use `useCategoryAccent('finance')` so `CATEGORY_ACCENT` import is unused. Remove the `CATEGORY_ACCENT` import line; final imports are just `Text`, `View`, `useBrandTokens`, `useCategoryAccent`, `useCategoryCardBg`.

Corrected file content (delete the `import { CATEGORY_ACCENT } from '@chiaro/ui-tokens'` line):

```tsx
import { Text, View } from 'react-native'
import { useBrandTokens, useCategoryAccent, useCategoryCardBg } from '../brand-hooks.ts'

// ... rest as above
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- FinanceSummaryStrip`
Expected: PASS — slice 43 stripe assertions pass; existing render/format/mode-aware tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/finance/FinanceSummaryStrip.tsx packages/officials-ui/test/finance/FinanceSummaryStrip.test.tsx
git commit -m "refactor(officials-ui): FinanceSummaryStrip stripe pattern (slice 43 task 4)

Drop Pattern B createElement gradient wrapper. Single View with 3px
finance-emerald top stripe + universal slice 43 cardBg. Drops
useFinanceCardBg consumer; the slice 37 abstraction collapses into
the universal hook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Refactor TopAmountBreakdown to stripe pattern

**Files:**
- Modify: `packages/officials-ui/src/finance/TopAmountBreakdown.tsx`
- Modify: `packages/officials-ui/test/finance/TopAmountBreakdown.test.tsx`

Same refactor pattern.

- [ ] **Step 1: Update test assertion (TDD)**

Edit `packages/officials-ui/test/finance/TopAmountBreakdown.test.tsx`. Find the test `it('applies the finance category gradient on web', ...)` (currently at lines 111-118). Replace with:

```tsx
  it('applies the universal card bg + finance 3px top stripe (slice 43)', () => {
    const { container } = render(<TopAmountBreakdown rows={TEN} noun={NOUN_INDUSTRY} />)
    // Outer wrapper is the View itself (no createElement div wrapper post-slice-43).
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    expect(style).toMatch(/background-color:\s*rgb\(255,\s*250,\s*242\)/)  // #fffaf2
    expect(style).toMatch(/border-top-color:\s*rgb\(26,\s*143,\s*90\)/)    // CATEGORY_ACCENT.finance #1a8f5a
    expect(style).toMatch(/border-top-width:\s*3px/)
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- TopAmountBreakdown`
Expected: FAIL — the existing component still uses Pattern B createElement wrapper.

- [ ] **Step 3: Refactor TopAmountBreakdown source**

Edit `packages/officials-ui/src/finance/TopAmountBreakdown.tsx`. Make these changes:

(a) Update imports — remove `Platform` from `react-native` import; remove `CATEGORY_CARD_GRADIENT` import; replace `useFinanceCardBg` with `useCategoryAccent, useCategoryCardBg`:

```tsx
import { createElement, useState } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { useBrandTokens, useCategoryAccent, useCategoryCardBg } from '../brand-hooks.ts'
import { PillChevron } from '../cards/PillChevron.tsx'
```

(b) Replace the function body's bg setup. Find these lines (currently lines 36-50):

```tsx
  const { semantic } = useBrandTokens()
  const cardBg = useFinanceCardBg()
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map(r => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  // Pattern B (see MetricCardShell): on web, paint the finance category
  // gradient via a raw <div> wrapper using CSS `background` (RNW strips
  // `linear-gradient(...)` from `backgroundColor`). Inner View is
  // transparent so the gradient shows through. Native paints the solid
  // top stop directly.
  const useWebGradient = Platform.OS === 'web'
  const innerBg = useWebGradient ? 'transparent' : cardBg

  const inner = (
```

Replace with:

```tsx
  const { semantic } = useBrandTokens()
  const cardBg = useCategoryCardBg()
  const financeAccent = useCategoryAccent('finance')
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map(r => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  return (
```

(c) Update the outer View style. Find this (currently lines 53-61):

```tsx
    <View
      style={{
        backgroundColor: innerBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderRadius: 6,
        padding: 14,
      }}
    >
```

Replace with:

```tsx
    <View
      style={{
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderTopWidth: 3,
        borderTopColor: financeAccent,
        borderRadius: 6,
        padding: 14,
      }}
    >
```

(d) Find the `const inner = ...` opening `<View ...>` and matching closing `</View>` block — and the trailing `if (useWebGradient) { return createElement('div', ...) } return inner` epilogue (currently lines 165-178). Replace the epilogue:

```tsx
  )

  if (useWebGradient) {
    return createElement(
      'div',
      {
        style: {
          background: CATEGORY_CARD_GRADIENT.finance,
          borderRadius: 6,
        },
      },
      inner,
    )
  }

  return inner
}
```

Replace with:

```tsx
  )
}
```

And drop the `const inner = (` wrapper — the `<View ...>` becomes the direct return. Practically: change `const inner = (` to `return (` and delete the `if (useWebGradient) {...}` block + the bare `return inner` line + `}` closing.

Final structure of the function body:

```tsx
export function TopAmountBreakdown({ ... }: ...): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const cardBg = useCategoryCardBg()
  const financeAccent = useCategoryAccent('finance')
  const [expanded, setExpanded] = useState(false)
  // ... (existing total/max/visible/showToggle)

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderTopWidth: 3,
        borderTopColor: financeAccent,
        borderRadius: 6,
        padding: 14,
      }}
    >
      <View style={{ gap: 10 }}>
        {visible.map(...)}
      </View>
      {showToggle ? (...) : null}
      {sourceUrl ? (...) : null}
    </View>
  )
}
```

`createElement` is still imported (used for the `<a>` smart-anchor on web for sourceUrl); don't remove that import.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- TopAmountBreakdown`
Expected: PASS — slice 43 stripe assertions pass; existing 5-row default + 10-row expand + accessibility + smart-anchor tests still pass.

- [ ] **Step 5: Run full officials-ui suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — 460 tests stay green.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/finance/TopAmountBreakdown.tsx packages/officials-ui/test/finance/TopAmountBreakdown.test.tsx
git commit -m "refactor(officials-ui): TopAmountBreakdown stripe pattern (slice 43 task 5)

Drop Pattern B createElement gradient wrapper. Single View with 3px
finance-emerald top stripe + universal slice 43 cardBg. Drops
useFinanceCardBg consumer + CATEGORY_CARD_GRADIENT import. createElement
import preserved (used for the smart-anchor sourceUrl <a> on web).

After Task 5, all 3 finance/card components use the stripe pattern.
Task 6 can now delete the 3 deprecated hooks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Delete deprecated hooks

**Files:**
- Modify: `packages/officials-ui/src/brand-hooks.ts`
- Modify: `packages/officials-ui/test/brand-hooks.test.tsx`

After Tasks 3-5, no consumer reads `useCategoryCardGradient`, `useCategoryCardBgSolid`, or `useFinanceCardBg`. Delete them + their tests.

- [ ] **Step 1: Verify no remaining consumers**

Run: `grep -rn "useCategoryCardGradient\|useCategoryCardBgSolid\|useFinanceCardBg" packages/`
Expected: zero matches in `src/` or `apps/` outside the 2 files about to be edited (hook def + test). If matches exist, STOP — Task 3/4/5 missed a consumer.

- [ ] **Step 2: Delete hook source**

Edit `packages/officials-ui/src/brand-hooks.ts`. Make these deletions:

(a) Remove from the `@chiaro/ui-tokens` import block: `CATEGORY_CARD_BG_SOLID`, `CATEGORY_CARD_BG_SOLID_DARK`, `CATEGORY_CARD_GRADIENT`, `CATEGORY_CARD_GRADIENT_DARK`, `FINANCE_CARD_BG`, `FINANCE_CARD_BG_DARK`. Leave the slice 43 `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK` imports.

(b) Delete 3 hook function declarations and their JSDoc blocks:

```ts
/**
 * Returns the CSS `linear-gradient(...)` string for a category card in the
 * active mode. Web-only consumer; native uses {@link useCategoryCardBgSolid}.
 */
export function useCategoryCardGradient(categoryId: CategoryId): string { ... }
```

```ts
/**
 * Returns the solid per-category card background color for the active mode.
 * Native uses this directly (RN lacks a built-in linear-gradient primitive).
 */
export function useCategoryCardBgSolid(categoryId: CategoryId): string { ... }
```

```ts
/**
 * Returns the finance-card background color for the active brand mode.
 */
export function useFinanceCardBg(): string { ... }
```

- [ ] **Step 3: Delete hook tests**

Edit `packages/officials-ui/test/brand-hooks.test.tsx`. Delete 3 describe blocks:

(a) `describe('useCategoryCardGradient', ...)` block (and its 2 it-cases)
(b) `describe('useCategoryCardBgSolid', ...)` block (and its 2 it-cases)
(c) `describe('useFinanceCardBg', ...)` block (and its 2 it-cases)

Also clean up the imports:
- Remove `CATEGORY_CARD_BG_SOLID`, `CATEGORY_CARD_BG_SOLID_DARK`, `CATEGORY_CARD_GRADIENT`, `CATEGORY_CARD_GRADIENT_DARK`, `FINANCE_CARD_BG`, `FINANCE_CARD_BG_DARK` from the `@chiaro/ui-tokens` import block (these were used by the deleted tests' assertions)
- Remove `useCategoryCardBgSolid`, `useCategoryCardGradient`, `useFinanceCardBg` from the `../src/brand-hooks.ts` import block

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- brand-hooks`
Expected: PASS — remaining tests stay green. (3 describe blocks removed → ~6 it-cases dropped; `useCategoryCardBg` slice 43 describe added in Task 2.)

- [ ] **Step 5: Run typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/brand-hooks.ts packages/officials-ui/test/brand-hooks.test.tsx
git commit -m "refactor(officials-ui): delete deprecated category hooks (slice 43 task 6)

Drops useCategoryCardGradient + useCategoryCardBgSolid + useFinanceCardBg.
Tasks 3-5 migrated all 3 finance/card components to useCategoryCardBg
(slice 43 universal hook); these 3 hooks have zero consumers. Test
describe blocks dropped (-6 it-cases). Imports cleaned.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Delete deprecated tokens

**Files:**
- Modify: `packages/ui-tokens/src/category.ts`
- Modify: `packages/ui-tokens/src/finance.ts`
- Modify: `packages/ui-tokens/src/index.ts`
- Modify: `packages/ui-tokens/test/category.test.ts`
- Modify: `packages/ui-tokens/test/domain-palette-dark.test.ts`

After Task 6, no hook reads `CATEGORY_CARD_GRADIENT*`, `CATEGORY_CARD_BG_SOLID*`, or `FINANCE_CARD_BG*`. Delete them.

- [ ] **Step 1: Verify no remaining src consumers**

Run: `grep -rn "CATEGORY_CARD_GRADIENT\|CATEGORY_CARD_BG_SOLID\|FINANCE_CARD_BG" packages/ apps/`
Expected: matches ONLY in:
- `packages/ui-tokens/src/category.ts` (about to be edited)
- `packages/ui-tokens/src/finance.ts` (about to be edited)
- `packages/ui-tokens/src/index.ts` (about to be edited)
- `packages/ui-tokens/test/category.test.ts` (about to be edited)
- `packages/ui-tokens/test/domain-palette-dark.test.ts` (about to be edited)

If matches exist elsewhere (e.g. in apps/ or in another test file), STOP and report.

- [ ] **Step 2: Delete from category.ts**

Edit `packages/ui-tokens/src/category.ts`. Delete 4 export blocks (with their preceding comments):

(a) `export const CATEGORY_CARD_GRADIENT: Record<CategoryId, string> = { ... }` (slice 41 block with 6 light gradient strings)
(b) `export const CATEGORY_CARD_BG_SOLID: Record<CategoryId, string> = { ... }` (slice 41 block with 6 light hexes)
(c) `export const CATEGORY_CARD_GRADIENT_DARK: Record<CategoryId, string> = { ... }` (slice 41 block with 6 dark gradient strings)
(d) `export const CATEGORY_CARD_BG_SOLID_DARK: Record<CategoryId, string> = { ... }` (slice 41 block with 6 dark hexes)

Keep: `CategoryId` type, `CATEGORY_LABEL`, `CATEGORY_ACCENT`, `CATEGORY_ACCENT_DARK`, `SUB_CASCADE_ACCENT`, `SUB_CASCADE_ACCENT_DARK`, `CATEGORY_CARD_BG`, `CATEGORY_CARD_BG_DARK`.

- [ ] **Step 3: Delete from finance.ts**

Edit `packages/ui-tokens/src/finance.ts`. Delete:

```ts
// Slice 37: finance card background (mint-tinted). Light variant is the
// gradient top stop already used by the finance card; dark variant is the
// deeper warm-green equivalent matching CATEGORY_CARD_BG_SOLID_DARK.finance.
export const FINANCE_CARD_BG = '#f4faf6'
export const FINANCE_CARD_BG_DARK = '#1a2820'
```

Keep: `INDUSTRY_COLOR`, `INDUSTRY_DEFAULT_COLOR`, `INDUSTRY_COLOR_DARK`, `INDUSTRY_DEFAULT_COLOR_DARK`.

- [ ] **Step 4: Update barrel export**

Edit `packages/ui-tokens/src/index.ts`. Make these changes:

(a) In the `finance.ts` export block (currently lines 16-23), remove `FINANCE_CARD_BG` + `FINANCE_CARD_BG_DARK`:

```ts
export {
  INDUSTRY_COLOR,
  INDUSTRY_COLOR_DARK,
  INDUSTRY_DEFAULT_COLOR,
  INDUSTRY_DEFAULT_COLOR_DARK,
} from './finance.ts'
```

(b) In the `category.ts` export block (added in Task 1), remove `CATEGORY_CARD_GRADIENT`, `CATEGORY_CARD_GRADIENT_DARK`, `CATEGORY_CARD_BG_SOLID`, `CATEGORY_CARD_BG_SOLID_DARK`:

```ts
export {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BG_DARK,
  SUB_CASCADE_ACCENT,
  SUB_CASCADE_ACCENT_DARK,
} from './category.ts'
```

- [ ] **Step 5: Update category.test.ts**

Edit `packages/ui-tokens/test/category.test.ts`. Make these changes:

(a) Remove `CATEGORY_CARD_BG_SOLID`, `CATEGORY_CARD_BG_SOLID_DARK`, `CATEGORY_CARD_GRADIENT`, `CATEGORY_CARD_GRADIENT_DARK` from the imports block (Task 1 left them in for coexistence).

(b) Delete the following describe blocks if they exist (slice 41 / slice 43 task 1 left them in for coexistence; they reference now-deleted exports):
- `describe('CATEGORY_CARD_GRADIENT', ...)` (any slice variant)
- `describe('CATEGORY_CARD_GRADIENT_DARK', ...)` (any slice variant)
- `describe('CATEGORY_CARD_BG_SOLID', ...)` (any slice variant)
- `describe('CATEGORY_CARD_BG_SOLID_DARK', ...)` (any slice variant)

Keep: `CategoryId enum + CATEGORY_LABEL ordering`, `CATEGORY_ACCENT` blocks (light + dark), `SUB_CASCADE_ACCENT` blocks (light + dark), `CATEGORY_CARD_BG` blocks (slice 43, added in Task 1).

- [ ] **Step 6: Update domain-palette-dark.test.ts**

Edit `packages/ui-tokens/test/domain-palette-dark.test.ts`. Make these changes:

(a) Remove from imports:
- `CATEGORY_CARD_GRADIENT, CATEGORY_CARD_GRADIENT_DARK` (deleted in Step 2)
- `CATEGORY_CARD_BG_SOLID, CATEGORY_CARD_BG_SOLID_DARK` (deleted in Step 2)
- `FINANCE_CARD_BG, FINANCE_CARD_BG_DARK` (deleted in Step 3)

(b) Delete 3 it-cases:
- `it('CATEGORY_CARD_GRADIENT key parity', ...)` (lines 41-44)
- `it('CATEGORY_CARD_BG_SOLID has 6 categories in both modes', ...)` (lines 46-50)
- `it('FINANCE_CARD_BG known values', ...)` (lines 70-73)
- `it('CATEGORY_CARD_BG_SOLID light values match expected', ...)` (lines 85-88)

Keep: everything else (PARTY, ALIGNMENT_CHIP, SCORECARD_LEAN, CATEGORY_ACCENT, SUB_CASCADE_ACCENT, INDUSTRY, FINANCE_SUB_SECTION_SHADES, MAP_COLORS).

- [ ] **Step 7: Run all ui-tokens tests**

Run: `pnpm --filter @chiaro/ui-tokens test`
Expected: PASS — should drop from ~166 to ~158 (8 token-test deletions: 2 CATEGORY_CARD_BG_SOLID + 2 CATEGORY_CARD_GRADIENT + 2 FINANCE_CARD_BG + 2 domain-palette-dark it-cases). Plus +2 from Task 1 already (CATEGORY_CARD_BG light + dark) — net ~-6 from pre-slice-43 baseline.

- [ ] **Step 8: Run workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 9: Run full officials-ui suite as integration check**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — 460 tests stay green.

- [ ] **Step 10: Commit**

```bash
git add packages/ui-tokens/src/category.ts packages/ui-tokens/src/finance.ts packages/ui-tokens/src/index.ts packages/ui-tokens/test/category.test.ts packages/ui-tokens/test/domain-palette-dark.test.ts
git commit -m "refactor(ui-tokens): delete deprecated category bg tokens (slice 43 task 7)

Drops CATEGORY_CARD_GRADIENT + CATEGORY_CARD_GRADIENT_DARK +
CATEGORY_CARD_BG_SOLID + CATEGORY_CARD_BG_SOLID_DARK from category.ts.
Drops FINANCE_CARD_BG + FINANCE_CARD_BG_DARK from finance.ts (slice 37
abstraction collapsed). Barrel index.ts cleaned. 8 token test
deletions across category.test.ts + domain-palette-dark.test.ts.

After Task 7, the universal CATEGORY_CARD_BG + CATEGORY_CARD_BG_DARK
+ useCategoryCardBg() are the only category-card-bg surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Brand docs

**Files:**
- Modify: `docs/brand-book.md`
- Modify: `docs/brand-migration.md`

Rewrite §11 in brand-book.md to remove the slice 41 gradient + per-category bg references; add the slice 43 stripe pattern. Append slice 43 entry to brand-migration.md.

- [ ] **Step 1: Read brand-book.md §11**

Read `docs/brand-book.md` and locate §11 "Category palette (slice 41)". The section currently lists:
- Light card bg per category (6 hexes)
- Dark card bg per category (6 hexes)
- Cross-component consumption notes

- [ ] **Step 2: Rewrite §11 in brand-book.md**

Replace the entire §11 content with:

```markdown
## 11. Category palette (slice 41 + 43)

Each category card identifies a card-section on the federal + state officials detail pages. Slice 41 (2026-05-27) locked the 6 accent colors. Slice 43 (2026-05-29) replaced the per-category gradient + bg pattern with a **universal neutral card bg + 3px top stripe in the category accent**.

### Universal card surface

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `CATEGORY_CARD_BG` | `#fffaf2` | `#2a2e34` | Single bg for all 6 category cards |

The light value sits visibly above the page bg `#efece5`; the dark value sits above the slice 40 `surface.elevated` `#262a30`. Both are mode-aware via `useCategoryCardBg()` in `@chiaro/officials-ui`.

### Top stripe

Every card renders a 3px `borderTopWidth` in its category accent (consumed via `useCategoryAccent(id)`):

| Category | Stripe color |
|---|---|
| Service Record | `#c89a4e` (gold) |
| Community Presence | `#b86340` (terracotta) |
| Finance | `#1a8f5a` (emerald) |
| Issue Positions | `#3b6ed1` (blue) |
| Ethics & Accountability | `#8a3a4d` (burgundy) |
| Voting & Bills | `#7d57c1` (purple) |

### What slice 43 dropped

- `CATEGORY_CARD_GRADIENT` + `_DARK` (12 gradient strings deleted)
- `CATEGORY_CARD_BG_SOLID` + `_DARK` (12 per-category hexes deleted)
- `FINANCE_CARD_BG` + `_DARK` (slice 37 abstraction collapsed; orphan exports)
- 3 hooks (`useCategoryCardGradient`, `useCategoryCardBgSolid`, `useFinanceCardBg`)
- The Pattern B createElement gradient escape hatch (CLAUDE.md Gotcha #19f) for category cards. The escape hatch stays alive for `BioPortrait` (separate concept).

### Placeholder + unavailable variants

Cards in placeholder or unavailable state render without the 3px stripe (1px top border matches the other borders + `semantic.bg.subtle` bg) so they read as "no data" rather than "active category card."
```

- [ ] **Step 3: Append slice 43 entry to brand-migration.md**

Append this at the end of `docs/brand-migration.md`:

```markdown

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
```

- [ ] **Step 4: Commit**

```bash
git add docs/brand-book.md docs/brand-migration.md
git commit -m "docs(slice-43): brand-book §11 rewrite + migration entry

Task 8. §11 in brand-book.md now reflects the slice 43 universal
bg + stripe pattern. brand-migration.md gains a slice 43 entry
covering: 2 new tokens, 1 new hook, 6 deleted tokens, 3 deleted
hooks, 3 component refactors, placeholder/unavailable variant
preservation, and a pointer to the finance-green audit explaining
why signal.success stayed status quo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final verification + CLAUDE.md + mobile DoD closeout

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 1: Run full workspace typecheck + tests**

Run: `pnpm -r typecheck`
Expected: PASS across all 11 projects.

Run: `pnpm --filter @chiaro/ui-tokens test && pnpm --filter @chiaro/officials-ui test`
Expected: ui-tokens ~158/158 PASS, officials-ui 460/460 PASS.

- [ ] **Step 2: Run web build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Capture `/officials/[id]` First Load JS size — expected to be slightly smaller (~2-5 kB) due to deleted gradient strings + dropped createElement wrappers in 3 components.

- [ ] **Step 3: Update CLAUDE.md (slice entry + Gotcha #19f narrowing)**

Open `CLAUDE.md`. Find the "Slices delivered" section. Find the slice 42 entry. After the LAST slice 42 entry, BEFORE the line that starts `Specs live in...`, APPEND this new entry as a single bullet line:

```markdown
- **Slice 43 — Category card bg stripe cascade** (2026-05-29): Mega Slice (~17 files). Replaces the slice 41 per-category gradient + bg pattern (24 hexes across `CATEGORY_CARD_GRADIENT*` + `CATEGORY_CARD_BG_SOLID*` plus slice 37 `FINANCE_CARD_BG*`) with a **universal neutral card bg** (`CATEGORY_CARD_BG` `#fffaf2` light / `#2a2e34` dark; V2b medium-pop elevation above page bg in both modes) + **3px top stripe** consuming the existing `useCategoryAccent(id)` (slice 41 unchanged). 6 categories cascade. **Drops Pattern B createElement gradient escape hatch** (Gotcha #19f) in `MetricCardShell` + `FinanceSummaryStrip` + `TopAmountBreakdown` — same `<View>` renders on web and native; no Platform.OS branch needed for category cards. **Placeholder/unavailable variants** in `MetricCardShell` render without the stripe (1px top border + `semantic.bg.subtle`) so they read as "no data". **Deleted tokens**: 4 per-category maps + 2 finance card bg scalars (6 exports). **Deleted hooks**: `useCategoryCardGradient` + `useCategoryCardBgSolid` + `useFinanceCardBg` (3 hooks). **Added**: `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK` (2 scalars) + `useCategoryCardBg()` (1 hook). `signal.success` untouched per the slice 43 prep audit at `docs/superpowers/audits/2026-05-29-finance-green-overlap.md` (user picked Option D status quo). Closes reskin roadmap #6 in a different direction than originally framed (drops gradient pattern entirely instead of retuning dark variants). Decided across 5 visual companion screens. Test delta: ui-tokens ~166→158, officials-ui 460→460. No schema work; pgTAP unchanged at 428. Bundle: `/officials/[id]` slightly smaller (gradient strings + createElement wrappers deleted).
```

- [ ] **Step 4: Update CLAUDE.md Gotcha #19f**

Find Gotcha #19f in CLAUDE.md (look for the text `RNW StyleSheet normalizer strips CSS \`linear-gradient(...)\` strings`). Append this note at the end of that gotcha:

```markdown
**Slice 43 update (2026-05-29):** Category cards (`MetricCardShell`, `FinanceSummaryStrip`, `TopAmountBreakdown`) no longer use this pattern — they switched to a 3px top stripe (`borderTopWidth: 3`, `borderTopColor: categoryAccent`) over the universal `CATEGORY_CARD_BG`. The Pattern B escape hatch survives in `BioPortrait` (slice 40, mode-aware portrait gradient) but is no longer in scope for category surfaces.
```

- [ ] **Step 5: Append slice 43 section to mobile DoD checklist**

Open `docs/superpowers/mobile-dod-checklist.md`. Find the slice 42 section. Append this section AFTER the slice 42 section, BEFORE the "After the run" footer (mirror the slice 41/42 placement pattern):

```markdown

## Slice 43 — Category card bg stripe cascade

- [ ] All 6 category cards on `/officials/[id]` (mobile) show a neutral cream-tinted bg + 3px top stripe in their category accent: Service Record gold, Community Presence terracotta, Finance emerald, Issue Positions blue, Ethics burgundy, Voting Bills purple.
- [ ] In dark mode, all 6 cards show the cool slate `#2a2e34` bg + same stripe accents — cards sit visibly above the cool-slate page bg.
- [ ] FinanceSummaryStrip renders the universal card bg + emerald top stripe; small-donor / PAC% / total-raised dots still visible.
- [ ] TopAmountBreakdown progress bars still render `signal.success` green fills (not changed by slice 43).
- [ ] Placeholder + unavailable MetricCardShell variants render WITHOUT a top stripe (1px border + subtle bg) — read as "no data" rather than as active category cards.
- [ ] `/state-officials/[id]` cards mirror the federal pattern (same 6 stripes + universal bg).
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-43): record slice 43 closeout + Gotcha #19f narrowing

Task 9. CLAUDE.md gets the slice 43 Slices delivered entry covering
the cascade (universal bg + stripe pattern, drops 3 Pattern B
consumers, deletes 6 tokens + 3 hooks). Gotcha #19f gains a slice 43
note documenting the scope narrowing -- BioPortrait remains the only
consumer of the createElement gradient escape hatch. Mobile DoD
checklist gains slice 43 smoke section with 6 verification checkboxes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Final summary to user**

Report:
- 9 task commits + 1 spec commit + 1 audit commit = 11 total on `slice-43-card-bg-stripe-cascade`.
- 17 files modified.
- ui-tokens ~158/158 + officials-ui 460/460 tests green.
- Workspace typecheck + web build green.
- Bundle: `/officials/[id]` slightly smaller (deleted gradient strings + createElement wrappers).
- Mobile smoke deferred per slice 38-42 pattern.
- Ready to merge.

---

## Self-review notes

**Spec coverage:**
- §1 goal (universal bg + stripe + Pattern B drop + visible elevation): Tasks 1-7. ✅
- §2 non-goals (no signal.success change, no other category tokens touched, BioPortrait preserved, semantic.bg.card preserved): all preserved by the additive-then-delete ordering. ✅
- §4 locked decisions (`#fffaf2` + `#2a2e34` + 6 stripe colors + deletions list): Task 1 + 2 + 3-5 + 6 + 7. ✅
- §5.1-5.7 file plan (17 files): Tasks 1-9 cover all 17. ✅
- §7.1 test regex updates: Task 3 + 4 + 5 each include the regex replacement. ✅
- §7.2 useFinanceCardBg retirement: Task 6 deletes hook; Task 7 deletes tokens. ✅
- §7.3 visual regression risk: deferred to operator post-merge per task 9 step 7. ✅
- §7.4 placeholder/unavailable distinction: Task 3 source explicitly handles both variants. ✅
- §7.5 semantic.bg.card untouched: verified by no edits to settings components or brand semantic file. ✅
- §8 testing: each task includes the relevant tests. ✅
- §9 surface: 17 files + test deltas tracked. ✅
- §10 closeout: Task 9 walks all criteria. ✅
- §11 reskin roadmap progress: CLAUDE.md slice 43 entry mentions closing #6 (Task 9 Step 3). ✅

**Placeholder scan:** None. All steps have exact code or commands.

**Type consistency:**
- `useCategoryCardBg()` signature stays identical across Tasks 2 (definition) and 3-5 (consumption).
- `useCategoryAccent(id: CategoryId)` signature unchanged from slice 41; Tasks 3-5 pass `'finance'` literal which matches the `CategoryId` union.
- `CATEGORY_CARD_BG` + `CATEGORY_CARD_BG_DARK` are string scalars (not Records). Tasks 1, 2, 7 all reference them consistently.
- Hex values cross-checked: `#fffaf2` light + `#2a2e34` dark appear in Tasks 1 + 2 + 3 + 4 + 5 + 8 + 9 byte-identical.
- RNW rgb normalizations cross-checked: `#fffaf2` → `rgb(255, 250, 242)`, `#1a8f5a` → `rgb(26, 143, 90)`. Verified.
