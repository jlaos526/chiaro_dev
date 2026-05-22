'use client'

import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type OfficeRow = Database['public']['Tables']['district_offices']['Row']

interface Props { rows: OfficeRow[] }

/**
 * Federal `district_offices` schema (migration 0011) holds only address /
 * city / state / zip / phone / source_url — NO `kind` column and NO
 * `hours_text` (those are state-only on `state_district_offices`). All rows
 * render uniformly; the capitol office is handled in the bio header
 * separately and is not represented in this table.
 */
export function FederalDistrictOfficesList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No district offices on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 12px' }}>
      {rows.map(r => (
        <div key={r.id} style={{ fontSize: 13, color: COLORS.brand.text }}>
          <div style={{ fontWeight: 600 }}>
            District Office · {r.city}, {r.state}
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {r.address}
            {r.zip && ` ${r.zip}`}
            {r.phone && (
              <>
                <br />
                {r.phone}
              </>
            )}
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
