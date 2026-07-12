'use client'

import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useOfficialLeadershipHistory, useOfficialMetrics } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { FederalKPIList } from './FederalKPIList.tsx'
import { FederalLeadershipList } from './FederalLeadershipList.tsx'

export interface FederalServiceRecordCardProps {
  officialId: string
  /** Senate guard — hides the "Lives in district" KPI tile. */
  hideLivesInDistrict?: boolean
}

export function FederalServiceRecordCard({
  officialId,
  hideLivesInDistrict,
}: FederalServiceRecordCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const metrics = useOfficialMetrics(client, officialId)
  const leadership = useOfficialLeadershipHistory(client, officialId)
  const { semantic } = useBrandTokens()

  const [openLeadership, setOpenLeadership] = useState(false)

  const m = metrics.data ?? null
  const leadCount = leadership.data?.length ?? null
  const allEmpty = !m && (leadCount === 0 || leadCount === null)

  const sponsored = m?.bills_sponsored_count ?? null
  const cosponsored = m?.bills_cosponsored_count ?? null
  const attendance = m?.attendance_pct ?? null

  return (
    <DetailCardShell
      title="Service Record"
      isLoading={metrics.isLoading || leadership.isLoading}
      isError={metrics.isError || leadership.isError}
      onRetry={() => {
        void metrics.refetch()
        void leadership.refetch()
      }}
      isEmpty={allEmpty}
      emptyText="No service record data on file for this legislator."
    >
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
        {sponsored != null ? `${sponsored} bill${sponsored === 1 ? '' : 's'} sponsored` : '—'}
        {' · '}
        {cosponsored != null ? `${cosponsored} cosponsored` : '—'}
        {' · '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </Text>

      {/* Always-visible KPI tiles */}
      <FederalKPIList metrics={m} {...(hideLivesInDistrict ? { hideLivesInDistrict: true } : {})} />

      {/* Collapsible Leadership subsection */}
      <CardSubsection
        label={`Leadership history (${leadCount ?? '—'})`}
        open={openLeadership}
        onToggle={() => setOpenLeadership((v) => !v)}
      >
        <FederalLeadershipList rows={leadership.data ?? []} />
      </CardSubsection>
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, marginBottom: 12 },
})
