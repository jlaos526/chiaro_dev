export interface DistrictBadgeProps {
  chamber: 'federal_house' | 'federal_senate'
  stateName: string
  districtNumber: number | null
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
  if (p.chamber === 'federal_senate') return p.stateName
  if (p.atLarge) return `${p.stateName}'s At-Large District`
  if (p.districtNumber == null) return p.stateName
  return `${p.stateName}'s ${ordinal(p.districtNumber)} District`
}

export function DistrictBadge(props: DistrictBadgeProps): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#3a352b', fontSize: '0.78rem' }}>
      <svg width="12" height="14" viewBox="0 0 12 14" fill="#d13b3b" aria-hidden="true">
        <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 8 6 8s6-3.5 6-8c0-3.3-2.7-6-6-6zm0 8.2C4.8 8.2 3.8 7.2 3.8 6S4.8 3.8 6 3.8 8.2 4.8 8.2 6 7.2 8.2 6 8.2z"/>
      </svg>
      {districtLabel(props)}
    </span>
  )
}
