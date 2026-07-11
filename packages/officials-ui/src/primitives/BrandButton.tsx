'use client'

import { Pressable, Text } from 'react-native'
import { type ReactNode } from 'react'
import { useBrandTokens } from '../brand-hooks.ts'
import { PRIMITIVE_FONT_FAMILY } from './font.ts'

export interface BrandButtonProps {
  children: ReactNode
  onPress: () => void
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'default' | 'lg'
  disabled?: boolean
  accessibilityLabel?: string
}

const SIZE_DIMS = {
  sm:      { height: 32, paddingHorizontal: 12, fontSize: 13 },
  default: { height: 40, paddingHorizontal: 18, fontSize: 14 },
  lg:      { height: 48, paddingHorizontal: 22, fontSize: 15 },
} as const

/**
 * Brand-aligned button primitive. Mode-aware via useBrandTokens().
 *
 * variant='primary': accent.primary bg + text.onAccent text.
 * variant='secondary': transparent bg + accent.primary border + accent.primary text.
 * disabled: opacity 0.4, blocks onPress, sets aria-disabled.
 */
export function BrandButton({
  children,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  accessibilityLabel,
}: BrandButtonProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dims = SIZE_DIMS[size]

  const bg = variant === 'primary'
    ? semantic.accent.primary
    : 'transparent'
  // Slice 47 cleanup: ternary collapsed (both branches identical).
  const borderColor = semantic.accent.primary
  const textColor = variant === 'primary'
    ? semantic.text.onAccent
    : semantic.accent.primary

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        backgroundColor: bg,
        borderColor,
        borderWidth: 1,
        borderRadius: 6,
        height: dims.height,
        paddingHorizontal: dims.paddingHorizontal,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          color: textColor,
          fontSize: dims.fontSize,
          fontWeight: '600',
          fontFamily: PRIMITIVE_FONT_FAMILY,
        }}
      >
        {children}
      </Text>
    </Pressable>
  )
}
