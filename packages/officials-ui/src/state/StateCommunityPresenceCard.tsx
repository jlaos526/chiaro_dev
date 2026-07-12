'use client'

import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import {
  useOfficialStateCommitteeHearings,
  useOfficialStateDistrictOffices,
  useOfficialStateTownHalls,
} from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
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
  const { semantic } = useBrandTokens()
  const halls = useOfficialStateTownHalls(client, officialId)
  const offices = useOfficialStateDistrictOffices(client, officialId)
  const hearings = useOfficialStateCommitteeHearings(client, officialId)

  const [openHalls, setOpenHalls] = useState(false)
  const [openHearings, setOpenHearings] = useState(false)
  const [openOffices, setOpenOffices] = useState(false)

  // Header counts: per NULL-vs-0 convention — em-dash when unknown
  // (data === undefined), numeric (including 0) when known.
  const hallCount = halls.data?.length ?? null
  const officeCount = offices.data?.length ?? null
  const hearingCount = hearings.data?.length ?? null

  const allEmpty = (hallCount ?? 0) === 0 && (officeCount ?? 0) === 0 && (hearingCount ?? 0) === 0

  return (
    <DetailCardShell
      title="Community Presence"
      isLoading={halls.isLoading || offices.isLoading || hearings.isLoading}
      isError={halls.isError || offices.isError || hearings.isError}
      onRetry={() => {
        void halls.refetch()
        void offices.refetch()
        void hearings.refetch()
      }}
      isEmpty={allEmpty}
      emptyText="No community-presence data available for this legislator yet."
    >
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
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
        onToggle={() => setOpenHalls((v) => !v)}
      >
        <StateTownHallsList rows={halls.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`Committee hearings attended (${hearingCount ?? '—'})`}
        open={openHearings}
        onToggle={() => setOpenHearings((v) => !v)}
      >
        <StateCommitteeHearingsList rows={hearings.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`District offices (${officeCount ?? '—'})`}
        open={openOffices}
        onToggle={() => setOpenOffices((v) => !v)}
      >
        <StateDistrictOfficesList rows={offices.data ?? []} />
      </CardSubsection>
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, marginBottom: 12 },
})
