'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateTownHallRow } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In person',
  virtual:   'Virtual',
  phone:     'Phone',
  hybrid:    'Hybrid',
}

export interface StateTownHallsListProps {
  rows: StateTownHallRow[]
}

export function StateTownHallsList({ rows }: StateTownHallsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No town halls in the past 12 months.
      </Text>
    )
  }
  return (
    <View style={styles.list}>
      {rows.map(r => {
        const url = r.source_url ?? null
        const Row = url ? Pressable : View
        return (
          <Row
            key={r.id}
            {...(url ? { onPress: () => Linking.openURL(url).catch(() => {}) } : {})}
            style={[styles.row, { backgroundColor: semantic.bg.elevated }]}
          >
            <Text style={[styles.title, { color: semantic.text.primary }]}>
              {r.event_date}
              {r.city ? ` · ${r.city}, ${r.state}` : ` · ${r.state}`}
            </Text>
            <Text style={[styles.meta, { color: semantic.text.muted }]}>
              {r.format ? FORMAT_LABEL[r.format] ?? r.format : 'Format n/a'}
              {r.attendance_estimate != null && ` · ~${r.attendance_estimate} attendees`}
            </Text>
          </Row>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: { borderRadius: 6, padding: 8 },
  title: { fontSize: 13, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
})
