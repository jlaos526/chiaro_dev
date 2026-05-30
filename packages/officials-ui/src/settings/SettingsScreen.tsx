'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'

export interface SettingsScreenProps {
  title?: string
  children: ReactNode
}

export function SettingsScreen({ title = 'Settings', children }: SettingsScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
})
