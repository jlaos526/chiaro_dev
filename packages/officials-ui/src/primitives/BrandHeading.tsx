'use client'

import { createElement, type ReactNode } from 'react'
import { Platform, Text } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'
import { PRIMITIVE_FONT_FAMILY } from './font.ts'

export interface BrandHeadingProps {
  children: ReactNode
  level: 1 | 2 | 3
  color?: string
}

const LEVEL_STYLES = {
  1: { fontSize: 28, lineHeight: 28 * 1.2, letterSpacing: -28 * 0.015, fontWeight: '700' as const },
  2: { fontSize: 22, lineHeight: 22 * 1.25, letterSpacing: -22 * 0.01, fontWeight: '700' as const },
  3: { fontSize: 18, lineHeight: 18 * 1.3, letterSpacing: -18 * 0.005, fontWeight: '700' as const },
} as const

// Web-style metrics use the unitless line-height that BRAND_TYPE spec uses.
const WEB_LINE_HEIGHT = { 1: 1.2, 2: 1.25, 3: 1.3 }

/**
 * Heading primitive. Renders real <h1>/<h2>/<h3> on web (SEO + screen reader
 * landmark) via createElement. Native uses <Text accessibilityRole='header'
 * accessibilityLevel={N}>. Mode-aware via useBrandTokens().
 */
export function BrandHeading({ children, level, color }: BrandHeadingProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const finalColor = color ?? semantic.text.primary

  if (Platform.OS === 'web') {
    const tag = `h${level}` as 'h1' | 'h2' | 'h3'
    return createElement(
      tag,
      {
        style: {
          fontSize: `${LEVEL_STYLES[level].fontSize}px`,
          lineHeight: WEB_LINE_HEIGHT[level],
          letterSpacing: `${LEVEL_STYLES[level].letterSpacing}px`,
          fontWeight: 700,
          color: finalColor,
          fontFamily: PRIMITIVE_FONT_FAMILY,
          margin: 0,
        },
      },
      children,
    )
  }

  return (
    <Text
      accessibilityRole="header"
      accessibilityLevel={level}
      style={{
        ...LEVEL_STYLES[level],
        color: finalColor,
        fontFamily: PRIMITIVE_FONT_FAMILY,
      }}
    >
      {children}
    </Text>
  )
}
