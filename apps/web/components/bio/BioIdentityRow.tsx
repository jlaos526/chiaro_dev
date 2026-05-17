import { PARTY_COLOR, PARTY_SHORT } from '@chiaro/ui-tokens'

export interface BioIdentityRowProps {
  party: string
  chamber: 'house' | 'senate'
  districtChipLabel: string
}

const chipBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: '0.72rem',
  fontWeight: 500,
  lineHeight: 1.4,
}

export function BioIdentityRow({ party, chamber, districtChipLabel }: BioIdentityRowProps): React.JSX.Element {
  const partyColor = PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? '#807a72'
  const partyLabel = PARTY_SHORT[party as keyof typeof PARTY_SHORT] ?? party
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      <span style={{ ...chipBase, background: partyColor, color: '#fff', fontWeight: 600 }}>{partyLabel}</span>
      <span style={{ ...chipBase, background: '#f0eee5', color: '#3a352b' }}>{chamber === 'house' ? 'House' : 'Senate'}</span>
      <span style={{ ...chipBase, background: '#f0eee5', color: '#3a352b' }}>{districtChipLabel}</span>
    </div>
  )
}
