'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  useOfficialDistrictOffices,
  useOfficialTownHalls,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { FederalDistrictOfficesList } from './FederalDistrictOfficesList.tsx'
import { FederalTownHallsList } from './FederalTownHallsList.tsx'

export interface FederalCommunityPresenceCardProps {
  officialId: string
  /** Congress number, e.g. '119'. */
  congress: string
}

export function FederalCommunityPresenceCard({
  officialId,
  congress,
}: FederalCommunityPresenceCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const offices = useOfficialDistrictOffices(client, officialId)
  const halls = useOfficialTownHalls(client, officialId, congress)

  const [openHalls, setOpenHalls] = useState(false)
  const [openOffices, setOpenOffices] = useState(false)

  if (offices.isLoading || halls.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Community Presence</Text>
        <Text style={styles.muted}>Loading community presence…</Text>
      </View>
    )
  }

  const hallsCount = halls.data?.length ?? 0
  // Federal `district_offices` lacks `kind` column — count all rows uniformly.
  const officesCount = offices.data?.length ?? 0
  const allEmpty = hallsCount === 0 && officesCount === 0

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
        {`${hallsCount} town hall${hallsCount === 1 ? '' : 's'}`}
        {' · '}
        {`${officesCount} office${officesCount === 1 ? '' : 's'}`}
      </Text>

      <CardSubsection
        label={`Town halls (${hallsCount})`}
        open={openHalls}
        onToggle={() => setOpenHalls(v => !v)}
      >
        <FederalTownHallsList rows={halls.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`District offices (${officesCount})`}
        open={openOffices}
        onToggle={() => setOpenOffices(v => !v)}
      >
        <FederalDistrictOfficesList rows={offices.data ?? []} />
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
