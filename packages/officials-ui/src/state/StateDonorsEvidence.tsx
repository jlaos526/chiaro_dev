'use client'

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'

const INITIAL_ROW_COUNT = 5
const PAGE_SIZE = 25 // slice 75 (audit C11) — incremental paging, see StateVotesEvidence

function fmtAmount(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function secondaryLine(d: StateFinanceIndividualDonorRow): string | null {
  const parts: string[] = []
  if (d.employer) parts.push(d.employer)
  if (d.occupation) parts.push(d.occupation)
  if (d.city) {
    parts.push(d.donor_state ? `${d.city}, ${d.donor_state}` : d.city)
  } else if (d.donor_state) {
    parts.push(d.donor_state)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export interface StateDonorsEvidenceProps {
  donors: StateFinanceIndividualDonorRow[]
}

export function StateDonorsEvidence({ donors }: StateDonorsEvidenceProps): React.JSX.Element {
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROW_COUNT)
  const expanded = visibleCount > INITIAL_ROW_COUNT
  const { semantic } = useBrandTokens()

  const emptyStyle = [styles.empty, { color: semantic.text.muted }]
  const rowStyle = [styles.row, { borderTopColor: semantic.border.default }]
  const donorNameStyle = [styles.donorName, { color: semantic.text.primary }]
  const amountStyle = [styles.amount, { color: semantic.text.primary }]
  const metaStyle = [styles.meta, { color: semantic.text.muted }]
  const moreButtonStyle = [styles.moreButton, { borderColor: semantic.border.default }]
  const moreTextStyle = [styles.moreText, { color: semantic.text.primary }]

  if (donors.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={emptyStyle}>No donor data for this cycle.</Text>
      </View>
    )
  }
  const visible = donors.slice(0, visibleCount)
  const remaining = Math.max(0, donors.length - visibleCount)
  const hasMore = donors.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-donors-evidence">
      {visible.map((d, i) => {
        const secondary = secondaryLine(d)
        return (
          <View key={`${d.donor_name}-${d.rank}-${i}`} style={rowStyle}>
            <View style={styles.headerRow}>
              <Text style={donorNameStyle}>{d.donor_name}</Text>
              <Text style={amountStyle}>{fmtAmount(Number(d.amount))}</Text>
            </View>
            {secondary && <Text style={metaStyle}>{secondary}</Text>}
          </View>
        )
      })}
      {hasMore && (
        <Pressable
          onPress={() =>
            remaining > 0
              ? setVisibleCount((c) => c + PAGE_SIZE)
              : setVisibleCount(INITIAL_ROW_COUNT)
          }
          style={moreButtonStyle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
        >
          <Text style={moreTextStyle}>
            {remaining > 0 ? `show more (${remaining} more)` : 'show less'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, fontStyle: 'italic' },
  row: {
    padding: 8,
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  donorName: { fontWeight: '600' },
  amount: {},
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
