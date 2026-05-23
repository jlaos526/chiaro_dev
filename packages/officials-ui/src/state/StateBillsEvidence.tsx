'use client'

import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateBillWithSponsors } from '@chiaro/state-bills'
import { COLORS } from '@chiaro/ui-tokens'

const INITIAL_ROW_COUNT = 5

export interface StateBillsEvidenceProps {
  bills: StateBillWithSponsors[]
}

export function StateBillsEvidence({ bills }: StateBillsEvidenceProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  if (bills.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={styles.empty}>No bills this session.</Text>
      </View>
    )
  }
  const visible = expanded ? bills : bills.slice(0, INITIAL_ROW_COUNT)
  const hasMore = bills.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-bills-evidence">
      {visible.map(b => (
        <Pressable
          key={b.id}
          onPress={() => Linking.openURL(b.source_url).catch(() => {})}
          style={styles.row}
        >
          <Text style={styles.title}>
            {b.bill_type} {b.number}: {b.title}
          </Text>
          <Text style={styles.meta}>
            {b.status_substage ?? b.status ?? '—'} · {b.latest_action_date}
          </Text>
        </Pressable>
      ))}
      {hasMore && (
        <Pressable onPress={() => setExpanded(e => !e)} style={styles.moreButton}>
          <Text style={styles.moreText}>
            {expanded ? 'show less' : `show more (${bills.length - INITIAL_ROW_COUNT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 13,
    color: COLORS.neutral.textMuted,
    fontStyle: 'italic',
  },
  row: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral.border,
  },
  title: { fontSize: 14, fontWeight: '600', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  moreButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.neutral.border,
    borderRadius: 4,
  },
  moreText: { fontSize: 12, color: COLORS.brand.text },
})
