'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { ScorecardRatingWithOrg } from '@chiaro/officials'
import { SCORECARD_LEAN_LABEL, type ScorecardLean } from '@chiaro/ui-tokens'
import { useBrandTokens, useScorecardLeanColor } from '../brand-hooks.ts'
import { IssuePriorityTag } from '../issues/IssuePriorityTag.tsx'
import { sortPriorityFirst } from '../issues/priority-orgs.ts'

export interface FederalScorecardRatingsListProps {
  rows: ScorecardRatingWithOrg[]
  /**
   * Scorecard org slugs tied to the user's selected issue topics. When non-empty,
   * the list renders FLAT with matched rows floated to the top (each carrying an
   * ★ IssuePriorityTag). When empty/undefined the list renders grouped-by-lean
   * exactly as before — the no-selections path is unchanged.
   */
  priorityOrgSlugs?: Set<string>
}

const LEAN_GROUP_ORDER: readonly ScorecardLean[] = [
  'progressive',
  'conservative',
  'single-issue',
  'libertarian',
  'centrist',
] as const

export function FederalScorecardRatingsList({
  rows,
  priorityOrgSlugs,
}: FederalScorecardRatingsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  // Resolve lean colors at the component body (rules of hooks: fixed-order calls).
  const leanColors: Record<ScorecardLean, string> = {
    progressive: useScorecardLeanColor('progressive'),
    conservative: useScorecardLeanColor('conservative'),
    'single-issue': useScorecardLeanColor('single-issue'),
    libertarian: useScorecardLeanColor('libertarian'),
    centrist: useScorecardLeanColor('centrist'),
  }

  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No scorecard ratings on file.
      </Text>
    )
  }

  // Priority path: when the user has selected issues that map to orgs present
  // here, drop the lean grouping and float matched rows to the top with a tag.
  const priority = priorityOrgSlugs ?? new Set<string>()
  if (priority.size > 0) {
    const ordered = sortPriorityFirst(rows, (r) => r.org?.slug, priority)
    return (
      <View style={styles.list}>
        {ordered.map((r) => {
          const isPriority = r.org?.slug != null && priority.has(r.org.slug)
          return (
            <View key={r.id} style={[styles.row, { backgroundColor: semantic.bg.app }]}>
              <View style={{ flex: 1 }}>
                {isPriority && <IssuePriorityTag />}
                <Text style={[styles.name, { color: semantic.text.primary }]}>
                  {r.org?.name ?? '(unknown org)'}
                </Text>
                {r.org?.issue_area && (
                  <Text style={[styles.issueArea, { color: semantic.text.muted }]}>
                    · {r.org.issue_area}
                  </Text>
                )}
              </View>
              <Text style={[styles.score, { color: semantic.text.primary }]}>
                {Number(r.score).toFixed(0)} / {r.org?.scoring_max ?? 100}
              </Text>
            </View>
          )
        })}
      </View>
    )
  }

  const byLean = new Map<string, ScorecardRatingWithOrg[]>()
  for (const r of rows) {
    const lean = r.org?.lean ?? 'centrist'
    if (!byLean.has(lean)) byLean.set(lean, [])
    byLean.get(lean)!.push(r)
  }

  return (
    <View style={styles.list}>
      {LEAN_GROUP_ORDER.filter((l) => byLean.has(l)).map((lean) => (
        <View key={lean} style={styles.group}>
          <Text style={[styles.groupHeader, { color: leanColors[lean] ?? semantic.text.muted }]}>
            {SCORECARD_LEAN_LABEL[lean as keyof typeof SCORECARD_LEAN_LABEL] ?? lean}
          </Text>
          {byLean.get(lean)!.map((r) => (
            <View key={r.id} style={[styles.row, { backgroundColor: semantic.bg.app }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: semantic.text.primary }]}>
                  {r.org?.name ?? '(unknown org)'}
                </Text>
                {r.org?.issue_area && (
                  <Text style={[styles.issueArea, { color: semantic.text.muted }]}>
                    · {r.org.issue_area}
                  </Text>
                )}
              </View>
              <Text style={[styles.score, { color: semantic.text.primary }]}>
                {Number(r.score).toFixed(0)} / {r.org?.scoring_max ?? 100}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 10, padding: 8 },
  group: { gap: 4 },
  groupHeader: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 8,
    gap: 8,
    marginBottom: 4,
  },
  name: { fontSize: 13 },
  issueArea: { fontSize: 12, marginTop: 2 },
  score: { fontSize: 13, fontWeight: '600', alignSelf: 'center' },
})
