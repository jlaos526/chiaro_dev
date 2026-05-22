import { useState } from 'react'
import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import {
  useOfficialMetrics,
  useOfficialLeadershipHistory,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { supabase } from '@/lib/supabase'
import { FederalKPIList } from './FederalKPIList'
import { FederalLeadershipList } from './FederalLeadershipList'

interface Props {
  officialId: string
  hideLivesInDistrict?: boolean // Senate guard
}

export function FederalServiceRecordCard({ officialId, hideLivesInDistrict }: Props) {
  const metrics = useOfficialMetrics(supabase, officialId)
  const leadership = useOfficialLeadershipHistory(supabase, officialId)

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
      <Subsection
        label={`Leadership history (${leadCount ?? '—'})`}
        open={openLeadership}
        onToggle={() => setOpenLeadership(v => !v)}
      >
        <FederalLeadershipList rows={leadership.data ?? []} />
      </Subsection>
    </View>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
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
    fontSize: 18, fontWeight: '600',
    marginBottom: 12, color: COLORS.brand.text,
  },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
  subsection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral.border,
    paddingTop: 8,
    marginTop: 8,
  },
  subsectionLabel: {
    color: COLORS.brand.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 6,
  },
})
