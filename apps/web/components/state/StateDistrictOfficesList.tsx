'use client'

import type { StateDistrictOfficeRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateDistrictOfficeRow[] }

const KIND_LABEL: Record<string, string> = {
  district:  'District Office',
  satellite: 'Satellite Office',
  capitol:   'Capitol Office',
}

export function StateDistrictOfficesList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No district offices on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 12px' }}>
      {rows.map(r => (
        <div key={r.id} style={{ fontSize: 13, color: COLORS.brand.text }}>
          <div style={{ fontWeight: 600 }}>
            {KIND_LABEL[r.kind] ?? r.kind} · {r.city}, {r.state}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.street_1}
            {r.street_2 ? `, ${r.street_2}` : ''}
            {r.postal_code ? `, ${r.postal_code}` : ''}
            {r.phone && (
              <>
                <br />
                {r.phone}
              </>
            )}
            {r.hours_text && (
              <>
                <br />
                Hours: {r.hours_text}
              </>
            )}
          </div>
        </div>
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
