'use client'

import { StyleSheet, Text } from 'react-native'
import type { Database } from '@chiaro/db'
import { useBrandTokens } from '../brand-hooks.ts'
import { EventRowList, FORMAT_LABEL } from '../cards/EventRowList.tsx'

type TownHallRow = Database['public']['Tables']['town_halls']['Row']

export interface FederalTownHallsListProps {
  rows: TownHallRow[]
}

/**
 * Thin wrapper over `EventRowList` (slice 80, audit C25) — the format map
 * lives in the shared `FORMAT_LABEL` next to the generic; this list only
 * owns its empty copy and the row-field mapping.
 */
export function FederalTownHallsList({ rows }: FederalTownHallsListProps): React.JSX.Element {
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
      urlOf={(r) => r.source_url}
      titleOf={(r) =>
        `${r.event_date}${r.city ? ` · ${r.city}, ${r.state ?? ''}` : r.state ? ` · ${r.state}` : ''}`
      }
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
