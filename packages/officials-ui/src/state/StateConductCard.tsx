'use client'

import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useOfficialStateEthicsComplaints, useOfficialStateOfficialEvents } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { StateEthicsComplaintsList } from './StateEthicsComplaintsList.tsx'
import { StateOfficialEventsList } from './StateOfficialEventsList.tsx'

export interface StateConductCardProps {
  officialId: string
}

export function StateConductCard({ officialId }: StateConductCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const { semantic } = useBrandTokens()
  const complaints = useOfficialStateEthicsComplaints(client, officialId)
  const events = useOfficialStateOfficialEvents(client, officialId)

  const [openComplaints, setOpenComplaints] = useState(false)
  const [openEvents, setOpenEvents] = useState(false)

  // Header counts: per NULL-vs-0 convention — em-dash when unknown,
  // numeric (incl. 0) when known.
  const complaintCount = complaints.data?.length ?? null
  const openCount = complaints.data?.filter((r) => r.status === 'open').length ?? 0
  const eventCount = events.data?.length ?? null
  const allEmpty = (complaintCount ?? 0) === 0 && (eventCount ?? 0) === 0

  return (
    <DetailCardShell
      title="Conduct & Sanctions"
      isLoading={complaints.isLoading || events.isLoading}
      isError={complaints.isError || events.isError}
      onRetry={() => {
        void complaints.refetch()
        void events.refetch()
      }}
      isEmpty={allEmpty}
      emptyText="No ethics complaints or conduct events on record for this legislator."
    >
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
        {complaintCount != null
          ? `${complaintCount} complaint${complaintCount === 1 ? '' : 's'} (${openCount} open)`
          : '—'}
        {' · '}
        {eventCount != null ? `${eventCount} event${eventCount === 1 ? '' : 's'}` : '—'}
      </Text>

      <CardSubsection
        label={`Ethics complaints (${complaintCount ?? '—'})`}
        open={openComplaints}
        onToggle={() => setOpenComplaints((v) => !v)}
      >
        <StateEthicsComplaintsList rows={complaints.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`Sanctions / recall / resignation (${eventCount ?? '—'})`}
        open={openEvents}
        onToggle={() => setOpenEvents((v) => !v)}
      >
        <StateOfficialEventsList rows={events.data ?? []} />
      </CardSubsection>
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, marginBottom: 12 },
})
