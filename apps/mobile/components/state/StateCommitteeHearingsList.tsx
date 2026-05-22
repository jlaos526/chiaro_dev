import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { StateCommitteeHearingRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

interface Props {
  rows: StateCommitteeHearingRow[]
}

export function StateCommitteeHearingsList({ rows }: Props) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) {
    return (
      <Text style={styles.muted}>No committee hearings attended in current session.</Text>
    )
  }
  const visible = showAll ? rows : rows.slice(0, 3)
  return (
    <View style={styles.list}>
      {visible.map(r => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.title}>
            {r.hearing_date}
            {r.location ? ` · ${r.location}` : ''}
          </Text>
          {r.agenda_topic && <Text style={styles.meta}>Agenda: {r.agenda_topic}</Text>}
        </View>
      ))}
      {!showAll && rows.length > 3 && (
        <Pressable onPress={() => setShowAll(true)}>
          <Text style={styles.more}>and {rows.length - 3} more</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: { backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  more: { fontSize: 12, color: COLORS.neutral.textMuted },
})
