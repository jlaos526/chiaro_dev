import { View, Text, Pressable } from 'react-native'
import { type CategoryId, CATEGORY_ACCENT, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import { PillChevron } from '@/components/cards/PillChevron'

export interface CategoryBarProps {
  categoryId: CategoryId
  teaser: string | null
  open: boolean
  onToggle: () => void
}

export function CategoryBar({ categoryId, teaser, open, onToggle }: CategoryBarProps) {
  const accent = CATEGORY_ACCENT[categoryId]
  const label = CATEGORY_LABEL[categoryId]
  return (
    <Pressable
      onPress={onToggle}
      accessibilityState={{ expanded: open }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 11,
        borderWidth: 1, borderColor: '#d8d4c9',
        borderLeftWidth: 2, borderLeftColor: accent,
        borderRadius: 6,
        borderBottomLeftRadius: open ? 0 : 6,
        borderBottomRightRadius: open ? 0 : 6,
        borderBottomWidth: open ? 0 : 1,
        backgroundColor: '#fff',
        marginBottom: open ? 0 : 6,
      }}
    >
      <PillChevron open={open} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: '#1a1714' }}>{label}</Text>
        {teaser ? (
          <Text style={{ fontSize: 12, color: '#5a5751', marginTop: 2 }}>{teaser}</Text>
        ) : (
          <Text style={{ fontSize: 12, color: '#807a72', fontStyle: 'italic', marginTop: 2 }}>no data yet</Text>
        )}
      </View>
    </Pressable>
  )
}
