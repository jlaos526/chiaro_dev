# Slice 38 — Dark Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a settings-page System / Light / Dark toggle that flows through the slice 33+ `BrandModeOverrideContext` and persists across reloads/relaunches on both platforms.

**Architecture:** New `<BrandModeProvider>` + `<BrandModeThemeRow>` in `@chiaro/officials-ui` (platform-agnostic, React Context only). Web persists via cookie read in async root layout (`cookies()` from `next/headers`) → no flash. Mobile persists via AsyncStorage hydrated in the existing `_layout.tsx` loading gate.

**Tech Stack:** Next.js 15 (App Router, cookies API), Expo Router, React Native + react-native-web, AsyncStorage, vitest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-05-27-dark-mode-toggle-design.md`

---

## Task 1: BrandModeProvider + useBrandModeSetter

**Files:**
- Create: `packages/officials-ui/src/brand-mode-provider.tsx`
- Create: `packages/officials-ui/test/brand-mode-provider.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` (add export at end)

The Provider wraps the existing `BrandModeOverrideContext` (already exported from `brand-hooks.ts`) plus a new sibling `BrandModeSetterContext`. Token consumers continue reading via `useBrandTokens()`; the toggle UI reads the setter via `useBrandModeSetter()`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/officials-ui/test/brand-mode-provider.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useBrandTokens } from '../src/brand-hooks.ts'
import { BrandModeProvider, useBrandModeSetter } from '../src/brand-mode-provider.tsx'

function withProvider(defaultMode: 'light' | 'dark' | null, onChange?: (m: 'light' | 'dark' | null) => void) {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeProvider, { defaultMode, onChange }, children)
}

describe('BrandModeProvider', () => {
  it('defaults useBrandTokens.mode to light when defaultMode is null and useColorScheme is null', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: withProvider(null) })
    expect(result.current.mode).toBe('light')
  })

  it('forces dark when defaultMode is "dark"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: withProvider('dark') })
    expect(result.current.mode).toBe('dark')
  })

  it('forces light when defaultMode is "light"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: withProvider('light') })
    expect(result.current.mode).toBe('light')
  })

  it('setMode updates the active mode for consumers', () => {
    const { result } = renderHook(
      () => ({ tokens: useBrandTokens(), setter: useBrandModeSetter() }),
      { wrapper: withProvider(null) },
    )
    expect(result.current.tokens.mode).toBe('light')
    act(() => result.current.setter.setMode('dark'))
    expect(result.current.tokens.mode).toBe('dark')
  })

  it('setMode(null) clears the override and falls back to system', () => {
    const { result } = renderHook(
      () => ({ tokens: useBrandTokens(), setter: useBrandModeSetter() }),
      { wrapper: withProvider('dark') },
    )
    expect(result.current.tokens.mode).toBe('dark')
    act(() => result.current.setter.setMode(null))
    // No useColorScheme mock → null override falls through to light default.
    expect(result.current.tokens.mode).toBe('light')
  })

  it('invokes onChange with the new value on each setMode call', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useBrandModeSetter(), {
      wrapper: withProvider(null, onChange),
    })
    act(() => result.current.setMode('dark'))
    act(() => result.current.setMode('light'))
    act(() => result.current.setMode(null))
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenNthCalledWith(1, 'dark')
    expect(onChange).toHaveBeenNthCalledWith(2, 'light')
    expect(onChange).toHaveBeenNthCalledWith(3, null)
  })

  it('exposes the current override on the setter context', () => {
    const { result } = renderHook(() => useBrandModeSetter(), {
      wrapper: withProvider('dark'),
    })
    expect(result.current.override).toBe('dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test -- brand-mode-provider`
Expected: FAIL with `Cannot find module '../src/brand-mode-provider.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/officials-ui/src/brand-mode-provider.tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { BrandModeOverrideContext } from './brand-hooks.ts'
import type { BrandMode } from '@chiaro/ui-tokens'

interface SetterCtx {
  override: BrandMode | null
  setMode: (mode: BrandMode | null) => void
}

const BrandModeSetterContext = createContext<SetterCtx | null>(null)

export interface BrandModeProviderProps {
  defaultMode: BrandMode | null
  onChange?: (mode: BrandMode | null) => void | Promise<void>
  children: ReactNode
}

export function BrandModeProvider({ defaultMode, onChange, children }: BrandModeProviderProps) {
  const [override, setOverride] = useState<BrandMode | null>(defaultMode)
  const setMode = useCallback(
    (mode: BrandMode | null) => {
      setOverride(mode)
      void onChange?.(mode)
    },
    [onChange],
  )
  const setterValue = useMemo<SetterCtx>(() => ({ override, setMode }), [override, setMode])
  return (
    <BrandModeOverrideContext.Provider value={override}>
      <BrandModeSetterContext.Provider value={setterValue}>
        {children}
      </BrandModeSetterContext.Provider>
    </BrandModeOverrideContext.Provider>
  )
}

export function useBrandModeSetter(): SetterCtx {
  const ctx = useContext(BrandModeSetterContext)
  if (!ctx) {
    throw new Error('useBrandModeSetter must be used inside <BrandModeProvider>')
  }
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test -- brand-mode-provider`
Expected: PASS (7 tests)

- [ ] **Step 5: Add export to barrel**

Edit `packages/officials-ui/src/index.ts`. After the existing `// Slice 33 — brand retrofit` block (around line 207), append:

```ts
// Slice 38 — dark mode toggle
export {
  BrandModeProvider,
  useBrandModeSetter,
  type BrandModeProviderProps,
} from './brand-mode-provider.tsx'
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/brand-mode-provider.tsx packages/officials-ui/test/brand-mode-provider.test.tsx packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): BrandModeProvider + useBrandModeSetter

Slice 38 task 1. Adds Context Provider that wraps the existing
BrandModeOverrideContext (from brand-hooks.ts) plus a sibling
BrandModeSetterContext exposing { override, setMode }. Token consumers
keep reading via useBrandTokens(); future toggle UI reads the setter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: BrandModeThemeRow segmented control

**Files:**
- Create: `packages/officials-ui/src/settings/brand-mode-theme-row.tsx`
- Create: `packages/officials-ui/test/brand-mode-theme-row.test.tsx`
- Modify: `packages/officials-ui/src/index.ts` (add export)

Three-button segmented control. Reads current mode via `useBrandModeSetter()`, themes itself via `useBrandTokens()`. Cross-platform — uses RN primitives that work on RNW.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/officials-ui/test/brand-mode-theme-row.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeProvider } from '../src/brand-mode-provider.tsx'
import { BrandModeThemeRow } from '../src/settings/brand-mode-theme-row.tsx'

function withProvider(defaultMode: 'light' | 'dark' | null, onChange?: (m: 'light' | 'dark' | null) => void) {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeProvider, { defaultMode, onChange }, children)
}

describe('BrandModeThemeRow', () => {
  it('renders three buttons labelled System, Light, Dark', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null) })
    expect(getByText('System')).toBeTruthy()
    expect(getByText('Light')).toBeTruthy()
    expect(getByText('Dark')).toBeTruthy()
  })

  it('marks System as selected when override is null', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null) })
    const systemBtn = getByText('System').closest('[role="button"]')
    expect(systemBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks Light as selected when override is "light"', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider('light') })
    expect(getByText('Light').closest('[role="button"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(getByText('System').closest('[role="button"]')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('marks Dark as selected when override is "dark"', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider('dark') })
    expect(getByText('Dark').closest('[role="button"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('tapping Dark calls onChange with "dark"', () => {
    const onChange = vi.fn()
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null, onChange) })
    fireEvent.click(getByText('Dark'))
    expect(onChange).toHaveBeenCalledWith('dark')
  })

  it('tapping System calls onChange with null', () => {
    const onChange = vi.fn()
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider('dark', onChange) })
    fireEvent.click(getByText('System'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('tapping Light calls onChange with "light"', () => {
    const onChange = vi.fn()
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null, onChange) })
    fireEvent.click(getByText('Light'))
    expect(onChange).toHaveBeenCalledWith('light')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test -- brand-mode-theme-row`
Expected: FAIL with `Cannot find module '../src/settings/brand-mode-theme-row.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/officials-ui/src/settings/brand-mode-theme-row.tsx
'use client'

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { useBrandModeSetter } from '../brand-mode-provider.tsx'
import type { BrandMode } from '@chiaro/ui-tokens'

interface Option {
  value: BrandMode | null
  label: string
}

const OPTIONS: readonly Option[] = [
  { value: null,    label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark' },
]

export function BrandModeThemeRow() {
  const { semantic } = useBrandTokens()
  const { override, setMode } = useBrandModeSetter()
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: semantic.text.muted }]}>Theme</Text>
      <View style={[styles.row, { borderColor: semantic.border.default, backgroundColor: semantic.bg.card }]}>
        {OPTIONS.map((opt, idx) => {
          const selected = opt.value === override
          return (
            <Pressable
              key={opt.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              aria-pressed={selected}
              onPress={() => setMode(opt.value)}
              style={[
                styles.segment,
                idx > 0 && { borderLeftWidth: 1, borderLeftColor: semantic.border.default },
                selected && { backgroundColor: semantic.accent.bg },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? semantic.accent.primary : semantic.text.body },
                  selected && styles.segmentTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root:                { gap: 8 },
  label:               { fontSize: 13, fontWeight: '600' },
  row:                 { flexDirection: 'row', borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  segment:             { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText:         { fontSize: 14 },
  segmentTextSelected: { fontWeight: '600' },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test -- brand-mode-theme-row`
Expected: PASS (7 tests)

- [ ] **Step 5: Add export to barrel**

Edit `packages/officials-ui/src/index.ts`. Inside the `// Slice 38` block from Task 1, append:

```ts
export { BrandModeThemeRow } from './settings/brand-mode-theme-row.tsx'
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter @chiaro/officials-ui typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/officials-ui/src/settings/brand-mode-theme-row.tsx packages/officials-ui/test/brand-mode-theme-row.test.tsx packages/officials-ui/src/index.ts
git commit -m "feat(officials-ui): BrandModeThemeRow segmented control

Slice 38 task 2. Three-button (System / Light / Dark) segmented
control. Reads + writes via useBrandModeSetter(), themes itself via
useBrandTokens(). Both accessibilityState.selected (native) and
aria-pressed (web, Gotcha #22) set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: useBrandModeSetter standalone error test

**Files:**
- Create: `packages/officials-ui/test/use-brand-mode-setter.test.tsx`

Spec §9 calls out the out-of-Provider error as a dedicated test file to keep error-path coverage discoverable.

- [ ] **Step 1: Write the test**

```tsx
// packages/officials-ui/test/use-brand-mode-setter.test.tsx
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBrandModeSetter } from '../src/brand-mode-provider.tsx'

describe('useBrandModeSetter (outside Provider)', () => {
  it('throws a clear error when used without <BrandModeProvider>', () => {
    expect(() => renderHook(() => useBrandModeSetter())).toThrow(
      /must be used inside <BrandModeProvider>/,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test -- use-brand-mode-setter`
Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add packages/officials-ui/test/use-brand-mode-setter.test.tsx
git commit -m "test(officials-ui): useBrandModeSetter throws outside Provider

Slice 38 task 3. Per spec §9 — standalone file keeps error-path
coverage easy to find.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Web cookie helpers

**Files:**
- Create: `apps/web/lib/brand-mode-cookie.ts` (server-only)
- Create: `apps/web/lib/brand-mode-cookie.client.ts` (client setter)

No tests — Next.js + cookie integration test infra doesn't exist in this workspace. Verified by manual smoke in Task 7.

- [ ] **Step 1: Write the server reader**

```ts
// apps/web/lib/brand-mode-cookie.ts
import 'server-only'
import { cookies } from 'next/headers'
import type { BrandMode } from '@chiaro/ui-tokens'

export const BRAND_MODE_COOKIE_KEY = 'chiaro_brand_mode'

export async function readBrandModeCookie(): Promise<BrandMode | null> {
  const store = await cookies()
  const v = store.get(BRAND_MODE_COOKIE_KEY)?.value
  return v === 'light' || v === 'dark' ? v : null
}
```

- [ ] **Step 2: Write the client setter**

```ts
// apps/web/lib/brand-mode-cookie.client.ts
'use client'

import type { BrandMode } from '@chiaro/ui-tokens'

export const BRAND_MODE_COOKIE_KEY = 'chiaro_brand_mode'

export function writeBrandModeCookie(mode: BrandMode | null): void {
  if (typeof document === 'undefined') return
  const maxAge = mode === null ? 0 : 60 * 60 * 24 * 365
  const value = mode === null ? '' : mode
  document.cookie = `${BRAND_MODE_COOKIE_KEY}=${value}; Max-Age=${maxAge}; path=/; SameSite=Lax`
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/brand-mode-cookie.ts apps/web/lib/brand-mode-cookie.client.ts
git commit -m "feat(web): brand-mode cookie read/write helpers

Slice 38 task 4. Server reader uses next/headers cookies(); client
setter uses document.cookie with Max-Age=1y, path=/, SameSite=Lax.
null = clear (Max-Age=0).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Web root layout + settings page

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/settings/page.tsx`

Root layout becomes async to read the cookie server-side, wraps with `<BrandModeProvider>` outside `<QueryProvider>`. Settings page adds the theme row.

- [ ] **Step 1: Update root layout**

Replace contents of `apps/web/app/layout.tsx` with:

```tsx
import { BrandModeProvider } from '@chiaro/officials-ui'
import { QueryProvider } from '@/lib/query-client'
import { readBrandModeCookie } from '@/lib/brand-mode-cookie'
import { ClientBrandModeWiring } from '@/lib/brand-mode-client-wiring'

export const metadata = { title: 'Chiaro' }

export default async function RootLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const defaultMode = await readBrandModeCookie()
  return (
    <html lang="en">
      <body>
        <ClientBrandModeWiring defaultMode={defaultMode}>
          <QueryProvider>{children}</QueryProvider>
        </ClientBrandModeWiring>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create the client wiring wrapper**

`BrandModeProvider` is a client component (uses `useState`), so the `onChange` function must be supplied client-side. Add a thin client wrapper:

Create `apps/web/lib/brand-mode-client-wiring.tsx`:

```tsx
'use client'

import { BrandModeProvider } from '@chiaro/officials-ui'
import { writeBrandModeCookie } from '@/lib/brand-mode-cookie.client'
import type { ReactNode } from 'react'
import type { BrandMode } from '@chiaro/ui-tokens'

export function ClientBrandModeWiring({
  defaultMode,
  children,
}: {
  defaultMode: BrandMode | null
  children: ReactNode
}) {
  return (
    <BrandModeProvider defaultMode={defaultMode} onChange={writeBrandModeCookie}>
      {children}
    </BrandModeProvider>
  )
}
```

- [ ] **Step 3: Update settings page**

Replace contents of `apps/web/app/settings/page.tsx` with:

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandModeThemeRow } from '@chiaro/officials-ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SettingsIndex() {
  const router = useRouter()
  async function handleSignOut() {
    document.cookie = 'chiaro_skip_calibrate=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }
  return (
    <ul>
      <li><Link href="/settings/address">Home address</Link></li>
      <li style={{ margin: '16px 0' }}><BrandModeThemeRow /></li>
      <li><button type="button" onClick={handleSignOut}>Sign out</button></li>
    </ul>
  )
}
```

- [ ] **Step 4: Verify typecheck + build**

Run: `pnpm --filter @chiaro/web typecheck`
Expected: PASS

Run: `pnpm --filter @chiaro/web build`
Expected: PASS — no unused-import errors, no SSR cookie-read errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/settings/page.tsx apps/web/lib/brand-mode-client-wiring.tsx
git commit -m "feat(web): wire BrandModeProvider + settings toggle

Slice 38 task 5. Root layout becomes async, reads
chiaro_brand_mode cookie via next/headers, passes through a thin
client wrapper that supplies writeBrandModeCookie as onChange.
Settings page gains BrandModeThemeRow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Mobile AsyncStorage helpers

**Files:**
- Create: `apps/mobile/lib/brand-mode-storage.ts`

- [ ] **Step 1: Write the helpers**

```ts
// apps/mobile/lib/brand-mode-storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BrandMode } from '@chiaro/ui-tokens'

export const BRAND_MODE_STORAGE_KEY = 'chiaro_brand_mode'

export async function readBrandMode(): Promise<BrandMode | null> {
  try {
    const v = await AsyncStorage.getItem(BRAND_MODE_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export async function writeBrandMode(mode: BrandMode | null): Promise<void> {
  if (mode === null) {
    await AsyncStorage.removeItem(BRAND_MODE_STORAGE_KEY)
  } else {
    await AsyncStorage.setItem(BRAND_MODE_STORAGE_KEY, mode)
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/brand-mode-storage.ts
git commit -m "feat(mobile): brand-mode AsyncStorage helpers

Slice 38 task 6. Read swallows errors → null fallthrough (per spec
§8). Write removes the key on null. Storage key matches web cookie:
chiaro_brand_mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Mobile root layout + settings page

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/(app)/settings/index.tsx`

The existing `_layout.tsx` already gates rendering on a `loaded` flag for the auth session. Extend that gate to also await `readBrandMode()` so the Provider mounts with the resolved mode and no flash occurs through the splash.

- [ ] **Step 1: Update root layout**

Replace contents of `apps/mobile/app/_layout.tsx` with:

```tsx
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { QueryProvider } from '@/lib/query-client'
import { ErrorBoundary, initSentry } from '@/lib/sentry'
import { supabase } from '@/lib/supabase'
import { readBrandMode, writeBrandMode } from '@/lib/brand-mode-storage'
import { BrandModeProvider, ChiaroClientProvider } from '@chiaro/officials-ui'
import type { Session } from '@supabase/supabase-js'
import type { BrandMode } from '@chiaro/ui-tokens'

initSentry()

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [brandMode, setBrandMode] = useState<BrandMode | null>(null)
  const [brandModeLoaded, setBrandModeLoaded] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    readBrandMode().then((m) => {
      setBrandMode(m)
      setBrandModeLoaded(true)
    })
  }, [])

  const loaded = sessionLoaded && brandModeLoaded

  useEffect(() => {
    if (!loaded) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) router.replace('/(auth)/sign-in')
    else if (session && inAuthGroup) router.replace('/(app)')
  }, [session, loaded, segments])

  if (!loaded) {
    return (
      <ErrorBoundary>
        <BrandModeProvider defaultMode={null} onChange={writeBrandMode}>
          <ChiaroClientProvider client={supabase}>
            <QueryProvider>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
              </View>
            </QueryProvider>
          </ChiaroClientProvider>
        </BrandModeProvider>
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary>
      <BrandModeProvider defaultMode={brandMode} onChange={writeBrandMode}>
        <ChiaroClientProvider client={supabase}>
          <QueryProvider>
            <Slot />
          </QueryProvider>
        </ChiaroClientProvider>
      </BrandModeProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 2: Update settings page**

Replace contents of `apps/mobile/app/(app)/settings/index.tsx` with:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Link, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BrandModeThemeRow } from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

export default function SettingsIndex() {
  const router = useRouter()
  async function handleSignOut() {
    await AsyncStorage.removeItem('chiaro_skip_calibrate')
    await supabase.auth.signOut()
    router.replace('/sign-in')
  }
  return (
    <View style={styles.root}>
      <Link href="/settings/address" style={styles.row}><Text>Home address ›</Text></Link>
      <View style={styles.themeRow}><BrandModeThemeRow /></View>
      <Pressable style={styles.row} onPress={handleSignOut}><Text>Sign out</Text></Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  row: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#aaa' },
  themeRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#aaa' },
})
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx "apps/mobile/app/(app)/settings/index.tsx"
git commit -m "feat(mobile): wire BrandModeProvider + settings toggle

Slice 38 task 7. Splits the existing 'loaded' gate into
sessionLoaded + brandModeLoaded; both must resolve before <Slot/>
renders so the Provider mounts with the correct defaultMode and the
splash never flashes the wrong theme. Settings page gains
BrandModeThemeRow alongside Home address + Sign out.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final verification + CLAUDE.md slice 38 entry

**Files:**
- Modify: `CLAUDE.md` (slice 38 entry in "Slices delivered")
- Modify: `docs/superpowers/mobile-dod-checklist.md` (smoke checklist additions)

- [ ] **Step 1: Run full workspace typecheck**

Run: `pnpm -r typecheck`
Expected: PASS across all 10 packages.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm test`
Expected: PASS. The 3 new test files contribute ~15 cases.

- [ ] **Step 3: Run the web build**

Run: `pnpm --filter @chiaro/web build`
Expected: PASS. Note the `/settings` bundle size before + after for the slice closeout.

- [ ] **Step 4: Manual smoke — web**

Start: `pnpm --filter @chiaro/web dev`

Walk through in Chrome:
- Visit `http://localhost:3000/settings` (sign in if needed). Confirm the theme row appears between Home address and Sign out.
- Click **Dark** → page repaints in dark mode instantly.
- DevTools → Application → Cookies → confirm `chiaro_brand_mode=dark` is set with Max-Age ~31536000.
- Hard reload — page renders dark from the first paint (no flash to light).
- Click **System** → cookie cleared (or set to empty Max-Age=0). Page follows OS preference.
- Click **Light** → cookie set to `light`. Hard reload → renders light from first paint.
- Toggle OS theme while on **System** → page follows.

Record any unexpected behavior. If FOUC occurs in any mode other than the documented "first-time visitor, no cookie, OS=dark" case, treat as a bug.

- [ ] **Step 5: Manual smoke — mobile**

Start: `pnpm --filter @chiaro/mobile dev`

Walk through in iOS simulator or Android dev client:
- Sign in, navigate to Settings. Confirm theme row appears.
- Tap **Dark** → UI repaints in dark mode.
- Kill app, relaunch → splash visible briefly, then app renders dark with no flash through the splash transition.
- Tap **System** → AsyncStorage key removed. App follows OS preference.
- Tap **Light** → persists. Relaunch confirms.
- Change OS theme while override=System → app follows.

- [ ] **Step 6: Update CLAUDE.md**

Open `CLAUDE.md`, find the "Slices delivered" section, append at the end of the slice list (before "Specs live in..."):

```markdown
- **Slice 38 — Dark mode toggle UI** (2026-05-27): Compressed-to-Mega-Slice (~13 files). New `BrandModeProvider` + `BrandModeThemeRow` in `@chiaro/officials-ui` consume the existing slice 33 `BrandModeOverrideContext`. Web persists via `chiaro_brand_mode` cookie read in async root layout (`cookies()` from `next/headers`) — server-renders correct mode for no-flash SSR. Mobile persists via AsyncStorage hydrated in the existing `_layout.tsx` loading-gate splash (extended with `brandModeLoaded` flag). Settings page (web + mobile) gains a System / Light / Dark segmented control. Unblocks slice 39+ visual smoke testing of the queued reskin philosophy decisions. ~15 new vitest cases (3 test files). No schema work; pgTAP unchanged at 428 plans.
```

- [ ] **Step 7: Update mobile DoD checklist**

Open `docs/superpowers/mobile-dod-checklist.md` and append a new section:

```markdown
## Slice 38 — Dark mode toggle

- [ ] Settings page shows Theme row between Home address and Sign out.
- [ ] Three options visible: System, Light, Dark; correct option is highlighted on mount.
- [ ] Tapping each option repaints the UI instantly.
- [ ] After choosing Dark, kill + relaunch app → splash visible, then UI renders in dark mode with no flash.
- [ ] After choosing System, change OS theme → app follows live.
- [ ] After choosing Light then System, OS theme dictates rendering.
```

- [ ] **Step 8: Final commit**

```bash
git add CLAUDE.md docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-38): record slice 38 closeout

Slice 38 task 8. CLAUDE.md gets the Slices delivered entry; mobile
DoD checklist gains the slice 38 smoke section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: Final summary to user**

Report:
- Commits on branch `slice-38-dark-mode-toggle`: 1 (spec) + 7 (tasks 1–7) + 1 (task 8 closeout) = 9 total
- Files changed: 5 new + 5 edited + 3 new tests + 2 docs = 15
- Test delta: +~15 cases (officials-ui 309 → ~324)
- Smoke status: web ✓, mobile ✓ (or note deferred if devices unavailable)
- Bundle: web `/settings` route size before/after

---

## Self-review notes

**Spec coverage:**

- §4 decisions — all captured: tri-state (Tasks 1/2), cookie+AsyncStorage (Tasks 4/6), segmented control on settings (Tasks 2/5/7). ✅
- §5 architecture — three layers built in order (shared → web glue → mobile glue). ✅
- §6 component contracts — types match in `BrandModeProvider` (Task 1) and `BrandModeThemeRow` (Task 2). ✅
- §7 data flow — Task 5 implements the async root layout cookie read; Task 7 implements the dual-flag gate. ✅
- §8 error handling — Task 6 storage helpers catch read errors; setter throws (Task 1 + Task 3). Storage write failures are fire-and-forget by Provider design (Task 1). ✅
- §9 testing — 3 test files built across Tasks 1/2/3 totalling ~15 cases. ✅
- §10 implementation surface — 5 new + 5 edited + 3 test, plus +1 client wrapper file in Task 5 not enumerated in spec §10. **Note: Task 5 introduces `apps/web/lib/brand-mode-client-wiring.tsx` because `BrandModeProvider` needs `'use client'` and a function `onChange` can't cross the server→client boundary. This is a faithful implementation detail of the architecture in §5.2; the spec narrative is unchanged. Updated total: 6 new + 5 edited + 3 test = 14 files.** ✅
- §12 closeout criteria — Task 8 walks all 5 items. ✅

**Placeholder scan:** none. Every step has runnable code or an exact command.

**Type consistency:** `BrandModeProviderProps.defaultMode: BrandMode | null` consistent in Tasks 1, 5, 7. `setMode: (mode: BrandMode | null) => void` consistent in Tasks 1, 2. Cookie key `chiaro_brand_mode` consistent in Tasks 4, 6. ✅

**Scope check:** one slice, one implementation plan. ✅
