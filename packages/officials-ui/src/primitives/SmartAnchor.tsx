'use client'

import { createElement, type ReactNode } from 'react'
import { Linking, Platform, Pressable } from 'react-native'

export interface SmartAnchorProps {
  children: ReactNode
  href: string
  onPress?: () => void
  style?: Record<string, unknown>
  accessibilityLabel?: string
}

/**
 * Behavior-only smart anchor (slice 14/18 pattern, style-agnostic — unlike the
 * styled {@link BrandLink}). Web: real `<a href>` with modifier-key passthrough
 * (cmd/ctrl/shift/middle fall through to the browser; plain left-click →
 * `preventDefault` + `onPress`, or `Linking.openURL` when `onPress` is omitted).
 * Native: `Pressable` with `accessibilityRole="link"`. Caller owns visuals via
 * `style` (merged after the base `textDecoration: none` + `color: inherit` on
 * web).
 */
export function SmartAnchor({
  children,
  href,
  onPress,
  style,
  accessibilityLabel,
}: SmartAnchorProps): React.JSX.Element {
  if (Platform.OS === 'web') {
    return createElement(
      'a',
      {
        href,
        'aria-label': accessibilityLabel,
        onClick: (e: MouseEvent) => {
          // Honor modifier-key + middle-click → browser default (new tab etc.).
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          if (onPress) {
            onPress()
          } else {
            Linking.openURL(href).catch(() => {})
          }
        },
        style: { textDecoration: 'none', color: 'inherit', ...style },
      },
      children,
    )
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={() => (onPress ? onPress() : Linking.openURL(href).catch(() => {}))}
      style={style}
    >
      {children}
    </Pressable>
  )
}
