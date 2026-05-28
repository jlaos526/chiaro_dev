'use client'

import { StyleSheet, Switch, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

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
    <View
      style={styles.row}
      aria-disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
    >
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
})
