import { useState } from 'react'
import { PillChevron } from '@/components/cards/PillChevron'

export interface TopAmountRow {
  label: string
  amount: number
}

export interface TopAmountNoun {
  singular: string
  plural: string
}

export interface TopAmountBreakdownProps {
  rows: ReadonlyArray<TopAmountRow>
  noun: TopAmountNoun
  sourceUrl?: string
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function TopAmountBreakdown({ rows, noun, sourceUrl }: TopAmountBreakdownProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = Math.max(...rows.map(r => r.amount), 1)
  const visible = expanded ? rows : rows.slice(0, 5)
  const showToggle = rows.length > 5

  return (
    <div style={{ background: 'linear-gradient(180deg, #f4faf6 0%, #fff 100%)', border: '1px solid #d8d4c9', borderRadius: 6, padding: '14px 16px', fontSize: '0.82rem', color: '#1a1714' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((r, idx) => {
          const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
          const isTop = idx === 0
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: isTop ? 700 : 600, fontSize: isTop ? '0.92rem' : '0.82rem', color: '#1a1714' }}>
                  {r.label}
                </span>
                <span>
                  <span style={{ fontWeight: 700, color: '#1a1714' }}>{formatMoney(r.amount)}</span>{' '}
                  <span style={{ color: '#5a5751', fontSize: '0.72rem' }}>· {pct}%</span>
                </span>
              </div>
              <div style={{ marginTop: 4, height: 6, background: '#e8e6dd', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ background: '#3da75b', width: `${(r.amount / max) * 100}%`, height: '100%' }} />
              </div>
            </div>
          )
        })}
      </div>

      {showToggle && (
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          style={{
            marginTop: 12,
            width: '100%',
            background: '#fff',
            border: '1px solid #d8d4c9',
            borderRadius: 6,
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#1a1714',
            fontSize: '0.82rem',
          }}
        >
          <PillChevron open={expanded} />
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>
            {expanded ? 'Show less' : `Show 5 more ${noun.plural}`}
          </span>
          <span style={{ color: '#5a5751', fontSize: '0.72rem' }}>
            {expanded ? `${rows.length} of ${rows.length} shown` : `5 of ${rows.length} shown`}
          </span>
        </button>
      )}

      {sourceUrl && (
        <div style={{ marginTop: 12, fontSize: '0.78rem' }}>
          <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#3b6ed1', textDecoration: 'underline' }}>
            → full breakdown on OpenSecrets
          </a>
        </div>
      )}
    </div>
  )
}
