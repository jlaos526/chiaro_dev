'use client'

import { StyleSheet, Text } from 'react-native'
import type { StateDistrictOfficeRow } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { EventRowList } from '../cards/EventRowList.tsx'

/** State-only office `kind` labels — federal `district_offices` has no kind column. */
const KIND_LABEL: Record<string, string> = {
  district: 'District Office',
  satellite: 'Satellite Office',
  capitol: 'Capitol Office',
}

export interface StateDistrictOfficesListProps {
  rows: StateDistrictOfficeRow[]
}

/**
 * Thin wrapper over `EventRowList` (slice 80, audit C25). `urlOf` returns
 * null on purpose: this list never rendered rows as links, and the generic's
 * null-url path keeps them plain non-interactive Views. The state schema's
 * extra `kind` / `hours_text` fields (absent federally) map into the title
 * and meta line.
 */
export function StateDistrictOfficesList({
  rows,
}: StateDistrictOfficesListProps): React.JSX.Element {
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
      titleOf={(r) => `${KIND_LABEL[r.kind] ?? r.kind} · ${r.city}, ${r.state}`}
      metaOf={(r) => [
        `${r.street_1}${r.street_2 ? `, ${r.street_2}` : ''}${
          r.postal_code ? `, ${r.postal_code}` : ''
        }${r.phone ? `\n${r.phone}` : ''}${r.hours_text ? `\nHours: ${r.hours_text}` : ''}`,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
})
