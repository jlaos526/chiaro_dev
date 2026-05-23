'use client'

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateFinanceIndividualDonorRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const INITIAL_ROW_COUNT = 5

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
  const [expanded, setExpanded] = useState(false)
  if (donors.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={styles.empty}>No donor data for this cycle.</Text>
      </View>
    )
  }
  const visible = expanded ? donors : donors.slice(0, INITIAL_ROW_COUNT)
  const hasMore = donors.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-donors-evidence">
      {visible.map(d => {
        const secondary = secondaryLine(d)
        return (
          <View key={d.rank} style={styles.row}>
            <View style={styles.headerRow}>
              <Text style={styles.donorName}>{d.donor_name}</Text>
              <Text style={styles.amount}>{fmtAmount(Number(d.amount))}</Text>
            </View>
            {secondary && <Text style={styles.meta}>{secondary}</Text>}
          </View>
        )
      })}
      {hasMore && (
        <Pressable onPress={() => setExpanded(e => !e)} style={styles.moreButton}>
          <Text style={styles.moreText}>
            {expanded ? 'show less' : `show more (${donors.length - INITIAL_ROW_COUNT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' },
  row: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  donorName: { fontWeight: '600', color: COLORS.brand.text },
  amount: { color: COLORS.brand.text },
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
