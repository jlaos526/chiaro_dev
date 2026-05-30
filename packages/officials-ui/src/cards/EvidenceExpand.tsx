'use client'

import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { PillChevron } from './PillChevron.tsx'

export interface EvidenceExpandProps {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * Expandable evidence panel with title + chevron toggle. Mode-aware via
 * useBrandTokens (slice 46): borderTopColor uses semantic.border.default;
 * title + toggle label use semantic.text.primary.
 */
export function EvidenceExpand({
  title,
  open,
  onToggle,
  children,
}: EvidenceExpandProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View>
      {open ? (
        <View
          style={{
            marginTop: 14,
            borderTopWidth: 1,
            borderTopColor: semantic.border.default,
            borderStyle: 'dashed',
            paddingTop: 12,
          }}
        >
          <Text
            style={{
              fontWeight: '700',
              fontSize: 13,
              color: semantic.text.primary,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          {children}
        </View>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <PillChevron open={open} />
          <Text style={{ color: semantic.text.primary, fontSize: 13, fontWeight: '600' }}>
            {open ? 'Hide evidence' : 'view evidence'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
