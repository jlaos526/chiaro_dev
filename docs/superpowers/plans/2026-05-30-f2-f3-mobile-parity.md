# Slice 48 — F2 + F3 mobile parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port slice 47 nav rail concept to mobile via Expo Router's `<Drawer>` (React Navigation under the hood). Rewrite 4 mobile screens using slice 47 shells + primitives.

**Architecture:** New `BrandDrawer` wrapper around Expo Router's `<Drawer>` + `BrandDrawerContent` custom drawerContent + `BrandNavRailBody` shared composition (extracted from slice 47 `BrandNavRail`). Each mobile screen declares a `<Drawer.Screen options={...} />` at top of JSX. Hidden-from-menu sub/detail routes use `drawerItemStyle: { display: 'none' }` + custom `BackButton` for `headerLeft`.

**Tech Stack:** Expo SDK 54, expo-router 6, `@react-navigation/drawer` v7, `react-native-gesture-handler`, `react-native-reanimated` v4. Existing TypeScript strict + jest-expo + vitest setup.

**Spec:** `docs/superpowers/specs/2026-05-30-f2-f3-mobile-parity-design.md`

---

## Task 1: Install drawer deps + reanimated babel + jest mock

**Files:**
- Modify: `apps/mobile/package.json` (3 new deps via expo install)
- Modify: `apps/mobile/babel.config.js` (add reanimated plugin)
- Modify: `apps/mobile/jest-setup.ts` (add reanimated jest mock)
- Modify: `pnpm-lock.yaml` (auto-updated)

- [ ] **Step 1: Install the 3 new deps via expo install (SDK-compatible versions)**

Run from repo root:

```bash
pnpm dlx expo install react-native-reanimated react-native-gesture-handler @react-navigation/drawer --filter @chiaro/mobile
```

Expected: Expo CLI resolves SDK-54-compatible versions, writes them to `apps/mobile/package.json` dependencies + updates `pnpm-lock.yaml`. Approximate versions: reanimated `~4.1.x`, gesture-handler `~2.20.x`, drawer `~7.x`.

If `pnpm dlx expo` is unavailable on Windows, fall back to direct pin via versions Expo SDK 54 documents:

```bash
pnpm --filter @chiaro/mobile add react-native-reanimated@~4.1.0 react-native-gesture-handler@~2.20.0 @react-navigation/drawer@^7.0.0
```

- [ ] **Step 2: Verify the dependencies installed**

Run: `cat apps/mobile/package.json | grep -E "reanimated|gesture-handler|drawer"`
Expected: Three new lines in `dependencies`.

- [ ] **Step 3: Add reanimated plugin to babel.config.js**

Modify `apps/mobile/babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // MUST be last in plugins array per reanimated docs
    ],
  }
}
```

- [ ] **Step 4: Add reanimated + gesture-handler jest mocks to jest-setup.ts**

Read `apps/mobile/jest-setup.ts` first. Then APPEND:

```ts
// Slice 48: Reanimated 4 + Gesture Handler jest mocks (required for any test that
// transitively imports either library, including BrandDrawer / BrandDrawerContent).
import 'react-native-gesture-handler/jestSetup'
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
```

If `jest-setup.ts` doesn't already import jest globals, ensure `setupFilesAfterEach` in `jest.config.js` runs this file (it already does per `setupFilesAfterEach: ['<rootDir>/jest-setup.ts']`).

- [ ] **Step 5: Verify mobile typecheck still passes**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS (no TS errors — new deps have their own types).

- [ ] **Step 6: Verify mobile jest still passes (with new mocks active)**

Run: `pnpm --filter @chiaro/mobile test`
Expected: PASS (existing tests; the new mocks are inert until something imports the libraries).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/package.json \
        apps/mobile/babel.config.js \
        apps/mobile/jest-setup.ts \
        pnpm-lock.yaml
git commit -m "build(mobile): add drawer + gesture-handler + reanimated deps (slice 48 task 1)"
```

---

## Task 2: Wrap root layout in GestureHandlerRootView

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Read the current root layout**

Read `apps/mobile/app/_layout.tsx` to confirm structure.

- [ ] **Step 2: Add GestureHandlerRootView import**

Modify `apps/mobile/app/_layout.tsx` to add the import near the top:

```diff
 import { Slot, useRouter, useSegments } from 'expo-router'
 import { useEffect, useState } from 'react'
 import { ActivityIndicator, View } from 'react-native'
+import { GestureHandlerRootView } from 'react-native-gesture-handler'
 import { QueryProvider } from '@/lib/query-client'
```

- [ ] **Step 3: Wrap both return branches in GestureHandlerRootView**

The current file returns two branches: loading state (around line 47-61) and the loaded state (around line 62-72). Wrap the INNER children of each branch in `<GestureHandlerRootView style={{ flex: 1 }}>`.

For the loading branch, the `<View>` already exists; wrap it:

```diff
             <QueryProvider>
-              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
-                <ActivityIndicator />
-              </View>
+              <GestureHandlerRootView style={{ flex: 1 }}>
+                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
+                  <ActivityIndicator />
+                </View>
+              </GestureHandlerRootView>
             </QueryProvider>
```

For the loaded branch:

```diff
           <QueryProvider>
-            <Slot />
+            <GestureHandlerRootView style={{ flex: 1 }}>
+              <Slot />
+            </GestureHandlerRootView>
           </QueryProvider>
```

- [ ] **Step 4: Run mobile typecheck + tests**

Run: `pnpm --filter @chiaro/mobile typecheck && pnpm --filter @chiaro/mobile test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): wrap root layout in GestureHandlerRootView (slice 48 task 2)"
```

---

## Task 3: Extract `BrandNavRailBody` from `BrandNavRail` (slice 47 refactor)

**Files:**
- Create: `packages/officials-ui/src/nav/BrandNavRailBody.tsx`
- Create: `packages/officials-ui/test/nav/BrandNavRailBody.test.tsx`
- Modify: `packages/officials-ui/src/nav/BrandNavRail.tsx` (consume the extracted body)
- Modify: `packages/officials-ui/test/nav/BrandNavRail.test.tsx` (assertions may need minor updates if internal DOM structure changes)

- [ ] **Step 1: Write the failing test for BrandNavRailBody**

Create `packages/officials-ui/test/nav/BrandNavRailBody.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandNavRailBody } from '../../src/nav/BrandNavRailBody.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

const user = { displayName: 'Sarah', username: 'sarah', initial: 'S' }

describe('BrandNavRailBody', () => {
  it('renders avatar + name + handle from user prop', () => {
    const { getByText } = render(
      <BrandNavRailBody user={user} activeRouteKey="home" onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sarah')).toBeTruthy()
    expect(getByText('@sarah')).toBeTruthy()
    expect(getByText('S')).toBeTruthy()
  })

  it('renders 3 nav items (Home / Officials / Settings) + Sign out', () => {
    const { getByText } = render(
      <BrandNavRailBody user={user} activeRouteKey="home" onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Home')).toBeTruthy()
    expect(getByText('Officials')).toBeTruthy()
    expect(getByText('Settings')).toBeTruthy()
    expect(getByText('Sign out')).toBeTruthy()
  })

  it('marks the active item via data-active="true"', () => {
    const { container } = render(
      <BrandNavRailBody user={user} activeRouteKey="officials" onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    const officialsActive = Array.from(container.querySelectorAll('[data-active="true"]'))
      .find(el => el.textContent?.includes('Officials'))
    expect(officialsActive).toBeTruthy()
  })

  it('does not mark any item active when activeRouteKey is null', () => {
    const { container } = render(
      <BrandNavRailBody user={user} activeRouteKey={null} onNavigate={() => {}} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    const anyActive = container.querySelectorAll('[data-active="true"]')
    expect(anyActive.length).toBe(0)
  })

  it('invokes onNavigate with the correct key', () => {
    const onNavigate = vi.fn()
    const { getByText } = render(
      <BrandNavRailBody user={user} activeRouteKey="home" onNavigate={onNavigate} onSignOut={() => {}} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Officials'))
    expect(onNavigate).toHaveBeenCalledWith('officials')
  })

  it('invokes onSignOut on Sign out press', () => {
    const onSignOut = vi.fn()
    const { getByText } = render(
      <BrandNavRailBody user={user} activeRouteKey="home" onNavigate={() => {}} onSignOut={onSignOut} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Sign out'))
    expect(onSignOut).toHaveBeenCalled()
  })

  it('falls back to "Welcome" when displayName + username are both null', () => {
    const { getByText } = render(
      <BrandNavRailBody
        user={{ displayName: null, username: null, initial: '?' }}
        activeRouteKey={null}
        onNavigate={() => {}}
        onSignOut={() => {}}
      />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Welcome')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandNavRailBody.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement BrandNavRailBody**

Create `packages/officials-ui/src/nav/BrandNavRailBody.tsx`:

```tsx
'use client'

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export type RailRouteKey = 'home' | 'officials' | 'settings'

export interface RailUser {
  displayName: string | null
  username: string | null
  initial: string
}

export interface BrandNavRailBodyProps {
  user: RailUser
  activeRouteKey: RailRouteKey | null
  onNavigate: (key: RailRouteKey) => void
  onSignOut: () => void
}

const NAV_ITEMS: Array<{ key: RailRouteKey; label: string }> = [
  { key: 'home',      label: 'Home' },
  { key: 'officials', label: 'Officials' },
  { key: 'settings',  label: 'Settings' },
]

export function BrandNavRailBody({
  user,
  activeRouteKey,
  onNavigate,
  onSignOut,
}: BrandNavRailBodyProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const name = user.displayName ?? user.username ?? 'Welcome'
  const handle = user.username ? `@${user.username}` : null
  return (
    <View style={styles.root}>
      <View style={[styles.avatarBlock, { borderBottomColor: semantic.border.default }]}>
        <View style={[styles.avatar, { backgroundColor: semantic.accent.primary }]}>
          <Text style={[styles.avatarInitial, { color: semantic.text.onAccent }]}>{user.initial}</Text>
        </View>
        <View style={styles.avatarText}>
          <Text style={[styles.avatarName, { color: semantic.text.primary }]} numberOfLines={1}>{name}</Text>
          {handle ? <Text style={[styles.avatarHandle, { color: semantic.text.muted }]} numberOfLines={1}>{handle}</Text> : null}
        </View>
      </View>
      <View style={styles.navSection}>
        <Text style={[styles.sectionLabel, { color: semantic.text.muted }]}>NAVIGATE</Text>
        {NAV_ITEMS.map(item => {
          const active = activeRouteKey === item.key
          return (
            <Pressable
              key={item.key}
              accessibilityRole="link"
              onPress={() => onNavigate(item.key)}
              dataSet={{ active: active ? 'true' : 'false' }}
              style={[
                styles.navItem,
                { backgroundColor: active ? semantic.bg.elevated : 'transparent' },
              ]}
            >
              <Text style={[styles.navItemText, { color: semantic.text.primary, fontWeight: active ? '600' : '400' }]}>
                {item.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.navItem}>
        <Text style={[styles.navItemText, { color: semantic.alert.danger.fg, fontWeight: '600' }]}>Sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingVertical: 18, gap: 14 },
  avatarBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontWeight: '700', fontSize: 14 },
  avatarText: { flexShrink: 1 },
  avatarName: { fontWeight: '700', fontSize: 13, lineHeight: 16 },
  avatarHandle: { fontSize: 11, lineHeight: 14 },
  navSection: { gap: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4 },
  navItem: { paddingHorizontal: 8, paddingVertical: 7, borderRadius: 6 },
  navItemText: { fontSize: 13 },
})
```

- [ ] **Step 4: Run BrandNavRailBody tests to verify they pass**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandNavRailBody.test.tsx`
Expected: PASS (7 cases).

- [ ] **Step 5: Refactor BrandNavRail to consume BrandNavRailBody**

Read `packages/officials-ui/src/nav/BrandNavRail.tsx` and locate the inline composition (the `AvatarBlock`, `NavSection`, `SignOutItem` sub-components). Replace them with a single `<BrandNavRailBody>` call inside both desktop + mobile-overlay branches.

Add the route-string → key mapper inside BrandNavRail:

```tsx
import { BrandNavRailBody, type RailRouteKey, type RailUser } from './BrandNavRailBody.tsx'

function pathnameToKey(pathname: string): RailRouteKey | null {
  if (pathname === '/') return 'home'
  if (pathname === '/officials' || pathname.startsWith('/officials/')) return 'officials'
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'settings'
  return null
}
```

DesktopRail becomes:

```tsx
function DesktopRail({ user, pathname, onNavigate, onSignOut }: RailDesktopProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={[styles.desktopRail, { backgroundColor: semantic.bg.subtle, borderRightColor: semantic.border.default }]}>
      <BrandNavRailBody
        user={user}
        activeRouteKey={pathnameToKey(pathname)}
        onNavigate={(key) => onNavigate(keyToPath(key))}
        onSignOut={onSignOut}
      />
    </View>
  )
}

const KEY_TO_PATH: Record<RailRouteKey, string> = {
  home: '/',
  officials: '/officials',
  settings: '/settings',
}
function keyToPath(key: RailRouteKey): string { return KEY_TO_PATH[key] }
```

MobileRail similarly: replace inline avatar/nav/signout composition with `<BrandNavRailBody>` inside the overlay rail. Keep the top bar + scrim + overlay positioning logic.

REMOVE the old `AvatarBlock`, `AvatarCircle`, `NavSection`, `SignOutItem` helper functions and the `NAV_ITEMS` + `isActive` constants from BrandNavRail.tsx (now they live in BrandNavRailBody).

Re-export `RailUser` from `./BrandNavRailBody.tsx`. Existing slice 47 consumers import `RailUser` from BrandNavRail; the re-export preserves back-compat:

```tsx
export type { RailUser } from './BrandNavRailBody.tsx'
```

- [ ] **Step 6: Update BrandNavRail tests to verify the refactor doesn't break existing behavior**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandNavRail.test.tsx`
Expected: PASS — existing 15 cases (14 from slice 47 + 1 from final-review fix). All assertions on rendered text (Home / Officials / Settings / Sign out / Sarah / @sarah / S) continue to work because BrandNavRailBody renders the same DOM.

If the active-route data-attr test breaks, ensure the body's `dataSet={{ active: ... }}` is reachable in the DesktopRail variant tests (which pass `pathname="/officials"` → key=officials → body marks Officials active).

If any test fails, inspect the rendered DOM with `console.log(container.outerHTML)` and adjust assertions to match the body's actual rendered structure. The BODY rendering should be identical to the old inline composition.

- [ ] **Step 7: Run full officials-ui suite**

Run: `pnpm --filter @chiaro/officials-ui test`
Expected: PASS (551 + 7 new = 558 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/officials-ui/src/nav/BrandNavRailBody.tsx \
        packages/officials-ui/test/nav/BrandNavRailBody.test.tsx \
        packages/officials-ui/src/nav/BrandNavRail.tsx \
        packages/officials-ui/test/nav/BrandNavRail.test.tsx
git commit -m "refactor(officials-ui): extract BrandNavRailBody for cross-platform share (slice 48 task 3)"
```

---

## Task 4: Create `BackButton` component

**Files:**
- Create: `packages/officials-ui/src/nav/BackButton.tsx`
- Create: `packages/officials-ui/test/nav/BackButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/nav/BackButton.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const backMock = vi.fn()
vi.mock('expo-router', () => ({
  useRouter: () => ({ back: backMock }),
}))

import { BackButton } from '../../src/nav/BackButton.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BackButton', () => {
  it('renders ← character', () => {
    const { getByText } = render(<BackButton />, { wrapper: withMode('light') })
    expect(getByText('←')).toBeTruthy()
  })

  it('sets accessibilityLabel "Back"', () => {
    const { container } = render(<BackButton />, { wrapper: withMode('light') })
    expect(container.querySelector('[aria-label="Back"]')).toBeTruthy()
  })

  it('calls router.back() on press', () => {
    backMock.mockClear()
    const { getByText } = render(<BackButton />, { wrapper: withMode('light') })
    fireEvent.click(getByText('←'))
    expect(backMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BackButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement BackButton**

Create `packages/officials-ui/src/nav/BackButton.tsx`:

```tsx
'use client'

import { Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useBrandTokens } from '../brand-hooks.ts'

/**
 * Back-arrow button consumed by hidden-from-menu Drawer screens
 * (officials/[id], state-officials/[id], profile/edit, settings/address,
 * calibrate). React Navigation Drawer's default headerLeft is the hamburger
 * icon — for sub-routes reached via router.push, the hamburger is wrong;
 * BackButton replaces it via screen options `headerLeft: () => <BackButton />`.
 */
export function BackButton(): React.JSX.Element {
  const router = useRouter()
  const { semantic } = useBrandTokens()
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{ paddingHorizontal: 14, paddingVertical: 8 }}
    >
      <Text style={{ color: semantic.accent.primary, fontSize: 17, fontWeight: '600' }}>←</Text>
    </Pressable>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BackButton.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/nav/BackButton.tsx \
        packages/officials-ui/test/nav/BackButton.test.tsx
git commit -m "feat(officials-ui): BackButton for hidden Drawer screens (slice 48 task 4)"
```

---

## Task 5: Create `BrandDrawerContent` component

**Files:**
- Create: `packages/officials-ui/src/nav/BrandDrawerContent.tsx`
- Create: `packages/officials-ui/test/nav/BrandDrawerContent.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/nav/BrandDrawerContent.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { ChiaroClientProvider } from '../../src/client-context.tsx'

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn(), back: vi.fn() },
}))
vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}))

let mockProfile: { display_name: string | null; username: string | null } | null = {
  display_name: 'Sarah', username: 'sarah',
}
vi.mock('@chiaro/profile', () => ({
  getMyProfile: vi.fn(async () => mockProfile),
}))

// Stub DrawerContentScrollView from @react-navigation/drawer so we don't pull
// the whole drawer machinery into vitest.
vi.mock('@react-navigation/drawer', () => ({
  DrawerContentScrollView: ({ children }: { children: ReactNode }) =>
    createElement('div', { 'data-testid': 'drawer-scroll-view' }, children),
}))

const fakeClient = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })), signOut: vi.fn(async () => ({})) },
} as never

function wrap(mode: 'light' | 'dark' = 'light') {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      ChiaroClientProvider,
      { client: fakeClient },
      createElement(BrandModeOverrideContext.Provider, { value: mode }, children),
    )
}

import { BrandDrawerContent } from '../../src/nav/BrandDrawerContent.tsx'

function makeDrawerProps(activeRouteName: string) {
  return {
    state: {
      routes: [{ key: 'r1', name: activeRouteName }],
      index: 0,
    },
    navigation: {
      navigate: vi.fn(),
      closeDrawer: vi.fn(),
    },
    descriptors: {},
  } as never
}

describe('BrandDrawerContent', () => {
  it('renders BrandNavRailBody with profile data', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah' }
    const props = makeDrawerProps('index')
    const { findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    expect(await findByText('Sarah')).toBeTruthy()
    expect(await findByText('@sarah')).toBeTruthy()
  })

  it('falls back to "Welcome" + "?" on null profile', async () => {
    mockProfile = null
    const props = makeDrawerProps('index')
    const { findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    expect(await findByText('Welcome')).toBeTruthy()
    expect(await findByText('?')).toBeTruthy()
  })

  it('marks Home active when route name is "index"', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah' }
    const props = makeDrawerProps('index')
    const { container, findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    await findByText('Sarah')
    const homeActive = Array.from(container.querySelectorAll('[data-active="true"]'))
      .find(el => el.textContent?.includes('Home'))
    expect(homeActive).toBeTruthy()
  })

  it('marks Officials active when route name is "officials/index"', async () => {
    mockProfile = { display_name: 'Sarah', username: 'sarah' }
    const props = makeDrawerProps('officials/index')
    const { container, findByText } = render(<BrandDrawerContent {...props} />, { wrapper: wrap() })
    await findByText('Sarah')
    const officialsActive = Array.from(container.querySelectorAll('[data-active="true"]'))
      .find(el => el.textContent?.includes('Officials'))
    expect(officialsActive).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandDrawerContent.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement BrandDrawerContent**

Create `packages/officials-ui/src/nav/BrandDrawerContent.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer'
import { getMyProfile } from '@chiaro/profile'
import { useChiaroClient } from '../client-context.tsx'
import { BrandNavRailBody, type RailRouteKey } from './BrandNavRailBody.tsx'
import { signOut } from './sign-out.ts'

function deriveInitial(p: { display_name: string | null; username: string | null } | null): string {
  const source = p?.display_name ?? p?.username
  if (!source || source.length === 0) return '?'
  return source[0]!.toUpperCase()
}

const ROUTE_TO_KEY: Record<string, RailRouteKey> = {
  'index': 'home',
  'officials/index': 'officials',
  'settings/index': 'settings',
}

const KEY_TO_ROUTE: Record<RailRouteKey, string> = {
  'home':      'index',
  'officials': 'officials/index',
  'settings':  'settings/index',
}

/**
 * Custom drawerContent for Expo Router's <Drawer>. Renders the shared
 * BrandNavRailBody composition inside React Navigation's drawer chrome
 * (scrim, slide animation, swipe gestures, safe area all handled by the
 * library).
 */
export function BrandDrawerContent(props: DrawerContentComponentProps): React.JSX.Element {
  const router = useRouter()
  const client = useChiaroClient()
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = await getMyProfile(client)
      if (!cancelled) setProfile(p)
    })()
    return () => { cancelled = true }
  }, [client])

  const activeRouteName = props.state.routes[props.state.index]?.name ?? ''
  const activeKey: RailRouteKey | null = ROUTE_TO_KEY[activeRouteName] ?? null

  const handleNavigate = (key: RailRouteKey) => {
    props.navigation.navigate(KEY_TO_ROUTE[key])
    props.navigation.closeDrawer()
  }

  const handleSignOut = () => {
    void signOut(router, client)
    props.navigation.closeDrawer()
  }

  const user = {
    displayName: profile?.display_name ?? null,
    username:    profile?.username ?? null,
    initial:     deriveInitial(profile),
  }

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <BrandNavRailBody
        user={user}
        activeRouteKey={activeKey}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
    </DrawerContentScrollView>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandDrawerContent.test.tsx`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/nav/BrandDrawerContent.tsx \
        packages/officials-ui/test/nav/BrandDrawerContent.test.tsx
git commit -m "feat(officials-ui): BrandDrawerContent custom drawerContent (slice 48 task 5)"
```

---

## Task 6: Create `BrandDrawer` wrapper component

**Files:**
- Create: `packages/officials-ui/src/nav/BrandDrawer.tsx`
- Create: `packages/officials-ui/test/nav/BrandDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/officials-ui/test/nav/BrandDrawer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Stub expo-router/drawer's Drawer export so we can inspect screenOptions
// without pulling the whole React Navigation runtime.
const drawerSpy = vi.fn()
vi.mock('expo-router/drawer', () => ({
  Drawer: (props: Record<string, unknown>) => {
    drawerSpy(props)
    return createElement('div', { 'data-testid': 'drawer-stub' })
  },
}))

// BrandDrawerContent is invoked by drawerContent — stub it to avoid pulling
// getMyProfile / ChiaroClientProvider into this test.
vi.mock('../../src/nav/BrandDrawerContent.tsx', () => ({
  BrandDrawerContent: () => createElement('div', { 'data-testid': 'drawer-content-stub' }),
}))

import { BrandDrawer } from '../../src/nav/BrandDrawer.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BrandDrawer', () => {
  it('renders Expo Router Drawer with brand-themed screenOptions', () => {
    drawerSpy.mockClear()
    render(<BrandDrawer />, { wrapper: withMode('light') })
    expect(drawerSpy).toHaveBeenCalled()
    const props = drawerSpy.mock.calls[0]![0]
    expect(props.screenOptions.drawerType).toBe('front')
    expect(props.screenOptions.drawerStyle.width).toBe('78%')
    // Light bg.elevated = #ffffff
    expect(props.screenOptions.headerStyle.backgroundColor).toBeDefined()
    expect(props.screenOptions.drawerStyle.backgroundColor).toBeDefined()
    expect(props.screenOptions.overlayColor).toBe('rgba(0,0,0,0.4)')
  })

  it('passes drawerContent that renders BrandDrawerContent', () => {
    drawerSpy.mockClear()
    render(<BrandDrawer />, { wrapper: withMode('light') })
    const props = drawerSpy.mock.calls[0]![0]
    expect(typeof props.drawerContent).toBe('function')
    // Calling drawerContent should return a React element wrapping BrandDrawerContent
    const rendered = props.drawerContent({ state: {}, navigation: {}, descriptors: {} })
    expect(rendered).toBeDefined()
  })

  it('applies screenOptionsOverride on top of brand defaults', () => {
    drawerSpy.mockClear()
    render(<BrandDrawer screenOptionsOverride={{ headerShown: false }} />, { wrapper: withMode('light') })
    const props = drawerSpy.mock.calls[0]![0]
    expect(props.screenOptions.headerShown).toBe(false)
    expect(props.screenOptions.drawerType).toBe('front') // base still applies
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandDrawer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement BrandDrawer**

Create `packages/officials-ui/src/nav/BrandDrawer.tsx`:

```tsx
'use client'

import { Drawer } from 'expo-router/drawer'
import type { ComponentProps } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandDrawerContent } from './BrandDrawerContent.tsx'

type DrawerProps = ComponentProps<typeof Drawer>

export interface BrandDrawerProps extends Omit<DrawerProps, 'drawerContent' | 'screenOptions'> {
  /** Override screen options per-screen if needed. Brand defaults always applied first. */
  screenOptionsOverride?: DrawerProps['screenOptions']
}

/**
 * Themed wrapper around Expo Router's <Drawer> (React Navigation Drawer).
 * Composes brand-themed screenOptions via useBrandTokens() + supplies
 * BrandDrawerContent as the custom drawerContent. Children + per-screen
 * overrides are forwarded.
 */
export function BrandDrawer({ screenOptionsOverride, children, ...rest }: BrandDrawerProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const baseOptions: DrawerProps['screenOptions'] = {
    headerStyle: { backgroundColor: semantic.bg.elevated },
    headerTintColor: semantic.text.primary,
    headerTitleStyle: { fontWeight: '700', fontSize: 17 },
    headerShadowVisible: false,
    drawerStyle: { backgroundColor: semantic.bg.elevated, width: '78%' },
    drawerType: 'front',
    overlayColor: 'rgba(0,0,0,0.4)',
    sceneStyle: { backgroundColor: semantic.bg.app },
  }
  const merged = screenOptionsOverride
    ? { ...baseOptions, ...screenOptionsOverride }
    : baseOptions
  return (
    <Drawer
      drawerContent={(props) => <BrandDrawerContent {...props} />}
      screenOptions={merged}
      {...rest}
    >
      {children}
    </Drawer>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @chiaro/officials-ui test test/nav/BrandDrawer.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/src/nav/BrandDrawer.tsx \
        packages/officials-ui/test/nav/BrandDrawer.test.tsx
git commit -m "feat(officials-ui): BrandDrawer themed wrapper (slice 48 task 6)"
```

---

## Task 7: Update officials-ui peerDeps + barrel exports

**Files:**
- Modify: `packages/officials-ui/package.json`
- Modify: `packages/officials-ui/src/index.ts`

- [ ] **Step 1: Add the new peerDeps**

Modify `packages/officials-ui/package.json`. Add to the existing `peerDependencies` block:

```diff
   "peerDependencies": {
     "@tanstack/react-query": "^5.0.0",
+    "@react-navigation/drawer": "^7.0.0",
+    "expo-router": "^6.0.0",
     "react": "^19.0.0",
     "react-native": "*",
     "react-native-svg": "*"
   },
```

Note: web does NOT install these — only the mobile app does. Web consumers of officials-ui (apps/web) only import the slice 47 nav components that don't reach into expo-router; the new BrandDrawer / BrandDrawerContent / BackButton are mobile-only consumers and won't be tree-shaken into the web bundle if not imported.

- [ ] **Step 2: Add barrel exports for the 4 new nav components + extracted body types**

Modify `packages/officials-ui/src/index.ts`. Add to the slice 47 nav export cluster:

```ts
export { BrandNavRailBody, type BrandNavRailBodyProps, type RailRouteKey } from './nav/BrandNavRailBody.tsx'
export { BrandDrawer, type BrandDrawerProps } from './nav/BrandDrawer.tsx'
export { BrandDrawerContent } from './nav/BrandDrawerContent.tsx'
export { BackButton } from './nav/BackButton.tsx'
```

If `RailUser` was already exported via `./nav/BrandNavRail.tsx` (slice 47), it now lives in `BrandNavRailBody`. Slice 47 task 10 already re-exports `RailUser` from BrandNavRail; task 3 of this slice adds `export type { RailUser } from './BrandNavRailBody.tsx'` inside BrandNavRail.tsx. The barrel re-export from BrandNavRail continues to work transitively.

- [ ] **Step 3: Run pnpm install at repo root to refresh the lockfile**

Run: `pnpm install`
Expected: lockfile updated to reflect the new peerDeps (workspace nodes only; no actual install since peerDeps don't bring packages in directly).

- [ ] **Step 4: Verify typecheck + tests pass**

Run: `pnpm --filter @chiaro/officials-ui typecheck && pnpm --filter @chiaro/officials-ui test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/officials-ui/package.json \
        packages/officials-ui/src/index.ts \
        pnpm-lock.yaml
git commit -m "build(officials-ui): add expo-router + drawer peerDeps + barrel exports (slice 48 task 7)"
```

---

## Task 8: Rewrite `(app)/_layout.tsx` to use `<BrandDrawer>`

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Read the current layout**

Read `apps/mobile/app/(app)/_layout.tsx` to confirm the calibration-redirect logic.

- [ ] **Step 2: Replace `<Stack>` with `<BrandDrawer />`**

Modify `apps/mobile/app/(app)/_layout.tsx`. Keep the calibration redirect logic intact; only the render at the bottom changes:

```diff
 import { useEffect, useState } from 'react'
 import { Redirect, Stack, useSegments } from 'expo-router'
 import AsyncStorage from '@react-native-async-storage/async-storage'
+import { BrandDrawer } from '@chiaro/officials-ui'
 import { supabase } from '@/lib/supabase'

 type CalibrationStatus = 'unknown' | 'calibrated' | 'uncalibrated' | 'skipped'

 export default function AppLayout() {
   // ... existing useEffect + state unchanged ...

   const segmentList = segments as readonly string[]
   const onCalibrate = segmentList[segmentList.length - 1] === 'calibrate'
   const onSettings = segmentList.includes('settings')
   if (calibrationStatus === 'uncalibrated' && !onCalibrate && !onSettings) {
     return <Redirect href="/calibrate" />
   }

-  return <Stack screenOptions={{ headerShown: true }} />
+  return <BrandDrawer />
 }
```

Remove the unused `Stack` import.

- [ ] **Step 3: Verify mobile typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Verify mobile jest passes (no new tests in this task)**

Run: `pnpm --filter @chiaro/mobile test`
Expected: PASS (existing tests; layout integration validated via manual smoke).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/_layout.tsx
git commit -m "feat(mobile): replace Stack with BrandDrawer in (app)/_layout.tsx (slice 48 task 8)"
```

---

## Task 9: Delete `(app)/settings/_layout.tsx`

**Files:**
- Delete: `apps/mobile/app/(app)/settings/_layout.tsx`

- [ ] **Step 1: Delete the file**

```bash
git rm apps/mobile/app/\(app\)/settings/_layout.tsx
```

- [ ] **Step 2: Verify typecheck + tests still pass**

Run: `pnpm --filter @chiaro/mobile typecheck && pnpm --filter @chiaro/mobile test`
Expected: PASS — settings/index + settings/address are now top-level Drawer screens (registered automatically by Expo Router's file-based routing).

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(mobile): delete (app)/settings/_layout.tsx (slice 48 task 9)

Mirror web slice 47: SettingsScreen renders its own page chrome on /settings.
/settings/address becomes a hidden Drawer screen with BackButton headerLeft
(slice 48 task 16). The inner Stack is no longer needed."
```

---

## Task 10: Add `<Drawer.Screen>` options to `settings/index.tsx` (in menu)

**Files:**
- Modify: `apps/mobile/app/(app)/settings/index.tsx`

- [ ] **Step 1: Read current file**

Read `apps/mobile/app/(app)/settings/index.tsx`.

- [ ] **Step 2: Add Drawer.Screen at top of return**

Wrap the existing `<SettingsScreen>` JSX in a Fragment with `<Drawer.Screen>`:

```diff
+import { Drawer } from 'expo-router/drawer'
 import { useRouter } from 'expo-router'
 // ... other imports unchanged ...

 export default function SettingsIndex() {
   const router = useRouter()
   // ... existing handlers unchanged ...

   return (
+    <>
+      <Drawer.Screen options={{ title: 'Settings' }} />
       <SettingsScreen>
         {/* existing children */}
       </SettingsScreen>
+    </>
   )
 }
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/settings/index.tsx
git commit -m "feat(mobile): add Drawer.Screen options to settings/index (slice 48 task 10)"
```

---

## Task 11: Add hidden `<Drawer.Screen>` + BackButton to `calibrate.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/calibrate.tsx`

- [ ] **Step 1: Read current file**

Read `apps/mobile/app/(app)/calibrate.tsx`.

- [ ] **Step 2: Wrap return in Fragment + add Drawer.Screen with BackButton headerLeft**

```diff
+import { Drawer } from 'expo-router/drawer'
 import { useRouter } from 'expo-router'
+import { BackButton } from '@chiaro/officials-ui'
 // ... other imports unchanged ...

 export default function CalibratePage() {
   const router = useRouter()
   // ... handlers unchanged ...

-  return <CalibrateScreen onSubmit={handleSubmit} onGpsSubmit={handleGpsSubmit} onSkip={handleSkip} />
+  return (
+    <>
+      <Drawer.Screen
+        options={{
+          title: 'Calibrate',
+          drawerItemStyle: { display: 'none' },
+          headerLeft: () => <BackButton />,
+        }}
+      />
+      <CalibrateScreen onSubmit={handleSubmit} onGpsSubmit={handleGpsSubmit} onSkip={handleSkip} />
+    </>
+  )
 }
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/calibrate.tsx
git commit -m "feat(mobile): hide calibrate from drawer menu + add BackButton (slice 48 task 11)"
```

---

## Task 12: Add hidden `<Drawer.Screen>` + BackButton to `officials/[id].tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/officials/[id].tsx`

- [ ] **Step 1: Read current file** to confirm export shape (default export of component returning JSX).

- [ ] **Step 2: Wrap return in Fragment**

Add at the top of the screen's JSX return:

```tsx
import { Drawer } from 'expo-router/drawer'
import { BackButton } from '@chiaro/officials-ui'

// Inside the component's return:
return (
  <>
    <Drawer.Screen
      options={{
        title: 'Official',
        drawerItemStyle: { display: 'none' },
        headerLeft: () => <BackButton />,
      }}
    />
    {/* existing JSX */}
  </>
)
```

If the existing JSX is a single root element, the Fragment wrapper above works. If the existing return is `null` (auth/loading-state branch), keep that as-is — only wrap the main render branch.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/officials/\[id\].tsx
git commit -m "feat(mobile): hide officials/[id] from drawer + add BackButton (slice 48 task 12)"
```

---

## Task 13: Add hidden `<Drawer.Screen>` + BackButton to `state-officials/[id].tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/state-officials/[id].tsx`

- [ ] **Step 1: Read current file**.

- [ ] **Step 2: Wrap return in Fragment + add Drawer.Screen**

```tsx
import { Drawer } from 'expo-router/drawer'
import { BackButton } from '@chiaro/officials-ui'

return (
  <>
    <Drawer.Screen
      options={{
        title: 'State official',
        drawerItemStyle: { display: 'none' },
        headerLeft: () => <BackButton />,
      }}
    />
    {/* existing JSX */}
  </>
)
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/state-officials/\[id\].tsx
git commit -m "feat(mobile): hide state-officials/[id] from drawer + add BackButton (slice 48 task 13)"
```

---

## Task 14: Rewrite `(app)/index.tsx` (home)

**Files:**
- Modify: `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Read current file** for context.

- [ ] **Step 2: Rewrite the entire file**

Replace `apps/mobile/app/(app)/index.tsx`:

```tsx
import { Drawer } from 'expo-router/drawer'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getMyProfile } from '@chiaro/profile'
import {
  BrandPageScreen,
  BrandHeading,
  BrandAlert,
  BrandLink,
  Logo,
  OfficialsCard,
} from '@chiaro/officials-ui'
import { DistrictPanel } from '@/components/DistrictPanel'

type Profile = Awaited<ReturnType<typeof getMyProfile>>

export default function Home() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    getMyProfile(supabase).then((p) => {
      if (mounted) {
        setProfile(p)
        setLoaded(true)
      }
    })
    return () => { mounted = false }
  }, [])

  const greetingName = profile?.display_name ?? profile?.username ?? null
  const greeting = greetingName ? `Welcome, ${greetingName}` : 'Welcome'

  return (
    <>
      <Drawer.Screen options={{ title: 'Home' }} />
      {loaded ? (
        <BrandPageScreen>
          <Logo variant="lockup" size={24} wordmarkSize={28} />
          <BrandHeading level={1}>{greeting}</BrandHeading>
          {!profile?.completed ? (
            <BrandAlert severity="info" title="Complete your profile">
              <BrandLink href="/(app)/profile/edit">Add your display name and username →</BrandLink>
            </BrandAlert>
          ) : null}
          <DistrictPanel />
          <OfficialsCard
            onSelect={({ officialId, subCascadeSlug }) =>
              router.push(
                subCascadeSlug
                  ? `/officials/${officialId}?cat=issue-positions&sub=${subCascadeSlug}`
                  : `/officials/${officialId}`,
              )
            }
            onSeeAll={() => router.push('/officials')}
            onCalibrate={() => router.push('/calibrate')}
          />
        </BrandPageScreen>
      ) : null}
    </>
  )
}
```

Behavior changes:
- Inline `<Link href="/settings">Settings</Link>` REMOVED (drawer handles)
- `<Text fontSize: 24>Chiaro</Text>` REPLACED with Logo lockup + BrandHeading "Welcome, {name}"
- Profile-completion `<Link>` REPLACED with BrandAlert info severity + BrandLink

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/index.tsx
git commit -m "feat(mobile): rewrite home with Logo lockup + BrandPageScreen (slice 48 task 14)"
```

---

## Task 15: Rewrite `(app)/officials/index.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/officials/index.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `apps/mobile/app/(app)/officials/index.tsx`:

```tsx
import { Drawer } from 'expo-router/drawer'
import { useRouter } from 'expo-router'
import { BrandPageScreen, OfficialsList } from '@chiaro/officials-ui'

export default function OfficialsScreen() {
  const router = useRouter()
  return (
    <>
      <Drawer.Screen options={{ title: 'Officials' }} />
      <BrandPageScreen>
        <OfficialsList
          onSelect={({ officialId }) => router.push(`/officials/${officialId}`)}
          onCalibrate={() => router.push('/calibrate')}
        />
      </BrandPageScreen>
    </>
  )
}
```

Behavior changes:
- `<ScrollView contentContainerStyle={{ padding: 16 }}>` REPLACED with BrandPageScreen
- Bare `<Text fontSize: 24>Your officials</Text>` REMOVED (Drawer header shows "Officials")
- OfficialsList callbacks preserved verbatim

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/officials/index.tsx
git commit -m "feat(mobile): rewrite officials list with BrandPageScreen (slice 48 task 15)"
```

---

## Task 16: Rewrite `(app)/profile/edit.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/profile/edit.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `apps/mobile/app/(app)/profile/edit.tsx`:

```tsx
import { Drawer } from 'expo-router/drawer'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'
import {
  BrandFormScreen,
  BrandTextInput,
  BrandButton,
  BrandAlert,
  BackButton,
} from '@chiaro/officials-ui'

export default function ProfileEdit() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setError(null)
    const parsed = profileFormSchema.safeParse({ display_name: displayName, username })
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join('; '))
      return
    }
    setLoading(true)
    try {
      await updateMyProfile(supabase, parsed.data)
      router.replace('/(app)')
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Drawer.Screen
        options={{
          title: 'Edit profile',
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackButton />,
        }}
      />
      <BrandFormScreen title="Complete your profile" backHref="/" backLabel="← Home">
        <BrandTextInput label="Display name" value={displayName} onChangeText={setDisplayName} />
        <BrandTextInput label="Username" value={username} onChangeText={setUsername} />
        {error ? <BrandAlert severity="danger" title="Couldn't save">{error}</BrandAlert> : null}
        <BrandButton variant="primary" disabled={loading} onPress={onSubmit}>
          {loading ? 'Saving…' : 'Save'}
        </BrandButton>
      </BrandFormScreen>
    </>
  )
}
```

Behavior changes:
- Bare RN `<Button>` REPLACED with BrandButton (primary variant)
- Raw `color: 'red'` error REPLACED with BrandAlert danger severity
- Bare `<TextInput>` REPLACED with BrandTextInput
- Drawer header shows "Edit profile"; BrandFormScreen body title shows "Complete your profile" (intentional duplication per spec §3 R11)

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/profile/edit.tsx
git commit -m "feat(mobile): rewrite /profile/edit with BrandFormScreen (slice 48 task 16)"
```

---

## Task 17: Rewrite `(app)/settings/address.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/settings/address.tsx`

- [ ] **Step 1: Rewrite the file**

Replace `apps/mobile/app/(app)/settings/address.tsx`:

```tsx
import { Drawer } from 'expo-router/drawer'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { addressInputSchema, getMyLocation } from '@chiaro/location'
import {
  BrandFormScreen,
  BrandTextInput,
  BrandButton,
  BrandAlert,
  BrandBodyText,
  BackButton,
} from '@chiaro/officials-ui'

export default function EditAddressScreen() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [calibratedAt, setCalibratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    getMyLocation(supabase as never).then(loc => {
      if (loc) {
        setAddress(loc.home_address_text)
        setCalibratedAt(loc.calibrated_at)
      }
      setBootstrapping(false)
    }).catch(() => setBootstrapping(false))
  }, [])

  async function save() {
    setError(null)
    const parsed = addressInputSchema.safeParse({ address })
    if (!parsed.success) {
      setError('Enter a complete address.')
      return
    }
    setLoading(true)
    const { error: invokeErr } = await supabase.functions.invoke('calibrate-location', {
      body: { address: parsed.data.address },
    })
    setLoading(false)
    if (invokeErr) {
      const status = (invokeErr as { context?: { status?: number } }).context?.status
      if (status === 400) setError("We couldn't find that address.")
      else if (status === 502) setError('Service unavailable. Try again.')
      else setError('Could not save.')
      return
    }
    router.push('/settings')
  }

  const drawerScreen = (
    <Drawer.Screen
      options={{
        title: 'Home address',
        drawerItemStyle: { display: 'none' },
        headerLeft: () => <BackButton />,
      }}
    />
  )

  if (bootstrapping) {
    return (
      <>
        {drawerScreen}
        <BrandFormScreen title="Home address" backHref="/settings" backLabel="← Settings">
          <BrandBodyText muted>Loading…</BrandBodyText>
        </BrandFormScreen>
      </>
    )
  }

  const subtitle = calibratedAt
    ? `Last updated ${new Date(calibratedAt).toLocaleString()}`
    : undefined

  return (
    <>
      {drawerScreen}
      <BrandFormScreen
        title="Home address"
        backHref="/settings"
        backLabel="← Settings"
        {...(subtitle ? { subtitle } : {})}
      >
        <BrandTextInput label="Address" value={address} onChangeText={setAddress} />
        {error ? <BrandAlert severity="danger" title="Couldn't save">{error}</BrandAlert> : null}
        <BrandButton variant="primary" disabled={loading} onPress={save}>
          {loading ? 'Saving…' : 'Save'}
        </BrandButton>
      </BrandFormScreen>
    </>
  )
}
```

Behavior changes:
- 6 inline hex literals (`#888`, `#5b6cff`, `#666`, `#d85c5c`, `'red'`, `'white'`) REPLACED with brand-token consumption via primitives
- `router.back()` changed to explicit `router.push('/settings')`
- Bootstrap state uses same BrandFormScreen shell with `<BrandBodyText muted>Loading…</BrandBodyText>` (parity with web slice 47)
- Drawer header "Home address" + BrandFormScreen body title "Home address" (intentional duplication)

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @chiaro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/settings/address.tsx
git commit -m "feat(mobile): rewrite /settings/address with BrandFormScreen (slice 48 task 17)"
```

---

## Task 18: Mobile DoD checklist update

**Files:**
- Modify: `docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 1: Read current checklist tail to see existing slice-47 section + format**

Run: `tail -40 docs/superpowers/mobile-dod-checklist.md`

- [ ] **Step 2: Append slice 48 section**

Append to `docs/superpowers/mobile-dod-checklist.md`:

```markdown
## Slice 48 — F2 + F3 mobile parity (iOS + Android)

- [ ] Sign in → land on `/` → see drawer header (hamburger left, "Home" centered)
- [ ] Tap hamburger → drawer slides in from left with avatar + Navigate + Sign out
- [ ] Swipe from left edge → drawer opens with native iOS / Material gesture
- [ ] Tap scrim → drawer closes
- [ ] Navigate Home → Officials → Settings via drawer, active item highlight tracks
- [ ] Drawer header title updates per screen
- [ ] Sign out from drawer → land on `/sign-in`
- [ ] Home page Logo lockup + "Welcome, {name}" body renders below drawer header
- [ ] Profile-completion BrandAlert appears on home only when incomplete
- [ ] Tap "Complete your profile" link → routes to /profile/edit (hidden from drawer menu, has back arrow)
- [ ] /profile/edit back-arrow returns to /
- [ ] Edit address from /settings → /settings/address (hidden from drawer menu, has back arrow)
- [ ] /settings/address back-arrow returns to /settings
- [ ] Hardware back button (Android) closes open drawer first, then navigates back
- [ ] Dark mode toggle from /settings → drawer header + drawer content + content area repaint correctly
- [ ] Safe area insets respected on iPhone notch + Android system bars
- [ ] Keyboard does not push drawer off-screen
- [ ] /officials/[id] + /state-officials/[id] hidden from drawer menu + back-arrow returns to officials list
- [ ] /calibrate hidden from drawer menu (pre-calibration redirect still works)
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/mobile-dod-checklist.md
git commit -m "docs(slice-48): mobile DoD checklist for drawer + screen rewrites (slice 48 task 18)"
```

---

## Task 19: Final verification — full suite, typecheck, mobile DoD note

**Files:** none (verification only — commits docs follow-ups if discovered)

- [ ] **Step 1: Run the full workspace test suite**

Run: `pnpm test`
Expected: PASS across all workspaces. Known pre-existing integration failures (`@chiaro/profile`, `@chiaro/bills` — both require `SUPABASE_*` env vars per CLAUDE.md; identical on master) are acceptable. New tests:
- officials-ui: 551 → ~568 (+~17 across BrandNavRailBody, BackButton, BrandDrawerContent, BrandDrawer)
- web: unchanged at 61
- mobile: unchanged baseline (no new mobile tests in this slice; new components covered via officials-ui vitest)

If any NON-pre-existing test fails, STOP and report.

- [ ] **Step 2: Run typecheck across all packages**

Run: `pnpm -r typecheck`
Expected: PASS (11 packages including mobile). Mobile typecheck must succeed with the new BrandDrawer / BrandDrawerContent / BackButton imports + the new deps.

If typecheck fails, STOP and report.

- [ ] **Step 3: Run web build (sanity — slice 47 surface should still be green)**

Run: `pnpm --filter @chiaro/web build`
Expected: SUCCESS. Web bundle unchanged (slice 48 doesn't touch web; the new BrandDrawer / BrandDrawerContent / BackButton imports are gated by tree-shaking since web doesn't import them).

- [ ] **Step 4: Report branch state**

Run:
```bash
git log --oneline master..HEAD
git diff --stat master..HEAD | tail -3
```

Expected: ~20 commits (1 spec + 1 plan + 18 task commits + finalization). ~25 files changed.

- [ ] **Step 5: No commit (verification only)**

This task produces no commit unless an issue is found that requires a fix-up commit. If a fix-up is needed:

```bash
git add <files>
git commit -m "fix(slice-48): <issue> (task 19 verification follow-up)"
```

---

## Self-review summary

**Spec coverage:** Every spec §1-§7 item maps to a task:
- §1 in-scope: tasks 1-17
- §2 architecture: matches file paths in tasks 3-17
- §3 BrandDrawer + BrandDrawerContent + BrandNavRailBody + BackButton: tasks 3-6
- §4 screen rewrites: tasks 14, 15, 16, 17 + supporting tasks 10-13
- §5 testing: each component task has TDD steps; task 19 runs full sweep; task 18 adds DoD checklist
- §6 risks: R1 (deps install task 1), R2 (babel plugin task 1), R3 (metro config — n/a unless dev fails; flag during task 19), R4 (jest-expo brittleness — BrandDrawerContent + BrandDrawer tests use vi.mock to avoid live React Navigation, mitigates risk), R5 (BackButton headerLeft tasks 11-13, 16, 17), R6 (auto-handled by Drawer), R7 (sceneStyle used in BrandDrawer), R8 (Logo solid fallback — unchanged from slice 33), R9 (default width — used as-is), R10 (per-screen JSX pattern used), R11 (locked duplicate titles — tasks 16, 17), R12 (active key null on hidden routes — handled in BrandDrawerContent), R13 ('use client' on RN files — used consistently)
- §7 visual decisions: locked + implementation honors them

**Placeholder scan:** No TBD/TODO/handwave in any step. Every code block is complete.

**Type consistency:**
- `RailUser` interface: defined in BrandNavRailBody (task 3); re-exported from BrandNavRail; consumed by BrandDrawerContent (task 5)
- `RailRouteKey` type: defined in BrandNavRailBody (task 3); consumed by BrandDrawerContent (task 5)
- `BrandDrawerProps`: defined in task 6
- `BrandNavRailBodyProps`: defined in task 3
- `signOut(router, client)` signature: unchanged from slice 47; consumed by BrandDrawerContent task 5
- `useChiaroClient()`: unchanged from slice 10; consumed in BrandDrawerContent task 5
- `useBrandTokens()`: unchanged; consumed throughout
- `<Drawer.Screen options={...}>` JSX: consistent across tasks 10-17 (settings/index, calibrate, officials/[id], state-officials/[id], home, officials, profile/edit, settings/address)
