import { Text } from 'react-native'
import type { OfficialWithDistrict } from '@chiaro/officials'
import { useBrandTokens } from './brand-hooks.ts'

export interface OfficialMetaProps {
  official: OfficialWithDistrict
}

// Slice 79.5 (audit U4): state chambers used to fall through to 'Senate'.
const CHAMBER_LABEL: Record<OfficialWithDistrict['chamber'], string> = {
  federal_house: 'House',
  federal_senate: 'Senate',
  state_house: 'State House',
  state_senate: 'State Senate',
  state_legislature: 'Legislature',
}

export function OfficialMeta({ official }: OfficialMetaProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const chamberLabel = CHAMBER_LABEL[official.chamber] ?? 'Senate'
  // Federal senators represent the whole state; everyone else has a numbered
  // district worth showing (state senate districts are numbered, unlike
  // federal senate seats).
  const districtSuffix =
    official.chamber === 'federal_senate' ? ` · ${official.state}` : ` · ${official.district.code}`
  const term = official.next_election
    ? ` · Next election ${new Date(official.next_election).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })}`
    : ''
  return (
    <Text style={{ color: semantic.text.muted }}>
      {chamberLabel}
      {districtSuffix}
      {term}
    </Text>
  )
}
