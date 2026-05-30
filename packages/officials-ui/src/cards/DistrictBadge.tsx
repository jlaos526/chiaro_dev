'use client'

import { Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { type OfficialChamber } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

export interface DistrictBadgeProps {
  chamber: OfficialChamber
  stateName: string
  stateAbbrev: string
  districtNumber: number | null
  /** Raw district code for state chambers (e.g. "15", "1A", "At-Large"). */
  districtCode?: string
  atLarge?: boolean
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const mod10 = n % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}

function districtLabel(p: DistrictBadgeProps): string {
  const { chamber, stateName, stateAbbrev, districtCode, districtNumber, atLarge } = p

  if (chamber === 'federal_senate') return stateName
  if (chamber === 'federal_house') {
    if (atLarge) return `${stateName}'s At-Large District`
    if (districtNumber == null) return stateName
    return `${stateName}'s ${ordinal(districtNumber)} District`
  }

  // State chambers — compact label for list density
  const codeForState = districtCode ?? (districtNumber != null ? String(districtNumber) : '')
  if (chamber === 'state_house')       return `${stateAbbrev}-${codeForState}`
  if (chamber === 'state_senate')      return `${stateAbbrev}-SD ${codeForState}`
  if (chamber === 'state_legislature') return `${stateAbbrev}-LD ${codeForState}`
  return `${stateAbbrev}-${codeForState}`
}

export function DistrictBadge(props: DistrictBadgeProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Svg width={12} height={14} viewBox="0 0 12 14">
        <Path
          d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 8 6 8s6-3.5 6-8c0-3.3-2.7-6-6-6zm0 8.2C4.8 8.2 3.8 7.2 3.8 6S4.8 3.8 6 3.8 8.2 4.8 8.2 6 7.2 8.2 6 8.2z"
          fill={semantic.icon.location}
        />
      </Svg>
      <Text style={{ color: semantic.text.body, fontSize: 12.5 }}>{districtLabel(props)}</Text>
    </View>
  )
}
