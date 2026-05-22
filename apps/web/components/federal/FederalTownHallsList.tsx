'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type TownHallRow = Database['public']['Tables']['town_halls']['Row']

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person', virtual: 'Virtual', phone: 'Phone', hybrid: 'Hybrid',
}

interface Props { rows: TownHallRow[] }

export function FederalTownHallsList({ rows }: Props): React.JSX.Element {
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
            padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
            borderRadius: 6, fontSize: 13, textDecoration: 'none', color: COLORS.brand.text,
            display: 'block',
          }}
        >
          <div style={{ fontWeight: 500 }}>
            {r.event_date}{r.city ? ` · ${r.city}, ${r.state ?? ''}` : r.state ? ` · ${r.state}` : ''}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.format ? FORMAT_LABEL[r.format] ?? r.format : 'Format n/a'}
            {r.attendance_estimate != null && ` · ~${r.attendance_estimate} attendees`}
          </div>
        </a>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
