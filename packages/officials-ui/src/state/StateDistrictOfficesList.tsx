'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { StateDistrictOfficeRow } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'

const KIND_LABEL: Record<string, string> = {
  district:  'District Office',
  satellite: 'Satellite Office',
  capitol:   'Capitol Office',
}

export interface StateDistrictOfficesListProps {
  rows: StateDistrictOfficeRow[]
}

export function StateDistrictOfficesList({
  rows,
}: StateDistrictOfficesListProps): React.JSX.Element {
  if (rows.length === 0) {
    return <Text style={styles.muted}>No district offices on file.</Text>
  }
  return (
    <View style={styles.list}>
      {rows.map(r => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.title}>
            {KIND_LABEL[r.kind] ?? r.kind} · {r.city}, {r.state}
          </Text>
          <Text style={styles.meta}>
            {r.street_1}
            {r.street_2 ? `, ${r.street_2}` : ''}
            {r.postal_code ? `, ${r.postal_code}` : ''}
            {r.phone ? `\n${r.phone}` : ''}
            {r.hours_text ? `\nHours: ${r.hours_text}` : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 10, padding: 8 },
  row: {},
  title: { fontSize: 13, fontWeight: '600', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 },
})
