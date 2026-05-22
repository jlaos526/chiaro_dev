'use client'

import type { OfficialFinance } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { finance: OfficialFinance | null | undefined }

function fmtAmount(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalPACsList({ finance }: Props): React.JSX.Element {
  const pacs = finance?.pacs ?? []
  if (pacs.length === 0) {
    return <div style={mutedStyle}>No PAC contribution data available.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {pacs.slice(0, 10).map((p, i) => (
        <div
          key={`${p.pac_name}-${i}`}
          style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '6px 10px', backgroundColor: COLORS.neutral.surface,
            borderRadius: 6, fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 500, color: COLORS.brand.text }}>{p.pac_name}</span>
          <span style={{ color: COLORS.brand.text, fontWeight: 600 }}>{fmtAmount(Number(p.amount))}</span>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
