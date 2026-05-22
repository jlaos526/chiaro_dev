import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import type { StateStockTransactionRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  sale: 'Sale',
  exchange: 'Exchange',
}

function formatAmountRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Amount n/a'
  const fmt = (n: number) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}k`
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`
  return fmt(low ?? high!)
}

interface Props {
  rows: StateStockTransactionRow[]
}

export function StateStockTransactionsList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No stock transactions on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => {
        const low = r.amount_range_low == null ? null : Number(r.amount_range_low)
        const high = r.amount_range_high == null ? null : Number(r.amount_range_high)
        return (
          <Pressable
            key={r.id}
            onPress={() => Linking.openURL(r.source_url)}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {r.transaction_date} · {r.asset_ticker ?? r.asset_name ?? 'Unknown asset'}
              </Text>
              <Text style={styles.meta}>
                {r.transaction_type ? TYPE_LABEL[r.transaction_type] ?? r.transaction_type : 'Type n/a'}
                {' · '}
                {formatAmountRange(low, high)}
              </Text>
            </View>
            {(r.days_late ?? 0) > 0 && (
              <Text
                style={[
                  styles.chip,
                  { color: COLORS.signal.warning, backgroundColor: `${COLORS.signal.warning}22` },
                ]}
              >
                {r.days_late}d late
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 6,
    padding: 8,
    gap: 8,
  },
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  chip: {
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'center',
  },
})
