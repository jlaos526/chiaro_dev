'use client'

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateCommitteeHearingRow } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

export interface StateCommitteeHearingsListProps {
  rows: StateCommitteeHearingRow[]
}

export function StateCommitteeHearingsList({
  rows,
}: StateCommitteeHearingsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No committee hearings attended in current session.
      </Text>
    )
  }
  const visible = showAll ? rows : rows.slice(0, 3)
  return (
    <View style={styles.list}>
      {visible.map((r) => (
        <View key={r.id} style={[styles.row, { backgroundColor: semantic.bg.elevated }]}>
          <Text style={[styles.title, { color: semantic.text.primary }]}>
            {r.hearing_date}
            {r.location ? ` · ${r.location}` : ''}
          </Text>
          {r.agenda_topic && (
            <Text style={[styles.meta, { color: semantic.text.muted }]}>
              Agenda: {r.agenda_topic}
            </Text>
          )}
        </View>
      ))}
      {!showAll && rows.length > 3 && (
        <Pressable onPress={() => setShowAll(true)}>
          <Text style={[styles.more, { color: semantic.text.muted }]}>
            and {rows.length - 3} more
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: { borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
  more: { fontSize: 12 },
})
