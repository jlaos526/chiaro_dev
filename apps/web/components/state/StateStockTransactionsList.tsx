'use client'

import type { StateStockTransactionRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateStockTransactionRow[] }

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase', sale: 'Sale', exchange: 'Exchange',
}

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export function StateStockTransactionsList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No stock transactions on file.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
      {rows.map(r => {
        const low = r.amount_range_low == null ? null : Number(r.amount_range_low)
        const high = r.amount_range_high == null ? null : Number(r.amount_range_high)
        return (
          <a
            key={r.id}
            href={r.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', justifyContent: 'space-between', gap: 12,
              padding: '8px 10px', backgroundColor: COLORS.neutral.surface,
              borderRadius: 6, fontSize: 13, textDecoration: 'none', color: COLORS.brand.text,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>
                {r.transaction_date} · {r.asset_ticker ?? r.asset_name ?? 'Unknown asset'}
              </div>
              <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
                {r.transaction_type ? TYPE_LABEL[r.transaction_type] ?? r.transaction_type : 'Type n/a'}
                {' · '}{formatAmountRange(low, high)}
              </div>
            </div>
            {(r.days_late ?? 0) > 0 && (
              <span
                style={{
                  alignSelf: 'center', fontSize: 11, fontWeight: 600,
                  color: COLORS.signal.warning,
                  padding: '2px 6px', borderRadius: 4,
                  backgroundColor: `${COLORS.signal.warning}22`,
                }}
              >
                {r.days_late}d late
              </span>
            )}
          </a>
        )
      })}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
