# Slice 48 — F2 + F3 mobile parity (Expo Router Drawer)

**Date:** 2026-05-30
**Branch:** `slice-48-f2-f3-mobile-parity`
**Tier:** Mega Slice (~15 files modified/new/deleted)

## 1. Goals & scope

Port slice 47's nav rail concept to the mobile app via Expo Router's `<Drawer>` (React Navigation Drawer under the hood — native swipe-from-edge gestures, iOS/Material idiomatic drawer chrome). Rewrite 4 mobile screens using slice 47's shells + primitives. Closes audit F2 + F3 + slice 47 R5 mobile-parity intent.

### In scope

- 3 new mobile deps: `@react-navigation/drawer`, `react-native-gesture-handler`, `react-native-reanimated` (via `expo install` for SDK-compatible versions)
- Babel config: `react-native-reanimated/plugin` added LAST in `babel.config.js` plugins array
- Root layout (`apps/mobile/app/_layout.tsx`): wrap in `<GestureHandlerRootView style={{ flex: 1 }}>`
- `(app)/_layout.tsx`: replace `<Stack>` with `<BrandDrawer>` (new wrapper around Expo Router's `<Drawer>`)
- New `BrandDrawer` component in `@chiaro/officials-ui` — themes `screenOptions` via `useBrandTokens()`, accepts `drawerContent` + per-screen children
- New `BrandDrawerContent` component in `@chiaro/officials-ui` — custom `drawerContent` consumer that renders the nav composition + wires React Navigation's `navigation.navigate` + the slice 47 `signOut` helper
- New `BrandNavRailBody` extraction in `@chiaro/officials-ui` — pure-composition shared between web `BrandNavRail` (slice 47) and mobile `BrandDrawerContent`
- New `BackButton` helper component for `headerLeft` on hidden-from-menu Drawer screens
- 4 mobile screen rewrites: `(app)/index.tsx`, `(app)/officials/index.tsx`, `(app)/profile/edit.tsx`, `(app)/settings/address.tsx`
- Delete `(app)/settings/_layout.tsx` (mirror web slice 47; address becomes hidden Drawer screen)
- Per-screen `<Drawer.Screen options={{ title, drawerItemStyle?, headerLeft? }} />` JSX declarations at top of each screen file
- Hidden Drawer items for sub/detail routes: `officials/[id]`, `state-officials/[id]`, `profile/edit`, `settings/address`, `calibrate`

### Out of scope

- Web changes (slice 47 already shipped; this slice consumes web-side artifacts)
- New screens (calibrate, sign-in, sign-up untouched — slice 31/39 migrated)
- iOS deep-link / Android intent handlers
- App icon / splash screen retheme
- Dynamic Drawer header titles for detail screens (e.g. official name on `/officials/[id]`) — follow-up; v1 uses static "Official" / "State official"
- Mobile DoD smoke testing (still blocked on EAS APK / paid Apple Developer credentials, pending since slice 2.5)
- New `BrandStack` wrapper — slice 48 deletes the only nested Stack (`settings/_layout.tsx`) so no immediate consumer; defer until needed

### Visual decisions locked

| Decision | Lock |
|---|---|
| Mobile nav pattern | **B** — Expo Router Drawer with native gestures (vs A reuse BrandNavRail mobile, vs C theme Stack headers only) |
| Drawer header strategy | **H1** — always-visible native Drawer header, themed via brand tokens |
| `settings/_layout.tsx` disposition | Delete (mirror web slice 47) |
| BrandFormScreen body title on hidden screens | Keep both Drawer header title + BrandFormScreen title (descriptive duplication, web parity) |
| Logo on mobile | Solid-color fallback per slice 33 (RN gradient escape hatch is web-only) |
| Code share | Extract `BrandNavRailBody` from web `BrandNavRail`; share with `BrandDrawerContent` |

## 2. Architecture

```
apps/mobile/
  package.json                          # MODIFY — add @react-navigation/drawer + react-native-gesture-handler + react-native-reanimated
  babel.config.js                       # MODIFY — add react-native-reanimated/plugin LAST
  app/
    _layout.tsx                         # MODIFY — wrap in <GestureHandlerRootView>
    (app)/
      _layout.tsx                       # REWRITE — <BrandDrawer> with BrandDrawerContent
      index.tsx                         # REWRITE — BrandPageScreen + Logo lockup + BrandHeading + DistrictPanel + OfficialsCard + <Drawer.Screen options={{ title: 'Home' }} />
      officials/
        index.tsx                       # REWRITE — BrandPageScreen + OfficialsList + <Drawer.Screen options={{ title: 'Officials' }} />
        [id].tsx                        # MODIFY — add <Drawer.Screen options={{ title: 'Official', drawerItemStyle: { display: 'none' }, headerLeft: () => <BackButton /> }} />
      profile/
        edit.tsx                        # REWRITE — BrandFormScreen + 2 BrandTextInput + BrandAlert + BrandButton + hidden Drawer.Screen
      settings/
        _layout.tsx                     # DELETE
        index.tsx                       # MODIFY — add <Drawer.Screen options={{ title: 'Settings' }} />
        address.tsx                     # REWRITE — BrandFormScreen + BrandTextInput + BrandAlert + BrandButton + hidden Drawer.Screen
      state-officials/
        [id].tsx                        # MODIFY — add hidden Drawer.Screen
      calibrate.tsx                     # MODIFY — add hidden Drawer.Screen

packages/officials-ui/src/
  nav/
    BrandNavRailBody.tsx                # NEW — extracted composition (avatar block + Navigate section + Sign out item)
    BrandNavRail.tsx                    # MODIFY — desktop + mobile variants consume BrandNavRailBody internally; web-only file
    BrandDrawer.tsx                     # NEW — themed wrapper around Expo Router's Drawer
    BrandDrawerContent.tsx              # NEW — drawerContent that renders BrandNavRailBody + React Navigation navigation + signOut
    BackButton.tsx                      # NEW — small back-arrow Pressable for headerLeft on hidden Drawer screens
```

### Dependency direction

`@chiaro/officials-ui` already depends on `@chiaro/ui-tokens`, `@chiaro/supabase-client`, `@chiaro/profile` (slice 47). New imports:
- `BrandDrawer` + `BrandDrawerContent` import from `expo-router` and `@react-navigation/drawer`
- These should be `peerDependency` on `@chiaro/officials-ui/package.json` (consuming app installs them; package doesn't bundle)
- Web does NOT import these (BrandDrawer/BrandDrawerContent live in mobile-only consumer territory)

**Workspace stays at 11 packages.** No new package created.

### File count

**Mobile:** 3 modify (package.json, babel.config.js, _layout.tsx) + 1 wrap (root _layout.tsx) + 4 rewrite (index, officials/index, profile/edit, settings/address) + 1 delete (settings/_layout) + 4 modify (settings/index, calibrate, officials/[id], state-officials/[id]) = **13 mobile files**

**Officials-ui:** 4 new (BrandNavRailBody, BrandDrawer, BrandDrawerContent, BackButton) + 1 modify (BrandNavRail) = **5 officials-ui files**

**Tests:** ~3-4 new test files

**Total:** ~22 files including tests.

## 3. BrandDrawer + BrandDrawerContent + BrandNavRailBody composition

### `BrandDrawer` — themed Drawer wrapper

`BrandDrawer` reads `useBrandTokens()` and composes Expo Router's `<Drawer>` `screenOptions` with brand-themed values:

```tsx
// packages/officials-ui/src/nav/BrandDrawer.tsx
'use client'

import { Drawer } from 'expo-router/drawer'
import type { ComponentProps } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandDrawerContent } from './BrandDrawerContent.tsx'

type DrawerProps = ComponentProps<typeof Drawer>

export interface BrandDrawerProps extends Omit<DrawerProps, 'drawerContent' | 'screenOptions'> {
  /** Override screen options per-screen if needed. Brand defaults always applied. */
  screenOptionsOverride?: DrawerProps['screenOptions']
}

export function BrandDrawer({ screenOptionsOverride, children, ...rest }: BrandDrawerProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const baseOptions = {
    headerStyle: { backgroundColor: semantic.bg.elevated },
    headerTintColor: semantic.text.primary,
    headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
    headerShadowVisible: false,
    drawerStyle: { backgroundColor: semantic.bg.elevated, width: '78%' as const },
    drawerType: 'front' as const,
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

### `BrandDrawerContent` — drawerContent consumer

```tsx
// packages/officials-ui/src/nav/BrandDrawerContent.tsx
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
  'home': 'index',
  'officials': 'officials/index',
  'settings': 'settings/index',
}

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

### `BrandNavRailBody` — extracted pure composition

```tsx
// packages/officials-ui/src/nav/BrandNavRailBody.tsx
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

### `BrandNavRail.tsx` modification (slice 47 refactor)

The existing slice 47 `BrandNavRail.tsx` web component currently has its own inline avatar/nav/signout composition. Refactor to consume the new `BrandNavRailBody`:

- Desktop variant: `<View style={[styles.desktopRail, ...]}><BrandNavRailBody {...props} /></View>`
- Mobile overlay variant: `<View style={[styles.overlayRail, ...]}><BrandNavRailBody {...props} /></View>`
- The route-string-to-key mapping moves into BrandNavRail (web uses `pathname` strings); the body takes a key, so web converts pathnames → keys via existing `isActive` logic
- Tests: existing 14+ cases still pass (body composition unchanged); selectors that find "Home"/"Officials"/"Settings"/"Sign out" text are unchanged

### `BackButton.tsx`

```tsx
// packages/officials-ui/src/nav/BackButton.tsx
'use client'

import { Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useBrandTokens } from '../brand-hooks.ts'

export function BackButton(): React.JSX.Element {
  const router = useRouter()
  const { semantic } = useBrandTokens()
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{ paddingHorizontal: 14 }}
    >
      <Text style={{ color: semantic.accent.primary, fontSize: 17, fontWeight: '600' }}>←</Text>
    </Pressable>
  )
}
```

Used as `headerLeft: () => <BackButton />` in hidden-from-menu Drawer screens (officials/[id], state-officials/[id], profile/edit, settings/address). Hidden Drawer screens otherwise default to the hamburger icon, which doesn't make sense for sub-routes.

## 4. Screen rewrites

### `(app)/index.tsx` (home)

```tsx
'use client'
import { Drawer } from 'expo-router/drawer'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getMyProfile } from '@chiaro/profile'
import {
  BrandPageScreen, BrandHeading, BrandAlert, BrandLink,
  Logo, OfficialsCard,
} from '@chiaro/officials-ui'
import { DistrictPanel } from '@/components/DistrictPanel'

type Profile = Awaited<ReturnType<typeof getMyProfile>>

export default function Home() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let mounted = true
    getMyProfile(supabase).then((p) => { if (mounted) { setProfile(p); setLoaded(true) } })
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
          {!profile?.completed && (
            <BrandAlert severity="info" title="Complete your profile">
              <BrandLink href="/(app)/profile/edit">Add your display name and username →</BrandLink>
            </BrandAlert>
          )}
          <DistrictPanel />
          <OfficialsCard
            onSelect={({ officialId, subCascadeSlug }) =>
              router.push(subCascadeSlug
                ? `/officials/${officialId}?cat=issue-positions&sub=${subCascadeSlug}`
                : `/officials/${officialId}`)
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

Behavior changes from slice 1:
- Inline `<Link href="/settings">Settings</Link>` REMOVED (drawer handles)
- `<Text style={{ fontSize: 24 }}>Chiaro</Text>` REPLACED with Logo lockup + BrandHeading "Welcome, {name}"
- Profile-completion `<Link>` REPLACED with BrandAlert info severity + BrandLink

### `(app)/officials/index.tsx`

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
- Bare `<ScrollView><Text fontSize: 24>Your officials</Text>` REPLACED with BrandPageScreen wrapper (no in-body h1 — Drawer header shows "Officials")
- `OfficialsList` callbacks preserved verbatim

### `(app)/profile/edit.tsx`

```tsx
'use client'
import { Drawer } from 'expo-router/drawer'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { profileFormSchema, updateMyProfile, ProfileError } from '@chiaro/profile'
import {
  BrandFormScreen, BrandTextInput, BrandButton, BrandAlert, BackButton,
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
- Bare RN `<Button>` + raw `color: 'red'` error text REPLACED with BrandButton + BrandAlert
- Form fields use BrandTextInput
- Drawer header shows "Edit profile"; BrandFormScreen body title shows "Complete your profile" (descriptive duplication per locked decision)

### `(app)/settings/address.tsx`

```tsx
'use client'
import { Drawer } from 'expo-router/drawer'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { addressInputSchema, getMyLocation } from '@chiaro/location'
import {
  BrandFormScreen, BrandTextInput, BrandButton, BrandAlert, BrandBodyText, BackButton,
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
    if (!parsed.success) return setError('Enter a complete address.')
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

  const subtitle = calibratedAt ? `Last updated ${new Date(calibratedAt).toLocaleString()}` : undefined

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
- `router.back()` changed to explicit `router.push('/settings')` (consistent with web; back button also works via BackButton helper)
- Drawer header "Home address" + BrandFormScreen body title "Home address" (intentional duplication for visual anchor)

### `(app)/settings/index.tsx`, `calibrate.tsx`, `officials/[id].tsx`, `state-officials/[id].tsx`

No body changes. Each adds a top-of-JSX `<Drawer.Screen options={{ ... }} />` element:

```tsx
// settings/index.tsx — in menu
<Drawer.Screen options={{ title: 'Settings' }} />
// calibrate.tsx — hidden, with back button
<Drawer.Screen options={{ title: 'Calibrate', drawerItemStyle: { display: 'none' }, headerLeft: () => <BackButton /> }} />
// officials/[id].tsx — hidden, with back button
<Drawer.Screen options={{ title: 'Official', drawerItemStyle: { display: 'none' }, headerLeft: () => <BackButton /> }} />
// state-officials/[id].tsx — hidden, with back button
<Drawer.Screen options={{ title: 'State official', drawerItemStyle: { display: 'none' }, headerLeft: () => <BackButton /> }} />
```

### `(app)/_layout.tsx` (REWRITE)

```tsx
import { useEffect, useState } from 'react'
import { Redirect, useSegments } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BrandDrawer } from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

type CalibrationStatus = 'unknown' | 'calibrated' | 'uncalibrated' | 'skipped'

export default function AppLayout() {
  const segments = useSegments()
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>('unknown')

  useEffect(() => {
    let mounted = true
    async function check() {
      const skip = await AsyncStorage.getItem('chiaro_skip_calibrate')
      if (!mounted) return
      if (skip === '1') { setCalibrationStatus('skipped'); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return
      const { count } = await supabase
        .from('user_locations')
        .select('id', { head: true, count: 'exact' })
        .eq('id', user.id)
      if (!mounted) return
      setCalibrationStatus((count ?? 0) > 0 ? 'calibrated' : 'uncalibrated')
    }
    check()
    return () => { mounted = false }
  }, [])

  const segmentList = segments as readonly string[]
  const onCalibrate = segmentList[segmentList.length - 1] === 'calibrate'
  const onSettings = segmentList.includes('settings')
  if (calibrationStatus === 'uncalibrated' && !onCalibrate && !onSettings) {
    return <Redirect href="/calibrate" />
  }

  return <BrandDrawer />
}
```

Calibration redirect logic preserved verbatim. `<Stack>` replaced with `<BrandDrawer />`. No children passed — Expo Router's file-based routing auto-registers all `(app)/**` files as Drawer screens. Per-screen `<Drawer.Screen options={...} />` JSX inside each screen file provides the per-screen config.

### Root `apps/mobile/app/_layout.tsx`

```diff
 import { Slot, useRouter, useSegments } from 'expo-router'
 import { useEffect, useState } from 'react'
 import { ActivityIndicator, View } from 'react-native'
+import { GestureHandlerRootView } from 'react-native-gesture-handler'
 import { QueryProvider } from '@/lib/query-client'
 import { ErrorBoundary, initSentry } from '@/lib/sentry'
 import { supabase } from '@/lib/supabase'
 import { readBrandMode, writeBrandMode } from '@/lib/brand-mode-storage'
 import { BrandModeProvider, ChiaroClientProvider } from '@chiaro/officials-ui'
 import type { Session } from '@supabase/supabase-js'
 import type { BrandMode } from '@chiaro/ui-tokens'

 initSentry()

 export default function RootLayout() {
   // ... all existing state + effects unchanged ...

   if (!loaded) {
     return (
       <ErrorBoundary>
         <BrandModeProvider defaultMode={null} onChange={writeBrandMode}>
           <ChiaroClientProvider client={supabase}>
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
-            <Slot />
+            <GestureHandlerRootView style={{ flex: 1 }}>
+              <Slot />
+            </GestureHandlerRootView>
           </QueryProvider>
         </ChiaroClientProvider>
       </BrandModeProvider>
     </ErrorBoundary>
   )
 }
```

### `babel.config.js`

```diff
 module.exports = function (api) {
   api.cache(true)
   return {
     presets: ['babel-preset-expo'],
+    plugins: [
+      'react-native-reanimated/plugin', // MUST be last per reanimated docs
+    ],
   }
 }
```

If `babel.config.js` doesn't exist yet, create it with the above. If it has existing plugins, append `react-native-reanimated/plugin` at the END (reanimated must always be last in the plugins array).

## 5. Testing

### New unit tests (`packages/officials-ui/test/`)

- `nav/BrandNavRailBody.test.tsx` — ~5 cases:
  - Renders avatar + name + handle from user prop
  - Renders 3 nav items
  - Marks active item via `activeRouteKey` (asserts `data-active="true"`)
  - Invokes `onNavigate` with correct key on press
  - Invokes `onSignOut` on Sign out press

- `nav/BrandDrawerContent.test.tsx` — ~6 cases (with React Navigation test setup):
  - Renders BrandNavRailBody with profile data
  - Falls back to "Welcome" + "?" on null profile
  - Active route from React Navigation state passes through to body
  - Navigate dispatches `navigation.navigate(routeName)` then `closeDrawer()`
  - Sign out calls shared `signOut` helper
  - Maps route names correctly (`index` → 'home', `officials/index` → 'officials', `settings/index` → 'settings')

- `nav/BrandDrawer.test.tsx` — ~3 cases:
  - Wraps Expo Router's Drawer
  - Applies brand-themed screenOptions (bg.elevated header, accent.primary tint)
  - Forwards `drawerContent` callback that renders BrandDrawerContent

- `nav/BackButton.test.tsx` — ~3 cases:
  - Renders ← character with accent color
  - Calls router.back() on press
  - Sets accessibilityLabel "Back"

- `nav/BrandNavRail.test.tsx` — UPDATE existing 14 cases (refactor — body composition extracted to BrandNavRailBody). Selectors that find "Home"/"Officials"/"Settings"/"Sign out" text continue to work because the body renders those labels.

**Total delta:** ~17 new test cases. officials-ui 551 → ~568.

### Mobile app tests (`apps/mobile/test/`)

The mobile app has limited test coverage (per Gotcha #11). Slice 48 adds minimal smoke if jest-expo cooperates:

- `app/(app)/_layout.test.tsx` (NEW) — ~2 cases if tractable:
  - Renders BrandDrawer when calibration check passes
  - Redirects to /calibrate when uncalibrated

If jest-expo + Drawer.Navigator integration is brittle, defer to manual smoke + cover the body composition via `BrandNavRailBody` unit tests. Flag in implementation.

### No schema work

pgTAP unchanged at 428.

### Manual smoke checklist (`docs/superpowers/mobile-dod-checklist.md`)

Append:

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

iOS + Android smoke depends on EAS APK + Apple Developer credentials (pending since slice 2.5).

## 6. Risks & open questions

### R1 — Reanimated 4 + Expo SDK 54 compatibility

Reanimated 4 is current; SDK 54 bundles `react-native-reanimated@~4.1.x`. `@react-navigation/drawer` v7 requires `react-native-reanimated@>=3.16`. Verify via:

```bash
pnpm dlx expo install react-native-reanimated react-native-gesture-handler @react-navigation/drawer --filter @chiaro/mobile
```

Expo CLI auto-resolves SDK-compatible versions.

### R2 — Babel plugin order

`react-native-reanimated/plugin` MUST be last in `babel.config.js` plugins array. Document inline.

### R3 — Metro config

Reanimated 4 + Expo SDK 54 requires no special Metro config in v1. If Metro complains about worklet imports during dev, add `unstable_enableSymlinks` to `metro.config.js` per Expo docs.

### R4 — jest-expo + Drawer.Navigator interaction

Per Gotcha #11, jest-expo has dynamic-mock pattern crashes. `BrandDrawerContent` tests may need `jest.mock` of `useNavigation` / `useDrawerStatus`. If integration is brittle, defer those tests to manual smoke + cover body via `BrandNavRailBody` unit tests.

### R5 — Drawer header back-arrow vs hamburger

React Navigation Drawer shows hamburger on top-level routes by default. For hidden Drawer screens reached via `router.push`, the header shows hamburger by default (since they're top-level Drawer routes). Slice 48 explicitly overrides with `headerLeft: () => <BackButton />` for: officials/[id], state-officials/[id], profile/edit, settings/address, calibrate.

### R6 — Drawer open from any screen (Android hardware back)

Drawer.Navigator handles Android back-button-to-close-drawer automatically when drawer is open. No `BackHandler` glue needed.

### R7 — sceneStyle vs contentStyle (React Navigation v7)

v7 renamed `cardStyle` to `sceneStyle` (Drawer). Use `sceneStyle: { backgroundColor: semantic.bg.app }`.

### R8 — Logo on mobile

Logo renders solid-color fallback on RN (Pattern B gradient escape hatch is web-only per slice 33). Mobile home page shows solid Logo lockup — different from web's gradient. Intentional cross-platform deviation.

### R9 — Drawer width

Default is responsive `'78%'`. Slice 48 uses default; tablet portrait may want fixed pixel width in a follow-up.

### R10 — Per-screen Drawer.Screen JSX vs centralized config

Per-file pattern (proximity). Centralization deferred unless surface grows.

### R11 — BrandFormScreen body title duplication on hidden screens

Drawer header shows "Edit profile" / "Home address". BrandFormScreen body shows "Complete your profile" / "Home address". Locked decision: keep both — descriptive duplication, web parity, BrandFormScreen title remains a card-internal anchor.

### R12 — Active key not detected on hidden routes

When user is on a hidden Drawer route (e.g. /profile/edit), `activeRouteName` matches none of `ROUTE_TO_KEY` entries → `activeKey === null` → no item highlighted in drawer. Acceptable — hidden routes are sub-pages, not nav destinations.

### R13 — `'use client'` directive on RN-only files

`'use client'` directive is harmless on RN — it's a Next.js RSC marker that RN/Metro ignores. Slice 47 added it to all primitive files for web RSC compliance; slice 48 mirrors the pattern for consistency.

## 7. Visual decisions locked (summary)

| Decision | Lock |
|---|---|
| Mobile nav pattern | **B** — Expo Router Drawer + React Navigation Drawer (native gestures) |
| New deps | `@react-navigation/drawer` + `react-native-gesture-handler` + `react-native-reanimated` |
| Drawer header | **H1** — always native Drawer header, themed via brand tokens |
| Settings inner Stack | DELETED (mirror web slice 47) |
| Settings/address Drawer registration | Hidden from menu (`drawerItemStyle: { display: 'none' }`) + BackButton headerLeft |
| BrandFormScreen body title on hidden screens | Keep both Drawer header title + BrandFormScreen title |
| Logo on mobile | Solid-color fallback per slice 33 (RN gradient escape hatch web-only) |
| Code share | Extract `BrandNavRailBody` from web `BrandNavRail`; share with `BrandDrawerContent` |
| Drawer width | React Navigation default 78% |
| Drawer slide direction | Left (default) |
| Drawer type | `'front'` (overlay style, not push) |
| Scrim color | `'rgba(0,0,0,0.4)'` |
| Sub/detail screens (hidden from menu) | officials/[id], state-officials/[id], profile/edit, settings/address, calibrate |
| Per-screen options pattern | Inline `<Drawer.Screen options={...} />` at top of each screen JSX |
