'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { BillRow } from '@chiaro/bills'
import { COLORS } from '@chiaro/ui-tokens'

function statusColor(status: string | null | undefined): string {
  if (!status) return COLORS.neutral.textMuted
  const s = status.toLowerCase()
  if (s.includes('passed') || s.includes('signed') || s.includes('became law') || s.includes('enacted')) return COLORS.signal.success
  if (s.includes('failed') || s.includes('vetoed')) return COLORS.signal.error
  if (s.includes('committee') || s.includes('introduced')) return COLORS.neutral.textMuted
  return COLORS.neutral.textMuted
}

export interface FederalSponsoredBillsListProps {
  rows: BillRow[]
}

export function FederalSponsoredBillsList({ rows }: FederalSponsoredBillsListProps): React.JSX.Element {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No sponsored bills.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.slice(0, 25).map(r => {
        const color = statusColor(r.status)
        const url = r.source_url ?? null
        const Row = url ? Pressable : View
        return (
          <Row
            key={r.id}
            {...(url ? { onPress: () => Linking.openURL(url).catch(() => {}) } : {})}
            style={styles.row}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.billId}>
                {r.bill_type} {r.number}
              </Text>
              {r.status && (
                <Text
                  style={[
                    styles.chip,
                    { color, backgroundColor: `${color}22` },
                  ]}
                >
                  {r.status}
                </Text>
              )}
            </View>
            <Text style={styles.title}>{r.short_title ?? r.title}</Text>
          </Row>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: {
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 6,
    padding: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  billId: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  chip: {
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  title: { fontSize: 12, color: COLORS.brand.text },
})
