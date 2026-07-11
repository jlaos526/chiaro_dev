'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { StateEthicsComplaintRow } from '@chiaro/officials'
import type { BrandSemantic } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  dismissed: 'Dismissed',
  settled: 'Settled',
  sanctioned: 'Sanctioned',
  closed_no_action: 'Closed (no action)',
}

function statusColor(status: string, semantic: BrandSemantic): string {
  if (status === 'open') return semantic.alert.warning.fg
  if (status === 'sanctioned') return semantic.alert.danger.fg
  if (status === 'dismissed' || status === 'closed_no_action') return semantic.alert.success.fg
  return semantic.text.muted
}

export interface StateEthicsComplaintsListProps {
  rows: StateEthicsComplaintRow[]
}

export function StateEthicsComplaintsList({
  rows,
}: StateEthicsComplaintsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()

  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const rowStyle = [styles.row, { backgroundColor: semantic.bg.elevated }]
  const dateStyle = [styles.date, { color: semantic.text.primary }]
  const summaryStyle = [styles.summary, { color: semantic.text.primary }]
  const dispositionStyle = [styles.disposition, { color: semantic.text.muted }]

  if (rows.length === 0) {
    return <Text style={mutedStyle}>No ethics complaints on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map((r) => {
        const color = statusColor(r.status, semantic)
        return (
          <View key={r.id} style={rowStyle}>
            <View style={styles.headerRow}>
              <Text style={dateStyle}>{r.complaint_date}</Text>
              <Text style={[styles.chip, { color, backgroundColor: `${color}22` }]}>
                {STATUS_LABEL[r.status] ?? r.status}
              </Text>
            </View>
            <Text style={summaryStyle}>{r.summary}</Text>
            {r.disposition && <Text style={dispositionStyle}>Disposition: {r.disposition}</Text>}
          </View>
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
  disposition: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
})
