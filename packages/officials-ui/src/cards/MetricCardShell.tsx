import { createElement, type ReactNode } from 'react'
import { Linking, Platform, Pressable, Text, View } from 'react-native'
import {
  type CategoryId,
  CATEGORY_ACCENT,
  CATEGORY_CARD_GRADIENT,
} from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

/**
 * NOTE (slice 34): This file has 13 inline hex values intentionally retained
 * as `// TODO slice 37` deferrals — they belong to the domain category palette
 * (`CATEGORY_CARD_BG_SOLID`), placeholder-bg literals, and link-blue color
 * which all await slice 37's domain palette work. See:
 * `docs/superpowers/audits/2026-05-27-inline-hex-sweep.md`.
 */

// Per-category card backgrounds. Web uses a `linear-gradient(...)` string
// applied through the CSS `background` shorthand (RNW's StyleSheet
// normalizer strips `linear-gradient(...)` from `backgroundColor`, so we
// only set it on a web-only outer DOM node). Native gets a near-equivalent
// solid color (the gradient's top stop) since RN has no built-in
// linear-gradient primitive.
// TODO slice 37: migrate CATEGORY_CARD_BG_SOLID to @chiaro/ui-tokens
// alongside CATEGORY_CARD_GRADIENT. Light + dark variants. See audit doc.
const CATEGORY_CARD_BG_SOLID: Record<CategoryId, string> = {
  'service-record': '#fcfaf2',
  'issue-positions': '#f6f8fc',
  'community-presence': '#f3faf8',
  finance: '#f4faf6',
  'ethics-accountability': '#fcf7f0',
  'voting-bills': '#f7f4fc',
}

interface BaseProps {
  value: ReactNode
  label: string
  caption?: ReactNode
  categoryId: CategoryId
  placeholder?: boolean
  unavailable?: boolean
}

type DrillDown =
  | { onExpand: () => void; externalSourceUrl?: never }
  | { externalSourceUrl: string; onExpand?: never }
  | { onExpand?: never; externalSourceUrl?: never }

export type MetricCardShellProps = BaseProps & DrillDown

// TODO slice 37: domain placeholder bg — move to ui-tokens or fold into bg.subtle
const UNAVAILABLE_BG = '#fafaf6'

export function MetricCardShell(props: MetricCardShellProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { value, label, caption, categoryId, placeholder = false, unavailable = false } = props
  const dotColor = unavailable ? semantic.text.muted : CATEGORY_ACCENT[categoryId]
  // Solid color used as the View's `backgroundColor` on native, AND as the
  // RNW-safe fallback before the web-only gradient overlay paints on top.
  const bgSolid = unavailable
    ? UNAVAILABLE_BG
    : placeholder
      ? // TODO slice 37: domain placeholder bg
        '#f6f4ed'
      : // TODO slice 37: category palette fallback (CATEGORY_CARD_BG_SOLID covers above)
        (CATEGORY_CARD_BG_SOLID[categoryId] ?? '#fcfaf2')
  // On web, this gradient string is applied to a raw <div> wrapper via the
  // CSS `background` shorthand. Only the "live" variant uses the gradient;
  // placeholder / unavailable variants stay solid to read as "no data."
  const bgGradientWeb =
    !unavailable && !placeholder ? (CATEGORY_CARD_GRADIENT[categoryId] ?? null) : null
  const renderedLabel = unavailable ? 'Unavailable' : label

  const valueStyle = {
    fontSize: 22,
    fontWeight: '700' as const,
    color: unavailable || placeholder ? semantic.text.muted : semantic.text.primary,
    fontStyle: unavailable || placeholder ? ('italic' as const) : ('normal' as const),
  }
  const labelStyle = {
    fontSize: 13,
    marginTop: 8,
    color: unavailable || placeholder ? semantic.text.muted : semantic.text.primary,
  }
  const captionStyle = {
    fontSize: 11,
    marginTop: 2,
    color: semantic.text.muted,
    fontStyle: unavailable || placeholder ? ('italic' as const) : ('normal' as const),
  }

  let cta: ReactNode = null
  if (!placeholder && !unavailable) {
    if ('onExpand' in props && typeof props.onExpand === 'function') {
      const onExpand = props.onExpand
      cta = (
        <Pressable onPress={onExpand} accessibilityLabel={`Expand evidence for ${label}`}>
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              // TODO slice 37: link blue brand-decision
              color: '#3b6ed1',
              textDecorationLine: 'underline',
            }}
          >
            view evidence →
          </Text>
        </Pressable>
      )
    } else if ('externalSourceUrl' in props && typeof props.externalSourceUrl === 'string') {
      const url = props.externalSourceUrl
      cta = (
        <Pressable onPress={() => Linking.openURL(url).catch(() => {})}>
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              // TODO slice 37: link blue brand-decision
              color: '#3b6ed1',
              textDecorationLine: 'underline',
            }}
          >
            view source →
          </Text>
        </Pressable>
      )
    }
  }

  // On web, the gradient is painted by an outer DOM <div> via the CSS
  // `background` shorthand (RNW's StyleSheet normalizer strips
  // `linear-gradient(...)` from `backgroundColor`). The inner View MUST
  // then be transparent for the gradient to show through. On native, the
  // View paints the (solid) backgroundColor itself.
  const useWebGradient = Platform.OS === 'web' && bgGradientWeb !== null
  const innerBg = useWebGradient ? 'transparent' : bgSolid

  const card = (
    <View
      accessibilityLabel={`${renderedLabel}: ${typeof value === 'string' ? value : ''}`}
      style={{
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderRadius: 6,
        padding: 12,
        backgroundColor: innerBg,
      }}
    >
      <Text style={valueStyle}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: dotColor,
            marginRight: 6,
          }}
          testID="category-dot"
        />
        <Text style={labelStyle}>{renderedLabel}</Text>
      </View>
      {caption ? <Text style={captionStyle}>{caption}</Text> : null}
      {cta}
    </View>
  )

  if (useWebGradient) {
    return createElement(
      'div',
      {
        style: {
          background: bgGradientWeb ?? undefined,
          borderRadius: 6,
        },
      },
      card,
    )
  }

  return card
}
