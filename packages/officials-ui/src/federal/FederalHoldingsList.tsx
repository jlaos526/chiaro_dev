'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { FederalHolding } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'n/a'
  const fmt = (n: number) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export interface FederalHoldingsListProps {
  rows: FederalHolding[]
}

export function FederalHoldingsList({ rows }: FederalHoldingsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return <Text style={[styles.muted, { color: semantic.text.muted }]}>No holdings on file.</Text>
  }
  // Group by filing_year for sectioned rendering
  const byYear = new Map<number, FederalHolding[]>()
  for (const r of rows) {
    const list = byYear.get(r.filing_year) ?? []
    list.push(r); byYear.set(r.filing_year, list)
  }
  const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a)
  return (
    <View style={styles.list}>
      {sortedYears.map(year => (
        <View key={year} style={styles.section}>
          <Text style={[styles.yearHeading, { color: semantic.text.primary }]}>{year}</Text>
          {byYear.get(year)!.map(r => {
            const low = r.value_min == null ? null : Number(r.value_min)
            const high = r.value_max == null ? null : Number(r.value_max)
            return (
              <Pressable
                key={r.id}
                onPress={() => { void Linking.openURL(r.source_url).catch(() => {}) }}
                style={styles.row}
                accessibilityRole="link"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: semantic.text.primary }]}>{r.asset_name ?? 'Unknown asset'}</Text>
                  {r.asset_ticker ? <Text style={[styles.ticker, { color: semantic.text.muted }]}>{r.asset_ticker}</Text> : null}
                  {r.asset_type ? <Text style={[styles.muted, { color: semantic.text.muted }]}>{r.asset_type}</Text> : null}
                </View>
                <Text style={[styles.amount, { color: semantic.text.primary }]}>{formatAmountRange(low, high)}</Text>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list:        { gap: 12 },
  section:     { gap: 6 },
  yearHeading: { fontSize: 14, fontWeight: '600' },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  name:        { fontSize: 13 },
  ticker:      { fontSize: 12, marginTop: 2 },
  muted:       { fontSize: 12 },
  amount:      { fontSize: 13, fontWeight: '600' },
})
