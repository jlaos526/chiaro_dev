'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsValueRowProps {
  label: string
  value: string
}

export function SettingsValueRow({ label, value }: SettingsValueRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: semantic.text.primary }]}>{label}</Text>
      <Text style={[styles.value, { color: semantic.text.muted }]}>{value}</Text>
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
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { fontSize: 15, flex: 1 },
  value: { fontSize: 14 },
})
