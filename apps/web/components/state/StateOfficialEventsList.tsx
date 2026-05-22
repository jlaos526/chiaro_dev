'use client'

import type { StateOfficialEventRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateOfficialEventRow[] }

const TYPE_LABEL: Record<string, string> = {
  recall_attempt:             'Recall attempt',
  recall_succeeded:           'Recall succeeded',
  recall_failed:              'Recall failed',
  resignation:                'Resignation',
  censure:                    'Censure',
  expulsion:                  'Expulsion',
  campaign_finance_violation: 'Finance violation',
}

function typeColor(type: string): string {
  if (type === 'expulsion' || type === 'recall_succeeded') return COLORS.signal.error
  if (type === 'censure' || type === 'campaign_finance_violation') return COLORS.signal.warning
  if (type === 'recall_failed') return COLORS.signal.success
  return COLORS.neutral.textMuted
}

export function StateOfficialEventsList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No sanctions or tenure events on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <a
          key={r.id}
          href={r.source_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
            borderRadius: 6, fontSize: 13, textDecoration: 'none',
            color: COLORS.brand.text, display: 'block',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>{r.event_date}</span>
            <span
              style={{
                fontSize: 11, fontWeight: 600,
                color: typeColor(r.event_type),
                padding: '2px 6px', borderRadius: 4,
                backgroundColor: `${typeColor(r.event_type)}22`,
              }}
            >
              {TYPE_LABEL[r.event_type] ?? r.event_type}
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.brand.text, whiteSpace: 'pre-wrap' }}>
            {r.summary}
          </div>
          {r.outcome && (
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 4, fontStyle: 'italic' }}>
              {r.outcome}
            </div>
          )}
        </a>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
