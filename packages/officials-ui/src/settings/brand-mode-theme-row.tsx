'use client'

import type * as React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { useBrandModeSetter } from '../brand-mode-provider.tsx'
import type { BrandMode } from '@chiaro/ui-tokens'

interface Option {
  value: BrandMode | null
  label: string
}

const OPTIONS: readonly Option[] = [
  { value: null, label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function BrandModeThemeRow(): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { override, setMode } = useBrandModeSetter()
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: semantic.text.muted }]}>Theme</Text>
      <View
        style={[
          styles.row,
          { borderColor: semantic.border.default, backgroundColor: semantic.bg.card },
        ]}
      >
        {OPTIONS.map((opt, idx) => {
          const selected = opt.value === override
          return (
            <Pressable
              key={opt.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              aria-pressed={selected}
              onPress={() => setMode(opt.value)}
              style={[
                styles.segment,
                idx > 0 && { borderLeftWidth: 1, borderLeftColor: semantic.border.default },
                selected && { backgroundColor: semantic.accent.bg },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? semantic.accent.primary : semantic.text.body },
                  selected && styles.segmentTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14 },
  segmentTextSelected: { fontWeight: '600' },
})
