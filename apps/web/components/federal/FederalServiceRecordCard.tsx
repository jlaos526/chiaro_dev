'use client'

import { useMemo, useState } from 'react'
import {
  useOfficialMetrics,
  useOfficialLeadershipHistory,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { FederalKPIList } from './FederalKPIList'
import { FederalLeadershipList } from './FederalLeadershipList'

interface Props {
  officialId: string
  hideLivesInDistrict?: boolean   // Senate guard
}

export function FederalServiceRecordCard({ officialId, hideLivesInDistrict }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const metrics = useOfficialMetrics(client, officialId)
  const leadership = useOfficialLeadershipHistory(client, officialId)

  const [openLeadership, setOpenLeadership] = useState(false)

  if (metrics.isLoading || leadership.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Service Record</h2>
        <div style={mutedStyle}>Loading service record…</div>
      </section>
    )
  }

  const m = metrics.data ?? null
  const leadCount = leadership.data?.length ?? null
  const allEmpty = !m && (leadCount === 0 || leadCount === null)

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Service Record</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No service record data on file for this legislator.
        </div>
      </section>
    )
  }

  const sponsored = m?.bills_sponsored_count ?? null
  const cosponsored = m?.bills_cosponsored_count ?? null
  const attendance = m?.attendance_pct ?? null

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Service Record</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {sponsored != null ? `${sponsored} bill${sponsored === 1 ? '' : 's'} sponsored` : '—'} ·{' '}
        {cosponsored != null ? `${cosponsored} cosponsored` : '—'} ·{' '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </div>

      {/* Always-visible KPI tiles */}
      <FederalKPIList metrics={m} {...(hideLivesInDistrict ? { hideLivesInDistrict: true } : {})} />

      {/* Collapsible Leadership subsection */}
      <Subsection
        label={`Leadership history (${leadCount ?? '—'})`}
        open={openLeadership}
        onToggle={() => setOpenLeadership(v => !v)}
      >
        <FederalLeadershipList rows={leadership.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8, marginTop: 8 }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '6px 0', textAlign: 'left', cursor: 'pointer',
        color: COLORS.brand.text, fontSize: 14, fontWeight: 500,
      }}>
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8, padding: 16, marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, marginBottom: 12, color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted, fontSize: 13,
}
