'use client'

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

export function FederalKPIList({ metrics, hideLivesInDistrict }: Props): React.JSX.Element {
  if (!metrics) {
    return <div style={mutedStyle}>No KPI data available.</div>
  }

  const tiles: Tile[] = [
    { label: 'Bills sponsored',   value: fmtCount(metrics.bills_sponsored_count) },
    { label: 'Bills cosponsored', value: fmtCount(metrics.bills_cosponsored_count) },
    { label: 'Attendance',        value: fmtPct(metrics.attendance_pct) },
    { label: 'Subject breadth',   value: fmtCount(metrics.subject_breadth) },
  ]
  if (!hideLivesInDistrict) {
    tiles.push({
      label: 'Lives in district',
      value: fmtLivesInDistrict(metrics.lives_in_district),
    })
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 8, padding: '8px 12px',
    }}>
      {tiles.map(t => (
        <div key={t.label} style={tileStyle}>
          <div style={tileValueStyle}>{t.value}</div>
          <div style={tileLabelStyle}>{t.label}</div>
        </div>
      ))}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
  padding: '8px 12px', fontStyle: 'italic',
}
const tileStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.surface,
  borderRadius: 6, padding: 8, textAlign: 'center',
}
const tileValueStyle: React.CSSProperties = {
  fontWeight: 600, color: COLORS.brand.text, fontSize: 15,
}
const tileLabelStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 11, marginTop: 4,
}
