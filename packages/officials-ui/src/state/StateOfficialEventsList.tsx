'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateOfficialEventRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

const TYPE_LABEL: Record<string, string> = {
  recall_attempt:             'Recall attempt',
  recall_succeeded:           'Recall succeeded',
  recall_failed:              'Recall failed',
  resignation:                'Resignation',
  censure:                    'Censure',
  expulsion:                  'Expulsion',
  campaign_finance_violation: 'Finance violation',
}

function typeColor(type: string, mutedFallback: string): string {
  if (type === 'expulsion' || type === 'recall_succeeded') return COLORS.signal.error
  if (type === 'censure' || type === 'campaign_finance_violation') return COLORS.signal.warning
  if (type === 'recall_failed') return COLORS.signal.success
  return mutedFallback
}

export interface StateOfficialEventsListProps {
  rows: StateOfficialEventRow[]
}

export function StateOfficialEventsList({
  rows,
}: StateOfficialEventsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const rowStyle = [styles.row, { backgroundColor: semantic.bg.elevated }]
  const dateStyle = [styles.date, { color: semantic.text.primary }]
  const summaryStyle = [styles.summary, { color: semantic.text.primary }]
  const outcomeStyle = [styles.outcome, { color: semantic.text.muted }]

  if (rows.length === 0) {
    return <Text style={mutedStyle}>No sanctions or tenure events on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => {
        const color = typeColor(r.event_type, semantic.text.muted)
        return (
          <Pressable
            key={r.id}
            onPress={() => Linking.openURL(r.source_url).catch(() => {})}
            style={rowStyle}
          >
            <View style={styles.headerRow}>
              <Text style={dateStyle}>{r.event_date}</Text>
              <Text style={[styles.chip, { color, backgroundColor: `${color}22` }]}>
                {TYPE_LABEL[r.event_type] ?? r.event_type}
              </Text>
            </View>
            <Text style={summaryStyle}>{r.summary}</Text>
            {r.outcome && <Text style={outcomeStyle}>{r.outcome}</Text>}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: { borderRadius: 6, padding: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  date: { fontWeight: '500', fontSize: 13 },
  chip: {
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  summary: { fontSize: 12 },
  outcome: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
})
