'use client'

import { StyleSheet, Text, View } from 'react-native'
import type { Database } from '@chiaro/db'
import { useBrandTokens } from '../brand-hooks.ts'

type MetricsRow = Database['public']['Tables']['official_metrics']['Row']

export interface FederalKPIListProps {
  metrics: MetricsRow | null | undefined
  hideLivesInDistrict?: boolean // Senate guard
}

interface Tile {
  label: string
  value: string
}

function fmtPct(n: number | null | undefined): string {
  return n == null ? '—' : `${n}%`
}

function fmtCount(n: number | null | undefined): string {
  return n == null ? '—' : String(n)
}

function fmtLivesInDistrict(b: boolean | null | undefined): string {
  if (b == null) return '—'
  return b ? '✓ Yes' : '✗ No'
}

export function FederalKPIList({
  metrics,
  hideLivesInDistrict,
}: FederalKPIListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (!metrics) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>No KPI data available.</Text>
    )
  }
  const tiles: Tile[] = [
    { label: 'Bills sponsored', value: fmtCount(metrics.bills_sponsored_count) },
    { label: 'Bills cosponsored', value: fmtCount(metrics.bills_cosponsored_count) },
    { label: 'Attendance', value: fmtPct(metrics.attendance_pct) },
    { label: 'Subject breadth', value: fmtCount(metrics.subject_breadth) },
  ]
  if (!hideLivesInDistrict) {
    tiles.push({ label: 'Lives in district', value: fmtLivesInDistrict(metrics.lives_in_district) })
  }

  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <View key={t.label} style={[styles.tile, { backgroundColor: semantic.bg.app }]}>
          <Text style={[styles.tileValue, { color: semantic.text.primary }]}>{t.value}</Text>
          <Text style={[styles.tileLabel, { color: semantic.text.muted }]}>{t.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  tile: {
    borderRadius: 6,
    padding: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  tileValue: { fontWeight: '600', fontSize: 15 },
  tileLabel: { fontSize: 11, marginTop: 4 },
})
