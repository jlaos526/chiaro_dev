'use client'

import type { VoteRow, VotePositionEnum } from '@chiaro/bills'
import { COLORS } from '@chiaro/ui-tokens'

/**
 * Matches the return shape of `fetchOfficialMissedVotes` in @chiaro/bills:
 * `Array<{ vote_id; position; vote: VoteRow }>`. There is no named
 * `MissedVoteRow` export — declared inline here as a structural type.
 */
export interface MissedVoteEntry {
  vote_id: string
  position: VotePositionEnum
  vote: VoteRow
}

interface Props { rows: MissedVoteEntry[] }

export function FederalMissedVotesList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No missed votes in current Congress.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.slice(0, 25).map(r => (
        <div
          key={r.vote_id}
          style={{
            padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
            borderRadius: 6, fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
            <span style={{ fontWeight: 500, color: COLORS.brand.text }}>
              {r.vote.vote_date} · Roll Call #{r.vote.roll_call}
            </span>
            <span
              style={{
                fontSize: 11, fontWeight: 600,
                color: COLORS.signal.warning,
                padding: '2px 6px', borderRadius: 4,
                backgroundColor: `${COLORS.signal.warning}22`,
                whiteSpace: 'nowrap',
              }}
            >
              MISSED
            </span>
          </div>
          {r.vote.question && (
            <div style={{ fontSize: 12, color: COLORS.brand.text }}>{r.vote.question}</div>
          )}
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
