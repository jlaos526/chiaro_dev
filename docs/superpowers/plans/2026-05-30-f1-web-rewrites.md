# Slice 47 — F1 web page rewrites + nav rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 6 raw-HTML web pages with declarative compositions using slice 45 brand primitives, behind a new persistent navigation rail that owns brand identity + user identity + sign-out.

**Architecture:** Add `WEB_VIEWPORT_FILL` shared constant + 2 screen shells (`BrandPageScreen`, `BrandFormScreen`) + 1 nav primitive (`BrandNavRail` responsive desktop/mobile) + 1 auth-gated mount (`BrandNavRailMount`) + 1 breakpoint hook + 1 shared `signOut` helper to `@chiaro/officials-ui`. Extend `Logo` with optional `wordmarkSize?` prop. Rewrite 6 pages + delete 1 layout. Bundle slice 45 cleanup items 1+2.

**Tech Stack:** Next.js 15 App Router, React 19, react-native-web 0.19, TypeScript strict, vitest + @testing-library/react, slice 32+ BRAND tokens via `useBrandTokens()`, slice 10 `ChiaroClientProvider` + slice 38 `BrandModeProvider`.

**Spec:** `docs/superpowers/specs/2026-05-30-f1-web-rewrites-design.md`

---

## Task 1: Hoist `WEB_VIEWPORT_FILL` to shared module

**Files:**
- Create: `packages/officials-ui/src/screens/_viewport-fill.ts`
- Create: `packages/officials-ui/test/screens/_viewport-fill.test.ts`
- Modify: `packages/officials-ui/src/auth/AuthScreen.tsx`
- Modify: `packages/officials-ui/src/settings/SettingsScreen.tsx`
- Modify: `packages/officials-ui/src/calibrate/CalibrateScreen.tsx`

- [ ] **Step 1: Write the failing test for the shared constant**

Create `packages/officials-ui/test/screens/_viewport-fill.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { WEB_VIEWPORT_FILL } from '../../src/screens/_viewport-fill.ts'

describe('WEB_VIEWPORT_FILL', () => {
  it('exports the 100vh minHeight object on web (jsdom)', () => {
    expect(WEB_VIEWPORT_FILL).toEqual({ minHeight: '100vh' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test test/screens/_viewport-fill.test.ts`
Expected: FAIL — `Cannot find module '../../src/screens/_viewport-fill.ts'`

- [ ] **Step 3: Implement the shared constant**

Create `packages/officials-ui/src/screens/_viewport-fill.ts`:

```ts
import { Platform } from 'react-native'

// Web parent <main>/<body>/<html> have no defined height by default, so the
// flex:1 on screen-shell outer Views collapses unless we fill the viewport.
// Mobile (RN) gets a flex-filled Screen wrapper from the navigator and
// ignores this. Same value previously duplicated across AuthScreen,
// SettingsScreen, CalibrateScreen — hoisted in slice 47.
//
// RN's DimensionValue type doesn't admit arbitrary CSS unit strings like
// '100vh' but RNW passes them through to CSS at runtime. Cast through
// `unknown` so strict typecheck doesn't reject the value the runtime wants.
export const WEB_VIEWPORT_FILL = Platform.OS === 'web'
  ? ({ minHeight: '100vh' as unknown as number })
  : null
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test test/screens/_viewport-fill.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Migrate AuthScreen to consume the shared constant**

Modify `packages/officials-ui/src/auth/AuthScreen.tsx` — replace the local declaration (around line 22):

```diff
- // Web: parent <main>/<body>/<html> have no defined height by default, so the
- // `flex: 1` on `outer` collapses and the card sits at the top of the viewport.
- // minHeight: '100vh' fills the viewport so justifyContent: 'center' can do its
- // job. Mobile (RN) already gets a flex-filled Screen wrapper from the navigator,
- // so this is web-only.
- // RN's DimensionValue type doesn't admit arbitrary CSS unit strings like '100vh'
- // but RNW passes them through to CSS at runtime. Cast through `any` here so the
- // strict-typecheck doesn't reject the value the runtime actually wants.
- const WEB_VIEWPORT_FILL = Platform.OS === 'web' ? ({ minHeight: '100vh' as unknown as number }) : null
+ import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'
```

Move the `import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'` to the import block. Also remove the now-unused `Platform` import if no other uses remain in the file.

- [ ] **Step 6: Migrate SettingsScreen + CalibrateScreen identically**

Same edits in `packages/officials-ui/src/settings/SettingsScreen.tsx` and `packages/officials-ui/src/calibrate/CalibrateScreen.tsx` — replace the local `WEB_VIEWPORT_FILL` declaration with the shared import; drop unused `Platform` import if applicable.

- [ ] **Step 7: Run the existing screen tests to verify no regression**

Run: `pnpm --filter @chiaro/officials-ui test test/auth test/settings test/calibrate`
Expected: PASS (all existing cases for AuthScreen, SettingsScreen, CalibrateScreen — including the `minHeight: 100vh` style assertion in each)

- [ ] **Step 8: Run the full officials-ui suite + commit**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS (496 + 1 = 497 tests)

```bash
git add packages/officials-ui/src/screens/_viewport-fill.ts \
        packages/officials-ui/test/screens/_viewport-fill.test.ts \
        packages/officials-ui/src/auth/AuthScreen.tsx \
        packages/officials-ui/src/settings/SettingsScreen.tsx \
        packages/officials-ui/src/calibrate/CalibrateScreen.tsx
git commit -m "refactor(officials-ui): hoist WEB_VIEWPORT_FILL to shared module (slice 47 task 1)"
```

---

## Task 2: Logo `wordmarkSize` prop

**Files:**
- Modify: `packages/officials-ui/src/Logo.tsx`
- Modify: `packages/officials-ui/test/Logo.test.tsx`

- [ ] **Step 1: Write the failing tests for the new prop**

Append to `packages/officials-ui/test/Logo.test.tsx` (inside the existing `describe('Logo', ...)` block):

```tsx
describe('wordmarkSize prop (slice 47)', () => {
  it('sets wordmark fontSize to the provided value when passed', () => {
    const { container } = render(
      <Logo variant="lockup" size={24} wordmarkSize={28} />,
      { wrapper: withMode('light') },
    )
    // Find the wordmark Text element (renders CHIARO)
    const wordmark = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'CHIARO') as HTMLElement | undefined
    expect(wordmark?.getAttribute('style')).toMatch(/font-size:\s*28(px)?/i)
  })

  it('falls back to size * 0.65 when wordmarkSize is omitted', () => {
    const { container } = render(
      <Logo variant="lockup" size={32} />,
      { wrapper: withMode('light') },
    )
    const wordmark = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'CHIARO') as HTMLElement | undefined
    // 32 * 0.65 = 20.8
    expect(wordmark?.getAttribute('style')).toMatch(/font-size:\s*20\.8(px)?/i)
  })

  it('computes gap from max(size, wordmarkSize) when wordmarkSize > size', () => {
    const { container } = render(
      <Logo variant="lockup" size={24} wordmarkSize={28} />,
      { wrapper: withMode('light') },
    )
    // Outer lockup container gets the gap; on web it's flex gap on the inline-flex div.
    // max(24, 28) * 0.4 = 11.2
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/gap:\s*11\.2(px)?/i)
  })

  it('computes gap from max(size, wordmarkSize) when wordmarkSize < size', () => {
    const { container } = render(
      <Logo variant="lockup" size={48} wordmarkSize={20} />,
      { wrapper: withMode('light') },
    )
    // max(48, 20) * 0.4 = 19.2
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/gap:\s*19\.2(px)?/i)
  })

  it('derives tracking from wordmarkSize when provided', () => {
    const { container } = render(
      <Logo variant="lockup" size={20} wordmarkSize={28} />,
      { wrapper: withMode('light') },
    )
    const wordmark = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'CHIARO') as HTMLElement | undefined
    // wordmarkSize 28 >= 24 → tracking = 0.07 * 28 = 1.96
    expect(wordmark?.getAttribute('style')).toMatch(/letter-spacing:\s*1\.96(px)?/i)
  })

  it('derives tagline size from wordmarkSize when provided', () => {
    const { container } = render(
      <Logo variant="lockup" size={24} wordmarkSize={28} tagline="civics" />,
      { wrapper: withMode('light') },
    )
    const tagline = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'civics') as HTMLElement | undefined
    // 28 * 0.45 = 12.6
    expect(tagline?.getAttribute('style')).toMatch(/font-size:\s*12\.6(px)?/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/Logo.test.tsx`
Expected: FAIL (6 new cases fail — current code uses fixed `wordmarkSize = size * 0.65`)

- [ ] **Step 3: Extend Logo with the new prop**

Modify `packages/officials-ui/src/Logo.tsx`:

Update the `LogoProps` interface (around line 18):

```tsx
export interface LogoProps {
  size?: number
  variant?: 'mark' | 'lockup'
  tagline?: string
  accessibilityLabel?: string
  /** When provided, decouples wordmark size from mark size. Defaults to `size × 0.65`. */
  wordmarkSize?: number
}
```

Update the lockup branch (around lines 59-65). Replace:

```diff
- // Lockup: mark + CHIARO wordmark (+ optional tagline)
- const wordmarkSize = size * 0.65 // per brand book §8.3
- const wordmarkTracking = size >= 48 ? 0.06 : size >= 24 ? 0.07 : 0.08
- const gap = size * 0.4
- const taglineSize = wordmarkSize * 0.45
- const taglineGap = wordmarkSize * 0.13
+ // Lockup: mark + CHIARO wordmark (+ optional tagline)
+ // wordmarkSize prop (slice 47) decouples wordmark from mark; falls back to brand book §8.3 default.
+ const effectiveWordmarkSize = wordmarkSize ?? size * 0.65
+ const wordmarkTracking = effectiveWordmarkSize >= 48 ? 0.06 : effectiveWordmarkSize >= 24 ? 0.07 : 0.08
+ const gap = Math.max(size, effectiveWordmarkSize) * 0.4
+ const taglineSize = effectiveWordmarkSize * 0.45
+ const taglineGap = effectiveWordmarkSize * 0.13
```

Then update the references in the wordmark Text style block (around line 70):

```diff
-        fontSize: wordmarkSize,
+        fontSize: effectiveWordmarkSize,
         color: semantic.text.primary,
-        letterSpacing: wordmarkTracking * wordmarkSize,
+        letterSpacing: wordmarkTracking * effectiveWordmarkSize,
```

Also accept the new prop in the function signature (around line 29):

```diff
 export function Logo({
   size = 32,
   variant = 'mark',
   tagline,
   accessibilityLabel,
+  wordmarkSize,
 }: LogoProps): React.JSX.Element {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/Logo.test.tsx`
Expected: PASS (existing 18 cases + 6 new = 24 total)

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/Logo.tsx \
        packages/officials-ui/test/Logo.test.tsx
git commit -m "feat(officials-ui): Logo accepts wordmarkSize prop (slice 47 task 2)"
```

---

## Task 3: Slice 45 cleanup item 1 — BrandButton borderColor ternary collapse

**Files:**
- Modify: `packages/officials-ui/src/primitives/BrandButton.tsx:43-45`

- [ ] **Step 1: Confirm existing tests still cover both variants**

Run: `pnpm --filter @chiaro/officials-ui test test/primitives/BrandButton.test.tsx`
Expected: PASS (existing cases — asserts borderColor === semantic.accent.primary for both variants)

- [ ] **Step 2: Collapse the ternary**

Modify `packages/officials-ui/src/primitives/BrandButton.tsx` lines 43-45. Replace:

```diff
-  const borderColor = variant === 'primary'
-    ? semantic.accent.primary
-    : semantic.accent.primary
+  // Slice 47 cleanup: ternary collapsed (both branches identical).
+  const borderColor = semantic.accent.primary
```

- [ ] **Step 3: Run tests to verify no regression**

Run: `pnpm --filter @chiaro/officials-ui test test/primitives/BrandButton.test.tsx`
Expected: PASS (same count as Step 1)

- [ ] **Step 4: Commit**

```bash
git add packages/officials-ui/src/primitives/BrandButton.tsx
git commit -m "refactor(officials-ui): collapse BrandButton borderColor ternary (slice 47 task 3, closes slice 45 cleanup item 1)"
```

---

## Task 4: Slice 45 cleanup item 2 — BrandAlert glyph color from token

**Files:**
- Modify: `packages/officials-ui/src/primitives/BrandAlert.tsx:72`
- Modify: `packages/officials-ui/test/primitives/BrandAlert.test.tsx`

- [ ] **Step 1: Write failing test for glyph color derived from semantic.text.onAccent**

Append to `packages/officials-ui/test/primitives/BrandAlert.test.tsx` (inside the existing describe block):

```tsx
describe('glyph color (slice 47 cleanup item 2)', () => {
  it('uses semantic.text.onAccent in light mode', () => {
    const { container } = render(
      <BrandAlert severity="info">Body</BrandAlert>,
      { wrapper: withMode('light') },
    )
    // Glyph is the 'i' Text node inside the 18px circle.
    const glyph = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'i') as HTMLElement | undefined
    // Light onAccent is '#fff' which RNW normalizes to 'rgb(255, 255, 255)'
    expect(glyph?.getAttribute('style')).toMatch(/color:\s*(rgb\(255,\s*255,\s*255\)|#fff)/i)
  })

  it('uses semantic.text.onAccent in dark mode', () => {
    const { container } = render(
      <BrandAlert severity="info">Body</BrandAlert>,
      { wrapper: withMode('dark') },
    )
    const glyph = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'i') as HTMLElement | undefined
    // Dark onAccent is '#fff0dc' which RNW normalizes to 'rgb(255, 240, 220)'
    expect(glyph?.getAttribute('style')).toMatch(/color:\s*(rgb\(255,\s*240,\s*220\)|#fff0dc)/i)
  })
})
```

If the test file doesn't already import `BrandModeOverrideContext` + define a `withMode` helper, add at the top:

```tsx
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}
```

- [ ] **Step 2: Run tests to verify the new cases fail**

Run: `pnpm --filter @chiaro/officials-ui test test/primitives/BrandAlert.test.tsx`
Expected: FAIL — light passes (because `'#fff'` matches the regex coincidentally), dark fails because glyph is still hardcoded `'#fff'`

- [ ] **Step 3: Replace the inline literal with the semantic token**

Modify `packages/officials-ui/src/primitives/BrandAlert.tsx` line 72. Replace:

```diff
-          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{sev.glyph}</Text>
+          <Text style={{ color: semantic.text.onAccent, fontSize: 11, fontWeight: '800' }}>{sev.glyph}</Text>
```

(No new imports needed — `semantic` is already destructured from `useBrandTokens()` at line 31.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/primitives/BrandAlert.test.tsx`
Expected: PASS (existing cases + 2 new mode-aware glyph cases)

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/primitives/BrandAlert.tsx \
        packages/officials-ui/test/primitives/BrandAlert.test.tsx
git commit -m "refactor(officials-ui): BrandAlert glyph color from semantic.text.onAccent (slice 47 task 4, closes slice 45 cleanup item 2)"
```

---

## Task 5: `BrandPageScreen` shell

**Files:**
- Create: `packages/officials-ui/src/screens/BrandPageScreen.tsx`
- Create: `packages/officials-ui/test/screens/BrandPageScreen.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` (export the new component)

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/screens/BrandPageScreen.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandPageScreen } from '../../src/screens/BrandPageScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BrandPageScreen', () => {
  it('renders title as h1 when provided', () => {
    const { container } = render(
      <BrandPageScreen title="Your officials"><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
    expect(h1?.textContent).toBe('Your officials')
  })

  it('omits heading when title is undefined', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('h1')).toBeNull()
  })

  it('applies semantic.bg.app background on outer wrapper', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    // light bg.app is #faf7ed → rgb(250, 247, 237)
    expect(outer?.getAttribute('style')).toMatch(/background-color:\s*(rgb\(250,\s*247,\s*237\)|#faf7ed)/i)
  })

  it('applies WEB_VIEWPORT_FILL minHeight 100vh on web', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/min-height:\s*100vh/i)
  })

  it('renders children inside the column wrapper', () => {
    const { getByText } = render(
      <BrandPageScreen><div>page-body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('page-body')).toBeTruthy()
  })

  it('consumes the --chiaro-rail-width CSS var on web', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/padding-left:\s*calc\(/i)
    expect(outer?.getAttribute('style')).toContain('--chiaro-rail-width')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/screens/BrandPageScreen.test.tsx`
Expected: FAIL — `Cannot find module '../../src/screens/BrandPageScreen.tsx'`

- [ ] **Step 3: Implement BrandPageScreen**

Create `packages/officials-ui/src/screens/BrandPageScreen.tsx`:

```tsx
'use client'

import { Platform, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { WEB_VIEWPORT_FILL } from './_viewport-fill.ts'

export interface BrandPageScreenProps {
  /** Optional h1 page title via BrandHeading level={1}. Omit when the page body anchors itself (e.g. home page uses Logo + greeting). */
  title?: string
  children: ReactNode
}

// Web: consume --chiaro-rail-width CSS var set by BrandNavRailMount so body
// content shifts right of the persistent desktop rail. Defaults to 0 (no
// rail) when the var is unset.
const WEB_RAIL_AWARE_PADDING = Platform.OS === 'web'
  ? ({ paddingLeft: 'calc(16px + var(--chiaro-rail-width, 0px))' as unknown as number })
  : null

/**
 * Generic page shell for list / landing / error pages. Consumed by `/`,
 * `/officials`, `/not-found`. Forms use BrandFormScreen instead.
 *
 * - Outer: brand bg.app + WEB_VIEWPORT_FILL + rail-aware left padding.
 * - Inner column: maxWidth 560 centered, vertical gap 24.
 * - Optional title renders as BrandHeading level={1} at top of column.
 */
export function BrandPageScreen({ title, children }: BrandPageScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View
      style={[
        styles.outer,
        { backgroundColor: semantic.bg.app },
        WEB_VIEWPORT_FILL,
        WEB_RAIL_AWARE_PADDING,
      ]}
    >
      <View style={styles.column}>
        {title ? <BrandHeading level={1}>{title}</BrandHeading> : null}
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  column: {
    width: '100%',
    maxWidth: 560,
    gap: 24,
  },
})
```

- [ ] **Step 4: Add export to the package barrel**

Modify `packages/officials-ui/src/index.ts` — add (near the existing screen exports, e.g. after the AuthScreen / SettingsScreen exports):

```ts
export { BrandPageScreen, type BrandPageScreenProps } from './screens/BrandPageScreen.tsx'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/screens/BrandPageScreen.test.tsx`
Expected: PASS (6 cases)

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/screens/BrandPageScreen.tsx \
        packages/officials-ui/test/screens/BrandPageScreen.test.tsx \
        packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): BrandPageScreen shell (slice 47 task 5)"
```

---

## Task 6: `BrandFormScreen` shell

**Files:**
- Create: `packages/officials-ui/src/screens/BrandFormScreen.tsx`
- Create: `packages/officials-ui/test/screens/BrandFormScreen.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` (export the new component)

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/screens/BrandFormScreen.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandFormScreen } from '../../src/screens/BrandFormScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BrandFormScreen', () => {
  it('renders required title as h1', () => {
    const { container } = render(
      <BrandFormScreen title="Home address"><div>form</div></BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
    expect(h1?.textContent).toBe('Home address')
  })

  it('renders optional subtitle as muted body text', () => {
    const { getByText } = render(
      <BrandFormScreen title="Home address" subtitle="Last updated yesterday">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('Last updated yesterday')).toBeTruthy()
  })

  it('omits subtitle when not provided', () => {
    const { queryByText } = render(
      <BrandFormScreen title="Home address"><div>form</div></BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(queryByText(/last updated/i)).toBeNull()
  })

  it('renders optional back link with href + label', () => {
    const { container } = render(
      <BrandFormScreen title="Home address" backHref="/settings" backLabel="← Settings">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    const link = container.querySelector('a[href="/settings"]')
    expect(link?.textContent).toBe('← Settings')
  })

  it('omits back link when backHref is absent', () => {
    const { container } = render(
      <BrandFormScreen title="Home address"><div>form</div></BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('a')).toBeNull()
  })

  it('applies card bg.elevated', () => {
    const { container } = render(
      <BrandFormScreen title="X"><div>form</div></BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    // Outer is the bg.app wrapper; card is the first inner View.
    const card = container.firstChild?.firstChild as HTMLElement
    // Light bg.elevated is #ffffff → rgb(255, 255, 255)
    expect(card?.getAttribute('style')).toMatch(/background-color:\s*(rgb\(255,\s*255,\s*255\)|#fff|#ffffff)/i)
  })

  it('renders form children', () => {
    const { getByText } = render(
      <BrandFormScreen title="X"><div>form-body</div></BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('form-body')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/screens/BrandFormScreen.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BrandFormScreen**

Create `packages/officials-ui/src/screens/BrandFormScreen.tsx`:

```tsx
'use client'

import { Platform, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandLink } from '../primitives/BrandLink.tsx'
import { WEB_VIEWPORT_FILL } from './_viewport-fill.ts'

export interface BrandFormScreenProps {
  /** Required h1 page title. */
  title: string
  /** Optional muted subtitle rendered below the title. */
  subtitle?: string
  /** Optional back link href. When set, also requires backLabel. */
  backHref?: string
  /** Visible label for the back link (e.g. "← Settings"). */
  backLabel?: string
  /** Form content rendered inside the card. */
  children: ReactNode
}

const WEB_RAIL_AWARE_PADDING = Platform.OS === 'web'
  ? ({ paddingLeft: 'calc(16px + var(--chiaro-rail-width, 0px))' as unknown as number })
  : null

/**
 * Centered-card form shell. Consumed by `/profile/edit`, `/settings/address`.
 * Use BrandPageScreen for list / landing pages instead.
 *
 * - Outer: brand bg.app + WEB_VIEWPORT_FILL + rail-aware left padding + vertical center.
 * - Card: maxWidth 400, bg.elevated, borderRadius 16, padding 30/24, soft shadow.
 * - Composition: optional back link, h1 title, optional muted subtitle, form children.
 * - No wordmark/logo (those belong to AuthScreen, which is pre-auth).
 */
export function BrandFormScreen({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: BrandFormScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View
      style={[
        styles.outer,
        { backgroundColor: semantic.bg.app },
        WEB_VIEWPORT_FILL,
        WEB_RAIL_AWARE_PADDING,
      ]}
    >
      <View style={[styles.card, { backgroundColor: semantic.bg.elevated }]}>
        {backHref && backLabel ? (
          <View style={styles.backLinkWrap}>
            <BrandLink href={backHref}>{backLabel}</BrandLink>
          </View>
        ) : null}
        <BrandHeading level={1}>{title}</BrandHeading>
        {subtitle ? (
          <View style={styles.subtitleWrap}>
            <BrandBodyText size="sm" muted>{subtitle}</BrandBodyText>
          </View>
        ) : null}
        <View style={styles.formChildrenWrap}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  backLinkWrap: { marginBottom: 12 },
  subtitleWrap: { marginTop: 4 },
  formChildrenWrap: { marginTop: 18, gap: 14 },
})
```

- [ ] **Step 4: Add export to the package barrel**

Modify `packages/officials-ui/src/index.ts` — add after the BrandPageScreen export:

```ts
export { BrandFormScreen, type BrandFormScreenProps } from './screens/BrandFormScreen.tsx'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/screens/BrandFormScreen.test.tsx`
Expected: PASS (7 cases)

- [ ] **Step 6: Commit**

```bash
git add packages/officials-ui/src/screens/BrandFormScreen.tsx \
        packages/officials-ui/test/screens/BrandFormScreen.test.tsx \
        packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): BrandFormScreen shell (slice 47 task 6)"
```

---

## Task 7: `useBreakpoint` hook

**Files:**
- Create: `packages/officials-ui/src/nav/useBreakpoint.ts`
- Create: `packages/officials-ui/test/nav/useBreakpoint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/nav/useBreakpoint.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBreakpoint } from '../../src/nav/useBreakpoint.ts'

interface FakeMQL {
  matches: boolean
  addEventListener: (event: 'change', listener: (e: { matches: boolean }) => void) => void
  removeEventListener: (event: 'change', listener: (e: { matches: boolean }) => void) => void
}

function installMatchMedia(initial: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>()
  const mql: FakeMQL = {
    matches: initial,
    addEventListener: (_e, l) => { listeners.add(l) },
    removeEventListener: (_e, l) => { listeners.delete(l) },
  }
  ;(window as unknown as { matchMedia: (q: string) => FakeMQL }).matchMedia = () => mql
  return {
    fire(matches: boolean) {
      mql.matches = matches
      listeners.forEach(l => l({ matches }))
    },
  }
}

describe('useBreakpoint', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('returns true on mount when matchMedia matches', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => useBreakpoint(768))
    expect(result.current).toBe(true)
  })

  it('returns false on mount when matchMedia does not match', () => {
    installMatchMedia(false)
    const { result } = renderHook(() => useBreakpoint(768))
    expect(result.current).toBe(false)
  })

  it('updates when matchMedia change event fires', () => {
    const { fire } = installMatchMedia(false)
    const { result } = renderHook(() => useBreakpoint(768))
    expect(result.current).toBe(false)
    act(() => fire(true))
    expect(result.current).toBe(true)
    act(() => fire(false))
    expect(result.current).toBe(false)
  })

  it('queries the correct min-width media string', () => {
    let receivedQuery = ''
    ;(window as unknown as { matchMedia: (q: string) => FakeMQL }).matchMedia = (q: string) => {
      receivedQuery = q
      return {
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
    }
    renderHook(() => useBreakpoint(768))
    expect(receivedQuery).toBe('(min-width: 768px)')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/useBreakpoint.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useBreakpoint**

Create `packages/officials-ui/src/nav/useBreakpoint.ts`:

```ts
'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * Subscribe to a min-width media query. SSR-safe: server snapshot is `false`
 * (treat SSR as below breakpoint — safer for narrow viewports). Client
 * snapshot reflects current `matchMedia` state and updates on `change` events.
 *
 * @example
 *   const isDesktop = useBreakpoint(768)
 */
export function useBreakpoint(minWidthPx: number): boolean {
  return useSyncExternalStore(
    typeof window === 'undefined'
      ? noopSubscribe
      : (onChange) => {
          const mql = window.matchMedia(`(min-width: ${minWidthPx}px)`)
          const handler = () => onChange()
          mql.addEventListener('change', handler)
          return () => mql.removeEventListener('change', handler)
        },
    () => (typeof window === 'undefined' ? false : window.matchMedia(`(min-width: ${minWidthPx}px)`).matches),
    () => false,
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/useBreakpoint.test.ts`
Expected: PASS (4 cases)

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/nav/useBreakpoint.ts \
        packages/officials-ui/test/nav/useBreakpoint.test.ts
git commit -m "feat(officials-ui): useBreakpoint hook (slice 47 task 7)"
```

---

## Task 8: Shared `signOut` helper

**Files:**
- Create: `packages/officials-ui/src/nav/sign-out.ts`
- Create: `packages/officials-ui/test/nav/sign-out.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/nav/sign-out.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { signOut } from '../../src/nav/sign-out.ts'

describe('signOut', () => {
  let originalCookie: string

  beforeEach(() => {
    originalCookie = document.cookie
    document.cookie = 'chiaro_skip_calibrate=1; path=/'
  })

  afterEach(() => {
    document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('clears the chiaro_skip_calibrate cookie', async () => {
    const router = { push: vi.fn(), refresh: vi.fn() }
    const client = { auth: { signOut: vi.fn().mockResolvedValue({}) } }
    await signOut(router, client as never)
    expect(document.cookie).not.toContain('chiaro_skip_calibrate=1')
  })

  it('awaits client.auth.signOut()', async () => {
    const router = { push: vi.fn(), refresh: vi.fn() }
    const order: string[] = []
    const client = {
      auth: {
        signOut: vi.fn(async () => {
          order.push('signOut')
          return {}
        }),
      },
    }
    const orig = router.push
    router.push = vi.fn((path: string) => {
      order.push(`push:${path}`)
      return orig(path)
    })
    await signOut(router, client as never)
    expect(order).toEqual(['signOut', 'push:/sign-in'])
  })

  it('routes to /sign-in then refreshes', async () => {
    const router = { push: vi.fn(), refresh: vi.fn() }
    const client = { auth: { signOut: vi.fn().mockResolvedValue({}) } }
    await signOut(router, client as never)
    expect(router.push).toHaveBeenCalledWith('/sign-in')
    expect(router.refresh).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/sign-out.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement signOut helper**

Create `packages/officials-ui/src/nav/sign-out.ts`:

```ts
'use client'

import type { ChiaroClient } from '@chiaro/supabase-client'

export interface SignOutRouter {
  push: (path: string) => void
  refresh: () => void
}

/**
 * Single sign-out implementation consumed by both the nav rail and the
 * settings page Sign Out row. Clears the skip-calibrate cookie, ends the
 * Supabase session, then routes to /sign-in.
 */
export async function signOut(router: SignOutRouter, client: ChiaroClient): Promise<void> {
  document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  await client.auth.signOut()
  router.push('/sign-in')
  router.refresh()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/sign-out.test.ts`
Expected: PASS (3 cases)

- [ ] **Step 5: Export from index + commit**

Modify `packages/officials-ui/src/index.ts` — add:

```ts
export { signOut, type SignOutRouter } from './nav/sign-out.ts'
```

```bash
git add packages/officials-ui/src/nav/sign-out.ts \
        packages/officials-ui/test/nav/sign-out.test.ts \
        packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): shared signOut helper (slice 47 task 8)"
```

---

## Task 9: `BrandNavRail` component

**Files:**
- Create: `packages/officials-ui/src/nav/BrandNavRail.tsx`
- Create: `packages/officials-ui/test/nav/BrandNavRail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/nav/BrandNavRail.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandNavRail } from '../../src/nav/BrandNavRail.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

const user = { displayName: 'Sarah', username: 'sarah', initial: 'S' }

describe('BrandNavRail desktop variant', () => {
  it('renders avatar block with name + @handle', () => {
    const { getByText } = render(
      <BrandNavRail variant="desktop" user={user} pathname="/" onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sarah')).toBeTruthy()
    expect(getByText('@sarah')).toBeTruthy()
    expect(getByText('S')).toBeTruthy()
  })

  it('renders 3 nav items (Home / Officials / Settings)', () => {
    const { getByText } = render(
      <BrandNavRail variant="desktop" user={user} pathname="/" onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Home')).toBeTruthy()
    expect(getByText('Officials')).toBeTruthy()
    expect(getByText('Settings')).toBeTruthy()
  })

  it('marks the active item with bg.elevated', () => {
    const { container } = render(
      <BrandNavRail variant="desktop" user={user} pathname="/officials" onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    const officialsItem = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'Officials')?.parentElement?.parentElement as HTMLElement | undefined
    // Active item has data-active attribute via dataSet (RNW); also bg.elevated style.
    expect(officialsItem?.getAttribute('data-active')).toBe('true')
  })

  it('renders Sign out at bottom', () => {
    const { getByText } = render(
      <BrandNavRail variant="desktop" user={user} pathname="/" onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sign out')).toBeTruthy()
  })

  it('invokes onNavigate when a nav item is pressed', () => {
    const onNavigate = vi.fn()
    const { getByText } = render(
      <BrandNavRail variant="desktop" user={user} pathname="/" onNavigate={onNavigate} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Officials'))
    expect(onNavigate).toHaveBeenCalledWith('/officials')
  })

  it('invokes onSignOut when Sign out is pressed', () => {
    const onSignOut = vi.fn()
    const { getByText } = render(
      <BrandNavRail variant="desktop" user={user} pathname="/" onNavigate={() => {}} onSignOut={onSignOut} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Sign out'))
    expect(onSignOut).toHaveBeenCalled()
  })

  it('handles user without display_name (falls back to username initial)', () => {
    const { getByText } = render(
      <BrandNavRail
        variant="desktop"
        user={{ displayName: null, username: 'alice', initial: 'A' }}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('alice')).toBeTruthy()
    expect(getByText('A')).toBeTruthy()
  })
})

describe('BrandNavRail mobile variant', () => {
  it('renders hamburger + avatar top bar when closed', () => {
    const { container, getByText } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('[aria-label="Open menu"]')).toBeTruthy()
    expect(getByText('S')).toBeTruthy()
  })

  it('does not render Navigate items when closed', () => {
    const { queryByText } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(queryByText('Officials')).toBeNull()
    expect(queryByText('Sign out')).toBeNull()
  })

  it('renders overlay rail + scrim when open', () => {
    const { container, getByText } = render(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Officials')).toBeTruthy()
    expect(getByText('Sign out')).toBeTruthy()
    expect(container.querySelector('[data-chiaro-rail-scrim="true"]')).toBeTruthy()
  })

  it('calls onOpenChange(true) when hamburger is pressed', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={onOpenChange}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    const hamburger = container.querySelector('[aria-label="Open menu"]') as HTMLElement
    fireEvent.click(hamburger)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('calls onOpenChange(false) when scrim is pressed', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={onOpenChange}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    const scrim = container.querySelector('[data-chiaro-rail-scrim="true"]') as HTMLElement
    fireEvent.click(scrim)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when a nav item is pressed', () => {
    const onOpenChange = vi.fn()
    const { getByText } = render(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={onOpenChange}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Officials'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('aria-expanded on hamburger reflects open state', () => {
    const { container, rerender } = render(
      <BrandNavRail
        variant="mobile"
        open={false}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('[aria-label="Open menu"]')?.getAttribute('aria-expanded')).toBe('false')
    rerender(
      <BrandNavRail
        variant="mobile"
        open={true}
        onOpenChange={() => {}}
        user={user}
        pathname="/"
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(container.querySelector('[aria-label="Open menu"]')?.getAttribute('aria-expanded')).toBe('true')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandNavRail.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BrandNavRail**

Create `packages/officials-ui/src/nav/BrandNavRail.tsx`:

```tsx
'use client'

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface RailUser {
  displayName: string | null
  username: string | null
  initial: string
}

interface RailCommonProps {
  user: RailUser
  pathname: string
  onNavigate: (path: string) => void
  onSignOut: () => void
}

interface RailDesktopProps extends RailCommonProps {
  variant: 'desktop'
}

interface RailMobileProps extends RailCommonProps {
  variant: 'mobile'
  open: boolean
  onOpenChange: (next: boolean) => void
}

export type BrandNavRailProps = RailDesktopProps | RailMobileProps

const NAV_ITEMS: Array<{ path: string; label: string }> = [
  { path: '/',         label: 'Home' },
  { path: '/officials', label: 'Officials' },
  { path: '/settings',  label: 'Settings' },
]

function isActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/') return pathname === '/'
  return pathname === itemPath || pathname.startsWith(itemPath + '/')
}

export function BrandNavRail(props: BrandNavRailProps): React.JSX.Element {
  if (props.variant === 'desktop') return <DesktopRail {...props} />
  return <MobileRail {...props} />
}

function DesktopRail({ user, pathname, onNavigate, onSignOut }: RailDesktopProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={[styles.desktopRail, { backgroundColor: semantic.bg.subtle, borderRightColor: semantic.border.default }]}>
      <AvatarBlock user={user} semantic={semantic} />
      <NavSection
        pathname={pathname}
        onNavigate={onNavigate}
        semantic={semantic}
        onClose={undefined}
      />
      <View style={{ flex: 1 }} />
      <SignOutItem onPress={onSignOut} semantic={semantic} />
    </View>
  )
}

function MobileRail({
  user,
  pathname,
  onNavigate,
  onSignOut,
  open,
  onOpenChange,
}: RailMobileProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const handleNavigate = (path: string) => {
    onNavigate(path)
    onOpenChange(false)
  }
  const handleSignOut = () => {
    onSignOut()
    onOpenChange(false)
  }
  return (
    <>
      <View style={[styles.topBar, { backgroundColor: semantic.bg.elevated, borderBottomColor: semantic.border.default }]}>
        <Pressable
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          onPress={() => onOpenChange(!open)}
          aria-expanded={open}
          style={styles.hamburger}
        >
          <View style={[styles.hamburgerBar, { backgroundColor: semantic.text.primary }]} />
          <View style={[styles.hamburgerBar, { backgroundColor: semantic.text.primary }]} />
          <View style={[styles.hamburgerBar, { backgroundColor: semantic.text.primary }]} />
        </Pressable>
        <AvatarCircle initial={user.initial} size={28} semantic={semantic} />
      </View>
      {open ? (
        <>
          <Pressable
            accessibilityLabel="Close menu"
            onPress={() => onOpenChange(false)}
            dataSet={{ chiaroRailScrim: 'true' }}
            style={styles.scrim}
          />
          <View style={[styles.overlayRail, { backgroundColor: semantic.bg.elevated, borderRightColor: semantic.border.default }]}>
            <AvatarBlock user={user} semantic={semantic} />
            <NavSection
              pathname={pathname}
              onNavigate={handleNavigate}
              semantic={semantic}
              onClose={() => onOpenChange(false)}
            />
            <View style={{ flex: 1 }} />
            <SignOutItem onPress={handleSignOut} semantic={semantic} />
          </View>
        </>
      ) : null}
    </>
  )
}

function AvatarBlock({ user, semantic }: { user: RailUser; semantic: ReturnType<typeof useBrandTokens>['semantic'] }): React.JSX.Element {
  const name = user.displayName ?? user.username ?? 'Welcome'
  const handle = user.username ? `@${user.username}` : null
  return (
    <View style={[styles.avatarBlock, { borderBottomColor: semantic.border.default }]}>
      <AvatarCircle initial={user.initial} size={36} semantic={semantic} />
      <View style={styles.avatarText}>
        <Text style={[styles.avatarName, { color: semantic.text.primary }]} numberOfLines={1}>{name}</Text>
        {handle ? <Text style={[styles.avatarHandle, { color: semantic.text.muted }]} numberOfLines={1}>{handle}</Text> : null}
      </View>
    </View>
  )
}

function AvatarCircle({ initial, size, semantic }: { initial: string; size: number; semantic: ReturnType<typeof useBrandTokens>['semantic'] }): React.JSX.Element {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: semantic.accent.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: semantic.text.onAccent, fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  )
}

function NavSection({
  pathname,
  onNavigate,
  semantic,
  onClose,
}: {
  pathname: string
  onNavigate: (path: string) => void
  semantic: ReturnType<typeof useBrandTokens>['semantic']
  onClose: (() => void) | undefined
}): React.JSX.Element {
  return (
    <View style={styles.navSection}>
      <Text style={[styles.sectionLabel, { color: semantic.text.muted }]}>NAVIGATE</Text>
      {NAV_ITEMS.map(item => {
        const active = isActive(pathname, item.path)
        return (
          <Pressable
            key={item.path}
            accessibilityRole="link"
            onPress={() => {
              onNavigate(item.path)
              onClose?.()
            }}
            dataSet={{ active: active ? 'true' : 'false' }}
            style={[
              styles.navItem,
              { backgroundColor: active ? semantic.bg.elevated : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.navItemText,
                { color: semantic.text.primary, fontWeight: active ? '600' : '400' },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function SignOutItem({
  onPress,
  semantic,
}: {
  onPress: () => void
  semantic: ReturnType<typeof useBrandTokens>['semantic']
}): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navItem}>
      <Text style={[styles.navItemText, { color: semantic.alert.danger.fg, fontWeight: '600' }]}>Sign out</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  desktopRail: {
    width: 200,
    paddingHorizontal: 12,
    paddingVertical: 18,
    gap: 14,
    borderRightWidth: 1,
    height: '100%' as unknown as number,
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  hamburger: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    gap: 4,
  },
  hamburgerBar: { height: 2, borderRadius: 2 },
  scrim: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 10,
  },
  overlayRail: {
    position: 'absolute' as const,
    top: 0, left: 0, bottom: 0,
    width: 240,
    paddingHorizontal: 12,
    paddingVertical: 18,
    gap: 14,
    borderRightWidth: 1,
    zIndex: 11,
  },
  avatarBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  avatarText: { flexShrink: 1 },
  avatarName: { fontWeight: '700', fontSize: 13, lineHeight: 16 },
  avatarHandle: { fontSize: 11, lineHeight: 14 },
  navSection: { gap: 2 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
  },
  navItem: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
  },
  navItemText: { fontSize: 13 },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandNavRail.test.tsx`
Expected: PASS (14 cases — 7 desktop + 7 mobile)

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/nav/BrandNavRail.tsx \
        packages/officials-ui/test/nav/BrandNavRail.test.tsx
git commit -m "feat(officials-ui): BrandNavRail responsive component (slice 47 task 9)"
```

---

## Task 10: `BrandNavRailMount` + barrel exports

**Files:**
- Create: `packages/officials-ui/src/nav/BrandNavRailMount.tsx`
- Create: `packages/officials-ui/test/nav/BrandNavRailMount.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` (export new components + types)

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/nav/BrandNavRailMount.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { ChiaroClientProvider } from '../../src/client-context.tsx'
import { BrandNavRailMount } from '../../src/nav/BrandNavRailMount.tsx'

// next/navigation stubs — vi.mock'd so the mount can be tested in isolation
let mockPathname = '/'
const mockRouter = { push: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}))

// Stub getMyProfile from @chiaro/profile so we control the user identity
let mockProfile: { display_name: string | null; username: string | null; completed: boolean } | null = {
  display_name: 'Sarah', username: 'sarah', completed: true,
}
vi.mock('@chiaro/profile', () => ({
  getMyProfile: vi.fn(async () => mockProfile),
}))

const fakeClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })),
    signOut: vi.fn(async () => ({})),
  },
} as never

function wrap(mode: 'light' | 'dark' = 'light') {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      ChiaroClientProvider,
      { client: fakeClient },
      createElement(BrandModeOverrideContext.Provider, { value: mode }, children),
    )
}

describe('BrandNavRailMount', () => {
  it('renders null when no session user', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: null } }))
    mockPathname = '/'
    const { container } = render(<BrandNavRailMount />, { wrapper: wrap() })
    // Allow the auth-state effect to resolve
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(container.firstChild).toBeNull()
  })

  it.each(['/sign-in', '/sign-up', '/calibrate'])(
    'renders null on excluded route %s',
    async (path) => {
      fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
      mockPathname = path
      const { container } = render(<BrandNavRailMount />, { wrapper: wrap() })
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(container.firstChild).toBeNull()
    },
  )

  it('renders rail on /', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
    mockPathname = '/'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sarah')).toBeTruthy()
  })

  it('renders rail on /officials', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
    mockPathname = '/officials'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Sign out')).toBeTruthy()
  })

  it('falls back to "Welcome" + "?" when profile is null', async () => {
    fakeClient.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
    mockProfile = null
    mockPathname = '/'
    const { findByText } = render(<BrandNavRailMount />, { wrapper: wrap() })
    expect(await findByText('Welcome')).toBeTruthy()
    expect(await findByText('?')).toBeTruthy()
    mockProfile = { display_name: 'Sarah', username: 'sarah', completed: true } // reset
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandNavRailMount.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BrandNavRailMount**

Create `packages/officials-ui/src/nav/BrandNavRailMount.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getMyProfile } from '@chiaro/profile'
import { useChiaroClient } from '../client-context.tsx'
import { useBreakpoint } from './useBreakpoint.ts'
import { BrandNavRail, type RailUser } from './BrandNavRail.tsx'
import { signOut } from './sign-out.ts'

const EXCLUDED_PREFIXES = ['/sign-in', '/sign-up', '/calibrate']

function deriveInitial(p: { display_name: string | null; username: string | null } | null): string {
  const source = p?.display_name ?? p?.username
  if (!source || source.length === 0) return '?'
  return source[0]!.toUpperCase()
}

/**
 * Auth-gated + route-aware mount for BrandNavRail. Renders null on pre-auth
 * routes and when no session user; otherwise renders the responsive rail
 * (desktop persistent ≥768px, mobile hamburger overlay <768px) and writes
 * the CSS var `--chiaro-rail-width` so BrandPageScreen + BrandFormScreen can
 * push their content right of the rail.
 */
export function BrandNavRailMount(): React.JSX.Element | null {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const client = useChiaroClient()
  const isDesktop = useBreakpoint(768)

  const [hasUser, setHasUser] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await client.auth.getUser()
      if (cancelled) return
      const user = data.user
      setHasUser(!!user)
      if (user) {
        const p = await getMyProfile(client)
        if (!cancelled) setProfile(p)
      }
    })()
    return () => { cancelled = true }
  }, [client])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const railShown = !!hasUser
      && !EXCLUDED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
      && isDesktop
    document.documentElement.style.setProperty('--chiaro-rail-width', railShown ? '200px' : '0px')
    return () => {
      document.documentElement.style.setProperty('--chiaro-rail-width', '0px')
    }
  }, [hasUser, pathname, isDesktop])

  const handleNavigate = useCallback((path: string) => router.push(path), [router])
  const handleSignOut = useCallback(() => { void signOut(router, client) }, [router, client])

  if (hasUser === false || hasUser === null) return null
  if (EXCLUDED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  const user: RailUser = {
    displayName: profile?.display_name ?? null,
    username:    profile?.username ?? null,
    initial:     deriveInitial(profile),
  }

  if (isDesktop) {
    return (
      <BrandNavRail
        variant="desktop"
        user={user}
        pathname={pathname}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
    )
  }
  return (
    <BrandNavRail
      variant="mobile"
      open={mobileOpen}
      onOpenChange={setMobileOpen}
      user={user}
      pathname={pathname}
      onNavigate={handleNavigate}
      onSignOut={handleSignOut}
    />
  )
}
```

- [ ] **Step 4: Add barrel exports**

Modify `packages/officials-ui/src/index.ts` — add after the signOut export:

```ts
export { BrandNavRail, type BrandNavRailProps, type RailUser } from './nav/BrandNavRail.tsx'
export { BrandNavRailMount } from './nav/BrandNavRailMount.tsx'
export { useBreakpoint } from './nav/useBreakpoint.ts'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandNavRailMount.test.tsx`
Expected: PASS (7 cases — null when no user + 3 excluded routes + 2 included routes + null-profile fallback)

- [ ] **Step 6: Run full officials-ui suite + commit**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS (~534 tests — 496 baseline + 38 new across tasks 1-10)

```bash
git add packages/officials-ui/src/nav/BrandNavRailMount.tsx \
        packages/officials-ui/test/nav/BrandNavRailMount.test.tsx \
        packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): BrandNavRailMount auth-gated wrapper (slice 47 task 10)"
```

---

## Task 11: Wire `BrandNavRailMount` into web `QueryProvider`

**Files:**
- Modify: `apps/web/lib/query-client.tsx`
- Create: `apps/web/test/lib/query-client.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/query-client.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// Stub the rail mount so we can assert it renders without exercising its full surface
vi.mock('@chiaro/officials-ui', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    BrandNavRailMount: () => <div data-testid="rail-mount-stub">RAIL</div>,
  }
})

// Stub the browser supabase client factory
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })), signOut: vi.fn() },
  }),
}))

import { QueryProvider } from '../../lib/query-client'

describe('QueryProvider', () => {
  it('renders BrandNavRailMount as sibling of children', () => {
    const { getByTestId, getByText } = render(
      <QueryProvider>
        <div>page-body</div>
      </QueryProvider>,
    )
    expect(getByTestId('rail-mount-stub')).toBeTruthy()
    expect(getByText('page-body')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/web test test/lib/query-client.test.tsx`
Expected: FAIL — rail-mount-stub not in DOM

- [ ] **Step 3: Modify QueryProvider to mount the rail**

Modify `apps/web/lib/query-client.tsx` — add the import + insert the mount inside QueryClientProvider:

```diff
 'use client'

 import * as React from 'react'
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
-import { ChiaroClientProvider } from '@chiaro/officials-ui'
+import { ChiaroClientProvider, BrandNavRailMount } from '@chiaro/officials-ui'
 import { createSupabaseBrowserClient } from './supabase/client'

 // ... (makeQueryClient + getQueryClient unchanged) ...

 export function QueryProvider({ children }: { children: React.ReactNode }) {
   const [qc] = React.useState(getQueryClient)
   return (
     <ChiaroClientProvider client={chiaroClient}>
-      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
+      <QueryClientProvider client={qc}>
+        <BrandNavRailMount />
+        {children}
+      </QueryClientProvider>
     </ChiaroClientProvider>
   )
 }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/web test test/lib/query-client.test.tsx`
Expected: PASS (1 case)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/query-client.tsx \
        apps/web/test/lib/query-client.test.tsx
git commit -m "feat(web): mount BrandNavRailMount inside QueryProvider (slice 47 task 11)"
```

---

## Task 12: Settings page uses shared `signOut` helper

**Files:**
- Modify: `apps/web/app/settings/page.tsx:21-27`

- [ ] **Step 1: Replace the inline handler with the shared helper**

Modify `apps/web/app/settings/page.tsx`. Replace:

```diff
 'use client'

 import { useRouter } from 'next/navigation'
 import {
   BrandModeThemeRow,
   SettingsActionRow,
   SettingsComingSoonRow,
   SettingsNavRow,
   SettingsScreen,
   SettingsSection,
   SettingsToggleRow,
   SettingsValueRow,
+  signOut,
 } from '@chiaro/officials-ui'
 import { createSupabaseBrowserClient } from '@/lib/supabase/client'

 const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

 export default function SettingsIndex() {
   const router = useRouter()

   async function handleSignOut() {
-    document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
-    const supabase = createSupabaseBrowserClient()
-    await supabase.auth.signOut()
-    router.push('/sign-in')
-    router.refresh()
+    await signOut(router, createSupabaseBrowserClient())
   }
   // ... rest unchanged ...
```

- [ ] **Step 2: Run the web suite to verify no regression**

Run: `pnpm --filter @chiaro/web test`
Expected: PASS (existing tests + task 11's new test)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/settings/page.tsx
git commit -m "refactor(web): settings page uses shared signOut helper (slice 47 task 12)"
```

---

## Task 13: Delete `apps/web/app/settings/layout.tsx`

**Files:**
- Delete: `apps/web/app/settings/layout.tsx`

- [ ] **Step 1: Delete the file**

```bash
git rm apps/web/app/settings/layout.tsx
```

- [ ] **Step 2: Run the web build to verify nothing references it**

Run: `pnpm --filter @chiaro/web build`
Expected: SUCCESS — build completes; Next falls through to root layout for /settings + /settings/address.

If build fails referencing the deleted layout, search for stale imports:

```bash
git grep -n "settings/layout" apps/web/
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(web): delete settings/layout.tsx (slice 47 task 13)

SettingsScreen (slice 39) renders its own page chrome on /settings, and
/settings/address gets BrandFormScreen chrome with its own back-nav after
slice 47. The layout was rendering a redundant 'Settings' heading on
/settings (double-chrome bug). Next falls through to root layout."
```

---

## Task 14: Rewrite `not-found.tsx`

**Files:**
- Modify: `apps/web/app/not-found.tsx`
- Create: `apps/web/test/app/not-found.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/not-found.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import NotFound from '../../app/not-found'

describe('NotFound page', () => {
  it('renders the title as h1 "Page not found"', () => {
    const { container } = render(<NotFound />)
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Page not found')
  })

  it('renders the Go home link with href="/"', () => {
    const { container } = render(<NotFound />)
    const link = container.querySelector('a[href="/"]')
    expect(link?.textContent).toContain('Go home')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/web test test/app/not-found.test.tsx`
Expected: FAIL — current not-found renders `<main>` + `<h1>Page not found</h1>` + raw `<a>` (the second assertion may pass coincidentally; the first will pass too — but after rewrite the BrandPageScreen structure is what we verify). Run anyway to baseline.

Actually — the existing markup already satisfies these assertions. To force a failing test that reflects the new shape, change the second assertion:

Replace the second `it` with:

```tsx
  it('renders inside BrandPageScreen (centered column on brand bg)', () => {
    const { container } = render(<NotFound />)
    // BrandPageScreen wraps in a View with semantic.bg.app background.
    // Expect that style on the outermost wrapper.
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/background-color:/i)
  })
```

Re-run: Expected: FAIL — current `<main>` has no inline background-color.

- [ ] **Step 3: Rewrite not-found.tsx**

Replace `apps/web/app/not-found.tsx`:

```tsx
import { BrandPageScreen, BrandBodyText, BrandLink } from '@chiaro/officials-ui'

export default function NotFound(): React.JSX.Element {
  return (
    <BrandPageScreen title="Page not found">
      <BrandBodyText>We couldn&apos;t find what you were looking for.</BrandBodyText>
      <BrandLink href="/">← Go home</BrandLink>
    </BrandPageScreen>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/web test test/app/not-found.test.tsx`
Expected: PASS (2 cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/not-found.tsx \
        apps/web/test/app/not-found.test.tsx
git commit -m "feat(web): rewrite /not-found with BrandPageScreen (slice 47 task 14)"
```

---

## Task 15: Rewrite `/officials/page.tsx`

**Files:**
- Modify: `apps/web/app/officials/page.tsx`
- Create: `apps/web/test/app/officials-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/officials-page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
  })),
}))

vi.mock('../../app/officials/OfficialsListClient', () => ({
  OfficialsListClient: () => <div data-testid="officials-list">officials list</div>,
}))

import OfficialsPage from '../../app/officials/page'

describe('Officials page', () => {
  it('renders title "Your officials" as h1 via BrandPageScreen', async () => {
    const el = await OfficialsPage()
    const { container } = render(el)
    const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
    expect(h1?.textContent).toBe('Your officials')
  })

  it('redirects to /sign-in when no user', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    })
    await OfficialsPage()
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/web test test/app/officials-page.test.tsx`
Expected: FAIL — current page renders `<main><h1>` (no aria-level=1 on h1 element). First test may fail; second passes.

- [ ] **Step 3: Rewrite officials/page.tsx**

Replace `apps/web/app/officials/page.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BrandPageScreen } from '@chiaro/officials-ui'
import { OfficialsListClient } from './OfficialsListClient'

export default async function OfficialsPage(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  return (
    <BrandPageScreen title="Your officials">
      <OfficialsListClient />
    </BrandPageScreen>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/web test test/app/officials-page.test.tsx`
Expected: PASS (2 cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/officials/page.tsx \
        apps/web/test/app/officials-page.test.tsx
git commit -m "feat(web): rewrite /officials with BrandPageScreen (slice 47 task 15)"
```

---

## Task 16: Rewrite home (`apps/web/app/page.tsx`)

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/test/app/home-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/home-page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

let mockUser: { id: string } | null = { id: 'u1' }
let mockProfile: { display_name: string | null; username: string | null; completed: boolean } | null = {
  display_name: 'Sarah', username: 'sarah', completed: true,
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockUser } })) },
  })),
}))
vi.mock('@chiaro/profile', () => ({
  getMyProfile: vi.fn(async () => mockProfile),
}))
vi.mock('@/components/DistrictPanel', () => ({
  DistrictPanel: () => <div data-testid="district-panel">district</div>,
}))
vi.mock('../../app/OfficialsCardClient', () => ({
  OfficialsCardClient: () => <div data-testid="officials-card">officials</div>,
}))

import Home from '../../app/page'

describe('Home page', () => {
  it('redirects to /sign-in when no user', async () => {
    mockUser = null
    await Home()
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
    mockUser = { id: 'u1' }
  })

  it('renders Logo lockup + Welcome heading with profile name', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah', completed: true }
    const el = await Home()
    const { container } = render(el)
    // Welcome heading
    const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
    expect(h1?.textContent).toBe('Welcome, Sarah')
    // Logo lockup contains CHIARO wordmark
    const wordmark = Array.from(container.querySelectorAll('*'))
      .find(el => el.textContent === 'CHIARO')
    expect(wordmark).toBeTruthy()
  })

  it('renders profile-completion BrandAlert when profile incomplete', async () => {
    mockProfile = { display_name: null, username: null, completed: false }
    const el = await Home()
    const { container, getByText } = render(el)
    expect(getByText('Complete your profile')).toBeTruthy()
    expect(container.querySelector('a[href="/profile/edit"]')).toBeTruthy()
  })

  it('does not render an inline sign-out form (moved to nav rail)', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah', completed: true }
    const el = await Home()
    const { container } = render(el)
    expect(container.querySelector('form[action="/sign-out"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/web test test/app/home-page.test.tsx`
Expected: FAIL — current home has `<h1>Chiaro</h1>` (not "Welcome, Sarah"), no Logo wordmark, no BrandAlert, has sign-out form.

- [ ] **Step 3: Rewrite home page**

Replace `apps/web/app/page.tsx`:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMyProfile } from '@chiaro/profile'
import { redirect } from 'next/navigation'
import {
  BrandPageScreen,
  BrandHeading,
  BrandAlert,
  BrandLink,
  Logo,
} from '@chiaro/officials-ui'
import { DistrictPanel } from '@/components/DistrictPanel'
import { OfficialsCardClient } from './OfficialsCardClient'

export default async function Home(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const profile = await getMyProfile(supabase)

  const greetingName = profile?.display_name ?? profile?.username ?? null
  const greeting = greetingName ? `Welcome, ${greetingName}` : 'Welcome'

  return (
    <BrandPageScreen>
      <Logo variant="lockup" size={24} wordmarkSize={28} />
      <BrandHeading level={1}>{greeting}</BrandHeading>
      {!profile?.completed ? (
        <BrandAlert severity="info" title="Complete your profile">
          <BrandLink href="/profile/edit">Add your display name and username →</BrandLink>
        </BrandAlert>
      ) : null}
      <DistrictPanel />
      <OfficialsCardClient />
    </BrandPageScreen>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/web test test/app/home-page.test.tsx`
Expected: PASS (4 cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx \
        apps/web/test/app/home-page.test.tsx
git commit -m "feat(web): rewrite / (home) with Logo lockup + BrandPageScreen (slice 47 task 16)"
```

---

## Task 17: Rewrite `/profile/edit/page.tsx`

**Files:**
- Modify: `apps/web/app/profile/edit/page.tsx`
- Create: `apps/web/test/app/profile-edit-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/profile-edit-page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const updateMyProfile = vi.fn()
vi.mock('@chiaro/profile', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    updateMyProfile: (...args: unknown[]) => updateMyProfile(...args),
    ProfileError: class ProfileError extends Error {},
  }
})

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

import ProfileEditPage from '../../app/profile/edit/page'

describe('ProfileEditPage', () => {
  it('renders BrandFormScreen with title "Complete your profile"', () => {
    const { container } = render(<ProfileEditPage />)
    const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
    expect(h1?.textContent).toBe('Complete your profile')
  })

  it('submits the form and routes to / on success', async () => {
    updateMyProfile.mockResolvedValueOnce({})
    const { container, getByText } = render(<ProfileEditPage />)
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'Sarah' } })
    fireEvent.change(inputs[1]!, { target: { value: 'sarah' } })
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
    expect(refreshMock).toHaveBeenCalled()
  })

  it('renders BrandAlert with danger severity on submission error', async () => {
    updateMyProfile.mockRejectedValueOnce(new Error('Username taken'))
    const { container, getByText, findByText } = render(<ProfileEditPage />)
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'Sarah' } })
    fireEvent.change(inputs[1]!, { target: { value: 'sarah' } })
    fireEvent.click(getByText('Save'))
    await findByText(/username taken/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/web test test/app/profile-edit-page.test.tsx`
Expected: FAIL — current page renders bare `<main><h1>Complete your profile</h1>` (h1 may pass but BrandTextInput / BrandButton / BrandAlert structure not present).

- [ ] **Step 3: Rewrite profile/edit/page.tsx**

Replace `apps/web/app/profile/edit/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'
import {
  BrandFormScreen,
  BrandTextInput,
  BrandButton,
  BrandAlert,
} from '@chiaro/officials-ui'

export default function ProfileEditPage(): React.JSX.Element {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    const parsed = profileFormSchema.safeParse({ display_name: displayName, username })
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join('; '))
      return
    }
    setLoading(true)
    const client = createSupabaseBrowserClient()
    try {
      await updateMyProfile(client, parsed.data)
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <BrandFormScreen title="Complete your profile" backHref="/" backLabel="← Home">
      <BrandTextInput label="Display name" value={displayName} onChangeText={setDisplayName} />
      <BrandTextInput label="Username" value={username} onChangeText={setUsername} />
      {error ? <BrandAlert severity="danger" title="Couldn't save">{error}</BrandAlert> : null}
      <BrandButton variant="primary" disabled={loading} onPress={handleSubmit}>
        {loading ? 'Saving…' : 'Save'}
      </BrandButton>
    </BrandFormScreen>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/web test test/app/profile-edit-page.test.tsx`
Expected: PASS (3 cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/profile/edit/page.tsx \
        apps/web/test/app/profile-edit-page.test.tsx
git commit -m "feat(web): rewrite /profile/edit with BrandFormScreen (slice 47 task 17)"
```

---

## Task 18: Rewrite `/settings/address/page.tsx`

**Files:**
- Modify: `apps/web/app/settings/address/page.tsx`
- Create: `apps/web/test/app/settings-address-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app/settings-address-page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const getMyLocation = vi.fn()
vi.mock('@chiaro/location', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    getMyLocation: (...args: unknown[]) => getMyLocation(...args),
  }
})

const functionsInvoke = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
  }),
}))

import EditAddressPage from '../../app/settings/address/page'

describe('EditAddressPage', () => {
  it('renders bootstrap state with title "Home address"', async () => {
    getMyLocation.mockResolvedValueOnce(null)
    const { container } = render(<EditAddressPage />)
    await waitFor(() => {
      const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
      expect(h1?.textContent).toBe('Home address')
    })
  })

  it('bootstraps from existing location into the input', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St',
      calibrated_at: '2026-05-30T12:00:00Z',
    })
    const { container } = render(<EditAddressPage />)
    await waitFor(() => {
      const input = container.querySelector('input') as HTMLInputElement | null
      expect(input?.value).toBe('123 Main St')
    })
  })

  it('renders last-updated subtitle when calibratedAt present', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St',
      calibrated_at: '2026-05-30T12:00:00Z',
    })
    const { findByText } = render(<EditAddressPage />)
    await findByText(/last updated/i)
  })

  it('submits + routes to /settings on success', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St, Springfield IL 62701',
      calibrated_at: null,
    })
    functionsInvoke.mockResolvedValueOnce({ error: null })
    const { container, getByText } = render(<EditAddressPage />)
    await waitFor(() => expect(container.querySelector('input')?.value).toBe('123 Main St, Springfield IL 62701'))
    fireEvent.click(getByText('Save'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/settings'))
  })

  it('renders BrandAlert with danger severity on error', async () => {
    getMyLocation.mockResolvedValueOnce({
      home_address_text: '123 Main St, Springfield IL 62701',
      calibrated_at: null,
    })
    functionsInvoke.mockResolvedValueOnce({ error: { context: { status: 400 } } })
    const { container, getByText, findByText } = render(<EditAddressPage />)
    await waitFor(() => expect(container.querySelector('input')?.value).toBe('123 Main St, Springfield IL 62701'))
    fireEvent.click(getByText('Save'))
    await findByText(/couldn'?t find that address/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/web test test/app/settings-address-page.test.tsx`
Expected: FAIL — current page renders `<section><h2>` (h1 assertion fails).

- [ ] **Step 3: Rewrite settings/address/page.tsx**

Replace `apps/web/app/settings/address/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { addressInputSchema, getMyLocation } from '@chiaro/location'
import {
  BrandFormScreen,
  BrandTextInput,
  BrandButton,
  BrandAlert,
  BrandBodyText,
} from '@chiaro/officials-ui'

export default function EditAddressPage(): React.JSX.Element {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    getMyLocation(supabase as never).then(loc => {
      if (loc) {
        setAddress(loc.home_address_text)
        setCalibratedAt(loc.calibrated_at)
      }
      setBootstrapping(false)
    }).catch(() => setBootstrapping(false))
  }, [])

  async function handleSubmit() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) {
      setError('Enter a complete address (street, city, state, ZIP).')
      return
    }
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError("We couldn't find that address.")
      else if (status === 502) setError('Address lookup is temporarily unavailable. Try again.')
      else setError('Could not save. Try again.')
      return
    }
    router.push('/settings')
    router.refresh()
  }

  if (bootstrapping) {
    return (
      <BrandFormScreen title="Home address" backHref="/settings" backLabel="← Settings">
        <BrandBodyText muted>Loading…</BrandBodyText>
      </BrandFormScreen>
    )
  }

  const subtitle = calibratedAt ? `Last updated ${new Date(calibratedAt).toLocaleString()}` : undefined

  return (
    <BrandFormScreen
      title="Home address"
      backHref="/settings"
      backLabel="← Settings"
      subtitle={subtitle}
    >
      <BrandTextInput label="Address" value={address} onChangeText={setAddress} />
      {error ? <BrandAlert severity="danger" title="Couldn't save">{error}</BrandAlert> : null}
      <BrandButton variant="primary" disabled={loading} onPress={handleSubmit}>
        {loading ? 'Saving…' : 'Save'}
      </BrandButton>
    </BrandFormScreen>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @chiaro/web test test/app/settings-address-page.test.tsx`
Expected: PASS (5 cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/settings/address/page.tsx \
        apps/web/test/app/settings-address-page.test.tsx
git commit -m "feat(web): rewrite /settings/address with BrandFormScreen (slice 47 task 18)"
```

---

## Task 19: Final verification — full suite, typecheck, build

**Files:** none (verification only)

- [ ] **Step 1: Run the full workspace test suite**

Run: `pnpm test`
Expected: PASS across all workspaces. officials-ui ~534 tests, web ~22 tests (5 new page tests + 1 query-client + ~16 existing), no regressions in other packages.

- [ ] **Step 2: Run typecheck across all packages**

Run: `pnpm -r typecheck`
Expected: PASS (10 packages, no TS errors)

- [ ] **Step 3: Run Next.js build to verify production bundle**

Run: `pnpm --filter @chiaro/web build`
Expected: SUCCESS. Compare bundle sizes; expect modest changes:
- `/` shrinks slightly (removed inline form) or grows slightly (Logo + primitives)
- `/officials`, `/profile/edit`, `/settings/address`, `/not-found` consume `@chiaro/officials-ui` primitives but most were already pulled in transitively

- [ ] **Step 4: Append manual smoke verification rows to mobile-dod-checklist**

Modify `docs/superpowers/mobile-dod-checklist.md` — append a new section:

```markdown
## Slice 47 — F1 web rewrites + nav rail (web)

- [ ] Sign in → land on `/` → see persistent left rail with avatar + Navigate + Sign out
- [ ] Resize browser <768px → rail collapses to hamburger top bar
- [ ] Tap hamburger → overlay rail slides in, scrim dims content
- [ ] Tap scrim → overlay closes
- [ ] Navigate Home → Officials → Settings, active item highlight tracks
- [ ] Sign out from rail → land on `/sign-in`, no rail visible
- [ ] Hit `/sign-in` directly while authed → no rail visible (excluded route)
- [ ] Hit a 404 URL → "Page not found" via BrandPageScreen, rail present if authed
- [ ] Edit profile flow happy path → routes back to `/`
- [ ] Edit profile flow error path → BrandAlert displays + form re-enabled
- [ ] Edit address flow happy path → routes back to `/settings`
- [ ] Edit address flow error path → BrandAlert displays
- [ ] /settings/address back link lands on /settings (not `/`)
- [ ] Dark mode toggle from /settings → rail repaints correctly
- [ ] Home page Welcome heading uses display_name when present; falls back to username; "Welcome" alone when both null
- [ ] Profile-completion BrandAlert appears on home only when profile.completed === false
```

- [ ] **Step 5: Commit verification + checklist**

```bash
git add docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-47): mobile DoD checklist additions for nav rail + page rewrites (slice 47 task 19)"
```

- [ ] **Step 6: Confirm branch state ready for review/merge**

Run: `git log --oneline master..slice-47-f1-web-rewrites`
Expected: ~20 commits (1 spec + 1 plan + 19 task commits)

Run: `git diff --stat master..slice-47-f1-web-rewrites`
Expected: ~22 files changed (~6 NEW shells/nav/utils + ~6 page rewrites + ~5 small modifies + 1 delete + 2 docs + ~6 new test files); insertions far exceed deletions due to TDD + nav rail expansion.

---

## Self-review summary

**Spec coverage check:** Every spec §1-§9 item maps to a task:
- §1 in-scope: tasks 5-18 + 19 closure
- §2 file structure: matches task file paths
- §3 BrandNavRail composition + behavior: task 9
- §3 auth gating + identity data + sign-out helper: tasks 8, 10
- §3 body layout shift + CSS var: tasks 5, 6, 10
- §3 SSR / hydration: task 7
- §4 BrandPageScreen / BrandFormScreen / _viewport-fill: tasks 1, 5, 6
- §5 page rewrites: tasks 13, 14, 15, 16, 17, 18 + task 11 (layout wiring)
- §6 Logo wordmarkSize + cleanup items: tasks 2, 3, 4
- §7 testing: every task has TDD steps; task 19 runs full suite + adds smoke checklist
- §8 risks acknowledged: implementer follows the spec where R1-R7 inform behavior decisions
- §9 visual decisions locked: implementation honors the W3 lock (size=24 wordmarkSize=28), the responsive R, the M3 layout

**Placeholder scan:** No TBD/TODO/handwave in any step. Every code block is complete.

**Type consistency check:**
- `BrandNavRailProps` discriminated union (variant: 'desktop' | 'mobile') used consistently in tasks 9 + 10
- `RailUser` interface defined in task 9, consumed in tasks 9 + 10
- `signOut(router, client)` signature: `SignOutRouter` interface defined in task 8, consumed in tasks 8 + 12
- `useBreakpoint(minWidthPx: number): boolean` used in tasks 7 + 10
- `BrandPageScreenProps` + `BrandFormScreenProps` defined in tasks 5 + 6, consumed in tasks 14, 15, 16, 17, 18
- Logo `wordmarkSize?: number` defined in task 2, consumed in task 16
