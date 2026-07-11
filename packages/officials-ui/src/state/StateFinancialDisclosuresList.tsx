'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { StateFinancialDisclosureRow } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

const KIND_LABEL: Record<string, string> = {
  salary: 'Salary',
  consulting: 'Consulting',
  royalty: 'Royalty',
  rental: 'Rental',
  dividend: 'Dividend',
  other: 'Other',
}

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export interface StateFinancialDisclosuresListProps {
  rows: StateFinancialDisclosureRow[]
}

export function StateFinancialDisclosuresList({
  rows,
}: StateFinancialDisclosuresListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const yearHeaderStyle = [styles.yearHeader, { color: semantic.text.primary }]
  const rowStyle = [styles.row, { backgroundColor: semantic.bg.elevated }]
  const titleStyle = [styles.title, { color: semantic.text.primary }]
  const metaStyle = [styles.meta, { color: semantic.text.muted }]

  if (rows.length === 0) {
    return <Text style={mutedStyle}>No financial disclosures on file.</Text>
  }
  // Group by filing_year
  const byYear = new Map<number, StateFinancialDisclosureRow[]>()
  for (const r of rows) {
    if (!byYear.has(r.filing_year)) byYear.set(r.filing_year, [])
    byYear.get(r.filing_year)!.push(r)
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a)

  return (
    <View style={styles.list}>
      {years.map((year) => {
        const yearRows = byYear.get(year)!
        return (
          <View key={year} style={{ gap: 4 }}>
            <Text style={yearHeaderStyle}>
              {year} ({yearRows.length} disclosure
              {yearRows.length === 1 ? '' : 's'})
            </Text>
            {yearRows.map((r) => {
              const low = r.amount_range_low == null ? null : Number(r.amount_range_low)
              const high = r.amount_range_high == null ? null : Number(r.amount_range_high)
              return (
                <View key={r.id} style={rowStyle}>
                  <Text style={titleStyle}>{r.income_source ?? '(unspecified source)'}</Text>
                  <Text style={metaStyle}>
                    {r.income_kind ? (KIND_LABEL[r.income_kind] ?? r.income_kind) : 'Kind n/a'}
                    {' · '}
                    {formatAmountRange(low, high)}
                  </Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 12, padding: 8 },
  yearHeader: {
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 4,
  },
  row: { borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
})
