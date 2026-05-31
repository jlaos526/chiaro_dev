'use client'

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { BrandNavRailBody, type RailRouteKey } from './BrandNavRailBody.tsx'

// Re-export RailUser so consumers can keep importing from BrandNavRail
export type { RailUser } from './BrandNavRailBody.tsx'

// Web: position the mobile top bar as fixed so it stays at the top of the
// viewport while the user scrolls. zIndex 5 keeps it above page content but
// below the overlay rail (zIndex 11) and scrim (zIndex 10).
const WEB_FIXED_TOP_BAR = Platform.OS === 'web'
  ? {
      position: 'fixed' as unknown as 'absolute',
      top: 0 as number,
      left: 0 as number,
      right: 0 as number,
      zIndex: 5 as number,
    }
  : null

interface RailCommonProps {
  user: import('./BrandNavRailBody.tsx').RailUser
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

// ─── Pathname ↔ key helpers ─────────────────────────────────────────────────

function pathnameToKey(pathname: string): RailRouteKey | null {
  if (pathname === '/') return 'home'
  if (pathname === '/officials' || pathname.startsWith('/officials/')) return 'officials'
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'settings'
  return null
}

const KEY_TO_PATH: Record<RailRouteKey, string> = {
  home: '/',
  officials: '/officials',
  settings: '/settings',
}

export function BrandNavRail(props: BrandNavRailProps): React.JSX.Element {
  if (props.variant === 'desktop') return <DesktopRail {...props} />
  return <MobileRail {...props} />
}

type Semantic = ReturnType<typeof useBrandTokens>['semantic']

// ─── Desktop variant ────────────────────────────────────────────────────────

function DesktopRail({ user, pathname, onNavigate, onSignOut }: RailDesktopProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View
      style={[
        styles.desktopRail,
        {
          backgroundColor: semantic.bg.subtle,
          borderRightColor: semantic.border.default,
        },
      ]}
    >
      <BrandNavRailBody
        user={user}
        activeRouteKey={pathnameToKey(pathname)}
        onNavigate={(key) => onNavigate(KEY_TO_PATH[key])}
        onSignOut={onSignOut}
      />
    </View>
  )
}

// ─── Mobile variant ─────────────────────────────────────────────────────────

function MobileRail({
  user,
  pathname,
  onNavigate,
  onSignOut,
  open,
  onOpenChange,
}: RailMobileProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const handleNavigate = (key: RailRouteKey) => {
    onNavigate(KEY_TO_PATH[key])
    onOpenChange(false)
  }
  const handleSignOut = () => {
    onSignOut()
    onOpenChange(false)
  }

  return (
    <>
      {/* Top bar: hamburger (left) + avatar circle (right) */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: semantic.bg.elevated,
            borderBottomColor: semantic.border.default,
          },
          WEB_FIXED_TOP_BAR,
        ]}
      >
        <Pressable
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => onOpenChange(!open)}
          style={styles.hamburger}
        >
          <View style={[styles.hamburgerBar, { backgroundColor: semantic.text.primary }]} />
          <View style={[styles.hamburgerBar, { backgroundColor: semantic.text.primary }]} />
          <View style={[styles.hamburgerBar, { backgroundColor: semantic.text.primary }]} />
        </Pressable>
        <AvatarCircle initial={user.initial} size={28} semantic={semantic} />
      </View>

      {/* Overlay: scrim behind + slide-in rail */}
      {open ? (
        <>
          {/* Scrim — tapping closes the menu.
              dataSet={{ chiaroRailScrim: 'true' }} → RNW emits
              data-chiaro-rail-scrim="true" (RNW 0.19 camelCase → kebab-case
              serialisation; slice 39 convention). */}
          <Pressable
            accessibilityLabel="Close menu"
            onPress={() => onOpenChange(false)}
            dataSet={{ chiaroRailScrim: 'true' } as Record<string, string>}
            style={styles.scrim}
          />
          {/* Overlay rail */}
          <View
            style={[
              styles.overlayRail,
              {
                backgroundColor: semantic.bg.elevated,
                borderRightColor: semantic.border.default,
              },
            ]}
          >
            <BrandNavRailBody
              user={user}
              activeRouteKey={pathnameToKey(pathname)}
              onNavigate={handleNavigate}
              onSignOut={handleSignOut}
            />
          </View>
        </>
      ) : null}
    </>
  )
}

// ─── AvatarCircle — used by mobile top bar only ──────────────────────────────

function AvatarCircle({
  initial,
  size,
  semantic,
}: {
  initial: string
  size: number
  semantic: Semantic
}): React.JSX.Element {
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
      <Text style={{ color: semantic.text.onAccent, fontWeight: '700', fontSize: size * 0.4 }}>
        {initial}
      </Text>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  desktopRail: {
    width: 200,
    borderRightWidth: 1,
    // height: '100%' — RNW resolves this fine; StyleSheet.create() expects
    // number but RNW's StyleSheet accepts '100%' for height/width at runtime.
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 10,
  },
  overlayRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    borderRightWidth: 1,
    zIndex: 11,
  },
})
