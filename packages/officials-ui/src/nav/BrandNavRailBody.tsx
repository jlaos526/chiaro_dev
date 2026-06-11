'use client'

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
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

// Native: bump rows from ~30px (7+7 padding + ~16px line) to a ≥44px
// effective touch target (audit U5): 14+14 padding + ~16px line = 44px.
// Web keeps the denser 7px padding (pointer input; rail density intentional).
const NATIVE_NAV_ITEM_TOUCH = Platform.OS === 'web' ? null : { paddingVertical: 14 }

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
              dataSet={{ active: active ? 'true' : 'false' } as Record<string, string>}
              style={[
                styles.navItem,
                NATIVE_NAV_ITEM_TOUCH,
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={onSignOut}
        style={[styles.navItem, NATIVE_NAV_ITEM_TOUCH]}
      >
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
