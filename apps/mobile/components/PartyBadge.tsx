import { Text, View } from 'react-native'
import { PARTY_COLOR, PARTY_SHORT, PARTY_LABEL, type PartyCode } from '@chiaro/ui-tokens'

export function PartyBadge({ party }: { party: PartyCode }) {
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
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
        {PARTY_SHORT[party]}
      </Text>
    </View>
  )
}
