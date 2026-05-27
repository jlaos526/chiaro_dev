import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface CardSubsectionProps {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * Collapsible card-section with a ▸/▾ triangle toggle.
 *
 * Extracted (slice 10 cleanup) from 8 identical inline `Subsection` helpers
 * across federal + state card files. Wires the a11y attributes that were
 * lost during the slice-10 port (Task 6 & 7 review):
 *   - accessibilityRole="button"
 *   - accessibilityState={{ expanded: open }}  (ARIA aria-expanded)
 *   - accessibilityLabel="<Expand|Collapse> <label>"
 */
export function CardSubsection({
  label,
  open,
  onToggle,
  children,
}: CardSubsectionProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={[styles.subsection, { borderTopColor: semantic.border.default }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${label}`}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
      >
        <Text style={[styles.subsectionLabel, { color: semantic.text.primary }]}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open ? <View>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  subsection: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8,
  },
  subsectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 6,
  },
})
