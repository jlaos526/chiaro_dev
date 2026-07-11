'use client'

import { StyleSheet, Text } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SettingsRow } from './SettingsRow.tsx'

export interface SettingsActionRowProps {
  label: string
  onPress: () => void
  danger?: boolean
}

export function SettingsActionRow({
  label,
  onPress,
  danger,
}: SettingsActionRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const color = danger ? semantic.alert.danger.fg : semantic.text.primary
  return (
    <SettingsRow onPress={onPress} accessibilityLabel={label}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </SettingsRow>
  )
}

const styles = StyleSheet.create({
  label: { flex: 1, fontSize: 15 },
})
