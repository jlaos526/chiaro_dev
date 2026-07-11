'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { OfficialFinance } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

export interface FederalPACsListProps {
  finance: OfficialFinance | null | undefined
}

function fmtAmount(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalPACsList({ finance }: FederalPACsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const pacs = finance?.pacs ?? []
  if (pacs.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No PAC contribution data available.
      </Text>
    )
  }
  return (
    <View style={styles.list}>
      {pacs.slice(0, 10).map((p, i) => (
        <View key={`${p.pac_name}-${i}`} style={[styles.row, { backgroundColor: semantic.bg.app }]}>
          <Text style={[styles.name, { color: semantic.text.primary }]}>{p.pac_name}</Text>
          <Text style={[styles.amount, { color: semantic.text.primary }]}>
            {fmtAmount(Number(p.amount))}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 6,
    padding: 8,
  },
  name: { fontSize: 13, fontWeight: '500', flex: 1 },
  amount: { fontSize: 13, fontWeight: '600' },
})
