'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  useOfficialStateCommitteeHearings,
  useOfficialStateDistrictOffices,
  useOfficialStateTownHalls,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { StateCommitteeHearingsList } from './StateCommitteeHearingsList.tsx'
import { StateDistrictOfficesList } from './StateDistrictOfficesList.tsx'
import { StateTownHallsList } from './StateTownHallsList.tsx'

export interface StateCommunityPresenceCardProps {
  officialId: string
}

export function StateCommunityPresenceCard({
  officialId,
}: StateCommunityPresenceCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const halls = useOfficialStateTownHalls(client, officialId)
  const offices = useOfficialStateDistrictOffices(client, officialId)
  const hearings = useOfficialStateCommitteeHearings(client, officialId)

  const [openHalls, setOpenHalls] = useState(false)
  const [openHearings, setOpenHearings] = useState(false)
  const [openOffices, setOpenOffices] = useState(false)

  if (halls.isLoading || offices.isLoading || hearings.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Community Presence</Text>
        <Text style={styles.muted}>Loading community presence…</Text>
      </View>
    )
  }

  // Header counts: per NULL-vs-0 convention — em-dash when unknown
  // (data === undefined), numeric (including 0) when known.
  const hallCount = halls.data?.length ?? null
  const officeCount = offices.data?.length ?? null
  const hearingCount = hearings.data?.length ?? null

  const allEmpty = hallCount === 0 && officeCount === 0 && hearingCount === 0

  if (allEmpty) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Community Presence</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No community-presence data available for this legislator yet.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Community Presence</Text>

      <Text style={styles.summary}>
        {hallCount != null ? `${hallCount} town hall${hallCount === 1 ? '' : 's'}` : '—'}
        {' · '}
        {hearingCount != null
          ? `${hearingCount} hearing${hearingCount === 1 ? '' : 's'} attended`
          : '—'}
        {' · '}
        {officeCount != null ? `${officeCount} office${officeCount === 1 ? '' : 's'}` : '—'}
      </Text>

      <CardSubsection
        label={`Town halls (${hallCount ?? '—'})`}
        open={openHalls}
        onToggle={() => setOpenHalls(v => !v)}
      >
        <StateTownHallsList rows={halls.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`Committee hearings attended (${hearingCount ?? '—'})`}
        open={openHearings}
        onToggle={() => setOpenHearings(v => !v)}
      >
        <StateCommitteeHearingsList rows={hearings.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`District offices (${officeCount ?? '—'})`}
        open={openOffices}
        onToggle={() => setOpenOffices(v => !v)}
      >
        <StateDistrictOfficesList rows={offices.data ?? []} />
      </CardSubsection>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.neutral.background,
    borderColor: COLORS.neutral.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: COLORS.brand.text },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
})
