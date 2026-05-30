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
  { path: '/',          label: 'Home' },
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
      <AvatarBlock user={user} semantic={semantic} />
      <NavSection pathname={pathname} onNavigate={onNavigate} semantic={semantic} onClose={undefined} />
      <View style={styles.spacer} />
      <SignOutItem onPress={onSignOut} semantic={semantic} />
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
      {/* Top bar: hamburger (left) + avatar circle (right) */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: semantic.bg.elevated,
            borderBottomColor: semantic.border.default,
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Open menu"
          accessibilityRole="button"
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
            <AvatarBlock user={user} semantic={semantic} />
            <NavSection
              pathname={pathname}
              onNavigate={handleNavigate}
              semantic={semantic}
              onClose={() => onOpenChange(false)}
            />
            <View style={styles.spacer} />
            <SignOutItem onPress={handleSignOut} semantic={semantic} />
          </View>
        </>
      ) : null}
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AvatarBlock({ user, semantic }: { user: RailUser; semantic: Semantic }): React.JSX.Element {
  const name = user.displayName ?? user.username ?? 'Welcome'
  const handle = user.username ? `@${user.username}` : null
  return (
    <View style={[styles.avatarBlock, { borderBottomColor: semantic.border.default }]}>
      <AvatarCircle initial={user.initial} size={36} semantic={semantic} />
      <View style={styles.avatarText}>
        <Text style={[styles.avatarName, { color: semantic.text.primary }]} numberOfLines={1}>
          {name}
        </Text>
        {handle ? (
          <Text style={[styles.avatarHandle, { color: semantic.text.muted }]} numberOfLines={1}>
            {handle}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

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

function NavSection({
  pathname,
  onNavigate,
  semantic,
  onClose,
}: {
  pathname: string
  onNavigate: (path: string) => void
  semantic: Semantic
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
            // dataSet → RNW → data-active="true"/"false" in DOM.
            // Slice 39 pattern: dataSet camelCase keys → kebab-case data-* attrs.
            dataSet={{ active: active ? 'true' : 'false' } as Record<string, string>}
            style={[
              styles.navItem,
              { backgroundColor: active ? semantic.bg.elevated : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.navItemText,
                {
                  color: semantic.text.primary,
                  fontWeight: active ? '600' : '400',
                },
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

function SignOutItem({ onPress, semantic }: { onPress: () => void; semantic: Semantic }): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navItem}>
      <Text style={[styles.navItemText, { color: semantic.alert.danger.fg, fontWeight: '600' }]}>
        Sign out
      </Text>
    </Pressable>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  desktopRail: {
    width: 200,
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderRightWidth: 1,
    // height: '100%' — RNW resolves this fine; StyleSheet.create() expects
    // number but RNW's StyleSheet accepts '100%' for height/width at runtime.
    height: '100%' as unknown as number,
  },
  spacer: { flex: 1 },
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
    paddingHorizontal: 12,
    paddingVertical: 18,
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
