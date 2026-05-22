'use client'

import type { StateEthicsComplaintRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateEthicsComplaintRow[] }

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', dismissed: 'Dismissed', settled: 'Settled',
  sanctioned: 'Sanctioned', closed_no_action: 'Closed (no action)',
}

function statusColor(status: string): string {
  if (status === 'open')           return COLORS.signal.warning
  if (status === 'sanctioned')     return COLORS.signal.error
  if (status === 'dismissed' || status === 'closed_no_action') return COLORS.signal.success
  return COLORS.neutral.textMuted
}

export function StateEthicsComplaintsList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No ethics complaints on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => (
        <div
          key={r.id}
          style={{
            padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
            borderRadius: 6, fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 500, color: COLORS.brand.text }}>{r.complaint_date}</span>
            <span
              style={{
                fontSize: 11, fontWeight: 600,
                color: statusColor(r.status),
                padding: '2px 6px', borderRadius: 4,
                backgroundColor: `${statusColor(r.status)}22`,
              }}
            >
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.brand.text, whiteSpace: 'pre-wrap' }}>
            {r.summary}
          </div>
          {r.disposition && (
            <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 4, fontStyle: 'italic' }}>
              Disposition: {r.disposition}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
