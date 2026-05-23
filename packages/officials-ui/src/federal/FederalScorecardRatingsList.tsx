'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { ScorecardRatingWithOrg } from '@chiaro/officials'
import { COLORS, SCORECARD_LEAN_LABEL, SCORECARD_LEAN_COLOR } from '@chiaro/ui-tokens'

export interface FederalScorecardRatingsListProps {
  rows: ScorecardRatingWithOrg[]
}

const LEAN_GROUP_ORDER = ['progressive', 'conservative', 'single-issue', 'libertarian', 'centrist'] as const

export function FederalScorecardRatingsList({ rows }: FederalScorecardRatingsListProps): React.JSX.Element {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No scorecard ratings on file.</Text>
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
              { color: SCORECARD_LEAN_COLOR[lean as keyof typeof SCORECARD_LEAN_COLOR] ?? COLORS.neutral.textMuted },
            ]}
          >
            {SCORECARD_LEAN_LABEL[lean as keyof typeof SCORECARD_LEAN_LABEL] ?? lean}
          </Text>
          {byLean.get(lean)!.map(r => (
            <View key={r.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.org?.name ?? '(unknown org)'}</Text>
                {r.org?.issue_area && (
                  <Text style={styles.issueArea}>· {r.org.issue_area}</Text>
                )}
              </View>
              <Text style={styles.score}>
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
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 10, padding: 8 },
  group: { gap: 4 },
  groupHeader: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 6,
    padding: 8,
    gap: 8,
    marginBottom: 4,
  },
  name: { fontSize: 13, color: COLORS.brand.text },
  issueArea: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
  score: { fontSize: 13, fontWeight: '600', color: COLORS.brand.text, alignSelf: 'center' },
})
