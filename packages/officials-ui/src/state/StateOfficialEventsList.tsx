'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateOfficialEventRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const TYPE_LABEL: Record<string, string> = {
  recall_attempt:             'Recall attempt',
  recall_succeeded:           'Recall succeeded',
  recall_failed:              'Recall failed',
  resignation:                'Resignation',
  censure:                    'Censure',
  expulsion:                  'Expulsion',
  campaign_finance_violation: 'Finance violation',
}

function typeColor(type: string): string {
  if (type === 'expulsion' || type === 'recall_succeeded') return COLORS.signal.error
  if (type === 'censure' || type === 'campaign_finance_violation') return COLORS.signal.warning
  if (type === 'recall_failed') return COLORS.signal.success
  return COLORS.neutral.textMuted
}

export interface StateOfficialEventsListProps {
  rows: StateOfficialEventRow[]
}

export function StateOfficialEventsList({
  rows,
}: StateOfficialEventsListProps): React.JSX.Element {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No sanctions or tenure events on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => {
        const color = typeColor(r.event_type)
        return (
          <Pressable
            key={r.id}
            onPress={() => Linking.openURL(r.source_url).catch(() => {})}
            style={styles.row}
          >
            <View style={styles.headerRow}>
              <Text style={styles.date}>{r.event_date}</Text>
              <Text style={[styles.chip, { color, backgroundColor: `${color}22` }]}>
                {TYPE_LABEL[r.event_type] ?? r.event_type}
              </Text>
            </View>
            <Text style={styles.summary}>{r.summary}</Text>
            {r.outcome && <Text style={styles.outcome}>{r.outcome}</Text>}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: { backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  date: { fontWeight: '500', color: COLORS.brand.text, fontSize: 13 },
  chip: {
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  summary: { fontSize: 12, color: COLORS.brand.text },
  outcome: {
    fontSize: 12,
    color: COLORS.neutral.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
})
