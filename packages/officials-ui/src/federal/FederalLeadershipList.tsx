'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { Database } from '@chiaro/db'
import { useBrandTokens } from '../brand-hooks.ts'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

export interface FederalLeadershipListProps {
  rows: LeadershipRow[]
}

export function FederalLeadershipList({ rows }: FederalLeadershipListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No leadership positions on file.
      </Text>
    )
  }
  return (
    <View style={styles.list}>
      {rows.map((r) => (
        <View key={r.id} style={[styles.row, { backgroundColor: semantic.bg.app }]}>
          <Text style={[styles.title, { color: semantic.text.primary }]}>{r.role}</Text>
          <Text style={[styles.meta, { color: semantic.text.muted }]}>
            {r.start_date}
            {r.end_date ? ` – ${r.end_date}` : ' – present'}
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
    borderRadius: 6,
    padding: 8,
  },
  title: { fontSize: 13, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
})
