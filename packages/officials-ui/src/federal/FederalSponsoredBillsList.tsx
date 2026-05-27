'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { BillRow } from '@chiaro/bills'
import { COLORS, type BrandSemantic } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

function statusColor(status: string | null | undefined, semantic: BrandSemantic): string {
  if (!status) return semantic.text.muted
  const s = status.toLowerCase()
  if (s.includes('passed') || s.includes('signed') || s.includes('became law') || s.includes('enacted')) return COLORS.signal.success
  if (s.includes('failed') || s.includes('vetoed')) return semantic.alert.danger.fg
  if (s.includes('committee') || s.includes('introduced')) return semantic.text.muted
  return semantic.text.muted
}

export interface FederalSponsoredBillsListProps {
  rows: BillRow[]
}

export function FederalSponsoredBillsList({ rows }: FederalSponsoredBillsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return <Text style={[styles.muted, { color: semantic.text.muted }]}>No sponsored bills.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.slice(0, 25).map(r => {
        const color = statusColor(r.status, semantic)
        const url = r.source_url ?? null
        const Row = url ? Pressable : View
        return (
          <Row
            key={r.id}
            {...(url ? { onPress: () => Linking.openURL(url).catch(() => {}) } : {})}
            style={[styles.row, { backgroundColor: semantic.bg.app }]}
          >
            <View style={styles.rowHeader}>
              <Text style={[styles.billId, { color: semantic.text.primary }]}>
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
            <Text style={[styles.title, { color: semantic.text.primary }]}>{r.short_title ?? r.title}</Text>
          </Row>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: {
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
  billId: { fontSize: 13, fontWeight: '500' },
  chip: {
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  title: { fontSize: 12 },
})
