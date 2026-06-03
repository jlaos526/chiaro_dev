'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface IssuePriorityTagProps {
  /** Visible + a11y label. Defaults to "Your priority". */
  label?: string
}

/**
 * Small accent pill (★ + label) marking a scorecard row whose org is tied to
 * one of the user's selected issue topics. Brand-tokened: accent bg with
 * contrasting on-accent text. The `accessibilityLabel` carries the same copy
 * so screen readers announce why the row floats to the top.
 */
export function IssuePriorityTag({
  label = 'Your priority',
}: IssuePriorityTagProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View
      accessibilityLabel={label}
      style={[styles.pill, { backgroundColor: semantic.accent.primary }]}
    >
      <Text style={[styles.text, { color: semantic.text.onAccent }]}>★ {label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
})
