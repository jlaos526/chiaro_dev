'use client'
import { useState } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateBillWithSponsors } from '@chiaro/state-bills'

const INITIAL_ROW_COUNT = 5

export function StateBillsEvidence({ bills }: { bills: StateBillWithSponsors[] }) {
  const [expanded, setExpanded] = useState(false)
  if (bills.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
        No bills this session.
      </div>
    )
  }
  const visible = expanded ? bills : bills.slice(0, INITIAL_ROW_COUNT)
  const hasMore = bills.length > INITIAL_ROW_COUNT
  return (
    <div data-testid="state-bills-evidence">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map(b => (
          <li key={b.id} style={{
            padding: 8,
            borderTop: `1px solid ${COLORS.neutral.border}`,
            display: 'flex', flexDirection: 'column',
          }}>
            <a
              href={b.source_url}
              target="_blank" rel="noreferrer"
              style={{ color: COLORS.brand.text, textDecoration: 'none', fontWeight: 600 }}
            >
              {b.bill_type} {b.number}: {b.title}
            </a>
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
              {b.status_substage ?? b.status ?? '—'} · {b.latest_action_date}
            </div>
          </li>
        ))}
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
          {expanded ? 'show less' : `show more (${bills.length - INITIAL_ROW_COUNT} more)`}
        </button>
      )}
    </div>
  )
}
