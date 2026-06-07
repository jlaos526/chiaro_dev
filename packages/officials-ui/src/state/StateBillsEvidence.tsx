'use client'

import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateBillWithSponsors } from '@chiaro/state-bills'
import { useBrandTokens } from '../brand-hooks.ts'

const INITIAL_ROW_COUNT = 5

export interface StateBillsEvidenceProps {
  bills: StateBillWithSponsors[]
}

export function StateBillsEvidence({ bills }: StateBillsEvidenceProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { semantic } = useBrandTokens()

  const emptyStyle = [styles.empty, { color: semantic.text.muted }]
  const rowStyle = [styles.row, { borderTopColor: semantic.border.default }]
  const titleStyle = [styles.title, { color: semantic.text.primary }]
  const metaStyle = [styles.meta, { color: semantic.text.muted }]
  const moreButtonStyle = [styles.moreButton, { borderColor: semantic.border.default }]
  const moreTextStyle = [styles.moreText, { color: semantic.text.primary }]

  if (bills.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={emptyStyle}>No bills this session.</Text>
      </View>
    )
  }
  const visible = expanded ? bills : bills.slice(0, INITIAL_ROW_COUNT)
  const hasMore = bills.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-bills-evidence">
      {visible.map(b => {
        const url = b.source_url ?? null
        const Row = url ? Pressable : View
        return (
          <Row
            key={b.id}
            {...(url ? { onPress: () => Linking.openURL(url).catch(() => {}) } : {})}
            style={rowStyle}
          >
            <Text style={titleStyle}>
              {b.bill_type} {b.number}: {b.title}
            </Text>
            <Text style={metaStyle}>
              {b.status_substage ?? b.status ?? '—'} · {b.latest_action_date}
            </Text>
          </Row>
        )
      })}
      {hasMore && (
        <Pressable
          onPress={() => setExpanded(e => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          style={moreButtonStyle}
        >
          <Text style={moreTextStyle}>
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
    fontStyle: 'italic',
  },
  row: {
    padding: 8,
    borderTopWidth: 1,
  },
  title: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  moreButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
  },
  moreText: { fontSize: 12 },
})
