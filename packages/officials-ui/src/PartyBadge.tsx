import { Text, View } from 'react-native'
import { PARTY_SHORT, PARTY_LABEL, type PartyCode } from '@chiaro/ui-tokens'
import { usePartyColor, useBrandTokens } from './brand-hooks.ts'

export interface PartyBadgeProps {
  party: PartyCode
}

export function PartyBadge({ party }: PartyBadgeProps): React.JSX.Element {
  const partyColor = usePartyColor(party)
  const { semantic } = useBrandTokens()
  return (
    <View
      accessibilityLabel={PARTY_LABEL[party]}
      style={{
        backgroundColor: partyColor,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{ color: semantic.text.onAccent, fontWeight: '700', fontSize: 12, lineHeight: 17 }}
      >
        {PARTY_SHORT[party]}
      </Text>
    </View>
  )
}
