'use client'
import { useState } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateVoteWithPosition } from '@chiaro/state-bills'

const INITIAL_ROW_COUNT = 5

function positionLabel(p: StateVoteWithPosition['position']): string {
  if (p === 'yes')        return 'yes'
  if (p === 'no')         return 'no'
  if (p === 'abstain')    return 'abstain'
  if (p === 'not_voting') return 'missed'
  if (p === 'present')    return 'present'
  return p
}

export function StateVotesEvidence({ votes }: { votes: StateVoteWithPosition[] }) {
  const [expanded, setExpanded] = useState(false)
  if (votes.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
        No votes this session.
      </div>
    )
  }
  const visible = expanded ? votes : votes.slice(0, INITIAL_ROW_COUNT)
  const hasMore = votes.length > INITIAL_ROW_COUNT
  return (
    <div data-testid="state-votes-evidence">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map(v => {
          const split = v.vote.party_vote_split as Record<string, number> | null
          return (
            <li key={v.vote.id} style={{
              padding: 8,
              borderTop: `1px solid ${COLORS.neutral.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <a
                  href={v.vote.source_url}
                  target="_blank" rel="noreferrer"
                  style={{ color: COLORS.brand.text, fontWeight: 600, textDecoration: 'none' }}
                >
                  {v.vote.question}
                </a>
                <span style={{
                  fontSize: 12, padding: '2px 6px', borderRadius: 4,
                  background: COLORS.neutral.surface,
                  color: COLORS.brand.text,
                  border: `1px solid ${COLORS.neutral.border}`,
                }}>
                  {positionLabel(v.position)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
                {v.vote.vote_date} · {v.vote.result}
                {split && (
                  <span style={{ marginLeft: 8 }}>
                    {Object.entries(split).map(([k, n]) => `${k}: ${n}`).join(' · ')}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 8, padding: '4px 10px', fontSize: 12,
            color: COLORS.brand.text, background: 'transparent',
            border: `1px solid ${COLORS.neutral.border}`, borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'show less' : `show more (${votes.length - INITIAL_ROW_COUNT} more)`}
        </button>
      )}
    </div>
  )
}
