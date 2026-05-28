'use client'

import { Children, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsSectionProps {
  title?: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const items = Children.toArray(children)
  return (
    <View style={styles.section}>
      {title ? (
        <Text
          accessibilityRole="header"
          accessibilityLevel={2}
          style={[styles.title, { color: semantic.text.muted }]}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      {description ? (
        <Text style={[styles.description, { color: semantic.text.muted }]}>{description}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: semantic.bg.card, borderColor: semantic.border.default }]}>
        {items.map((child, idx) => (
          <View key={idx}>
            {child}
            {idx < items.length - 1 ? (
              <View
                // RNW 0.19 strips arbitrary `data-*` props on <View>; the
                // canonical web pass-through is `dataSet={{ key: value }}`,
                // which RNW serializes to `data-key="value"` on the rendered
                // <div>. Used here as a test-only marker (see
                // SettingsSection.test.tsx). RN native ignores dataSet.
                dataSet={{ divider: 'true' }}
                style={[styles.divider, { backgroundColor: semantic.border.default }]}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  description: { fontSize: 13, marginBottom: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    marginLeft: 16,
  },
})
