import { Text, View } from 'react-native'
import { useBrandTokens } from '../brand-hooks.ts'

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

export interface ComingSoonCardProps {
  category: ComingSoonCategory
}

export function ComingSoonCard({ category }: ComingSoonCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View
      style={{
        backgroundColor: semantic.bg.app,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: semantic.border.default,
      }}
    >
      <Text
        accessibilityRole="header"
        accessibilityLevel={3}
        style={{ fontSize: 14, fontWeight: '600', color: semantic.text.primary }}
      >
        {category}
      </Text>
      <Text style={{ marginTop: 8, fontSize: 13, color: semantic.text.muted }}>
        {CATEGORY_COPY[category]}
      </Text>
    </View>
  )
}
