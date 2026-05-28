'use client'

import { Pressable, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'

export interface SettingsRowProps {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link'
}

export function SettingsRow({
  children,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
}: SettingsRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (onPress) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled: !!disabled }}
        aria-disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.row,
          pressed && !disabled ? { backgroundColor: semantic.bg.subtle } : null,
        ]}
      >
        {children}
      </Pressable>
    )
  }
  return <View style={styles.row}>{children}</View>
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
})
