import { PARTY_COLOR, PARTY_SHORT, PARTY_LABEL, type PartyCode } from '@chiaro/ui-tokens'

interface Props {
  party: PartyCode
}

export function PartyBadge({ party }: Props) {
  return (
    <span
      aria-label={PARTY_LABEL[party]}
      title={PARTY_LABEL[party]}
      style={{
        display: 'inline-block',
        background: PARTY_COLOR[party],
        color: '#fff',
        borderRadius: 12,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.4,
      }}
    >
      {PARTY_SHORT[party]}
    </span>
  )
}
