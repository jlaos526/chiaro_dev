'use client'

import { useState } from 'react'
import type { StateCommitteeHearingRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateCommitteeHearingRow[] }

export function StateCommitteeHearingsList({ rows }: Props): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) {
    return <div style={mutedStyle}>No committee hearings attended in current session.</div>
  }
  const visible = showAll ? rows : rows.slice(0, 3)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {visible.map(r => (
        <div
          key={r.id}
          style={{
            padding: '8px 10px',
            backgroundColor: COLORS.neutral.surface,
            borderRadius: 6,
            fontSize: 13,
            color: COLORS.brand.text,
          }}
        >
          <div style={{ fontWeight: 500 }}>
            {r.hearing_date}
            {r.location ? ` · ${r.location}` : ''}
          </div>
          {r.agenda_topic && (
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              Agenda: {r.agenda_topic}
            </div>
          )}
        </div>
      ))}
      {!showAll && rows.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          style={{
            border: 'none',
            background: 'transparent',
            color: COLORS.neutral.textMuted,
            fontSize: 12,
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
          }}
        >
          and {rows.length - 3} more
        </button>
      )}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted,
  fontSize: 13,
  padding: '8px 12px',
  fontStyle: 'italic',
}
