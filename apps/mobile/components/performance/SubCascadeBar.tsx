import { View, Text, Pressable } from 'react-native'
import { type CategoryId, SUB_CASCADE_ACCENT } from '@chiaro/ui-tokens'

export interface SubCascadeBarProps {
  categoryId: CategoryId
  subId: string
  name: string
  teaser: string | null
  open: boolean
  onToggle: () => void
  accentOverride?: string
  placeholder?: boolean
}

export function SubCascadeBar(props: SubCascadeBarProps) {
  const { categoryId, name, teaser, open, onToggle, accentOverride, placeholder = false } = props
  const accent = accentOverride ?? SUB_CASCADE_ACCENT[categoryId]

  const content = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: '#e5e1d4',
        borderLeftWidth: 1, borderLeftColor: accent,
        borderRadius: 5,
        backgroundColor: placeholder ? '#f6f4ed' : '#fff',
        marginBottom: 4,
      }}
    >
      <Text style={{ fontSize: 12, color: placeholder ? '#807a72' : '#1a1714' }}>{open ? '▾' : '▸'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', fontSize: 13, color: placeholder ? '#5a5751' : '#1a1714' }}>{name}</Text>
        <Text
          style={{
            fontSize: 11, marginTop: 1, lineHeight: 16,
            color: placeholder ? '#807a72' : '#5a5751',
            fontStyle: placeholder ? 'italic' : 'normal',
          }}
        >
          {teaser ?? ''}
        </Text>
      </View>
    </View>
  )

  if (placeholder) return <View>{content}</View>
  return <Pressable onPress={onToggle} accessibilityState={{ expanded: open }}>{content}</Pressable>
}
