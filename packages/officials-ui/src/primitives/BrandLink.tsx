'use client'

import { createElement, type ReactNode } from 'react'
import { Linking, Platform, Pressable, Text } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BrandLinkProps {
  children: ReactNode
  href: string
  onPress?: () => void
  external?: boolean
}

/**
 * Inline link primitive with smart-anchor behavior (slice 14 + 18 pattern,
 * inlined here per YAGNI — slice 45 spec section 7 risk 2). On web renders
 * real <a href> with onClick intercept: plain left-clicks call
 * preventDefault + onPress (or Linking.openURL fallback); modifier-key
 * clicks (cmd/ctrl/shift/middle) fall through to browser default. Native
 * uses Pressable + Text.
 */
export function BrandLink({ children, href, onPress, external = false }: BrandLinkProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const color = semantic.link.fg

  if (Platform.OS === 'web') {
    const props: Record<string, unknown> = {
      href,
      onClick: (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
        e.preventDefault()
        if (onPress) {
          onPress()
        } else {
          Linking.openURL(href).catch(() => {})
        }
      },
      style: {
        color,
        textDecoration: 'underline',
        fontWeight: 500,
        cursor: 'pointer',
      },
    }
    if (external) {
      props.target = '_blank'
      props.rel = 'noopener noreferrer'
    }
    return createElement('a', props, children)
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => (onPress ? onPress() : Linking.openURL(href).catch(() => {}))}
    >
      <Text
        style={{
          color,
          textDecorationLine: 'underline',
          fontWeight: '500',
        }}
      >
        {children}
      </Text>
    </Pressable>
  )
}
