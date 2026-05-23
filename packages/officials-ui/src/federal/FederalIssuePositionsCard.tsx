'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useOfficialScorecardRatings } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'
import { FederalScorecardRatingsList } from './FederalScorecardRatingsList.tsx'

export interface FederalIssuePositionsCardProps {
  officialId: string
}

export function FederalIssuePositionsCard({
  officialId,
}: FederalIssuePositionsCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const ratings = useOfficialScorecardRatings(client, officialId)

  if (ratings.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Issue Positions</Text>
        <Text style={styles.muted}>Loading issue positions…</Text>
      </View>
    )
  }

  const rows = ratings.data ?? []
  if (rows.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Issue Positions</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No issue-position ratings available for this legislator yet.
        </Text>
      </View>
    )
  }

  const leans = new Set(rows.map(r => r.org?.lean ?? 'centrist'))
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Issue Positions</Text>
      <Text style={styles.summary}>
        {rows.length} org{rows.length === 1 ? '' : 's'} rated · {leans.size} lean group
        {leans.size === 1 ? '' : 's'}
      </Text>
      <FederalScorecardRatingsList rows={rows} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.neutral.background,
    borderColor: COLORS.neutral.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.brand.text,
  },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
})
