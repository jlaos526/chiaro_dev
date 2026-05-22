'use client'

import type { StateFinancialDisclosureRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props { rows: StateFinancialDisclosureRow[] }

const KIND_LABEL: Record<string, string> = {
  salary: 'Salary', consulting: 'Consulting', royalty: 'Royalty',
  rental: 'Rental', dividend: 'Dividend', other: 'Other',
}

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export function StateFinancialDisclosuresList({ rows }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <div style={mutedStyle}>No financial disclosures on file.</div>
  }
  // Group by filing_year
  const byYear = new Map<number, StateFinancialDisclosureRow[]>()
  for (const r of rows) {
    if (!byYear.has(r.filing_year)) byYear.set(r.filing_year, [])
    byYear.get(r.filing_year)!.push(r)
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 12px' }}>
      {years.map(year => {
        const yearRows = byYear.get(year)!
        return (
          <div key={year}>
            <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.brand.text, marginBottom: 4 }}>
              {year} ({yearRows.length} disclosure{yearRows.length === 1 ? '' : 's'})
            </div>
            {yearRows.map(r => {
              const low = r.amount_range_low == null ? null : Number(r.amount_range_low)
              const high = r.amount_range_high == null ? null : Number(r.amount_range_high)
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '6px 10px', backgroundColor: COLORS.neutral.surface,
                    borderRadius: 6, fontSize: 13, marginBottom: 4,
                  }}
                >
                  <div style={{ fontWeight: 500, color: COLORS.brand.text }}>
                    {r.income_source ?? '(unspecified source)'}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
                    {r.income_kind ? KIND_LABEL[r.income_kind] ?? r.income_kind : 'Kind n/a'}
                    {' · '}{formatAmountRange(low, high)}
                  </div>
                </div>
              )
            })}
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
