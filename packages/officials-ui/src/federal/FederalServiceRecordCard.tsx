'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useOfficialLeadershipHistory, useOfficialMetrics } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
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
  const { semantic } = useBrandTokens()

  const [openLeadership, setOpenLeadership] = useState(false)

  const cardStyle = [
    styles.card,
    { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
  ]
  const titleStyle = [styles.title, { color: semantic.text.primary }]
  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const summaryStyle = [styles.summary, { color: semantic.text.muted }]

  if (metrics.isLoading || leadership.isLoading) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
          Service Record
        </Text>
        <Text style={mutedStyle}>Loading service record…</Text>
      </View>
    )
  }

  const m = metrics.data ?? null
  const leadCount = leadership.data?.length ?? null
  const allEmpty = !m && (leadCount === 0 || leadCount === null)

  if (allEmpty) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
          Service Record
        </Text>
        <Text style={[styles.muted, { color: semantic.text.muted, fontStyle: 'italic' }]}>
          No service record data on file for this legislator.
        </Text>
      </View>
    )
  }

  const sponsored = m?.bills_sponsored_count ?? null
  const cosponsored = m?.bills_cosponsored_count ?? null
  const attendance = m?.attendance_pct ?? null

  return (
    <View style={cardStyle}>
      <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
        Service Record
      </Text>
      <Text style={summaryStyle}>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
})
