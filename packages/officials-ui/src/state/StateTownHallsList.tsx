'use client'

import { StyleSheet, Text } from 'react-native'
import type { StateTownHallRow } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { EventRowList, FORMAT_LABEL } from '../cards/EventRowList.tsx'

export interface StateTownHallsListProps {
  rows: StateTownHallRow[]
}

/**
 * Thin wrapper over `EventRowList` (slice 80, audit C25) — the format map
 * lives in the shared `FORMAT_LABEL` next to the generic; this list only
 * owns its empty copy and the row-field mapping. The slice-57 B6 null
 * `source_url` guard now lives in the generic's `urlOf` path.
 */
export function StateTownHallsList({ rows }: StateTownHallsListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No town halls in the past 12 months.
      </Text>
    )
  }
  return (
    <EventRowList
      rows={rows}
      keyOf={(r) => r.id}
      urlOf={(r) => r.source_url ?? null}
      titleOf={(r) => `${r.event_date}${r.city ? ` · ${r.city}, ${r.state}` : ` · ${r.state}`}`}
      metaOf={(r) => [
        `${r.format ? (FORMAT_LABEL[r.format] ?? r.format) : 'Format n/a'}${
          r.attendance_estimate != null ? ` · ~${r.attendance_estimate} attendees` : ''
        }`,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
})
