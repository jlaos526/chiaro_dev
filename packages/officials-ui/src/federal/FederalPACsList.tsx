'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { OfficialFinance } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

export interface FederalPACsListProps {
  finance: OfficialFinance | null | undefined
}

function fmtAmount(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalPACsList({ finance }: FederalPACsListProps): React.JSX.Element {
  const pacs = finance?.pacs ?? []
  if (pacs.length === 0) {
    return <Text style={styles.muted}>No PAC contribution data available.</Text>
  }
  return (
    <View style={styles.list}>
      {pacs.slice(0, 10).map((p, i) => (
        <View key={`${p.pac_name}-${i}`} style={styles.row}>
          <Text style={styles.name}>{p.pac_name}</Text>
          <Text style={styles.amount}>{fmtAmount(Number(p.amount))}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 6,
    padding: 8,
  },
  name: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text, flex: 1 },
  amount: { fontSize: 13, fontWeight: '600', color: COLORS.brand.text },
})
