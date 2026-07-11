'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SettingsRow } from './SettingsRow.tsx'

export interface SettingsComingSoonRowProps {
  label: string
  description?: string
}

export function SettingsComingSoonRow({
  label,
  description,
}: SettingsComingSoonRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <SettingsRow>
      <View style={styles.labelGroup}>
        <Text style={[styles.label, { color: semantic.text.primary, opacity: 0.6 }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: semantic.text.muted }]}>{description}</Text>
        ) : null}
      </View>
      <View style={[styles.badge, { backgroundColor: semantic.bg.subtle }]}>
        <Text style={[styles.badgeText, { color: semantic.text.muted }]}>Coming soon</Text>
      </View>
    </SettingsRow>
  )
}

const styles = StyleSheet.create({
  labelGroup: { flex: 1, gap: 2 },
  label: { fontSize: 15 },
  description: { fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
})
