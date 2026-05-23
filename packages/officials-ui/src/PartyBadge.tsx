import { Text, View } from 'react-native'
import { PARTY_COLOR, PARTY_SHORT, PARTY_LABEL, type PartyCode } from '@chiaro/ui-tokens'

export interface PartyBadgeProps {
  party: PartyCode
}

export function PartyBadge({ party }: PartyBadgeProps): React.JSX.Element {
  return (
    <View
      accessibilityLabel={PARTY_LABEL[party]}
      style={{
        backgroundColor: PARTY_COLOR[party],
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, lineHeight: 17 }}>
        {PARTY_SHORT[party]}
      </Text>
    </View>
  )
}
