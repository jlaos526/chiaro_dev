'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { ScorecardRatingWithOrg } from '@chiaro/officials'
import { SCORECARD_LEAN_LABEL, SCORECARD_LEAN_COLOR } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

export interface FederalScorecardRatingsListProps {
  rows: ScorecardRatingWithOrg[]
}

const LEAN_GROUP_ORDER = ['progressive', 'conservative', 'single-issue', 'libertarian', 'centrist'] as const

export function FederalScorecardRatingsList({ rows }: FederalScorecardRatingsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No scorecard ratings on file.
      </Text>
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
      {LEAN_GROUP_ORDER.filter(l => byLean.has(l)).map(lean => (
        <View key={lean} style={styles.group}>
          <Text
            style={[
              styles.groupHeader,
              { color: SCORECARD_LEAN_COLOR[lean as keyof typeof SCORECARD_LEAN_COLOR] ?? semantic.text.muted },
            ]}
          >
            {SCORECARD_LEAN_LABEL[lean as keyof typeof SCORECARD_LEAN_LABEL] ?? lean}
          </Text>
          {byLean.get(lean)!.map(r => (
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
