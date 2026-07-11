'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useOfficialScorecardRatings } from '@chiaro/officials'
import { useMySelections, useIssueCatalog, useRepWatchlistFlags } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { useChiaroClient } from '../client-context.tsx'
import { computePriorityOrgSlugs } from '../issues/priority-orgs.ts'
import { WatchlistFlag } from '../issues/WatchlistFlag.tsx'
import { FederalScorecardRatingsList } from './FederalScorecardRatingsList.tsx'

export interface FederalIssuePositionsCardProps {
  officialId: string
}

export function FederalIssuePositionsCard({
  officialId,
}: FederalIssuePositionsCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const ratings = useOfficialScorecardRatings(client, officialId)
  // The user's selected issues → the scorecard org slugs they care about. These
  // queries never gate the card: while they load (or for logged-out users) the
  // priority set is empty and the card renders exactly as it did pre-slice-52.
  const selections = useMySelections(client)
  const catalog = useIssueCatalog(client)
  const priorityOrgSlugs = computePriorityOrgSlugs(selections.data, catalog.data)

  // Watchlist evidence flags ("⚑") — finance-derived matches for this rep. Like
  // the priority queries above, this never gates the card: no flags (or a
  // logged-out user) yields a null section and the card renders as in slice 52.
  const watchlistFlags = useRepWatchlistFlags(client, officialId)
  const flags = watchlistFlags.data ?? []
  const flagsSection =
    flags.length > 0 ? (
      <View>
        {flags.map((f) => (
          <WatchlistFlag key={`${f.topicSlug}::${f.lensSlug}`} flag={f} />
        ))}
      </View>
    ) : null

  if (ratings.isLoading) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
        ]}
      >
        <Text
          style={[styles.title, { color: semantic.text.primary }]}
          accessibilityRole="header"
          accessibilityLevel={2}
        >
          Issue Positions
        </Text>
        <Text style={[styles.muted, { color: semantic.text.muted }]}>Loading issue positions…</Text>
      </View>
    )
  }

  const rows = ratings.data ?? []
  if (rows.length === 0) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
        ]}
      >
        <Text
          style={[styles.title, { color: semantic.text.primary }]}
          accessibilityRole="header"
          accessibilityLevel={2}
        >
          Issue Positions
        </Text>
        {flagsSection}
        <Text style={[styles.muted, { color: semantic.text.muted, fontStyle: 'italic' }]}>
          No issue-position ratings available for this legislator yet.
        </Text>
      </View>
    )
  }

  const leans = new Set(rows.map((r) => r.org?.lean ?? 'centrist'))
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
      ]}
    >
      <Text
        style={[styles.title, { color: semantic.text.primary }]}
        accessibilityRole="header"
        accessibilityLevel={2}
      >
        Issue Positions
      </Text>
      {flagsSection}
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
        {rows.length} org{rows.length === 1 ? '' : 's'} rated · {leans.size} lean group
        {leans.size === 1 ? '' : 's'}
      </Text>
      <FederalScorecardRatingsList rows={rows} priorityOrgSlugs={priorityOrgSlugs} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
})
