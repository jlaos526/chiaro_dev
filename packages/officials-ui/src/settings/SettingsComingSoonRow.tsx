'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsComingSoonRowProps {
  label: string
  description?: string
}

export function SettingsComingSoonRow({ label, description }: SettingsComingSoonRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        <Text style={[styles.label, { color: semantic.text.primary, opacity: 0.6 }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: semantic.text.muted }]}>{description}</Text>
        ) : null}
      </View>
      <View style={[styles.badge, { backgroundColor: semantic.bg.subtle }]}>
        <Text style={[styles.badgeText, { color: semantic.text.muted }]}>Coming soon</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelGroup: { flex: 1, gap: 2 },
  label: { fontSize: 15 },
  description: { fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
})
