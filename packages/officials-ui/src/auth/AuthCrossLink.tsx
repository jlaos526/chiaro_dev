'use client'

import { createElement } from 'react'
import { Platform, Pressable, StyleSheet, Text } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'

export interface AuthCrossLinkProps {
  mode: 'sign-in' | 'sign-up'
  onPress: () => void
  /** Web a11y: real `<a href>` for middle-click / new-tab / status-bar URL preview.
   *  Native ignores this prop. Slice 14 + slice 18 M6 smart-anchor pattern. */
  href?: string
}

const COPY = {
  'sign-in': { prefix: 'New here? ', action: 'Create account' },
  'sign-up': { prefix: 'Already have one? ', action: 'Sign in' },
}

export function AuthCrossLink({ mode, onPress, href }: AuthCrossLinkProps): React.JSX.Element {
  const { prefix, action } = COPY[mode]
  const inner = (
    <Text style={styles.text}>
      {prefix}
      <Text style={styles.action}>{action}</Text>
    </Text>
  )

  // Web smart-anchor: real <a href> for middle-click / modifier-key, intercept plain click.
  if (Platform.OS === 'web' && href) {
    return createElement(
      'a',
      {
        href,
        onClick: (e: React.MouseEvent) => {
          // Let Ctrl/Cmd/Shift/middle clicks fall through to browser default.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          onPress()
        },
        style: { textDecoration: 'none' },
        'aria-label': `${prefix.trim()} ${action}`,
      },
      inner,
    )
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${prefix.trim()} ${action}`}>
      {inner}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  text:   { fontSize: 13, color: COLORS.neutral.textMuted, textAlign: 'center' },
  action: { fontWeight: '600', color: COLORS.brand.primary },
})
