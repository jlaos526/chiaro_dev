'use client'

import { useMemo, useState } from 'react'
import { useOfficialFinance } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { FederalDonorsList } from './FederalDonorsList'
import { FederalPACsList } from './FederalPACsList'

interface Props {
  officialId: string
  cycle: string   // e.g. '2024'
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalFinanceCard({ officialId, cycle }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const finance = useOfficialFinance(client, officialId, cycle)

  const [openDonors, setOpenDonors] = useState(false)
  const [openPACs, setOpenPACs] = useState(false)

  if (finance.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Finance ({cycle})</h2>
        <div style={mutedStyle}>Loading finance…</div>
      </section>
    )
  }

  const f = finance.data ?? null
  if (!f) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Finance ({cycle})</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No finance data available for this legislator and cycle.
        </div>
      </section>
    )
  }

  const totalRaised = f.summary.total_raised == null ? null : Number(f.summary.total_raised)
  const donorCount = f.individualDonors.length
  const pacCount = f.pacs.length

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Finance ({cycle})</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {fmtAmount(totalRaised)} raised ·{' '}
        {`${donorCount} donor${donorCount === 1 ? '' : 's'}`} ·{' '}
        {`${pacCount} PAC${pacCount === 1 ? '' : 's'}`}
      </div>

      <Subsection label={`Top individual donors (${donorCount})`}
                  open={openDonors} onToggle={() => setOpenDonors(v => !v)}>
        <FederalDonorsList finance={f} />
      </Subsection>

      <Subsection label={`Top PACs (${pacCount})`}
                  open={openPACs} onToggle={() => setOpenPACs(v => !v)}>
        <FederalPACsList finance={f} />
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
