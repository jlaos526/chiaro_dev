'use client'

import type { StateTownHallRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateTownHallRow[] }

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person',
  virtual:   'Virtual',
  phone:     'Phone',
  hybrid:    'Hybrid',
}

export function StateTownHallsList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No town halls in the past 12 months.</div>
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
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 10px',
            backgroundColor: COLORS.neutral.surface,
            borderRadius: 6,
            fontSize: 13,
            textDecoration: 'none',
            color: COLORS.brand.text,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>
              {r.event_date}
              {r.city ? ` · ${r.city}, ${r.state}` : ` · ${r.state}`}
            </div>
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
              {r.format ? FORMAT_LABEL[r.format] ?? r.format : 'Format n/a'}
              {r.attendance_estimate != null && ` · ~${r.attendance_estimate} attendees`}
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted,
  fontSize: 13,
  padding: '8px 12px',
  fontStyle: 'italic',
}
