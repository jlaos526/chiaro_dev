'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

interface Props { rows: LeadershipRow[] }

export function FederalLeadershipList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No leadership positions on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <div key={r.id} style={{
          padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, fontSize: 13,
        }}>
          <div style={{ fontWeight: 500, color: COLORS.brand.text }}>
            {r.role}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.start_date}{r.end_date ? ` – ${r.end_date}` : ' – present'}
          </div>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
