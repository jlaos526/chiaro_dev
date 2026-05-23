'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  useOfficialLeadershipHistory,
  useOfficialMetrics,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { CardSubsection } from '../cards/CardSubsection.tsx'
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

  const [openLeadership, setOpenLeadership] = useState(false)

  if (metrics.isLoading || leadership.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Service Record</Text>
        <Text style={styles.muted}>Loading service record…</Text>
      </View>
    )
  }

  const m = metrics.data ?? null
  const leadCount = leadership.data?.length ?? null
  const allEmpty = !m && (leadCount === 0 || leadCount === null)

  if (allEmpty) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Service Record</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No service record data on file for this legislator.
        </Text>
      </View>
    )
  }

  const sponsored = m?.bills_sponsored_count ?? null
  const cosponsored = m?.bills_cosponsored_count ?? null
  const attendance = m?.attendance_pct ?? null

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Service Record</Text>
      <Text style={styles.summary}>
        {sponsored != null ? `${sponsored} bill${sponsored === 1 ? '' : 's'} sponsored` : '—'}
        {' · '}
        {cosponsored != null ? `${cosponsored} cosponsored` : '—'}
        {' · '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </Text>

      {/* Always-visible KPI tiles */}
      <FederalKPIList
        metrics={m}
        {...(hideLivesInDistrict ? { hideLivesInDistrict: true } : {})}
      />

      {/* Collapsible Leadership subsection */}
      <CardSubsection
        label={`Leadership history (${leadCount ?? '—'})`}
        open={openLeadership}
        onToggle={() => setOpenLeadership(v => !v)}
      >
        <FederalLeadershipList rows={leadership.data ?? []} />
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.brand.text,
  },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
})
