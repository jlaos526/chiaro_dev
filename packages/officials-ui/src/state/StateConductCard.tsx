'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useOfficialStateEthicsComplaints, useOfficialStateOfficialEvents } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
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

  const cardStyle = [
    styles.card,
    { backgroundColor: semantic.bg.app, borderColor: semantic.border.default },
  ]
  const titleStyle = [styles.title, { color: semantic.text.primary }]
  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const summaryStyle = [styles.summary, { color: semantic.text.muted }]

  if (complaints.isLoading || events.isLoading) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
          Conduct & Sanctions
        </Text>
        <Text style={mutedStyle}>Loading conduct records…</Text>
      </View>
    )
  }

  // Header counts: per NULL-vs-0 convention — em-dash when unknown,
  // numeric (incl. 0) when known.
  const complaintCount = complaints.data?.length ?? null
  const openCount = complaints.data?.filter((r) => r.status === 'open').length ?? 0
  const eventCount = events.data?.length ?? null
  const allEmpty = (complaintCount ?? 0) === 0 && (eventCount ?? 0) === 0

  if (allEmpty) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
          Conduct & Sanctions
        </Text>
        <Text style={[mutedStyle, { fontStyle: 'italic' }]}>
          No ethics complaints or conduct events on record for this legislator.
        </Text>
      </View>
    )
  }

  return (
    <View style={cardStyle}>
      <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
        Conduct & Sanctions
      </Text>
      <Text style={summaryStyle}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
})
