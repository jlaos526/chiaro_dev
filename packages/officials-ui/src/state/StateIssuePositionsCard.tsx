'use client'

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useOfficialStateScorecardRatings,
  type StateScorecardRatingWithOrg,
} from '@chiaro/officials'
import {
  COLORS,
  SCORECARD_LEAN_COLOR,
  SCORECARD_LEAN_LABEL,
  type ScorecardLean,
} from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'
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

function leanColor(lean: string): string {
  return (SCORECARD_LEAN_COLOR as Record<string, string>)[lean] ?? COLORS.neutral.textMuted
}

function leanLabel(lean: string): string {
  return (SCORECARD_LEAN_LABEL as Record<string, string>)[lean] ?? lean
}

export function StateIssuePositionsCard({
  officialId,
}: StateIssuePositionsCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const { data, isLoading } = useOfficialStateScorecardRatings(client, officialId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Issue Positions</Text>
        <Text style={styles.muted}>Loading issue positions…</Text>
      </View>
    )
  }
  if (!data || data.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Issue Positions</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No issue-position ratings available for this legislator yet.
        </Text>
      </View>
    )
  }

  const byLean = new Map<string, StateScorecardRatingWithOrg[]>()
  for (const r of data) {
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

  // Render canonical order first, then any unknown leans last (defensive).
  const orderedLeans: string[] = [
    ...LEAN_GROUP_ORDER.filter(l => byLean.has(l)),
    ...Array.from(byLean.keys()).filter(l => !LEAN_GROUP_ORDER.includes(l as ScorecardLean)),
  ]

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Issue Positions</Text>
      {orderedLeans.map(lean => (
        <View key={lean} style={{ marginBottom: 12 }}>
          <Text style={[styles.leanHeader, { color: leanColor(lean) }]}>
            {leanLabel(lean)}
          </Text>
          {byLean.get(lean)!.map(r => (
            <View key={r.id} style={styles.ratingRow}>
              <Pressable onPress={() => toggle(r.id)} style={styles.ratingButton}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orgName}>{r.org.name}</Text>
                  <Text style={styles.issueArea}>{r.org.issue_area}</Text>
                </View>
                <Text style={styles.score}>
                  {Number(r.score).toFixed(0)} / {r.org.scoring_max}
                </Text>
              </Pressable>
              {expanded.has(r.id) && (
                <StateIssueVotesEvidence
                  officialId={officialId}
                  issueArea={r.org.issue_area}
                />
              )}
            </View>
          ))}
        </View>
      ))}
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
  muted: {
    color: COLORS.neutral.textMuted,
    fontSize: 13,
  },
  leanHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  ratingRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral.border,
    paddingVertical: 8,
  },
  ratingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orgName: { fontSize: 14, color: COLORS.brand.text },
  issueArea: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  score: { fontSize: 14, fontWeight: '600', color: COLORS.brand.text },
})
