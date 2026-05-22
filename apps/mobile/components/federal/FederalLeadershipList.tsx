import { View, Text, StyleSheet } from 'react-native'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type LeadershipRow = Database['public']['Tables']['officials_leadership_history']['Row']

interface Props { rows: LeadershipRow[] }

export function FederalLeadershipList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No leadership positions on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.title}>{r.role}</Text>
          <Text style={styles.meta}>
            {r.start_date}{r.end_date ? ` – ${r.end_date}` : ' – present'}
          </Text>
        </View>
      ))}
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
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
})
