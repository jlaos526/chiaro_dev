import { createElement, type ReactNode } from 'react'
import { Linking, Platform, Pressable, Text, View } from 'react-native'
import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useBrandTokens,
  useCategoryAccent,
  useCategoryCardBgSolid,
  useCategoryCardGradient,
} from '../brand-hooks.ts'

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

export function MetricCardShell(props: MetricCardShellProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { value, label, caption, categoryId, placeholder = false, unavailable = false } = props
  const categoryAccent = useCategoryAccent(categoryId)
  const categoryBgSolid = useCategoryCardBgSolid(categoryId)
  const categoryGradient = useCategoryCardGradient(categoryId)
  const dotColor = unavailable ? semantic.text.muted : categoryAccent
  // Solid color used as the View's `backgroundColor` on native, AND as the
  // RNW-safe fallback before the web-only gradient overlay paints on top.
  const bgSolid = unavailable
    ? semantic.bg.subtle
    : placeholder
      ? semantic.bg.subtle
      : categoryBgSolid
  // On web, this gradient string is applied to a raw <div> wrapper via the
  // CSS `background` shorthand. Only the "live" variant uses the gradient;
  // placeholder / unavailable variants stay solid to read as "no data."
  const bgGradientWeb = !unavailable && !placeholder ? categoryGradient : null
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
              color: semantic.link.fg,
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
              color: semantic.link.fg,
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
