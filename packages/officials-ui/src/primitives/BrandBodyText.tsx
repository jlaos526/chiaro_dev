'use client'

import { Text } from 'react-native'
import { type ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { PRIMITIVE_FONT_FAMILY } from './font.ts'

export interface BrandBodyTextProps {
  children: ReactNode
  size?: 'default' | 'sm'
  muted?: boolean
  testID?: string
}

const SIZE_DIMS = {
  default: { fontSize: 15, lineHeight: 15 * 1.55 },
  sm:      { fontSize: 13, lineHeight: 13 * 1.55 },
} as const

/**
 * Body text primitive. size=default (15px) or sm (13px). 1.55 line-height
 * both. Color defaults to semantic.text.body; muted=true switches to
 * semantic.text.muted. Mode-aware via useBrandTokens().
 */
export function BrandBodyText({ children, size = 'default', muted = false, testID }: BrandBodyTextProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dims = SIZE_DIMS[size]
  const color = muted ? semantic.text.muted : semantic.text.body
  return (
    <Text
      style={{
        fontSize: dims.fontSize,
        lineHeight: dims.lineHeight,
        color,
        fontFamily: PRIMITIVE_FONT_FAMILY,
      }}
      testID={testID}
    >
      {children}
    </Text>
  )
}
