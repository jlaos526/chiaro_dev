'use client'

import { StyleSheet, Text } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SettingsRow } from './SettingsRow.tsx'

export interface SettingsValueRowProps {
  label: string
  value: string
}

export function SettingsValueRow({ label, value }: SettingsValueRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <SettingsRow>
      <Text style={[styles.label, { color: semantic.text.primary }]}>{label}</Text>
      <Text style={[styles.value, { color: semantic.text.muted }]}>{value}</Text>
    </SettingsRow>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 15, flex: 1 },
  value: { fontSize: 14 },
})
