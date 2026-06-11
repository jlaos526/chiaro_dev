'use client'

import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'

export interface SettingsScreenProps {
  title?: string
  children: ReactNode
}

export function SettingsScreen({ title = 'Settings', children }: SettingsScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const column = (
    <View style={styles.column}>
      <Text
        accessibilityRole="header"
        accessibilityLevel={1}
        style={[styles.title, { color: semantic.text.primary }]}
      >
        {title}
      </Text>
      {children}
    </View>
  )

  // Web: plain View, document body scrolls — byte-identical pre/post slice 65.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
        {column}
      </View>
    )
  }

  // Native: settings sections below the fold were unreachable (audit U0/C8).
  // ScrollView owns the brand bg so overscroll shows it.
  return (
    <ScrollView
      style={[styles.nativeScroll, { backgroundColor: semantic.bg.app }]}
      contentContainerStyle={styles.nativeContent}
      keyboardShouldPersistTaps="handled"
    >
      {column}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  nativeScroll: { flex: 1 },
  nativeContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  column: {
    width: '100%',
    maxWidth: 560,
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
})
