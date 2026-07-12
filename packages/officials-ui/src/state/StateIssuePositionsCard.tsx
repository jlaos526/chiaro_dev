'use client'

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useOfficialStateScorecardRatings,
  type StateScorecardRatingWithOrg,
} from '@chiaro/officials'
import { useMySelections, useIssueCatalog, useRepWatchlistFlags } from '@chiaro/issues'
import { SCORECARD_LEAN_LABEL, type ScorecardLean } from '@chiaro/ui-tokens'
import { useBrandTokens, useScorecardLeanColor } from '../brand-hooks.ts'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { IssuePriorityTag } from '../issues/IssuePriorityTag.tsx'
import { computePriorityOrgSlugs, sortPriorityFirst } from '../issues/priority-orgs.ts'
import { WatchlistFlag } from '../issues/WatchlistFlag.tsx'
import { StateIssueVotesEvidence } from './StateIssueVotesEvidence.tsx'

export interface StateIssuePositionsCardProps {
  officialId: string
}

const LEAN_GROUP_ORDER: ScorecardLean[] = [
  'progressive',
  'conservative',
  'single-issue',
  'libertarian',
  'centrist',
]

const EMPTY_TEXT = 'No issue-position ratings available for this legislator yet.'

function leanLabel(lean: string): string {
  return (SCORECARD_LEAN_LABEL as Record<string, string>)[lean] ?? lean
}

export function StateIssuePositionsCard({
  officialId,
}: StateIssuePositionsCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const { semantic } = useBrandTokens()

  // Resolve lean colors at the component body (rules of hooks: fixed-order calls).
  const leanColors: Record<ScorecardLean, string> = {
    progressive: useScorecardLeanColor('progressive'),
    conservative: useScorecardLeanColor('conservative'),
    'single-issue': useScorecardLeanColor('single-issue'),
    libertarian: useScorecardLeanColor('libertarian'),
    centrist: useScorecardLeanColor('centrist'),
  }
  const leanColor = (lean: string, fallback: string): string =>
    (leanColors as Record<string, string>)[lean] ?? fallback
  const ratings = useOfficialStateScorecardRatings(client, officialId)
  // The user's selected issues → scorecard org slugs they care about. These
  // queries never gate the card: while they load (or for logged-out users) the
  // priority set is empty and the card renders exactly as it did pre-slice-52.
  const selections = useMySelections(client)
  const catalog = useIssueCatalog(client)
  const priorityOrgSlugs = computePriorityOrgSlugs(selections.data, catalog.data)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Watchlist evidence flags ("⚑") — finance-derived matches for this rep. Like
  // the priority queries above, this never gates the card: no flags (or a
  // logged-out user) yields a null section and the card renders as in slice 52.
  // State donor data is federal-only today, so production state reps have no
  // flags; the slot exists for future state watchlists. Called unconditionally
  // before the early returns to satisfy the rules of hooks.
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

  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const ratingRowStyle = [styles.ratingRow, { borderBottomColor: semantic.border.default }]
  const orgNameStyle = [styles.orgName, { color: semantic.text.primary }]
  const issueAreaStyle = [styles.issueArea, { color: semantic.text.muted }]
  const scoreStyle = [styles.score, { color: semantic.text.primary }]

  const rows = ratings.data ?? []

  const byLean = new Map<string, StateScorecardRatingWithOrg[]>()
  for (const r of rows) {
    const key = r.org.lean
    if (!byLean.has(key)) byLean.set(key, [])
    byLean.get(key)!.push(r)
  }

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  // Single source of truth for a rating row — used by both the grouped (default)
  // and the flat priority-first layouts so the Pressable + evidence-expand
  // behavior stays identical across both.
  const renderRatingRow = (r: StateScorecardRatingWithOrg, isPriority: boolean) => (
    <View key={r.id} style={ratingRowStyle}>
      <Pressable
        onPress={() => toggle(r.id)}
        style={styles.ratingButton}
        accessibilityRole="button"
        accessibilityState={{ expanded: expanded.has(r.id) }}
        aria-expanded={expanded.has(r.id)}
      >
        <View style={{ flex: 1 }}>
          {isPriority && <IssuePriorityTag />}
          <Text style={orgNameStyle}>{r.org.name}</Text>
          <Text style={issueAreaStyle}>{r.org.issue_area}</Text>
        </View>
        <Text style={scoreStyle}>
          {Number(r.score).toFixed(0)} / {r.org.scoring_max}
        </Text>
      </Pressable>
      {expanded.has(r.id) && (
        <StateIssueVotesEvidence officialId={officialId} issueArea={r.org.issue_area} />
      )}
    </View>
  )

  // Render canonical order first, then any unknown leans last (defensive).
  const orderedLeans: string[] = [
    ...LEAN_GROUP_ORDER.filter((l) => byLean.has(l)),
    ...Array.from(byLean.keys()).filter((l) => !LEAN_GROUP_ORDER.includes(l as ScorecardLean)),
  ]

  return (
    <DetailCardShell
      title="Issue Positions"
      // The priority/watchlist queries never gate the card — only ratings do.
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
        <Text style={[mutedStyle, { fontStyle: 'italic' }]}>{EMPTY_TEXT}</Text>
      ) : priorityOrgSlugs.size > 0 ? (
        // Priority path: when the user has selected issues that map to orgs
        // present here, drop the lean grouping and float matched rows to the
        // top with a tag.
        sortPriorityFirst(rows, (r) => r.org.slug, priorityOrgSlugs).map((r) =>
          renderRatingRow(r, priorityOrgSlugs.has(r.org.slug)),
        )
      ) : (
        orderedLeans.map((lean) => (
          <View key={lean} style={{ marginBottom: 12 }}>
            <Text style={[styles.leanHeader, { color: leanColor(lean, semantic.text.muted) }]}>
              {leanLabel(lean)}
            </Text>
            {byLean.get(lean)!.map((r) => renderRatingRow(r, false))}
          </View>
        ))
      )}
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  muted: {
    fontSize: 13,
  },
  leanHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  ratingRow: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  ratingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orgName: { fontSize: 14 },
  issueArea: { fontSize: 12, marginTop: 2 },
  score: { fontSize: 14, fontWeight: '600' },
})
