import { View, Text, StyleSheet } from 'react-native'
import type { StateFinancialDisclosureRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

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

interface Props {
  rows: StateFinancialDisclosureRow[]
}

export function StateFinancialDisclosuresList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No financial disclosures on file.</Text>
  }
  const byYear = new Map<number, StateFinancialDisclosureRow[]>()
  for (const r of rows) {
    if (!byYear.has(r.filing_year)) byYear.set(r.filing_year, [])
    byYear.get(r.filing_year)!.push(r)
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a)

  return (
    <View style={styles.list}>
      {years.map(year => (
        <View key={year} style={{ gap: 4 }}>
          <Text style={styles.yearHeader}>
            {year} ({byYear.get(year)!.length} disclosure
            {byYear.get(year)!.length === 1 ? '' : 's'})
          </Text>
          {byYear.get(year)!.map(r => {
            const low = r.amount_range_low == null ? null : Number(r.amount_range_low)
            const high = r.amount_range_high == null ? null : Number(r.amount_range_high)
            return (
              <View key={r.id} style={styles.row}>
                <Text style={styles.title}>{r.income_source ?? '(unspecified source)'}</Text>
                <Text style={styles.meta}>
                  {r.income_kind ? KIND_LABEL[r.income_kind] ?? r.income_kind : 'Kind n/a'}
                  {' · '}
                  {formatAmountRange(low, high)}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 12, padding: 8 },
  yearHeader: { fontWeight: '600', fontSize: 13, color: COLORS.brand.text, marginBottom: 4 },
  row: { backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
})
