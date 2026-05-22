'use client'

import type { BillRow } from '@chiaro/bills'
import { COLORS } from '@chiaro/ui-tokens'

function statusColor(status: string | null | undefined): string {
  if (!status) return COLORS.neutral.textMuted
  const s = status.toLowerCase()
  if (s.includes('passed') || s.includes('signed') || s.includes('became law') || s.includes('enacted')) return COLORS.signal.success
  if (s.includes('failed') || s.includes('vetoed')) return COLORS.signal.error
  if (s.includes('committee') || s.includes('introduced')) return COLORS.neutral.textMuted
  return COLORS.neutral.textMuted
}

interface Props { rows: BillRow[] }

export function FederalSponsoredBillsList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No sponsored bills.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.slice(0, 25).map(r => {
        const color = statusColor(r.status)
        return (
          <div
            key={r.id}
            style={{
              padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
              borderRadius: 6, fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
              <span style={{ fontWeight: 500, color: COLORS.brand.text }}>
                {r.bill_type} {r.number}
              </span>
              {r.status && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 600,
                    color, padding: '2px 6px', borderRadius: 4,
                    backgroundColor: `${color}22`, whiteSpace: 'nowrap',
                  }}
                >
                  {r.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: COLORS.brand.text }}>{r.short_title ?? r.title}</div>
          </div>
        )
      })}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
