import { View, Text } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'

export type ComingSoonCategory =
  | 'Service Record'
  | 'Issue Positions'
  | 'Community Presence'
  | 'Finance'
  | 'Ethics & Accountability'

const CATEGORY_COPY: Record<ComingSoonCategory, string> = {
  'Service Record':         'Bills + votes — coming soon',
  'Issue Positions':        'Scorecards — coming soon',
  'Community Presence':     'Town halls — coming soon',
  'Finance':                'Campaign finance — coming soon',
  'Ethics & Accountability':'STOCK Act compliance — coming soon',
}

export function ComingSoonCard({ category }: { category: ComingSoonCategory }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.neutral.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.neutral.border,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.brand.text }}>
        {category}
      </Text>
      <Text style={{ marginTop: 8, fontSize: 13, color: COLORS.neutral.textMuted }}>
        {CATEGORY_COPY[category]}
      </Text>
    </View>
  )
}
