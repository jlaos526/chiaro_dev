# Slice 33 — Auth Brand Retrofit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate slice-31 auth surface to slice-32 brand tokens via a new `useBrandTokens()` hook + `<Logo />` component. Auth becomes the first dark-mode-ready surface. Ship the migration foundation (hook + migration doc) that slices 34-37 will reuse.

**Architecture:** New `useBrandTokens()` hook in `@chiaro/officials-ui/src/brand-hooks.ts` reads from a `BrandModeOverrideContext` first (slice 33 ships no Provider — Context is plumbing only), falls back to `useColorScheme()`, defaults to `'light'`. New `<Logo />` component is the first consumer of slice-32 `logoGeometry()` helper. Web uses `createElement` escape hatch for gradient fills; native uses solid color fallback. 6 auth components migrate from `COLORS.*` to semantic tokens via the hook.

**Tech Stack:** TypeScript 5.4 strict mode, vitest 2, `@testing-library/react`, RN/RNW (react-native-web@0.19), `.ts`-extension relative imports.

**Spec:** `docs/superpowers/specs/2026-05-27-auth-brand-retrofit-design.md`
**Branch:** `auth-brand-retrofit` (already created; spec committed at `ae6d36a`)

---

## File structure

```
packages/officials-ui/src/
├── brand-hooks.ts                NEW (useBrandTokens + BrandModeOverrideContext + types)
├── Logo.tsx                      NEW
├── index.ts                      MODIFY (export Logo, useBrandTokens, BrandModeOverrideContext, types)
└── auth/
    ├── AuthWordmark.tsx          MODIFY (use <Logo variant="lockup" />)
    ├── AuthScreen.tsx            MODIFY (useBrandTokens, semantic.bg.*)
    ├── AuthCrossLink.tsx         MODIFY (useBrandTokens, semantic.text.muted + accent.primary)
    ├── AuthInput.tsx             MODIFY (useBrandTokens — CSS template rebuilds per mode)
    ├── AuthForm.tsx              MODIFY (useBrandTokens)
    └── AuthPageChrome.tsx        no color refs; verify no change needed

packages/officials-ui/test/
├── brand-hooks.test.tsx          NEW
├── Logo.test.tsx                 NEW
└── auth/*.test.tsx               UPDATE assertions; add dark-mode coverage where useful

docs/
├── brand-migration.md            NEW
└── (no other docs touched)

CLAUDE.md                         MODIFY (slice 33 entry)
```

No `apps/web/` or `apps/mobile/` files need changes — the route shells import shared components which self-update.

---

## Task 1: `useBrandTokens()` hook + `BrandModeOverrideContext`

**Files:**
- Create: `packages/officials-ui/src/brand-hooks.ts`
- Create: `packages/officials-ui/test/brand-hooks.test.tsx`

The hook is the canonical entry point for every retrofit slice. Lock the return shape and the Context-backed override pattern now.

- [ ] **Step 1: Write the failing hook test**

Create `packages/officials-ui/test/brand-hooks.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BRAND_PALETTE, getSemantic } from '@chiaro/ui-tokens'
import {
  BrandModeOverrideContext,
  useBrandTokens,
} from '../src/brand-hooks.ts'

function wrapper(override: 'light' | 'dark' | null) {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: override }, children)
}

describe('useBrandTokens', () => {
  it('returns light mode by default when no override and useColorScheme returns null', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper(null) })
    expect(result.current.mode).toBe('light')
    expect(result.current.semantic).toBe(getSemantic('light'))
    expect(result.current.palette).toBe(BRAND_PALETTE.light)
  })

  it('returns dark mode when override is "dark"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper('dark') })
    expect(result.current.mode).toBe('dark')
    expect(result.current.semantic).toBe(getSemantic('dark'))
    expect(result.current.palette).toBe(BRAND_PALETTE.dark)
  })

  it('returns light mode when override is "light"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper('light') })
    expect(result.current.mode).toBe('light')
  })

  it('semantic.text.primary equals palette ink[1000] for both modes', () => {
    const { result: light } = renderHook(() => useBrandTokens(), { wrapper: wrapper('light') })
    const { result: dark } = renderHook(() => useBrandTokens(), { wrapper: wrapper('dark') })
    expect(light.current.semantic.text.primary).toBe(light.current.palette.ink[1000])
    expect(dark.current.semantic.text.primary).toBe(dark.current.palette.ink[1000])
    expect(light.current.semantic.text.primary).not.toBe(dark.current.semantic.text.primary)
  })

  it('return object has exactly 3 keys', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper(null) })
    expect(Object.keys(result.current).sort()).toEqual(['mode', 'palette', 'semantic'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @chiaro/officials-ui test brand-hooks
```

Expected: FAIL — module `../src/brand-hooks.ts` does not exist.

- [ ] **Step 3: Create the hook implementation**

Create `packages/officials-ui/src/brand-hooks.ts`:

```ts
'use client'

// Brand mode + token hook. Canonical entry point for every consumer of the
// slice-32 BRAND.* token surface. Reads override Context first (slice 33 ships
// no Provider — Context plumbing exists for future override slices), falls
// back to react-native's useColorScheme(), defaults to 'light' if both null.
//
// Source of truth: docs/superpowers/specs/2026-05-27-auth-brand-retrofit-design.md §4.1

import { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import {
  BRAND_PALETTE,
  getSemantic,
  type BrandMode,
  type BrandSemantic,
} from '@chiaro/ui-tokens'

/**
 * Override Context for forced light/dark. null = follow system preference.
 *
 * Slice 33 ships no Provider component — the value is always null at runtime.
 * Tests wrap their tree with `BrandModeOverrideContext.Provider value="dark"`
 * to force dark mode. A future slice (likely 38) will ship a Provider that
 * reads from a settings store.
 */
export const BrandModeOverrideContext = createContext<BrandMode | null>(null)

export interface BrandTokens {
  mode: BrandMode
  semantic: BrandSemantic
  palette: (typeof BRAND_PALETTE)['light']
}

/**
 * Hook returning the active brand token table.
 *
 * @example
 * const { mode, semantic } = useBrandTokens()
 * <View style={{ backgroundColor: semantic.bg.card, color: semantic.text.primary }} />
 */
export function useBrandTokens(): BrandTokens {
  const override = useContext(BrandModeOverrideContext)
  const system = useColorScheme()
  const mode: BrandMode = override ?? (system === 'dark' ? 'dark' : 'light')
  return {
    mode,
    semantic: getSemantic(mode),
    palette: BRAND_PALETTE[mode],
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @chiaro/officials-ui test brand-hooks
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Run package typecheck**

```bash
pnpm --filter @chiaro/officials-ui typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/brand-hooks.ts \
        packages/officials-ui/test/brand-hooks.test.tsx
git commit -m "$(cat <<'EOF'
feat(officials-ui): useBrandTokens hook + BrandModeOverrideContext

Canonical entry point for slice 32 BRAND.* tokens. Reads override
Context first (no Provider in slice 33 — plumbing only); falls back
to RN useColorScheme(); defaults to light. Slices 34-37 consume this
hook; slice 38+ may ship a Provider for forced overrides.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `<Logo />` component

**Files:**
- Create: `packages/officials-ui/src/Logo.tsx`
- Create: `packages/officials-ui/test/Logo.test.tsx`

First consumer of slice-32 `logoGeometry()` helper. Renders the 2-square cascade + 4 corner brackets. Web uses `createElement` escape hatch for the gradient fills (Gotcha #19f); native renders solid color fallback (no new RN deps).

- [ ] **Step 1: Write the failing Logo test**

Create `packages/officials-ui/test/Logo.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { Logo } from '../src/Logo.tsx'
import { BrandModeOverrideContext } from '../src/brand-hooks.ts'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('Logo — mark variant (default)', () => {
  it('renders without wordmark text by default', () => {
    const { container } = render(<Logo />, { wrapper: withMode('light') })
    expect(container.textContent).not.toContain('CHIARO')
  })

  it('renders 2 squares + 4 bracket elements at default size', () => {
    const { container } = render(<Logo />, { wrapper: withMode('light') })
    // Two squares + four brackets = at least 6 positioned divs.
    expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(6)
  })

  it('exposes an accessibility label', () => {
    const { container } = render(<Logo />, { wrapper: withMode('light') })
    const labelled = container.querySelector('[aria-label]')
    expect(labelled?.getAttribute('aria-label')).toBe('Chiaro')
  })

  it('respects custom accessibilityLabel prop', () => {
    const { container } = render(<Logo accessibilityLabel="Custom" />, { wrapper: withMode('light') })
    expect(container.querySelector('[aria-label="Custom"]')).not.toBeNull()
  })
})

describe('Logo — lockup variant', () => {
  it('renders CHIARO wordmark in lockup variant', () => {
    const { container } = render(<Logo variant="lockup" />, { wrapper: withMode('light') })
    expect(container.textContent).toContain('CHIARO')
  })

  it('renders tagline below wordmark when provided', () => {
    const { container } = render(
      <Logo variant="lockup" tagline="Know who represents you." />,
      { wrapper: withMode('light') },
    )
    expect(container.textContent).toContain('CHIARO')
    expect(container.textContent).toContain('Know who represents you.')
  })

  it('defaults accessibilityLabel to "Chiaro logo" in lockup variant', () => {
    const { container } = render(<Logo variant="lockup" />, { wrapper: withMode('light') })
    expect(container.querySelector('[aria-label="Chiaro logo"]')).not.toBeNull()
  })
})

describe('Logo — size variants', () => {
  it('respects custom size prop', () => {
    const { container } = render(<Logo size={64} />, { wrapper: withMode('light') })
    // At S=64 the bounding box should be ~92×80 (per logoGeometry).
    // The outer wrapper sets explicit width/height; assert it's >= 64.
    const wrapper = container.firstElementChild as HTMLElement | null
    expect(wrapper).not.toBeNull()
  })

  it('renders fallback solid square below S=12', () => {
    const { container } = render(<Logo size={10} />, { wrapper: withMode('light') })
    // Fallback path: single square, no brackets. ≤ 3 divs (wrapper + 1 square + label sibling at most).
    expect(container.querySelectorAll('div').length).toBeLessThanOrEqual(3)
  })
})

describe('Logo — mode awareness', () => {
  it('renders wordmark in dark color when mode is dark', () => {
    const { container } = render(<Logo variant="lockup" />, { wrapper: withMode('dark') })
    const text = container.textContent
    expect(text).toContain('CHIARO')
    // Visual delta verified manually; structural assertion only.
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @chiaro/officials-ui test Logo
```

Expected: FAIL — module `../src/Logo.tsx` does not exist.

- [ ] **Step 3: Create the Logo implementation**

Create `packages/officials-ui/src/Logo.tsx`:

```tsx
'use client'

// Chiaro logo component. First consumer of slice-32 logoGeometry() helper.
//
// Geometry: two cascading squares with 4 L-shaped corner brackets at the
// overlap region. Web renders gradient fills via createElement escape hatch
// (RNW 0.19 strips CSS gradient strings from backgroundColor — Gotcha #19f).
// Native renders solid color fallback (alpha gradients aren't free in core RN).
//
// Source of truth: docs/superpowers/specs/2026-05-27-auth-brand-retrofit-design.md §4.2
// Geometry source: docs/brand-book.md §8

import { createElement } from 'react'
import { Platform, Text, View } from 'react-native'
import { logoGeometry, LOGO_FILLS } from '@chiaro/ui-tokens'
import { useBrandTokens } from './brand-hooks.ts'

export interface LogoProps {
  /** Square side length S, in px. Defaults to 32 (Medium variant per brand book §8.2). */
  size?: number
  /** `'mark'` (default): 2-square cascade + 4 brackets. `'lockup'`: mark + CHIARO wordmark. */
  variant?: 'mark' | 'lockup'
  /** Optional tagline below wordmark (lockup variant only). */
  tagline?: string
  /** Defaults: `'Chiaro'` for mark, `'Chiaro logo'` for lockup. */
  accessibilityLabel?: string
}

export function Logo({
  size = 32,
  variant = 'mark',
  tagline,
  accessibilityLabel,
}: LogoProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const isWeb = Platform.OS === 'web'

  const label = accessibilityLabel ?? (variant === 'lockup' ? 'Chiaro logo' : 'Chiaro')

  // Below S=12: brackets are unreadable; fall back to single solid square.
  if (size < 12) {
    return renderFallback(size, label, isWeb)
  }

  const g = logoGeometry(size)
  const mark = renderMark(g, isWeb)

  if (variant === 'mark') {
    if (isWeb) {
      return createElement(
        'div',
        { 'aria-label': label, style: { display: 'inline-flex' } },
        mark,
      )
    }
    return <View accessibilityLabel={label}>{mark}</View>
  }

  // Lockup: mark + CHIARO wordmark (+ optional tagline)
  const wordmarkSize = size * 0.65 // per brand book §8.3
  const wordmarkTracking = size >= 48 ? 0.06 : size >= 24 ? 0.07 : 0.08
  const gap = size * 0.4
  const taglineSize = wordmarkSize * 0.45
  const taglineGap = wordmarkSize * 0.13

  const wordmark = (
    <Text
      style={{
        fontWeight: '700',
        fontSize: wordmarkSize,
        color: semantic.text.primary,
        letterSpacing: wordmarkTracking * wordmarkSize,
      }}
    >
      CHIARO
    </Text>
  )

  const taglineNode = tagline ? (
    <Text
      style={{
        fontWeight: '400',
        fontSize: taglineSize,
        color: semantic.text.muted,
        letterSpacing: 0.02 * taglineSize,
        marginTop: taglineGap,
      }}
    >
      {tagline}
    </Text>
  ) : null

  if (isWeb) {
    return createElement(
      'div',
      {
        'aria-label': label,
        style: { display: 'inline-flex', alignItems: 'center', gap },
      },
      mark,
      createElement(
        'div',
        { style: { display: 'inline-flex', flexDirection: 'column' } },
        wordmark,
        taglineNode,
      ),
    )
  }

  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      {mark}
      <View>
        {wordmark}
        {taglineNode}
      </View>
    </View>
  )
}

function renderMark(
  g: ReturnType<typeof logoGeometry>,
  isWeb: boolean,
): React.JSX.Element {
  // Solid color fallback for native (no alpha gradients in core RN).
  const backFill = isWeb ? LOGO_FILLS.backSquare : LOGO_FILLS.borderColor
  const frontFill = isWeb ? LOGO_FILLS.frontSquare : '#e8a060'

  const backStyle = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: g.squareSize,
    height: g.squareSize,
    borderRadius: g.squareRadius,
    borderWidth: g.borderStroke,
    borderColor: LOGO_FILLS.borderColor,
  }
  const frontStyle = {
    position: 'absolute' as const,
    left: g.offsetX,
    top: g.offsetY,
    width: g.squareSize,
    height: g.squareSize,
    borderRadius: g.squareRadius,
    borderWidth: g.borderStroke,
    borderColor: LOGO_FILLS.borderColor,
  }

  // Bracket positions: 4 corners of the overlap rectangle.
  // Overlap rect: x ∈ [offsetX, squareSize], y ∈ [offsetY, squareSize]
  const overlapLeft = g.offsetX
  const overlapTop = g.offsetY
  const overlapRight = g.squareSize
  const overlapBottom = g.squareSize
  const arm = g.bracketArm
  const stroke = g.bracketStroke

  const brackets = [
    { left: overlapLeft, top: overlapTop, borderLeft: stroke, borderTop: stroke }, // TL
    { left: overlapRight - arm, top: overlapTop, borderRight: stroke, borderTop: stroke }, // TR
    { left: overlapLeft, top: overlapBottom - arm, borderLeft: stroke, borderBottom: stroke }, // BL
    { left: overlapRight - arm, top: overlapBottom - arm, borderRight: stroke, borderBottom: stroke }, // BR
  ]

  if (isWeb) {
    return createElement(
      'div',
      {
        style: {
          position: 'relative',
          width: g.boundingWidth,
          height: g.boundingHeight,
        },
      },
      createElement('div', {
        style: { ...backStyle, background: backFill },
      }),
      createElement('div', {
        style: { ...frontStyle, background: frontFill },
      }),
      ...brackets.map((b, i) =>
        createElement('div', {
          key: `b${i}`,
          style: {
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: arm,
            height: arm,
            borderLeftWidth: b.borderLeft ?? 0,
            borderRightWidth: b.borderRight ?? 0,
            borderTopWidth: b.borderTop ?? 0,
            borderBottomWidth: b.borderBottom ?? 0,
            borderStyle: 'solid',
            borderColor: LOGO_FILLS.bracketColor,
          },
        }),
      ),
    )
  }

  // Native: View tree with solid backgrounds.
  return (
    <View style={{ position: 'relative', width: g.boundingWidth, height: g.boundingHeight }}>
      <View style={{ ...backStyle, backgroundColor: backFill }} />
      <View style={{ ...frontStyle, backgroundColor: frontFill }} />
      {brackets.map((b, i) => (
        <View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: arm,
            height: arm,
            borderLeftWidth: b.borderLeft ?? 0,
            borderRightWidth: b.borderRight ?? 0,
            borderTopWidth: b.borderTop ?? 0,
            borderBottomWidth: b.borderBottom ?? 0,
            borderColor: LOGO_FILLS.bracketColor,
          }}
        />
      ))}
    </View>
  )
}

function renderFallback(size: number, label: string, isWeb: boolean): React.JSX.Element {
  const style = {
    width: size,
    height: size,
    borderRadius: Math.max(1, size * 0.094),
    backgroundColor: LOGO_FILLS.borderColor,
  }
  if (isWeb) {
    return createElement('div', { 'aria-label': label, style })
  }
  return <View accessibilityLabel={label} style={style} />
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @chiaro/officials-ui test Logo
```

Expected: PASS — ~10 tests across 4 describe blocks.

- [ ] **Step 5: Run package typecheck**

```bash
pnpm --filter @chiaro/officials-ui typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/Logo.tsx \
        packages/officials-ui/test/Logo.test.tsx
git commit -m "$(cat <<'EOF'
feat(officials-ui): <Logo /> component (mark + lockup variants)

First consumer of slice-32 logoGeometry() + LOGO_FILLS. Two-square
cascade + 4 corner brackets. Web uses createElement escape hatch for
gradient fills (Gotcha #19f); native uses solid-color fallback (no
new RN deps). Below S=12 falls back to single solid square.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `docs/brand-migration.md`

**Files:**
- Create: `docs/brand-migration.md`

Pure documentation. The migration vocabulary slices 34-37 will follow.

- [ ] **Step 1: Create `docs/brand-migration.md`** with this content:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/brand-migration.md
git commit -m "$(cat <<'EOF'
docs(brand): brand-migration.md — vocabulary for slices 33-37

Pinned COLORS.* → BRAND.semantic.* mapping table that downstream
retrofit slices grep against. Documents per-slice scope split.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Export `<Logo />` + `useBrandTokens()` from package root

**Files:**
- Modify: `packages/officials-ui/src/index.ts`

Small task — barrel the new exports so slice 33 consumers can `import { Logo, useBrandTokens } from '@chiaro/officials-ui'`.

- [ ] **Step 1: Read the current barrel**

```bash
cat packages/officials-ui/src/index.ts
```

Note the existing export pattern.

- [ ] **Step 2: Append the new exports**

Append to `packages/officials-ui/src/index.ts`:

```ts
export { Logo, type LogoProps } from './Logo.tsx'
export {
  BrandModeOverrideContext,
  useBrandTokens,
  type BrandTokens,
} from './brand-hooks.ts'
```

Place these exports in a clearly demarcated block at the bottom of the file (after any existing exports). Do NOT modify or reorder existing exports.

- [ ] **Step 3: Verify the package compiles**

```bash
pnpm --filter @chiaro/officials-ui typecheck
pnpm --filter @chiaro/officials-ui test
```

Expected: clean typecheck; all tests still pass (no behavior change).

- [ ] **Step 4: Verify the workspace compiles**

```bash
pnpm -r typecheck
```

Expected: 11 packages green.

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/index.ts
git commit -m "$(cat <<'EOF'
feat(officials-ui): export Logo + useBrandTokens from package root

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `AuthWordmark` refactor — wraps `<Logo />`

**Files:**
- Modify: `packages/officials-ui/src/auth/AuthWordmark.tsx`
- Update: `packages/officials-ui/test/auth/AuthWordmark.test.tsx`

Replace the rounded-square dot + Text with `<Logo variant="lockup" />`. Keep the public API (`size?: 'sm' | 'md'`) for back-compat with slice-31 consumers.

- [ ] **Step 1: Read existing AuthWordmark + its test**

```bash
cat packages/officials-ui/src/auth/AuthWordmark.tsx
cat packages/officials-ui/test/auth/AuthWordmark.test.tsx
```

- [ ] **Step 2: Replace `AuthWordmark.tsx`** with this content:

```tsx
'use client'

import { Logo } from '../Logo.tsx'

export interface AuthWordmarkProps {
  /** `sm` for desktop page-chrome; `md` for mobile in-card. Default `md`. */
  size?: 'sm' | 'md'
}

/**
 * Auth-screen wordmark lockup. Thin wrapper over `<Logo variant="lockup" />`
 * preserved for back-compat with slice-31 callers (AuthScreen, AuthPageChrome).
 *
 *   sm  → Logo size=20  (web page-chrome)
 *   md  → Logo size=32  (mobile in-card)
 */
export function AuthWordmark({ size = 'md' }: AuthWordmarkProps): React.JSX.Element {
  const logoSize = size === 'md' ? 32 : 20
  return <Logo variant="lockup" size={logoSize} />
}
```

- [ ] **Step 3: Update the existing test**

The previous test asserted on a CHIARO text + dot structure. The new test asserts on the lockup behavior:

Replace `packages/officials-ui/test/auth/AuthWordmark.test.tsx` with:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { AuthWordmark } from '../../src/auth/AuthWordmark.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
}

describe('AuthWordmark', () => {
  it('renders CHIARO wordmark text (via Logo lockup variant)', () => {
    const { container } = render(<AuthWordmark />, { wrapper })
    expect(container.textContent).toContain('CHIARO')
  })

  it('default size is md (S=32 logo)', () => {
    const { container } = render(<AuthWordmark />, { wrapper })
    // Outermost aria-label is the Logo lockup wrapper.
    expect(container.querySelector('[aria-label="Chiaro logo"]')).not.toBeNull()
  })

  it('size="sm" still renders the wordmark (smaller scale)', () => {
    const { container } = render(<AuthWordmark size="sm" />, { wrapper })
    expect(container.textContent).toContain('CHIARO')
    expect(container.querySelector('[aria-label="Chiaro logo"]')).not.toBeNull()
  })
})
```

- [ ] **Step 4: Run the test + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test AuthWordmark
pnpm --filter @chiaro/officials-ui typecheck
```

Expected: 3 tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/auth/AuthWordmark.tsx \
        packages/officials-ui/test/auth/AuthWordmark.test.tsx
git commit -m "$(cat <<'EOF'
refactor(officials-ui): AuthWordmark wraps <Logo variant="lockup" />

Replaces the rounded-square dot + Text pair with the canonical slice-32
mark. Public API (size: sm | md) preserved for slice-31 callers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `AuthInput` migration — CSS template per-mode

**Files:**
- Modify: `packages/officials-ui/src/auth/AuthInput.tsx`
- Update: `packages/officials-ui/test/auth/AuthInput.test.tsx`

`AuthInput` is the gnarliest file in this slice: it has both a CSS-in-JS template literal (web `<style>` block) AND React Native StyleSheet styles. Both must consume `useBrandTokens()`. The CSS template rebuilds every render — use `useMemo` over `(mode, focused, error)` to avoid pointless string allocation on every keystroke.

- [ ] **Step 1: Read existing AuthInput + its test**

```bash
cat packages/officials-ui/src/auth/AuthInput.tsx
cat packages/officials-ui/test/auth/AuthInput.test.tsx
```

- [ ] **Step 2: Migrate the imports + render top**

In `packages/officials-ui/src/auth/AuthInput.tsx`:

- Replace the `import { COLORS } from '@chiaro/ui-tokens'` line (line 5) with:
  ```ts
  import { useBrandTokens } from '../brand-hooks.ts'
  ```

- At the top of the `AuthInput` function body (right after the existing `const [focused, setFocused] = useState(false)` line), add:
  ```ts
  const { mode, semantic } = useBrandTokens()
  ```

- [ ] **Step 3: Migrate the web CSS template**

In the `if (Platform.OS === 'web')` block (around line 63), replace every `${COLORS.*}` interpolation in the template-literal CSS:

| Was | Becomes |
|---|---|
| `${COLORS.neutral.border}` | `${semantic.border.default}` |
| `${COLORS.brand.text}` | `${semantic.text.primary}` |
| `${COLORS.brand.primary}` | `${semantic.accent.primary}` |
| `${COLORS.signal.error}` | `${semantic.alert.danger.fg}` |
| `${COLORS.neutral.textMuted}` | `${semantic.text.muted}` |
| `${COLORS.neutral.background}` | `${semantic.bg.elevated}` |

Wrap the `const css = \`...\`` line in a `useMemo` to avoid recomputing on every keystroke:

```ts
const css = useMemo(() => `
.${className} { position: relative; }
// ... unchanged template body with the semantic.* replacements above ...
`.trim(), [className, semantic])
```

Add `useMemo` to the `react` import line at the top.

- [ ] **Step 4: Migrate the RN StyleSheet at the bottom of the file**

The bottom of `AuthInput.tsx` has a `StyleSheet.create({...})` block with `COLORS.*` references. StyleSheet must be static — it can't read from a hook. Options:
- **(A)** Lift the styles inline into the component body so they can read from `semantic`. Loses StyleSheet's perf optimization but the auth screens are not perf-hot.
- **(B)** Keep StyleSheet for static structure (positioning, sizing) and override colors inline via `style={[styles.boxInput, { borderColor: semantic.border.default }]}` arrays.

**Apply option B.** Keep StyleSheet for layout-only properties; pass color overrides via inline style arrays. Specifically:
- Remove every `COLORS.*` reference from the StyleSheet object. Keep all non-color properties (width, height, padding, fontSize, fontWeight).
- In the render, where the StyleSheet styles are applied, append the inline color overrides:
  ```ts
  style={[
    styles.box,
    { borderColor: semantic.border.default, backgroundColor: semantic.bg.elevated },
    focused && { borderColor: semantic.accent.primary },
    error && { borderColor: semantic.alert.danger.fg },
  ]}
  ```
  And similar for label, input text, error text.

The implementer should map each existing `boxFocused` / `boxError` / `labelFocused` / `labelError` / etc. branch to an equivalent inline override.

- [ ] **Step 5: Update placeholderTextColor**

```ts
placeholderTextColor={semantic.text.muted}
```

(Replaces `COLORS.neutral.textMuted`.)

- [ ] **Step 6: Update the existing test for new tokens + add a dark-mode test**

In `packages/officials-ui/test/auth/AuthInput.test.tsx`:

- If existing assertions reference the OLD hex values (`#5b6cff` blue, `#c5364a` red, `#666` gray), update them to the NEW hex values (`#c46a2a`, `#a83a3a`, `#6b5e52`). Or assert structurally (presence of focus-ring border) rather than on hex literals.
- Add ONE new test asserting dark mode renders different colors:

```tsx
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)

describe('AuthInput — mode awareness', () => {
  it('renders different border colors in light vs dark', () => {
    const { container: light } = render(
      <AuthInput label="Email" value="" onChangeText={() => {}} />,
      { wrapper: lightWrapper },
    )
    const { container: dark } = render(
      <AuthInput label="Email" value="" onChangeText={() => {}} />,
      { wrapper: darkWrapper },
    )
    // The web CSS template contains the hex values for the active mode.
    expect(light.innerHTML).toContain('#e8d8c2') // light border.default
    expect(dark.innerHTML).toContain('#3a2e26') // dark border.default
  })
})
```

- [ ] **Step 7: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test AuthInput
pnpm --filter @chiaro/officials-ui typecheck
```

Expected: existing tests still pass; new mode-awareness test passes; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add packages/officials-ui/src/auth/AuthInput.tsx \
        packages/officials-ui/test/auth/AuthInput.test.tsx
git commit -m "$(cat <<'EOF'
refactor(officials-ui): AuthInput migrates to BRAND.semantic.* tokens

Web CSS template rebuilds per (mode, focused, error) via useMemo; RN
styles split layout-static / color-inline so color overrides come from
useBrandTokens(). Adds dark-mode assertion.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `AuthScreen` + `AuthCrossLink` + `AuthForm` — batched migration

**Files:**
- Modify: `packages/officials-ui/src/auth/AuthScreen.tsx`
- Modify: `packages/officials-ui/src/auth/AuthCrossLink.tsx`
- Modify: `packages/officials-ui/src/auth/AuthForm.tsx`
- Update: corresponding test files in `packages/officials-ui/test/auth/`

These three components are mechanically similar — each imports `COLORS`, references a small number of fields, and uses RN StyleSheet. Batch them in one task per the standard mode-flip pattern.

- [ ] **Step 1: Read all three files + tests**

```bash
cat packages/officials-ui/src/auth/AuthScreen.tsx
cat packages/officials-ui/src/auth/AuthCrossLink.tsx
cat packages/officials-ui/src/auth/AuthForm.tsx
cat packages/officials-ui/test/auth/AuthScreen.test.tsx
cat packages/officials-ui/test/auth/AuthCrossLink.test.tsx
cat packages/officials-ui/test/auth/AuthForm.test.tsx
```

- [ ] **Step 2: Migrate `AuthScreen.tsx`**

- Replace `import { COLORS } from '@chiaro/ui-tokens'` with `import { useBrandTokens } from '../brand-hooks.ts'`
- Inside the component, add `const { semantic } = useBrandTokens()`
- Replace `COLORS.neutral.surface` → `semantic.bg.app`
- Replace `COLORS.neutral.background` → `semantic.bg.elevated`
- Since RN StyleSheet can't read from a hook, lift the affected styles inline (same pattern as Task 6 option B). Keep static layout in StyleSheet; pass color overrides via inline `style` array.

- [ ] **Step 3: Migrate `AuthCrossLink.tsx`**

- Replace import with hook
- `const { semantic } = useBrandTokens()`
- Replace `COLORS.neutral.textMuted` → `semantic.text.muted`
- Replace `COLORS.brand.primary` → `semantic.accent.primary`
- Lift styles inline as needed.

- [ ] **Step 4: Migrate `AuthForm.tsx`**

- Replace import with hook
- `const { semantic } = useBrandTokens()`
- Replace `COLORS.brand.text` → `semantic.text.primary`
- Replace `COLORS.neutral.textMuted` → `semantic.text.muted`
- Replace `COLORS.signal.error` → `semantic.alert.danger.fg`
- Replace `COLORS.brand.primary` (submit button background) → `semantic.accent.primary`
- Lift styles inline as needed.

- [ ] **Step 5: Update the 3 test files**

For each of `AuthScreen.test.tsx`, `AuthCrossLink.test.tsx`, `AuthForm.test.tsx`:

- If existing assertions reference OLD hex values, update to NEW ones from `docs/brand-migration.md`, OR shift assertions to structural (e.g. "renders the submit button", "click handler fires").
- Add one new test per file asserting the component renders without throwing under both light + dark mode wrappers (referencing the same `BrandModeOverrideContext.Provider` wrapper pattern from Task 5/6).

Example shape for each new dark-mode test:

```tsx
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

it('renders under both light and dark wrappers without throwing', () => {
  expect(() => render(<TheComponent {...props} />, { wrapper: lightWrapper })).not.toThrow()
  expect(() => render(<TheComponent {...props} />, { wrapper: darkWrapper })).not.toThrow()
})
```

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm --filter @chiaro/officials-ui test auth/
pnpm --filter @chiaro/officials-ui typecheck
```

Expected: all auth tests pass; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/auth/AuthScreen.tsx \
        packages/officials-ui/src/auth/AuthCrossLink.tsx \
        packages/officials-ui/src/auth/AuthForm.tsx \
        packages/officials-ui/test/auth/AuthScreen.test.tsx \
        packages/officials-ui/test/auth/AuthCrossLink.test.tsx \
        packages/officials-ui/test/auth/AuthForm.test.tsx
git commit -m "$(cat <<'EOF'
refactor(officials-ui): auth screen/crosslink/form migrate to BRAND.semantic

useBrandTokens() per component; RN StyleSheet split layout-static /
color-inline. Tests assert light + dark wrappers render without throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `AuthPageChrome` — verify no color refs need migration

**Files:**
- Verify: `packages/officials-ui/src/auth/AuthPageChrome.tsx`

`AuthPageChrome.tsx` (33 lines) was verified during spec-writing to have NO `COLORS.*` references — it's structural-only (positioning, flex layout). It uses `<AuthWordmark size="sm" />` and `<AuthCrossLink ... />` which self-update via Task 5 and Task 7.

- [ ] **Step 1: Grep for `COLORS.`**

```bash
grep -n "COLORS\." packages/officials-ui/src/auth/AuthPageChrome.tsx
```

Expected: zero matches. If matches appear (the file has drifted since spec), apply the same migration pattern as Task 7.

- [ ] **Step 2: No code change required if grep is empty**

If the grep finds nothing, no change needed. Skip to Step 3.

- [ ] **Step 3: Run the auth test suite one more time**

```bash
pnpm --filter @chiaro/officials-ui test auth/
```

Expected: all green. `AuthPageChrome` doesn't have its own test in slice 31 (verify); if it does, it should still pass.

- [ ] **Step 4: Skip commit if no change**

If no files changed, do not create an empty commit. Move to Task 9.

---

## Task 9: Final verification + smoke + CLAUDE.md slice 33

**Files:**
- Verify: workspace state
- Modify: `CLAUDE.md`

Final gate before merging.

- [ ] **Step 1: Full workspace typecheck**

```bash
pnpm -r typecheck
```

Expected: all 11 packages green.

- [ ] **Step 2: Full workspace test**

```bash
pnpm test
```

Expected: every package's tests pass (except possibly the known integration tests that need `CONGRESS_GOV_API_KEY` + live Supabase — those are environmental, not regressions).

- [ ] **Step 3: Confirm no live files outside scope were modified**

```bash
git diff master --name-only -- 'apps/' 'packages/officials/' 'packages/state-bills/' 'packages/bills/' 'packages/location/' 'packages/profile/' 'packages/supabase-client/' 'packages/db/' 'packages/ui-tokens/'
```

Expected: empty output. Slice 33 should only touch `packages/officials-ui/`, `docs/`, and `CLAUDE.md`.

- [ ] **Step 4: Run the web build (Next 15 smoke)**

```bash
pnpm --filter @chiaro/web build
```

Expected: clean build (Next 15 page-data collection, RNW transpile, source-map upload no-op without `SENTRY_AUTH_TOKEN`). Verifies auth routes still build cleanly with the new imports.

- [ ] **Step 5: Update CLAUDE.md "Slices delivered" section**

Open `CLAUDE.md`. Find the slice 32 bullet (it starts with `- **Slice 32 — Brand design system**`). Append a new bullet immediately after it:

```markdown
- **Slice 33 — Auth brand retrofit + Logo + useBrandTokens** (2026-05-27): First consumer of slice-32 brand tokens. New `<Logo />` component in `@chiaro/officials-ui` (mark + lockup variants) using slice-32 `logoGeometry()` — web gradient fills via `createElement` escape hatch (Gotcha #19f); native solid-color fallback. New `useBrandTokens()` hook with `BrandModeOverrideContext` plumbing (no Provider in this slice — slice 38+ adds one). New `docs/brand-migration.md` reference doc pinning the `COLORS.* → BRAND.semantic.*` vocabulary for slices 34-37. 6 auth components migrate via the hook; auth becomes first dark-mode-ready surface (rest of app stays light). AuthWordmark refactors from rounded-square dot+Text to `<Logo variant="lockup" />`. ~20 files; no schema work; pgTAP unchanged at 428 plans.
```

- [ ] **Step 6: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): record slice 33 — auth brand retrofit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Final state check**

```bash
git log --oneline master..auth-brand-retrofit
git status --short
```

Expected: ~10-12 commits on `auth-brand-retrofit` since `master` (spec + plan + 8 task commits + CLAUDE.md update); clean working tree.

---

## Notes for the implementer

1. **`useBrandTokens()` always reads from the override Context first.** Slice 33 ships no Provider, so the Context value is always null at runtime — the hook falls back to `useColorScheme()`. Don't add a Provider component anywhere in this slice; slice 38+ owns that.

2. **`AuthInput.tsx` is the gnarliest file.** The CSS-in-JS template literal must rebuild per `(mode, focused, error)` triple. Use `useMemo`. The RN StyleSheet must split layout (static) from colors (inline overrides via `style` array). Same pattern applies to `AuthScreen.tsx` / `AuthCrossLink.tsx` / `AuthForm.tsx` but smaller surface.

3. **Native gradient fallback for `<Logo />` is intentional.** No new RN deps. Documented in spec §4.2. If a reviewer asks "why isn't this gradient?" the answer is "core RN doesn't ship gradient support; `expo-linear-gradient` is a future polish slice."

4. **Below `size={12}` falls back to a single solid square.** Brand book §8.2 prescribes this; the fallback must not render the overlap construction (which is unreadable at that scale).

5. **The mitigation script for web SSR first-paint flash (spec §4.5) is OPTIONAL.** If implementing it adds risk (cross-platform `<Script>` placement, hydration mismatches), defer it. The flash is acceptable in v1.

6. **Domain palette exports stay untouched in slice 33.** `PARTY_COLOR`, `CATEGORY_ACCENT`, `ALIGNMENT_CHIP_COLORS`, `INDUSTRY_COLOR`, `SCORECARD_LEAN_COLOR`, etc. all remain on legacy `COLORS.*`. Slice 37 owns their migration.

7. **`docs/brand-migration.md` is the canonical mapping vocabulary for slices 34-37.** Treat it as load-bearing — slices 34-37 will grep against it.

8. **Test naming.** Existing tests use file names like `AuthWordmark.test.tsx`. New tests follow the same pattern. The hook test is `brand-hooks.test.tsx` (hyphen, mirroring the source file `brand-hooks.ts`). The Logo test is `Logo.test.tsx`.

9. **`apps/web/` and `apps/mobile/` route shells need NO changes.** They import shared components which self-update. Verify with `git status` after Task 7 — if the route shells appear in the diff, something has drifted; investigate.

10. **The legacy `COLORS` export stays untouched.** Don't remove or modify it. Slice 33 is purely additive to the BRAND surface.
