'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { Database } from '@chiaro/db'
import { useBrandTokens } from '../brand-hooks.ts'

type OfficeRow = Database['public']['Tables']['district_offices']['Row']

export interface FederalDistrictOfficesListProps {
  rows: OfficeRow[]
}

/**
 * Federal `district_offices` schema (migration 0011) holds only address /
 * city / state / zip / phone / source_url — NO `kind` column and NO
 * `hours_text` (those are state-only on `state_district_offices`). All rows
 * render uniformly.
 */
export function FederalDistrictOfficesList({ rows }: FederalDistrictOfficesListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No district offices on file.
      </Text>
    )
  }
  return (
    <View style={styles.list}>
      {rows.map(r => (
        <View key={r.id} style={styles.row}>
          <Text style={[styles.title, { color: semantic.text.primary }]}>
            District Office · {r.city}, {r.state}
          </Text>
          <Text style={[styles.meta, { color: semantic.text.muted }]}>
            {r.address}
            {r.zip ? ` ${r.zip}` : ''}
            {r.phone ? `\n${r.phone}` : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 10, padding: 8 },
  row: {},
  title: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
})
