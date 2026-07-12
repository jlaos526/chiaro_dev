'use client'

import { createElement, type ReactNode } from 'react'
import { Linking, Platform, Pressable } from 'react-native'

export interface SmartAnchorProps {
  children: ReactNode
  href: string
  onPress?: () => void
  /**
   * Slice 79 (audit C7): fired on `mouseenter`/`focus` in the WEB branch only —
   * hover/focus-gated route prefetch. Web wrappers pass
   * `() => router.prefetch(href)`; the shared package stays next-free. No
   * viewport-based prefetch by design (N-row fan-out). Native ignores it.
   */
  onPrefetch?: () => void
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
  onPrefetch,
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
        ...(onPrefetch ? { onMouseEnter: onPrefetch, onFocus: onPrefetch } : {}),
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
