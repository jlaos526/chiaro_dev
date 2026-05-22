import { useState } from 'react'
import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import {
  useOfficialStateTownHalls,
  useOfficialStateDistrictOffices,
  useOfficialStateCommitteeHearings,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateTownHallsList } from './StateTownHallsList'
import { StateCommitteeHearingsList } from './StateCommitteeHearingsList'
import { StateDistrictOfficesList } from './StateDistrictOfficesList'

interface Props {
  officialId: string
}

export function StateCommunityPresenceCard({ officialId }: Props) {
  const halls = useOfficialStateTownHalls(supabase, officialId)
  const offices = useOfficialStateDistrictOffices(supabase, officialId)
  const hearings = useOfficialStateCommitteeHearings(supabase, officialId)

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
        {hallCount != null ? `${hallCount} town hall${hallCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {hearingCount != null
          ? `${hearingCount} hearing${hearingCount === 1 ? '' : 's'} attended`
          : '—'}{' '}
        ·{' '}
        {officeCount != null ? `${officeCount} office${officeCount === 1 ? '' : 's'}` : '—'}
      </Text>

      <Subsection
        label={`Town halls (${hallCount ?? '—'})`}
        open={openHalls}
        onToggle={() => setOpenHalls(v => !v)}
      >
        <StateTownHallsList rows={halls.data ?? []} />
      </Subsection>

      <Subsection
        label={`Committee hearings attended (${hearingCount ?? '—'})`}
        open={openHearings}
        onToggle={() => setOpenHearings(v => !v)}
      >
        <StateCommitteeHearingsList rows={hearings.data ?? []} />
      </Subsection>

      <Subsection
        label={`District offices (${officeCount ?? '—'})`}
        open={openOffices}
        onToggle={() => setOpenOffices(v => !v)}
      >
        <StateDistrictOfficesList rows={offices.data ?? []} />
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
}) {
  return (
    <View style={styles.subsection}>
      <Pressable onPress={onToggle}>
        <Text style={styles.subsectionLabel}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open && <View>{children}</View>}
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.brand.text,
  },
  muted: {
    color: COLORS.neutral.textMuted,
    fontSize: 13,
  },
  summary: {
    fontSize: 13,
    color: COLORS.neutral.textMuted,
    marginBottom: 12,
  },
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
