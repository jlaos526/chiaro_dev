'use client'

import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useOfficialDistrictOffices, useOfficialTownHalls } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
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
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const offices = useOfficialDistrictOffices(client, officialId)
  const halls = useOfficialTownHalls(client, officialId, congress)

  const [openHalls, setOpenHalls] = useState(false)
  const [openOffices, setOpenOffices] = useState(false)

  const hallsCount = halls.data?.length ?? 0
  // Federal `district_offices` lacks `kind` column — count all rows uniformly.
  const officesCount = offices.data?.length ?? 0

  return (
    <DetailCardShell
      title="Community Presence"
      isLoading={offices.isLoading || halls.isLoading}
      isError={offices.isError || halls.isError}
      onRetry={() => {
        void offices.refetch()
        void halls.refetch()
      }}
      isEmpty={hallsCount === 0 && officesCount === 0}
      emptyText="No community-presence data available for this legislator yet."
    >
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
        {`${hallsCount} town hall${hallsCount === 1 ? '' : 's'}`}
        {' · '}
        {`${officesCount} office${officesCount === 1 ? '' : 's'}`}
      </Text>

      <CardSubsection
        label={`Town halls (${hallsCount})`}
        open={openHalls}
        onToggle={() => setOpenHalls((v) => !v)}
      >
        <FederalTownHallsList rows={halls.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`District offices (${officesCount})`}
        open={openOffices}
        onToggle={() => setOpenOffices((v) => !v)}
      >
        <FederalDistrictOfficesList rows={offices.data ?? []} />
      </CardSubsection>
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, marginBottom: 12 },
})
