import { Text, View } from 'react-native'
import { PARTY_COLOR, PARTY_SHORT } from '@chiaro/ui-tokens'
import { DistrictBadge } from '../cards/DistrictBadge.tsx'
import { useBrandTokens } from '../brand-hooks.ts'

export interface BioIdentityRowProps {
  party: string
  chamber: 'federal_house' | 'federal_senate'
  stateName: string
  stateAbbrev: string
  districtNumber: number | null
  atLarge: boolean
}

const chipBase = {
  paddingHorizontal: 10,
  paddingVertical: 3,
  borderRadius: 12,
}

export function BioIdentityRow({
  party, chamber, stateName, stateAbbrev, districtNumber, atLarge,
}: BioIdentityRowProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  // TODO slice 37: replace with PARTY_COLOR.unknown when palette gets dark variants
  const partyColor = PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? '#807a72'
  const partyLabel = PARTY_SHORT[party as keyof typeof PARTY_SHORT] ?? party
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
      <View style={[chipBase, { backgroundColor: partyColor }]}>
        <Text style={{ color: semantic.bg.elevated, fontWeight: '600', fontSize: 12 }}>{partyLabel}</Text>
      </View>
      <View style={[chipBase, { backgroundColor: semantic.bg.subtle }]}>
        <Text style={{ color: semantic.text.body, fontSize: 12 }}>
          {chamber === 'federal_house' ? 'House' : 'Senate'}
        </Text>
      </View>
      <View style={[chipBase, { backgroundColor: semantic.bg.subtle }]}>
        <DistrictBadge
          chamber={chamber}
          stateName={stateName}
          stateAbbrev={stateAbbrev}
          districtNumber={districtNumber}
          atLarge={atLarge}
        />
      </View>
    </View>
  )
}
