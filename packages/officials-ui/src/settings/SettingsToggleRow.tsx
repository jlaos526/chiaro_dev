'use client'

import { StyleSheet, Switch, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SettingsRow } from './SettingsRow.tsx'

export interface SettingsToggleRowProps {
  label: string
  description?: string
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

export function SettingsToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: SettingsToggleRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const opacity = disabled ? 0.5 : 1
  return (
    <SettingsRow disabled={disabled}>
      <View style={styles.labelGroup}>
        <Text style={[styles.label, { color: semantic.text.primary, opacity }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: semantic.text.muted, opacity }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onChange}
        disabled={disabled}
      />
    </SettingsRow>
  )
}

const styles = StyleSheet.create({
  labelGroup: { flex: 1, gap: 2 },
  label: { fontSize: 15 },
  description: { fontSize: 13 },
})
