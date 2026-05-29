import { type ReactNode } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { type CategoryId } from '@chiaro/ui-tokens'
import {
  useBrandTokens,
  useCategoryAccent,
  useCategoryCardBg,
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
  const cardBg = useCategoryCardBg()
  const isLive = !placeholder && !unavailable
  // Live variant: full 3px top stripe in category accent.
  // Placeholder/unavailable: no stripe (1px top border matches the other borders)
  // so the card reads as "no data" rather than "active category card."
  const dotColor = unavailable ? semantic.text.muted : categoryAccent
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
  if (isLive) {
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

  // Live variant: 3px top stripe in category accent + universal card bg.
  // Placeholder/unavailable: 1px top border + subtle bg.
  const cardStyle = isLive
    ? {
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderTopWidth: 3,
        borderTopColor: categoryAccent,
        borderRadius: 6,
        padding: 12,
      }
    : {
        backgroundColor: semantic.bg.subtle,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderRadius: 6,
        padding: 12,
      }

  return (
    <View
      accessibilityLabel={`${renderedLabel}: ${typeof value === 'string' ? value : ''}`}
      style={cardStyle}
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
}
