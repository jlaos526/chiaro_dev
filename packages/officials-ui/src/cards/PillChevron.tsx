'use client'

import { Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface PillChevronProps {
  open: boolean
  size?: 'sm' | 'md'
}

/**
 * Small rounded pill rendering an expand chevron. Mode-aware via
 * useBrandTokens (slice 46): bg uses semantic.bg.subtle; text uses
 * semantic.text.primary.
 */
export function PillChevron({ open, size = 'md' }: PillChevronProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dim = size === 'sm' ? 18 : 20
  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        backgroundColor: semantic.bg.subtle,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: semantic.text.primary, fontSize: 10, fontWeight: '700' }}>
        {open ? '▾' : '▸'}
      </Text>
    </View>
  )
}
