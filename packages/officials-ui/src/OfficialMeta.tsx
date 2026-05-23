import { Text } from 'react-native'
import type { OfficialWithDistrict } from '@chiaro/officials'

export interface OfficialMetaProps {
  official: OfficialWithDistrict
}

export function OfficialMeta({ official }: OfficialMetaProps): React.JSX.Element {
  const chamberLabel = official.chamber === 'federal_house' ? 'House' : 'Senate'
  const districtSuffix =
    official.chamber === 'federal_house'
      ? ` · ${official.district.code}`
      : ` · ${official.state}`
  const term = official.next_election
    ? ` · Next election ${new Date(official.next_election).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })}`
    : ''
  return (
    <Text>
      {chamberLabel}
      {districtSuffix}
      {term}
    </Text>
  )
}
