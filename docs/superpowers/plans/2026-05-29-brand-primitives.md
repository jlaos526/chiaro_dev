# Slice 45 — Brand primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 brand primitives (`BrandButton`, `BrandHeading`, `BrandBodyText`, `BrandLink`, `BrandAlert`) in `@chiaro/officials-ui` plus retune `BRAND_PALETTE.alert.*` from slice 32 generic colors to slice 41/42 brand-family (burgundy/gold/emerald/terracotta) + new `alert.info` key. AuthForm consumer migrates from inline `#fef2f0` to `semantic.alert.danger.bg`.

**Architecture:** Token-first ordering — palette retune in Task 1 + semantic in Task 2, then 5 primitives in Tasks 3-7 (each TDD-independent), then barrel + consumer migration in Tasks 8-9, then docs in Task 10. Each primitive consumes `useBrandTokens()` (slice 33 hook) and mode-aware tables. `BrandLink` inlines the slice 14 smart-anchor pattern; `BrandHeading` uses `createElement` on web for real `<h1>`/`<h2>`/`<h3>` semantic. `BrandAlert` uses the P2 pill layout (7px rounded pill, 6px inset, 12px rounded card with severity-keyed band+icon+title colors).

**Tech Stack:** TypeScript strict + `exactOptionalPropertyTypes`, vitest, React Native + react-native-web (RNW 0.19). Token consumption via existing `useBrandTokens()` hook in `@chiaro/officials-ui/src/brand-hooks.ts`.

**Spec:** `docs/superpowers/specs/2026-05-29-brand-primitives-design.md`

---

## Task 1: BRAND_PALETTE alert retune (light + dark)

**Files:**
- Modify: `packages/ui-tokens/src/brand/palette.ts`
- Modify: `packages/ui-tokens/test/brand-palette.test.ts`

Retune the 3 existing alert triplets (`danger`, `warning`, `success`) to slice 41/42 brand-family values + add NEW `alert.info` triplet. Both light + dark.

- [ ] **Step 1: Pre-flight grep for old alert hex residues**

Run from `C:\Users\jlaos\Downloads\Chiaro`:

```bash
grep -rn "#a83a3a\|#fdf2f0\|#f5b8b0\|#d68a1f\|#fef7e8\|#f5c878\|#1f9b88\|#e8f5f2\|#7fc5b5\|#d05050\|#2a1414\|#6e2222\|#f0b558\|#3a2a14\|#6e4a20\|#4dbfb0\|#1a302c\|#3a6e62" packages/ apps/
```

Expected hits (legitimate):
- `packages/ui-tokens/src/brand/palette.ts` (about to be edited)
- `packages/ui-tokens/test/brand-palette.test.ts` (about to be edited)
- `packages/ui-tokens/test/brand-semantic.test.ts` (Task 2 updates)
- `packages/officials-ui/src/auth/AuthForm.tsx` (line 169 `#fef2f0` — Task 9 migrates)

Expected hits that need verification (slice 32 alert-token consumers via brand-hooks):
- Any `*.test.tsx` that pins alert hex literally. If grep shows test files outside the 3 above, list them and adjust the plan to update them in subsequent tasks.

Document the grep result before proceeding to Step 2. If grep finds new test pins, STOP and report so we can extend the plan to include them.

- [ ] **Step 2: Update test assertions**

Edit `packages/ui-tokens/test/brand-palette.test.ts`. Find the existing `describe('BRAND_PALETTE.light', ...)` block. Replace the 3 alert it-cases (currently lines 31-47) with these 4 new it-cases:

```ts
  it('exports the burgundy alert.danger triplet (slice 45 brand-family)', () => {
    expect(BRAND_PALETTE.light.alert.danger.fg).toBe('#8a3a4d')
    expect(BRAND_PALETTE.light.alert.danger.bg).toBe('#f8d8d0')
    expect(BRAND_PALETTE.light.alert.danger.border).toBe('#e0928a')
  })

  it('exports the gold alert.warning triplet (slice 45 brand-family)', () => {
    expect(BRAND_PALETTE.light.alert.warning.fg).toBe('#c89a4e')
    expect(BRAND_PALETTE.light.alert.warning.bg).toBe('#f9e3b8')
    expect(BRAND_PALETTE.light.alert.warning.border).toBe('#d6a85a')
  })

  it('exports the emerald alert.success triplet (slice 45 brand-family)', () => {
    expect(BRAND_PALETTE.light.alert.success.fg).toBe('#1a8f5a')
    expect(BRAND_PALETTE.light.alert.success.bg).toBe('#c5e0d6')
    expect(BRAND_PALETTE.light.alert.success.border).toBe('#5fa897')
  })

  it('exports the terracotta alert.info triplet (slice 45 new)', () => {
    expect(BRAND_PALETTE.light.alert.info.fg).toBe('#b86340')
    expect(BRAND_PALETTE.light.alert.info.bg).toBe('#f3d7b6')
    expect(BRAND_PALETTE.light.alert.info.border).toBe('#d6a474')
  })
```

In the existing `describe('BRAND_PALETTE.dark', ...)` block, find the 3 dark alert it-cases and replace with these 4:

```ts
  it('exports the burgundy alert.danger triplet (dark, slice 45)', () => {
    expect(BRAND_PALETTE.dark.alert.danger.fg).toBe('#c89aa8')
    expect(BRAND_PALETTE.dark.alert.danger.bg).toBe('#2a1820')
    expect(BRAND_PALETTE.dark.alert.danger.border).toBe('#5a2535')
  })

  it('exports the gold alert.warning triplet (dark, slice 45)', () => {
    expect(BRAND_PALETTE.dark.alert.warning.fg).toBe('#e1c896')
    expect(BRAND_PALETTE.dark.alert.warning.bg).toBe('#2e2516')
    expect(BRAND_PALETTE.dark.alert.warning.border).toBe('#7c5a1e')
  })

  it('exports the emerald alert.success triplet (dark, slice 45)', () => {
    expect(BRAND_PALETTE.dark.alert.success.fg).toBe('#7eb898')
    expect(BRAND_PALETTE.dark.alert.success.bg).toBe('#162a1f')
    expect(BRAND_PALETTE.dark.alert.success.border).toBe('#0f5a4f')
  })

  it('exports the terracotta alert.info triplet (dark, slice 45 new)', () => {
    expect(BRAND_PALETTE.dark.alert.info.fg).toBe('#e0b8a0')
    expect(BRAND_PALETTE.dark.alert.info.bg).toBe('#2a1f18')
    expect(BRAND_PALETTE.dark.alert.info.border).toBe('#7a3e23')
  })
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: FAIL — existing palette has slice 32 hexes; the new test assertions don't match; also `alert.info` doesn't exist yet so TypeScript fails on `palette.light.alert.info.fg`.

- [ ] **Step 4: Update palette.ts**

Edit `packages/ui-tokens/src/brand/palette.ts`. Find the `BRAND_PALETTE.light.alert` block (currently lines 32-36) and replace with:

```ts
    alert: {
      // Slice 45 brand-family retune. Danger = burgundy (matches slice 42 ethics
      // family + slice 41 SUB_CASCADE light); warning = gold (slice 41 Service
      // Record family); success = emerald (slice 41 Finance family); info =
      // terracotta (slice 41 Community Presence family). Consumers of fg
      // automatically shift via brand-hooks. Replaces slice 32 generic
      // red/amber/teal/peach.
      danger:  { fg: '#8a3a4d', bg: '#f8d8d0', border: '#e0928a' },
      warning: { fg: '#c89a4e', bg: '#f9e3b8', border: '#d6a85a' },
      success: { fg: '#1a8f5a', bg: '#c5e0d6', border: '#5fa897' },
      info:    { fg: '#b86340', bg: '#f3d7b6', border: '#d6a474' },
    },
```

Find the `BRAND_PALETTE.dark.alert` block (currently lines 75-79) and replace with:

```ts
    alert: {
      // Slice 45 dark-mode brand-family. fg uses SUB_CASCADE_ACCENT_DARK family
      // values for legibility against cool slate page bg #16181c. bg uses deep
      // hue-tinted slate; border picks up slice 41 family edge color.
      danger:  { fg: '#c89aa8', bg: '#2a1820', border: '#5a2535' },
      warning: { fg: '#e1c896', bg: '#2e2516', border: '#7c5a1e' },
      success: { fg: '#7eb898', bg: '#162a1f', border: '#0f5a4f' },
      info:    { fg: '#e0b8a0', bg: '#2a1f18', border: '#7a3e23' },
    },
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-palette`
Expected: PASS — 8 alert it-cases (4 light + 4 dark) all pass; light + dark portrait + signal + link tests unchanged and still passing.

- [ ] **Step 6: Run workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS. `alert.info` is a new key; the TypeScript type `typeof BRAND_PALETTE` automatically includes it. Existing consumers that destructure only `danger`/`warning`/`success` continue compiling.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-tokens/src/brand/palette.ts packages/ui-tokens/test/brand-palette.test.ts
git commit -m "feat(ui-tokens): alert palette brand-family retune (slice 45 task 1)

Replace slice 32 alert.{danger,warning,success} generic
red/amber/teal hexes with slice 41/42 brand-family values:
burgundy/gold/emerald + new terracotta info. Both light + dark.

6 existing semantic.alert.*.fg consumers (passed bills,
sanctioned status, censure events, etc.) shift visibly to
the brand-family palette -- intentional cascade per slice 45
spec section 7 risk 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: BRAND_SEMANTIC alert.info wiring

**Files:**
- Modify: `packages/ui-tokens/src/brand/semantic.ts`
- Modify: `packages/ui-tokens/test/brand-semantic.test.ts`

Pipe the new `alert.info` through `BRAND_SEMANTIC` so consumers can read it via `semantic.alert.info.{fg,bg,border}`. Existing danger/warning/success piping unchanged.

- [ ] **Step 1: Update test assertions**

Edit `packages/ui-tokens/test/brand-semantic.test.ts`. The existing light describe block (lines 30-46) tests danger/warning/success — update the literal-value assertions to the slice 45 brand-family values:

Replace the 3 light alert it-cases:

```ts
  it('resolves alert.danger.{fg,bg,border} to slice 45 burgundy triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.danger.fg).toBe('#8a3a4d')
    expect(BRAND_SEMANTIC.light.alert.danger.bg).toBe('#f8d8d0')
    expect(BRAND_SEMANTIC.light.alert.danger.border).toBe('#e0928a')
  })

  it('resolves alert.warning.{fg,bg,border} to slice 45 gold triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.warning.fg).toBe('#c89a4e')
    expect(BRAND_SEMANTIC.light.alert.warning.bg).toBe('#f9e3b8')
    expect(BRAND_SEMANTIC.light.alert.warning.border).toBe('#d6a85a')
  })

  it('resolves alert.success.{fg,bg,border} to slice 45 emerald triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.success.fg).toBe('#1a8f5a')
    expect(BRAND_SEMANTIC.light.alert.success.bg).toBe('#c5e0d6')
    expect(BRAND_SEMANTIC.light.alert.success.border).toBe('#5fa897')
  })

  it('resolves alert.info.{fg,bg,border} to slice 45 terracotta triplet (new)', () => {
    expect(BRAND_SEMANTIC.light.alert.info.fg).toBe('#b86340')
    expect(BRAND_SEMANTIC.light.alert.info.bg).toBe('#f3d7b6')
    expect(BRAND_SEMANTIC.light.alert.info.border).toBe('#d6a474')
  })
```

Now scroll to the `describe('BRAND_SEMANTIC.dark', ...)` block (similar structure further down). Update the 3 dark alert it-cases and add a 4th:

```ts
  it('resolves alert.danger.{fg,bg,border} (dark, slice 45)', () => {
    expect(BRAND_SEMANTIC.dark.alert.danger.fg).toBe('#c89aa8')
    expect(BRAND_SEMANTIC.dark.alert.danger.bg).toBe('#2a1820')
    expect(BRAND_SEMANTIC.dark.alert.danger.border).toBe('#5a2535')
  })

  it('resolves alert.warning.{fg,bg,border} (dark, slice 45)', () => {
    expect(BRAND_SEMANTIC.dark.alert.warning.fg).toBe('#e1c896')
    expect(BRAND_SEMANTIC.dark.alert.warning.bg).toBe('#2e2516')
    expect(BRAND_SEMANTIC.dark.alert.warning.border).toBe('#7c5a1e')
  })

  it('resolves alert.success.{fg,bg,border} (dark, slice 45)', () => {
    expect(BRAND_SEMANTIC.dark.alert.success.fg).toBe('#7eb898')
    expect(BRAND_SEMANTIC.dark.alert.success.bg).toBe('#162a1f')
    expect(BRAND_SEMANTIC.dark.alert.success.border).toBe('#0f5a4f')
  })

  it('resolves alert.info.{fg,bg,border} (dark, slice 45 new)', () => {
    expect(BRAND_SEMANTIC.dark.alert.info.fg).toBe('#e0b8a0')
    expect(BRAND_SEMANTIC.dark.alert.info.bg).toBe('#2a1f18')
    expect(BRAND_SEMANTIC.dark.alert.info.border).toBe('#7a3e23')
  })
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-semantic`
Expected: FAIL — `BRAND_SEMANTIC.light.alert.info` is undefined; light alert assertions fail with slice 32 values.

- [ ] **Step 3: Update semantic.ts**

Edit `packages/ui-tokens/src/brand/semantic.ts`. Find the `alert:` block in `buildSemantic` (currently lines 33-49) and replace with:

```ts
    alert: {
      danger: {
        fg:     p.alert.danger.fg,
        bg:     p.alert.danger.bg,
        border: p.alert.danger.border,
      },
      warning: {
        fg:     p.alert.warning.fg,
        bg:     p.alert.warning.bg,
        border: p.alert.warning.border,
      },
      success: {
        fg:     p.alert.success.fg,
        bg:     p.alert.success.bg,
        border: p.alert.success.border,
      },
      info: {
        fg:     p.alert.info.fg,
        bg:     p.alert.info.bg,
        border: p.alert.info.border,
      },
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/ui-tokens test -- brand-semantic`
Expected: PASS — 8 alert it-cases pass (4 light + 4 dark).

- [ ] **Step 5: Run workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/src/brand/semantic.ts packages/ui-tokens/test/brand-semantic.test.ts
git commit -m "feat(ui-tokens): semantic alert.info wiring (slice 45 task 2)

Pipe new BRAND_PALETTE.alert.info through buildSemantic so
consumers can read semantic.alert.info.{fg,bg,border} alongside
danger/warning/success. Existing danger/warning/success piping
unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: BrandButton primitive (TDD)

**Files:**
- Create: `packages/officials-ui/src/primitives/BrandButton.tsx`
- Create: `packages/officials-ui/test/primitives/BrandButton.test.tsx`

Variant + size + disabled. Primary uses `accent.primary` bg + onAccent text. Secondary is outlined.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/primitives/BrandButton.test.tsx`:

```tsx
import { createElement, type ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BrandButton } from '../../src/primitives/BrandButton.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BrandButton', () => {
  it('renders children', () => {
    render(<BrandButton onPress={() => {}}>Save</BrandButton>)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('calls onPress when clicked', () => {
    const onPress = vi.fn()
    render(<BrandButton onPress={onPress}>Save</BrandButton>)
    fireEvent.click(screen.getByText('Save'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('primary variant uses accent.primary bg in light mode', () => {
    const { container } = render(<BrandButton onPress={() => {}}>Save</BrandButton>, { wrapper: lightWrapper })
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn).not.toBeNull()
    const style = btn?.getAttribute('style') ?? ''
    // RNW normalizes #c46a2a to rgb(196, 106, 42).
    expect(style).toMatch(/background-color:\s*rgb\(196,\s*106,\s*42\)/)
  })

  it('primary variant uses slate-blue accent.primary bg in dark mode', () => {
    const { container } = render(<BrandButton onPress={() => {}}>Save</BrandButton>, { wrapper: darkWrapper })
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn).not.toBeNull()
    const style = btn?.getAttribute('style') ?? ''
    // RNW normalizes #374f68 to rgb(55, 79, 104).
    expect(style).toMatch(/background-color:\s*rgb\(55,\s*79,\s*104\)/)
  })

  it('secondary variant renders transparent bg + colored border', () => {
    const { container } = render(<BrandButton variant="secondary" onPress={() => {}}>Save</BrandButton>, { wrapper: lightWrapper })
    const btn = container.firstElementChild as HTMLElement | null
    const style = btn?.getAttribute('style') ?? ''
    expect(style).toMatch(/background-color:\s*(transparent|rgba\(0,\s*0,\s*0,\s*0\))/)
    expect(style).toMatch(/border-color:\s*rgb\(196,\s*106,\s*42\)/)
  })

  it('disabled prop sets aria-disabled + does NOT call onPress when clicked', () => {
    const onPress = vi.fn()
    render(<BrandButton onPress={onPress} disabled>Save</BrandButton>)
    const btn = screen.getByText('Save').closest('[role="button"]') as HTMLElement | null
    expect(btn?.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(btn!)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('size sm renders 32px height', () => {
    const { container } = render(<BrandButton size="sm" onPress={() => {}}>Save</BrandButton>)
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn?.getAttribute('style') ?? '').toMatch(/height:\s*32px/)
  })

  it('size lg renders 48px height', () => {
    const { container } = render(<BrandButton size="lg" onPress={() => {}}>Save</BrandButton>)
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn?.getAttribute('style') ?? '').toMatch(/height:\s*48px/)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandButton`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement BrandButton**

Create `packages/officials-ui/src/primitives/BrandButton.tsx`:

```tsx
'use client'

import { Pressable, Text } from 'react-native'
import { type ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BrandButtonProps {
  children: ReactNode
  onPress: () => void
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'default' | 'lg'
  disabled?: boolean
  accessibilityLabel?: string
}

const SIZE_DIMS = {
  sm:      { height: 32, paddingHorizontal: 12, fontSize: 13 },
  default: { height: 40, paddingHorizontal: 18, fontSize: 14 },
  lg:      { height: 48, paddingHorizontal: 22, fontSize: 15 },
} as const

/**
 * Brand-aligned button primitive. Mode-aware via useBrandTokens().
 *
 * variant='primary': accent.primary bg + text.onAccent text.
 * variant='secondary': transparent bg + accent.primary border + accent.primary text.
 * disabled: opacity 0.4, blocks onPress, sets aria-disabled.
 */
export function BrandButton({
  children,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  accessibilityLabel,
}: BrandButtonProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dims = SIZE_DIMS[size]

  const bg = variant === 'primary'
    ? semantic.accent.primary
    : 'transparent'
  const borderColor = variant === 'primary'
    ? semantic.accent.primary
    : semantic.accent.primary
  const textColor = variant === 'primary'
    ? semantic.text.onAccent
    : semantic.accent.primary

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={{
        backgroundColor: bg,
        borderColor,
        borderWidth: 1,
        borderRadius: 6,
        height: dims.height,
        paddingHorizontal: dims.paddingHorizontal,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          color: textColor,
          fontSize: dims.fontSize,
          fontWeight: '600',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {children}
      </Text>
    </Pressable>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandButton`
Expected: PASS — 8 it-cases pass.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/primitives/BrandButton.tsx packages/officials-ui/test/primitives/BrandButton.test.tsx
git commit -m "feat(officials-ui): BrandButton primitive (slice 45 task 3)

variant=primary|secondary, size=sm|default|lg, disabled state with
aria-disabled + onPress suppression. Mode-aware via useBrandTokens.
Primary uses accent.primary bg + text.onAccent text; secondary is
outlined. Inter 600 weight, 6px border radius (BRAND_RADII.md).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: BrandHeading primitive (TDD)

**Files:**
- Create: `packages/officials-ui/src/primitives/BrandHeading.tsx`
- Create: `packages/officials-ui/test/primitives/BrandHeading.test.tsx`

Level={1,2,3} → renders real `<h1>`/`<h2>`/`<h3>` on web via createElement; native uses Text with accessibilityRole='header' + accessibilityLevel.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/primitives/BrandHeading.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandHeading } from '../../src/primitives/BrandHeading.tsx'

describe('BrandHeading', () => {
  it('level=1 renders an <h1> element on web', () => {
    const { container } = render(<BrandHeading level={1}>Settings</BrandHeading>)
    const h = container.querySelector('h1')
    expect(h).not.toBeNull()
    expect(h?.textContent).toBe('Settings')
  })

  it('level=2 renders an <h2> element on web', () => {
    const { container } = render(<BrandHeading level={2}>Account</BrandHeading>)
    const h = container.querySelector('h2')
    expect(h).not.toBeNull()
  })

  it('level=3 renders an <h3> element on web', () => {
    const { container } = render(<BrandHeading level={3}>Appearance</BrandHeading>)
    const h = container.querySelector('h3')
    expect(h).not.toBeNull()
  })

  it('level=1 applies 28px font-size + 1.2 line-height', () => {
    const { container } = render(<BrandHeading level={1}>Settings</BrandHeading>)
    const h = container.querySelector('h1') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*28px/)
    expect(style).toMatch(/line-height:\s*1\.2/)
  })

  it('level=2 applies 22px font-size + 1.25 line-height', () => {
    const { container } = render(<BrandHeading level={2}>Account</BrandHeading>)
    const h = container.querySelector('h2') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*22px/)
    expect(style).toMatch(/line-height:\s*1\.25/)
  })

  it('level=3 applies 18px font-size + 1.3 line-height', () => {
    const { container } = render(<BrandHeading level={3}>Appearance</BrandHeading>)
    const h = container.querySelector('h3') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*18px/)
    expect(style).toMatch(/line-height:\s*1\.3/)
  })

  it('color prop overrides default semantic.text.primary', () => {
    const { container } = render(<BrandHeading level={1} color="#ff0000">Custom</BrandHeading>)
    const h = container.querySelector('h1') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    // RNW normalizes #ff0000 to rgb(255, 0, 0).
    expect(style).toMatch(/color:\s*rgb\(255,\s*0,\s*0\)/)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandHeading`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement BrandHeading**

Create `packages/officials-ui/src/primitives/BrandHeading.tsx`:

```tsx
'use client'

import { createElement, type ReactNode } from 'react'
import { Platform, Text } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BrandHeadingProps {
  children: ReactNode
  level: 1 | 2 | 3
  color?: string
}

const LEVEL_STYLES = {
  1: { fontSize: 28, lineHeight: 28 * 1.2,  letterSpacing: -28 * 0.015, fontWeight: '700' as const },
  2: { fontSize: 22, lineHeight: 22 * 1.25, letterSpacing: -22 * 0.01,  fontWeight: '700' as const },
  3: { fontSize: 18, lineHeight: 18 * 1.3,  letterSpacing: -18 * 0.005, fontWeight: '700' as const },
} as const

// Web-style metrics use the unitless line-height that BRAND_TYPE spec uses.
const WEB_LINE_HEIGHT = { 1: 1.2, 2: 1.25, 3: 1.3 }

/**
 * Heading primitive. Renders real <h1>/<h2>/<h3> on web (SEO + screen reader
 * landmark) via createElement. Native uses <Text accessibilityRole='header'
 * accessibilityLevel={N}>. Mode-aware via useBrandTokens().
 */
export function BrandHeading({ children, level, color }: BrandHeadingProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const finalColor = color ?? semantic.text.primary

  if (Platform.OS === 'web') {
    const tag = `h${level}` as 'h1' | 'h2' | 'h3'
    return createElement(
      tag,
      {
        style: {
          fontSize: `${LEVEL_STYLES[level].fontSize}px`,
          lineHeight: WEB_LINE_HEIGHT[level],
          letterSpacing: `${LEVEL_STYLES[level].letterSpacing}px`,
          fontWeight: 700,
          color: finalColor,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: 0,
        },
      },
      children,
    )
  }

  return (
    <Text
      accessibilityRole="header"
      accessibilityLevel={level}
      style={{
        ...LEVEL_STYLES[level],
        color: finalColor,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {children}
    </Text>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandHeading`
Expected: PASS — 7 it-cases pass.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/primitives/BrandHeading.tsx packages/officials-ui/test/primitives/BrandHeading.test.tsx
git commit -m "feat(officials-ui): BrandHeading primitive (slice 45 task 4)

level={1,2,3} renders real h1/h2/h3 on web (SEO + screen reader)
via createElement. Native uses Text + accessibilityRole='header'
+ accessibilityLevel. Sizes from BRAND_TYPE (28/22/18px), tracking
from spec, mode-aware via useBrandTokens semantic.text.primary
default with color prop override.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: BrandBodyText primitive (TDD)

**Files:**
- Create: `packages/officials-ui/src/primitives/BrandBodyText.tsx`
- Create: `packages/officials-ui/test/primitives/BrandBodyText.test.tsx`

Size + muted color flag. Renders as `<Text>` on both platforms.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/primitives/BrandBodyText.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandBodyText } from '../../src/primitives/BrandBodyText.tsx'

describe('BrandBodyText', () => {
  it('renders children', () => {
    render(<BrandBodyText>Hello world</BrandBodyText>)
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('default size renders 15px font with 1.55 line-height', () => {
    const { container } = render(<BrandBodyText>Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*15px/)
  })

  it('size=sm renders 13px font', () => {
    const { container } = render(<BrandBodyText size="sm">Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*13px/)
  })

  it('default uses semantic.text.body color', () => {
    const { container } = render(<BrandBodyText>Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    // semantic.text.body in light = #3a322c (RNW normalizes to rgb).
    expect(style).toMatch(/color:\s*rgb\(58,\s*50,\s*44\)/)
  })

  it('muted=true uses semantic.text.muted color', () => {
    const { container } = render(<BrandBodyText muted>Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    // semantic.text.muted in light = #6b5e52 (RNW normalizes).
    expect(style).toMatch(/color:\s*rgb\(107,\s*94,\s*82\)/)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandBodyText`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement BrandBodyText**

Create `packages/officials-ui/src/primitives/BrandBodyText.tsx`:

```tsx
'use client'

import { Text, type TextProps } from 'react-native'
import { type ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BrandBodyTextProps {
  children: ReactNode
  size?: 'default' | 'sm'
  muted?: boolean
  testID?: string
}

const SIZE_DIMS = {
  default: { fontSize: 15, lineHeight: 15 * 1.55 },
  sm:      { fontSize: 13, lineHeight: 13 * 1.55 },
} as const

/**
 * Body text primitive. size=default (15px) or sm (13px). 1.55 line-height
 * both. Color defaults to semantic.text.body; muted=true switches to
 * semantic.text.muted. Mode-aware via useBrandTokens().
 */
export function BrandBodyText({ children, size = 'default', muted = false, testID }: BrandBodyTextProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dims = SIZE_DIMS[size]
  const color = muted ? semantic.text.muted : semantic.text.body
  return (
    <Text
      style={{
        fontSize: dims.fontSize,
        lineHeight: dims.lineHeight,
        color,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
      testID={testID}
    >
      {children}
    </Text>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandBodyText`
Expected: PASS — 5 it-cases pass.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/primitives/BrandBodyText.tsx packages/officials-ui/test/primitives/BrandBodyText.test.tsx
git commit -m "feat(officials-ui): BrandBodyText primitive (slice 45 task 5)

size=default (15px) or sm (13px). 1.55 line-height both. Defaults
to semantic.text.body color; muted=true switches to text.muted.
Mode-aware via useBrandTokens. Inter regular weight (400).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: BrandLink primitive (TDD, smart-anchor inlined)

**Files:**
- Create: `packages/officials-ui/src/primitives/BrandLink.tsx`
- Create: `packages/officials-ui/test/primitives/BrandLink.test.tsx`

Inline smart-anchor pattern (slice 14 reference). Web renders `<a href>` with onClick intercept; native uses `<Pressable>` + `<Text>`.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/primitives/BrandLink.test.tsx`:

```tsx
import { createElement, type ReactNode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { BrandLink } from '../../src/primitives/BrandLink.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BrandLink', () => {
  it('renders as a real <a href> on web', () => {
    const { container } = render(<BrandLink href="https://example.com">Visit</BrandLink>)
    const a = container.querySelector('a[href="https://example.com"]')
    expect(a).not.toBeNull()
    expect(a?.textContent).toBe('Visit')
  })

  it('uses semantic.link.fg color in light mode', () => {
    const { container } = render(<BrandLink href="/x">Tag</BrandLink>, { wrapper: lightWrapper })
    const a = container.querySelector('a') as HTMLAnchorElement
    const style = a.getAttribute('style') ?? ''
    // semantic.link.fg light = #3b6ed1 → rgb(59, 110, 209).
    expect(style).toMatch(/color:\s*rgb\(59,\s*110,\s*209\)/)
  })

  it('uses semantic.link.fg color in dark mode', () => {
    const { container } = render(<BrandLink href="/x">Tag</BrandLink>, { wrapper: darkWrapper })
    const a = container.querySelector('a') as HTMLAnchorElement
    const style = a.getAttribute('style') ?? ''
    // semantic.link.fg dark = #7a98e1 → rgb(122, 152, 225).
    expect(style).toMatch(/color:\s*rgb\(122,\s*152,\s*225\)/)
  })

  it('plain left-click calls onPress + preventDefault', () => {
    const onPress = vi.fn()
    const { container } = render(<BrandLink href="/x" onPress={onPress}>Tag</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = a.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('cmd-click falls through to browser default (no onPress)', () => {
    const onPress = vi.fn()
    const { container } = render(<BrandLink href="/x" onPress={onPress}>Tag</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })
    const notPrevented = a.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('plain left-click without onPress calls Linking.openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(<BrandLink href="https://example.com">Tag</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    a.dispatchEvent(event)
    expect(spy).toHaveBeenCalledWith('https://example.com')
  })

  it('external=true adds target=_blank rel=noopener noreferrer', () => {
    const { container } = render(<BrandLink href="https://example.com" external>Visit</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandLink`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement BrandLink**

Create `packages/officials-ui/src/primitives/BrandLink.tsx`:

```tsx
'use client'

import { createElement, type ReactNode } from 'react'
import { Linking, Platform, Pressable, Text } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BrandLinkProps {
  children: ReactNode
  href: string
  onPress?: () => void
  external?: boolean
}

/**
 * Inline link primitive with smart-anchor behavior (slice 14 + 18 pattern,
 * inlined here per YAGNI — slice 45 spec section 7 risk 2). On web renders
 * real <a href> with onClick intercept: plain left-clicks call
 * preventDefault + onPress (or Linking.openURL fallback); modifier-key
 * clicks (cmd/ctrl/shift/middle) fall through to browser default. Native
 * uses Pressable + Text.
 */
export function BrandLink({ children, href, onPress, external = false }: BrandLinkProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const color = semantic.link.fg

  if (Platform.OS === 'web') {
    const props: Record<string, unknown> = {
      href,
      onClick: (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
        e.preventDefault()
        if (onPress) {
          onPress()
        } else {
          Linking.openURL(href).catch(() => {})
        }
      },
      style: {
        color,
        textDecoration: 'underline',
        fontWeight: 500,
        cursor: 'pointer',
      },
    }
    if (external) {
      props.target = '_blank'
      props.rel = 'noopener noreferrer'
    }
    return createElement('a', props, children)
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => (onPress ? onPress() : Linking.openURL(href).catch(() => {}))}
    >
      <Text
        style={{
          color,
          textDecorationLine: 'underline',
          fontWeight: '500',
        }}
      >
        {children}
      </Text>
    </Pressable>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandLink`
Expected: PASS — 7 it-cases pass.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/primitives/BrandLink.tsx packages/officials-ui/test/primitives/BrandLink.test.tsx
git commit -m "feat(officials-ui): BrandLink primitive (slice 45 task 6)

Smart-anchor pattern inlined (slice 14 reference). Web renders
real <a href> with onClick intercept: plain left-click ->
preventDefault + onPress (or Linking.openURL fallback);
modifier-key clicks fall through. external=true adds
target=_blank rel=noopener noreferrer. Native uses Pressable
+ Text. semantic.link.fg color, weight 500, underline.

3rd inlined copy of smart-anchor (AlignmentChip + slice 18
sites + this) per YAGNI -- future slice consolidates if needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: BrandAlert primitive (TDD, P2 pill)

**Files:**
- Create: `packages/officials-ui/src/primitives/BrandAlert.tsx`
- Create: `packages/officials-ui/test/primitives/BrandAlert.test.tsx`

P2 pill layout: 12px rounded card + 7px pill on left (6px inset) + 18px severity-colored icon circle + title + body. Severity-keyed colors.

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/primitives/BrandAlert.test.tsx`:

```tsx
import { createElement, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandAlert } from '../../src/primitives/BrandAlert.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BrandAlert', () => {
  it('renders title + body', () => {
    render(<BrandAlert severity="danger" title="Couldn't save">Address not found.</BrandAlert>)
    expect(screen.getByText("Couldn't save")).toBeTruthy()
    expect(screen.getByText('Address not found.')).toBeTruthy()
  })

  it('exposes role=alert on the outer container', () => {
    const { container } = render(<BrandAlert severity="danger" title="Oops">body</BrandAlert>)
    const outer = container.querySelector('[role="alert"]')
    expect(outer).not.toBeNull()
  })

  it('danger band uses burgundy #8a3a4d', () => {
    const { container } = render(<BrandAlert severity="danger" title="Oops">body</BrandAlert>, { wrapper: lightWrapper })
    // Pill is the only element styled with rgb(138, 58, 77) bg.
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(138,\s*58,\s*77\)/))
    expect(hasBand).toBe(true)
  })

  it('warning band uses gold #c89a4e', () => {
    const { container } = render(<BrandAlert severity="warning" title="Heads up">body</BrandAlert>, { wrapper: lightWrapper })
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    // RNW normalizes #c89a4e to rgb(200, 154, 78).
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(200,\s*154,\s*78\)/))
    expect(hasBand).toBe(true)
  })

  it('success band uses emerald #1a8f5a', () => {
    const { container } = render(<BrandAlert severity="success" title="Saved">body</BrandAlert>, { wrapper: lightWrapper })
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    // RNW normalizes #1a8f5a to rgb(26, 143, 90).
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(26,\s*143,\s*90\)/))
    expect(hasBand).toBe(true)
  })

  it('info band uses terracotta #b86340', () => {
    const { container } = render(<BrandAlert severity="info" title="FYI">body</BrandAlert>, { wrapper: lightWrapper })
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    // RNW normalizes #b86340 to rgb(184, 99, 64).
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(184,\s*99,\s*64\)/))
    expect(hasBand).toBe(true)
  })

  it('icon glyph differs per severity', () => {
    const dangerR = render(<BrandAlert severity="danger" title="x">y</BrandAlert>)
    expect(dangerR.container.textContent).toContain('!')
    dangerR.unmount()
    const successR = render(<BrandAlert severity="success" title="x">y</BrandAlert>)
    expect(successR.container.textContent).toContain('✓')
    successR.unmount()
    const infoR = render(<BrandAlert severity="info" title="x">y</BrandAlert>)
    expect(infoR.container.textContent).toContain('i')
  })

  it('dark mode card bg is slice 43 universal #2a2e34', () => {
    const { container } = render(<BrandAlert severity="danger" title="Oops">body</BrandAlert>, { wrapper: darkWrapper })
    const outer = container.querySelector('[role="alert"]') as HTMLElement
    const style = outer.getAttribute('style') ?? ''
    // RNW normalizes #2a2e34 to rgb(42, 46, 52).
    expect(style).toMatch(/background-color:\s*rgb\(42,\s*46,\s*52\)/)
  })

  it('title omitted: renders only body content', () => {
    render(<BrandAlert severity="info">Just informational.</BrandAlert>)
    expect(screen.getByText('Just informational.')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandAlert`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement BrandAlert**

Create `packages/officials-ui/src/primitives/BrandAlert.tsx`:

```tsx
'use client'

import { Text, View, type ViewProps } from 'react-native'
import { type ReactNode } from 'react'
import { CATEGORY_CARD_BG, CATEGORY_CARD_BG_DARK } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

export type BrandAlertSeverity = 'danger' | 'warning' | 'success' | 'info'

export interface BrandAlertProps {
  severity: BrandAlertSeverity
  title?: string
  children?: ReactNode
}

const SEVERITY_BANDS: Record<BrandAlertSeverity, { band: string; glyph: string; titleLight: string; titleDark: string }> = {
  danger:  { band: '#8a3a4d', glyph: '!', titleLight: '#8a3a4d', titleDark: '#c89aa8' },
  warning: { band: '#c89a4e', glyph: '!', titleLight: '#7c5a1e', titleDark: '#e1c896' },
  success: { band: '#1a8f5a', glyph: '✓', titleLight: '#0f5a4f', titleDark: '#7eb898' },
  info:    { band: '#b86340', glyph: 'i', titleLight: '#7a3e23', titleDark: '#e0b8a0' },
}

/**
 * Alert callout (P2 pill design, slice 45). 12px rounded card + 7px rounded
 * pill on left (6px inset) + 18px severity-colored icon circle + title + body.
 * 4 severities: danger (burgundy), warning (gold), success (emerald), info
 * (terracotta). Mode-aware via useBrandTokens(); card bg uses slice 43
 * universal CATEGORY_CARD_BG.
 */
export function BrandAlert({ severity, title, children }: BrandAlertProps): React.JSX.Element {
  const { mode, semantic } = useBrandTokens()
  const sev = SEVERITY_BANDS[severity]
  const cardBg = mode === 'dark' ? CATEGORY_CARD_BG_DARK : CATEGORY_CARD_BG
  const titleColor = mode === 'dark' ? sev.titleDark : sev.titleLight

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.strong,
        borderRadius: 12,
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'stretch',
      }}
    >
      <View style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 6, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 7,
            backgroundColor: sev.band,
            borderRadius: 999,
            alignSelf: 'stretch',
          }}
        />
      </View>
      <View style={{ flex: 1, paddingVertical: 10, paddingRight: 14, paddingLeft: 4, flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: sev.band,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 9,
            marginTop: 1,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{sev.glyph}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {title ? (
            <Text style={{ fontWeight: '700', fontSize: 12.5, color: titleColor, marginBottom: 1 }}>
              {title}
            </Text>
          ) : null}
          {children ? (
            <Text style={{ fontSize: 12.5, lineHeight: 12.5 * 1.5, color: semantic.text.body }}>
              {children}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @chiaro/officials-ui test -- BrandAlert`
Expected: PASS — 9 it-cases pass.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/primitives/BrandAlert.tsx packages/officials-ui/test/primitives/BrandAlert.test.tsx
git commit -m "feat(officials-ui): BrandAlert primitive (slice 45 task 7)

P2 pill design. 12px rounded card on slice 43 CATEGORY_CARD_BG.
7px rounded pill on left (6px inset top/bottom/left). 18px
severity-colored icon circle inline with title + body. 4
severities (danger/warning/success/info) keyed to slice 41/42
brand-family colors via SEVERITY_BANDS map. Dark title brightens
to SUB_CASCADE_ACCENT_DARK family per slice 45 spec section 4.5.
role='alert' on outer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Barrel exports

**Files:**
- Modify: `packages/officials-ui/src/index.ts`

Re-export the 5 new primitives + types under a slice 45 section.

- [ ] **Step 1: Read current barrel**

Read `packages/officials-ui/src/index.ts` to locate the end of file + verify the existing export style.

- [ ] **Step 2: Append slice 45 exports**

Append at the END of `packages/officials-ui/src/index.ts`:

```ts

// Slice 45 — brand primitives. Foundational components for page composition
// (Heading, BodyText, Button, Link, Alert). Mode-aware via useBrandTokens().
// Used by slice 47+ to rewrite F1/F2 surfaces (per slice 44 UI audit).
export { BrandButton, type BrandButtonProps } from './primitives/BrandButton.tsx'
export { BrandHeading, type BrandHeadingProps } from './primitives/BrandHeading.tsx'
export { BrandBodyText, type BrandBodyTextProps } from './primitives/BrandBodyText.tsx'
export { BrandLink, type BrandLinkProps } from './primitives/BrandLink.tsx'
export {
  BrandAlert,
  type BrandAlertProps,
  type BrandAlertSeverity,
} from './primitives/BrandAlert.tsx'
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm -r typecheck`
Expected: PASS. All 5 primitives resolve through the barrel.

- [ ] **Step 4: Run full officials-ui suite (sanity)**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — should now hit ~480 tests (456 baseline + ~25 new primitive tests).

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): barrel exports for 5 brand primitives (slice 45 task 8)

Re-export BrandButton + BrandHeading + BrandBodyText + BrandLink +
BrandAlert + their types via the package barrel. Consumers can now
import directly from @chiaro/officials-ui.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: AuthForm consumer migration

**Files:**
- Modify: `packages/officials-ui/src/auth/AuthForm.tsx`

Replace inline `#fef2f0` literal with `semantic.alert.danger.bg` via `useBrandTokens()`.

- [ ] **Step 1: Read the current errorBanner section**

Open `packages/officials-ui/src/auth/AuthForm.tsx`. Find lines 155-176 where `styles.errorBanner` is declared (the inline `#fef2f0` is on line 169).

- [ ] **Step 2: Migrate to consume semantic.alert.danger.bg**

Two patches in `AuthForm.tsx`:

**(a)** Find the `errorBanner` StyleSheet entry (lines 166-173):

```ts
  // Risk #2 acknowledged in spec: light-pink error background inlined as
  // hex placeholder; promote to @chiaro/ui-tokens if a 2nd caller surfaces.
  errorBanner: {
    backgroundColor: '#fef2f0',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
```

Replace with (drop the `backgroundColor` — it moves to inline at the call site):

```ts
  // Slice 45 update: backgroundColor lifted to inline so it consumes
  // semantic.alert.danger.bg via useBrandTokens (mode-aware). The static
  // StyleSheet here keeps layout-only properties.
  errorBanner: {
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
```

**(b)** Find the JSX where `styles.errorBanner` is consumed. It will look something like `<View style={styles.errorBanner}>` near the JSX render. Replace that single line with:

```tsx
<View style={[styles.errorBanner, { backgroundColor: semantic.alert.danger.bg }]}>
```

The component already destructures `{ semantic }` from `useBrandTokens()` (it consumes other semantic tokens elsewhere). If it does NOT, add `const { semantic } = useBrandTokens()` at the top of the component body and import `useBrandTokens` from `../brand-hooks.ts`.

- [ ] **Step 3: Run AuthForm tests**

Run: `pnpm --filter @chiaro/officials-ui test -- AuthForm`
Expected: PASS — existing AuthForm tests don't pin the `#fef2f0` literal (verified during spec drafting). All AuthForm tests stay green.

- [ ] **Step 4: Run full officials-ui suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS — ~480 tests.

- [ ] **Step 5: Workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/auth/AuthForm.tsx
git commit -m "refactor(officials-ui): AuthForm consumes alert.danger.bg token (slice 45 task 9)

Replace inline #fef2f0 error banner bg literal with
semantic.alert.danger.bg consumed via useBrandTokens. After the
slice 45 alert palette retune (Task 1), the literal would
otherwise become stale (#fef2f0 -> #f8d8d0 brand-family
burgundy bg). Mode-aware: dark variant becomes #2a1820 cool slate.

Closes a slice 44 audit F4 finding (the only inline hex within
slice 45's adjacent scope; remaining 8 F4 hex literals belong to
slice 46).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Docs + closeout

**Files:**
- Modify: `docs/brand-book.md`
- Modify: `docs/brand-migration.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/mobile-dod-checklist.md`

Final docs + closeout + final verification.

- [ ] **Step 1: Final workspace verification**

Run: `pnpm -r typecheck`
Expected: PASS.

Run: `pnpm --filter @chiaro/ui-tokens test && pnpm --filter @chiaro/officials-ui test`
Expected: ui-tokens ~163/163 PASS (was 159; +~4 alert.info), officials-ui ~480+/480+ PASS (was 456; +~25 primitive tests).

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Capture `/officials/[id]` First Load size.

- [ ] **Step 2: Append §13 to brand-book.md**

Open `docs/brand-book.md`. Append a new section at the END:

```markdown

## 13. Brand primitives (slice 45)

5 foundational primitives in `@chiaro/officials-ui` for page composition. All mode-aware via `useBrandTokens()`.

### BrandButton
`<BrandButton variant="primary"|"secondary" size="sm"|"default"|"lg" disabled? onPress>{children}</BrandButton>`
Primary: `accent.primary` bg. Secondary: outlined. Disabled: opacity 0.4 + aria-disabled.

### BrandHeading
`<BrandHeading level={1|2|3} color?>{children}</BrandHeading>`
Web renders real `<h1>`/`<h2>`/`<h3>` (SEO). Native uses Text + accessibilityRole='header' + accessibilityLevel. Sizes from BRAND_TYPE.

### BrandBodyText
`<BrandBodyText size="default"|"sm" muted?>{children}</BrandBodyText>`
15px or 13px / 1.55 line-height. Default `semantic.text.body`; muted switches to `semantic.text.muted`.

### BrandLink
`<BrandLink href onPress? external?>{children}</BrandLink>`
Inline smart-anchor (slice 14 pattern inlined). Web `<a href>` + onClick intercept; modifier-key clicks fall through.

### BrandAlert
`<BrandAlert severity="danger"|"warning"|"success"|"info" title?>{children}</BrandAlert>`
P2 pill layout: 12px rounded card + 7px pill on left + 18px severity-colored icon circle + title + body.

### Alert palette (slice 45 brand-family retune)

| severity | light fg | light bg | light border | dark fg | dark bg | dark border |
|---|---|---|---|---|---|---|
| danger | `#8a3a4d` (burgundy) | `#f8d8d0` | `#e0928a` | `#c89aa8` | `#2a1820` | `#5a2535` |
| warning | `#c89a4e` (gold) | `#f9e3b8` | `#d6a85a` | `#e1c896` | `#2e2516` | `#7c5a1e` |
| success | `#1a8f5a` (emerald) | `#c5e0d6` | `#5fa897` | `#7eb898` | `#162a1f` | `#0f5a4f` |
| info | `#b86340` (terracotta) | `#f3d7b6` | `#d6a474` | `#e0b8a0` | `#2a1f18` | `#7a3e23` |

Replaces slice 32 generic red/amber/teal/peach. Dark `fg` values use slice 41 `SUB_CASCADE_ACCENT_DARK` family for legibility against cool-slate page bg.
```

- [ ] **Step 3: Append slice 45 entry to brand-migration.md**

Append at the END of `docs/brand-migration.md`:

```markdown

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
```

- [ ] **Step 4: Append slice 45 entry to CLAUDE.md**

Open `CLAUDE.md`. Find the "Slices delivered" section. Find the slice 44 entry (the audit). After the LAST slice 44 entry (or just after the audit bullet if there's only one), BEFORE the line that starts `Specs live in...`, APPEND this new entry as a single bullet:

```markdown
- **Slice 45 — Brand primitives** (2026-05-29): Mega Slice (~21 files). 5 new primitives in `@chiaro/officials-ui` — `BrandButton` (variant: primary/secondary, size: sm/default/lg, disabled), `BrandHeading` (level: 1/2/3 — real `<h1>`/`<h2>`/`<h3>` on web via createElement; native uses `accessibilityRole="header"` + `accessibilityLevel`), `BrandBodyText` (size: default/sm, muted), `BrandLink` (smart-anchor inlined per YAGNI — 3rd copy of slice 14 pattern), `BrandAlert` (P2 pill: 12px rounded card + 7px rounded pill on left + 18px severity-colored icon circle + title + body; severity: danger/warning/success/info). **Alert palette retune** in `BRAND_PALETTE`: slice 32 generic red/amber/teal/peach → slice 41/42 brand-family burgundy `#8a3a4d` / gold `#c89a4e` / emerald `#1a8f5a` / terracotta `#b86340` (new `alert.info` key). Light bgs at Level-B saturation, dark bgs at deep hue-tinted slate, dark `fg` uses slice 41 `SUB_CASCADE_ACCENT_DARK` family for legibility. **6 existing `semantic.alert.*.fg` consumers** (passed-bill indicators, sanctioned status, censure events, recall_failed, dismissed) shift colors automatically via the brand-hooks layer — intentional cascade. **AuthForm consumer migration**: inline `#fef2f0` → `semantic.alert.danger.bg` (closes 1 of 9 audit F4 inline-hex literals; remaining 8 belong to slice 46). Closes slice 44 audit **F5** (missing primitives). Unblocks **slice 46** (F4 inline-hex sweep) + **slice 47** (F1 web page rewrites using new primitives) + **slice 48** (F2 mobile rewrites + F3 BrandStack nav theming). Decided across 7 visual companion screens (catalog v1 → v2 line-height+intensity → V3+V5 hybrids → 12 band geometries → 10 V5-deeper → 10 pill variants → P1 vs P2 matrix → final lock). Test delta: ui-tokens ~159→163, officials-ui ~456→480. No schema work; pgTAP unchanged at 428.
```

- [ ] **Step 5: Append slice 45 section to mobile DoD**

Open `docs/superpowers/mobile-dod-checklist.md`. Append after the slice 44 entry (or wherever the latest slice section ends), BEFORE the "After the run" footer:

```markdown

## Slice 45 — Brand primitives

- [ ] `BrandButton` primary variant renders with `accent.primary` bg on mobile (orange in light, slate-blue in dark).
- [ ] `BrandButton` secondary variant renders outlined.
- [ ] `BrandHeading` renders text with proper visual hierarchy (h1 > h2 > h3).
- [ ] `BrandBodyText` default (15px) vs sm (13px) sizes visible distinct.
- [ ] `BrandLink` is tappable on mobile, opens external URL (or fires onPress) via `Linking`.
- [ ] `BrandAlert` renders all 4 severities (burgundy/gold/emerald/terracotta) with correct pill + icon colors.
- [ ] AuthForm error banner shows brand-family burgundy bg (was peach-pink in slice 32 era).
- [ ] Dark mode toggle repaints all 5 primitives without app restart.
```

- [ ] **Step 6: Commit**

```bash
git add docs/brand-book.md docs/brand-migration.md CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-45): record slice 45 closeout

Task 10. brand-book §13 (5 primitive APIs + alert palette table).
brand-migration entry (new primitives + retune + consumer cascade +
smart-anchor YAGNI note). CLAUDE.md slice 45 entry. Mobile DoD slice
45 section with 8 verification checkboxes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Final summary to user**

Report:
- 10 task commits + 1 spec commit = 11 total on `slice-45-brand-primitives`.
- 21 files modified/created (5 primitive src + 5 primitive tests + 2 token src + 2 token tests + 1 barrel + 1 AuthForm consumer + 3 docs + 2 closeout).
- 5 new exports + 1 new palette key + 3 retuned alert tokens.
- ui-tokens ~163/163 + officials-ui ~480/480 tests green.
- Workspace typecheck + web build green.
- Mobile smoke deferred per slice 38-43 pattern.
- Closes slice 44 audit F5; unblocks slices 46-48.
- Ready to merge.

---

## Self-review notes

**Spec coverage:**
- §1 goal (5 primitives + alert retune): Tasks 1-9 ✅
- §2 non-goals (no F1/F2 rewrites, no F3, no F4 except AuthForm): preserved by scope ✅
- §4.1 BrandButton: Task 3 ✅
- §4.2 BrandHeading: Task 4 ✅
- §4.3 BrandBodyText: Task 5 ✅
- §4.4 BrandLink: Task 6 ✅
- §4.5 BrandAlert: Task 7 ✅
- §4.6 BRAND_PALETTE retune: Tasks 1-2 ✅
- §4.7 AuthForm refactor: Task 9 ✅
- §5.1-5.7 file plan: 21 files across Tasks 1-10 ✅
- §7 risks: Risk #1 (alert consumer color shift) handled by Task 1 pre-flight grep + Tasks 1+2 token updates; Risk #2 (smart-anchor YAGNI) handled by Task 6 inlining; Risk #3 (AuthForm visual regression) handled by Task 9. ✅
- §8 testing: each task includes the relevant test step. ✅
- §9 surface: 21 files matches ✅
- §10 closeout: Task 10 ✅
- §11 unblocks: documented in CLAUDE.md + brand-migration entries (Task 10) ✅

**Placeholder scan:** None. All steps have exact code or commands.

**Type consistency:**
- `BrandAlertSeverity` type alias used in Task 7 + Task 8 barrel ✅
- `useBrandTokens()` consumed identically across Tasks 3-7 ✅
- Hex values: all locked decisions §4 cross-checked across token tasks (1, 2), primitive tasks (3-7), and docs (10) byte-identical
- RNW rgb normalizations: `#c46a2a → rgb(196, 106, 42)`, `#374f68 → rgb(55, 79, 104)`, `#8a3a4d → rgb(138, 58, 77)`, `#c89a4e → rgb(200, 154, 78)`, `#1a8f5a → rgb(26, 143, 90)`, `#b86340 → rgb(184, 99, 64)`, `#2a2e34 → rgb(42, 46, 52)`, `#3b6ed1 → rgb(59, 110, 209)`, `#7a98e1 → rgb(122, 152, 225)`. Verified.
