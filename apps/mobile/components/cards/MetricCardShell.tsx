import type { ReactNode } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { type CategoryId, CATEGORY_ACCENT } from '@chiaro/ui-tokens'

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

const UNAVAILABLE_GREY = '#807a72'
const UNAVAILABLE_BG = '#fafaf6'

export function MetricCardShell(props: MetricCardShellProps) {
  const { value, label, caption, categoryId, placeholder = false, unavailable = false } = props
  const dotColor = unavailable ? UNAVAILABLE_GREY : CATEGORY_ACCENT[categoryId]
  const bg = unavailable ? UNAVAILABLE_BG : placeholder ? '#f6f4ed' : '#fcfaf2'

  const renderedLabel = unavailable ? 'Unavailable' : label

  const valueStyle = {
    fontSize: 22,
    fontWeight: '700' as const,
    color: unavailable || placeholder ? UNAVAILABLE_GREY : '#1a1714',
    fontStyle: unavailable || placeholder ? ('italic' as const) : ('normal' as const),
  }
  const labelStyle = {
    fontSize: 13,
    marginTop: 8,
    color: unavailable || placeholder ? '#5a5751' : '#1a1714',
  }
  const captionStyle = {
    fontSize: 11,
    marginTop: 2,
    color: unavailable ? UNAVAILABLE_GREY : '#807a72',
    fontStyle: unavailable || placeholder ? ('italic' as const) : ('normal' as const),
  }

  let cta: ReactNode = null
  if (!placeholder && !unavailable) {
    if ('onExpand' in props && typeof props.onExpand === 'function') {
      const onExpand = props.onExpand
      cta = (
        <Pressable onPress={onExpand} accessibilityLabel={`Expand evidence for ${label}`}>
          <Text style={{ marginTop: 10, fontSize: 12, color: '#3b6ed1', textDecorationLine: 'underline' }}>
            view evidence →
          </Text>
        </Pressable>
      )
    } else if ('externalSourceUrl' in props && typeof props.externalSourceUrl === 'string') {
      const url = props.externalSourceUrl
      cta = (
        <Pressable onPress={() => Linking.openURL(url).catch(() => {})}>
          <Text style={{ marginTop: 10, fontSize: 12, color: '#3b6ed1', textDecorationLine: 'underline' }}>
            view source →
          </Text>
        </Pressable>
      )
    }
  }

  return (
    <View
      accessibilityLabel={`${renderedLabel}: ${typeof value === 'string' ? value : ''}`}
      style={{ borderWidth: 1, borderColor: '#d8d4c9', borderRadius: 6, padding: 12, backgroundColor: bg }}
    >
      <Text style={valueStyle}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginRight: 6 }}
          testID="category-dot"
        />
        <Text style={labelStyle}>{renderedLabel}</Text>
      </View>
      {caption ? <Text style={captionStyle}>{caption}</Text> : null}
      {cta}
    </View>
  )
}
