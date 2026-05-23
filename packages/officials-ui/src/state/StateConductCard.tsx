'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useOfficialStateEthicsComplaints,
  useOfficialStateOfficialEvents,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'
import { StateEthicsComplaintsList } from './StateEthicsComplaintsList.tsx'
import { StateOfficialEventsList } from './StateOfficialEventsList.tsx'

export interface StateConductCardProps {
  officialId: string
}

export function StateConductCard({
  officialId,
}: StateConductCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const complaints = useOfficialStateEthicsComplaints(client, officialId)
  const events = useOfficialStateOfficialEvents(client, officialId)

  const [openComplaints, setOpenComplaints] = useState(false)
  const [openEvents, setOpenEvents] = useState(false)

  if (complaints.isLoading || events.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Conduct & Sanctions</Text>
        <Text style={styles.muted}>Loading conduct records…</Text>
      </View>
    )
  }

  // Header counts: per NULL-vs-0 convention — em-dash when unknown,
  // numeric (incl. 0) when known.
  const complaintCount = complaints.data?.length ?? null
  const openCount = complaints.data?.filter(r => r.status === 'open').length ?? 0
  const eventCount = events.data?.length ?? null
  const allEmpty = complaintCount === 0 && eventCount === 0

  if (allEmpty) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Conduct & Sanctions</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No ethics complaints or conduct events on record for this legislator.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Conduct & Sanctions</Text>
      <Text style={styles.summary}>
        {complaintCount != null
          ? `${complaintCount} complaint${complaintCount === 1 ? '' : 's'} (${openCount} open)`
          : '—'}
        {' · '}
        {eventCount != null ? `${eventCount} event${eventCount === 1 ? '' : 's'}` : '—'}
      </Text>

      <Subsection
        label={`Ethics complaints (${complaintCount ?? '—'})`}
        open={openComplaints}
        onToggle={() => setOpenComplaints(v => !v)}
      >
        <StateEthicsComplaintsList rows={complaints.data ?? []} />
      </Subsection>

      <Subsection
        label={`Sanctions / recall / resignation (${eventCount ?? '—'})`}
        open={openEvents}
        onToggle={() => setOpenEvents(v => !v)}
      >
        <StateOfficialEventsList rows={events.data ?? []} />
      </Subsection>
    </View>
  )
}

function Subsection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <View style={styles.subsection}>
      <Pressable onPress={onToggle}>
        <Text style={styles.subsectionLabel}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open ? <View>{children}</View> : null}
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
  subsection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral.border,
    paddingTop: 8,
  },
  subsectionLabel: {
    color: COLORS.brand.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 6,
  },
})
