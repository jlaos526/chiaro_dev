import { View, Text, StyleSheet } from 'react-native'
import type { Database } from '@chiaro/db'
import { COLORS } from '@chiaro/ui-tokens'

type MetricsRow = Database['public']['Tables']['official_metrics']['Row']

interface Props {
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

export function FederalKPIList({ metrics, hideLivesInDistrict }: Props) {
  if (!metrics) {
    return <Text style={styles.muted}>No KPI data available.</Text>
  }
  const tiles: Tile[] = [
    { label: 'Bills sponsored',   value: fmtCount(metrics.bills_sponsored_count) },
    { label: 'Bills cosponsored', value: fmtCount(metrics.bills_cosponsored_count) },
    { label: 'Attendance',        value: fmtPct(metrics.attendance_pct) },
    { label: 'Subject breadth',   value: fmtCount(metrics.subject_breadth) },
  ]
  if (!hideLivesInDistrict) {
    tiles.push({ label: 'Lives in district', value: fmtLivesInDistrict(metrics.lives_in_district) })
  }

  return (
    <View style={styles.grid}>
      {tiles.map(t => (
        <View key={t.label} style={styles.tile}>
          <Text style={styles.tileValue}>{t.value}</Text>
          <Text style={styles.tileLabel}>{t.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { color: COLORS.neutral.textMuted, fontSize: 13, fontStyle: 'italic', padding: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  tile: { backgroundColor: COLORS.neutral.surface, borderRadius: 6, padding: 8, minWidth: 120, alignItems: 'center' },
  tileValue: { fontWeight: '600', color: COLORS.brand.text, fontSize: 15 },
  tileLabel: { color: COLORS.neutral.textMuted, fontSize: 11, marginTop: 4 },
})
