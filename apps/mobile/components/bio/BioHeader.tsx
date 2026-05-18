import { View, Text } from 'react-native'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'
import { BioPortrait } from './BioPortrait'
import { BioIdentityRow } from './BioIdentityRow'
import { BioServiceCard } from './BioServiceCard'
import { BioContactLinks } from './BioContactLinks'
import { BioAlignmentChipRow } from './BioAlignmentChipRow'

export interface BioHeaderProps {
  officialId: string
  fullName: string
  portraitUrl: string | null
  party: string
  chamber: 'house' | 'senate'
  state: string
  stateName: string
  districtNumber: number | null
  senateClass: 1 | 2 | 3 | null
  atLarge: boolean
  role: string
  firstElectedYear: number | null
  officialUrl: string | null
  twitterHandle: string | null
  chips: AlignmentChipRow[]
}

export function BioHeader(p: BioHeaderProps) {
  return (
    <View style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 12 }}>
      <BioPortrait fullName={p.fullName} portraitUrl={p.portraitUrl} size={72} />
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#1a1714' }}>{p.fullName}</Text>
      <BioIdentityRow
        party={p.party}
        chamber={p.chamber}
        stateName={p.stateName}
        districtNumber={p.districtNumber}
        atLarge={p.atLarge}
      />
      <BioAlignmentChipRow chips={p.chips} officialId={p.officialId} />
      <BioServiceCard role={p.role} firstElectedYear={p.firstElectedYear} />
      <BioContactLinks officialUrl={p.officialUrl} twitterHandle={p.twitterHandle} />
    </View>
  )
}
