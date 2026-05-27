'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { FederalDisclosureOther } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

// DB-level check constraint allows 7 categories; the generated TS type widens
// to `string`. The label map covers the canonical 7 — unknown categories
// fall back to their raw key via the optional-chained lookup below.
type DisclosureCategory =
  | 'gift'
  | 'travel'
  | 'position'
  | 'agreement'
  | 'liability'
  | 'compensation'
  | 'honoraria'

const CATEGORY_LABEL: Record<DisclosureCategory, string> = {
  gift:         'Gifts',
  travel:       'Travel',
  position:     'Positions',
  agreement:    'Agreements',
  liability:    'Liabilities',
  compensation: 'Compensation',
  honoraria:    'Honoraria',
}

// Order is editorial — gifts/travel/honoraria most user-interesting, agreements/positions/liabilities/compensation
// less so. Categories with no rows are skipped entirely.
const CATEGORY_ORDER: DisclosureCategory[] = [
  'gift', 'travel', 'honoraria', 'compensation', 'agreement', 'position', 'liability',
]

function formatValue(low: number | null, high: number | null, text: string | null): string {
  if (text) return text
  if (low == null && high == null) return 'n/a'
  const fmt = (n: number) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

export interface FederalDisclosureOtherListProps {
  rows: FederalDisclosureOther[]
}

export function FederalDisclosureOtherList({
  rows,
}: FederalDisclosureOtherListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return <Text style={[styles.muted, { color: semantic.text.muted }]}>No other disclosures on file.</Text>
  }
  // Group by category
  const byCategory = new Map<string, FederalDisclosureOther[]>()
  for (const r of rows) {
    const list = byCategory.get(r.category) ?? []
    list.push(r); byCategory.set(r.category, list)
  }
  return (
    <View style={styles.list}>
      {CATEGORY_ORDER.filter(c => byCategory.has(c)).map(category => (
        <View key={category} style={styles.section}>
          <Text style={[styles.categoryHeading, { color: semantic.text.primary }]}>{CATEGORY_LABEL[category]}</Text>
          {byCategory.get(category)!.map(r => {
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
                  <Text style={[styles.name, { color: semantic.text.primary }]}>{r.description ?? 'Unknown'}</Text>
                  {r.source_party ? <Text style={[styles.muted, { color: semantic.text.muted }]}>{r.source_party}</Text> : null}
                  <Text style={[styles.year, { color: semantic.text.muted }]}>{r.filing_year}</Text>
                </View>
                <Text style={[styles.amount, { color: semantic.text.primary }]}>{formatValue(low, high, r.value_text)}</Text>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list:            { gap: 12 },
  section:         { gap: 6 },
  categoryHeading: { fontSize: 14, fontWeight: '600' },
  row:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  name:            { fontSize: 13 },
  year:            { fontSize: 11, marginTop: 2 },
  muted:           { fontSize: 12, marginTop: 2 },
  amount:          { fontSize: 13, fontWeight: '600' },
})
