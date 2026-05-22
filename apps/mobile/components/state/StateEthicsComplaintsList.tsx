import { View, Text, StyleSheet } from 'react-native'
import type { StateEthicsComplaintRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  dismissed: 'Dismissed',
  settled: 'Settled',
  sanctioned: 'Sanctioned',
  closed_no_action: 'Closed (no action)',
}

function statusColor(status: string): string {
  if (status === 'open') return COLORS.signal.warning
  if (status === 'sanctioned') return COLORS.signal.error
  if (status === 'dismissed' || status === 'closed_no_action') return COLORS.signal.success
  return COLORS.neutral.textMuted
}

interface Props {
  rows: StateEthicsComplaintRow[]
}

export function StateEthicsComplaintsList({ rows }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No ethics complaints on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => {
        const color = statusColor(r.status)
        return (
          <View key={r.id} style={styles.row}>
            <View style={styles.headerRow}>
              <Text style={styles.date}>{r.complaint_date}</Text>
              <Text
                style={[
                  styles.chip,
                  { color, backgroundColor: `${color}22` },
                ]}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </Text>
            </View>
            <Text style={styles.summary}>{r.summary}</Text>
            {r.disposition && (
              <Text style={styles.disposition}>Disposition: {r.disposition}</Text>
            )}
          </View>
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
  disposition: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 4, fontStyle: 'italic' },
})
