'use client'

import { createElement, type MouseEvent } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { SettingsRow } from './SettingsRow.tsx'

export interface SettingsNavRowProps {
  label: string
  value?: string
  onPress: () => void
  href?: string
}

export function SettingsNavRow({ label, value, onPress, href }: SettingsNavRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const content = (
    <>
      <Text style={[styles.label, { color: semantic.text.primary }]}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={[styles.value, { color: semantic.text.muted }]}>{value}</Text> : null}
        <Text style={[styles.chevron, { color: semantic.text.muted }]}>›</Text>
      </View>
    </>
  )

  // Smart-anchor (Gotcha #19f + slice 14 AlignmentChip): real <a href> with
  // intercepted plain-left-clicks. Modifier-key clicks (Cmd/Ctrl/Shift, middle)
  // fall through to browser default → restores new-tab semantics, link
  // prefetch, status-bar URL preview.
  if (Platform.OS === 'web' && href) {
    return createElement(
      'a',
      {
        href,
        onClick: (e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          onPress()
        },
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
          padding: '12px 16px',
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer',
        },
      },
      content,
    )
  }

  return (
    <SettingsRow onPress={onPress} accessibilityRole="link" accessibilityLabel={label}>
      {content}
    </SettingsRow>
  )
}

const styles = StyleSheet.create({
  label: { flex: 1, fontSize: 15 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { fontSize: 14 },
  chevron: { fontSize: 20 },
})
