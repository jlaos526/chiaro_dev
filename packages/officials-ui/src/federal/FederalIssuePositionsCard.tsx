'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useOfficialScorecardRatings } from '@chiaro/officials'
import { useMySelections, useIssueCatalog, useRepWatchlistFlags } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { computePriorityOrgSlugs } from '../issues/priority-orgs.ts'
import { WatchlistFlag } from '../issues/WatchlistFlag.tsx'
import { FederalScorecardRatingsList } from './FederalScorecardRatingsList.tsx'

export interface FederalIssuePositionsCardProps {
  officialId: string
}

const EMPTY_TEXT = 'No issue-position ratings available for this legislator yet.'

export function FederalIssuePositionsCard({
  officialId,
}: FederalIssuePositionsCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const ratings = useOfficialScorecardRatings(client, officialId)
  // The user's selected issues → the scorecard org slugs they care about. These
  // queries never gate the card (loading / empty / error): while they load (or
  // for logged-out users) the priority set is empty and the card renders
  // exactly as it did pre-slice-52.
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

  const rows = ratings.data ?? []
  const leans = new Set(rows.map((r) => r.org?.lean ?? 'centrist'))

  return (
    <DetailCardShell
      title="Issue Positions"
      isLoading={ratings.isLoading}
      isError={ratings.isError}
      onRetry={() => {
        void ratings.refetch()
      }}
      // Flags render even with no ratings (slice 53), so the shell's empty
      // branch only fires when BOTH ratings and flags are absent.
      isEmpty={rows.length === 0 && flags.length === 0}
      emptyText={EMPTY_TEXT}
    >
      {flagsSection}
      {rows.length === 0 ? (
        // Flags-only case: keep the verbatim no-ratings note under the flags
        // (the pre-shell empty branch rendered flags + this note together).
        <Text style={[styles.muted, { color: semantic.text.muted, fontStyle: 'italic' }]}>
          {EMPTY_TEXT}
        </Text>
      ) : (
        <>
          <Text style={[styles.summary, { color: semantic.text.muted }]}>
            {rows.length} org{rows.length === 1 ? '' : 's'} rated · {leans.size} lean group
            {leans.size === 1 ? '' : 's'}
          </Text>
          <FederalScorecardRatingsList rows={rows} priorityOrgSlugs={priorityOrgSlugs} />
        </>
      )}
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
})
