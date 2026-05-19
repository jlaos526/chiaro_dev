import { PARTY_COLOR, PARTY_SHORT } from '@chiaro/ui-tokens'
import { DistrictBadge } from '@/components/cards/DistrictBadge'

export interface BioIdentityRowProps {
  party: string
  chamber: 'federal_house' | 'federal_senate'
  stateName: string
  districtNumber: number | null
  atLarge: boolean
}

const chipBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: '0.72rem',
  fontWeight: 500,
  lineHeight: 1.4,
}

export function BioIdentityRow({ party, chamber, stateName, districtNumber, atLarge }: BioIdentityRowProps): React.JSX.Element {
  const partyColor = PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? '#807a72'
  const partyLabel = PARTY_SHORT[party as keyof typeof PARTY_SHORT] ?? party
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
      <span style={{ ...chipBase, background: partyColor, color: '#fff', fontWeight: 600 }}>{partyLabel}</span>
      <span style={{ ...chipBase, background: '#f0eee5', color: '#3a352b' }}>{chamber === 'federal_house' ? 'House' : 'Senate'}</span>
      <span style={{ ...chipBase, background: '#f0eee5' }}>
        <DistrictBadge chamber={chamber} stateName={stateName} districtNumber={districtNumber} atLarge={atLarge} />
      </span>
    </div>
  )
}
