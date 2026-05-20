import type { OfficialWithDistrict } from '@chiaro/officials'

interface Props {
  official: OfficialWithDistrict
}

export function OfficialMeta({ official }: Props) {
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
    <span>
      {chamberLabel}
      {districtSuffix}
      {term}
    </span>
  )
}
