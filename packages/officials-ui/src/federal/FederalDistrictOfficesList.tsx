'use client'

import { StyleSheet, Text } from 'react-native'
import type { Database } from '@chiaro/db'
import { useBrandTokens } from '../brand-hooks.ts'
import { EventRowList } from '../cards/EventRowList.tsx'

type OfficeRow = Database['public']['Tables']['district_offices']['Row']

export interface FederalDistrictOfficesListProps {
  rows: OfficeRow[]
}

/**
 * Federal `district_offices` schema (migration 0011) holds only address /
 * city / state / zip / phone / source_url — NO `kind` column and NO
 * `hours_text` (those are state-only on `state_district_offices`). All rows
 * render uniformly.
 *
 * Thin wrapper over `EventRowList` (slice 80, audit C25). `urlOf` returns
 * null on purpose: this list never rendered rows as links, and the generic's
 * null-url path keeps them plain non-interactive Views.
 */
export function FederalDistrictOfficesList({
  rows,
}: FederalDistrictOfficesListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No district offices on file.
      </Text>
    )
  }
  return (
    <EventRowList
      rows={rows}
      keyOf={(r) => r.id}
      urlOf={() => null}
      titleOf={(r) => `District Office · ${r.city}, ${r.state}`}
      metaOf={(r) => [`${r.address}${r.zip ? ` ${r.zip}` : ''}${r.phone ? `\n${r.phone}` : ''}`]}
    />
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
})
