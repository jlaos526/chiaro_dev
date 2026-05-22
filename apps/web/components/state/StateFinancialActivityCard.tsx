'use client'

import { useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  useOfficialStateStockTransactions,
  useOfficialStateFinancialDisclosures,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { StateStockTransactionsList } from './StateStockTransactionsList'
import { StateFinancialDisclosuresList } from './StateFinancialDisclosuresList'

interface Props { officialId: string }

export function StateFinancialActivityCard({ officialId }: Props): React.JSX.Element {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const stock       = useOfficialStateStockTransactions(client, officialId)
  const disclosures = useOfficialStateFinancialDisclosures(client, officialId)

  const [openStock, setOpenStock] = useState(false)
  const [openDisc,  setOpenDisc]  = useState(false)

  if (stock.isLoading || disclosures.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Financial Activity</h2>
        <div style={mutedStyle}>Loading financial activity…</div>
      </section>
    )
  }

  // Header counts: per [[feedback-null-vs-zero-metrics]], em-dash when the
  // count is unknown (data === undefined), numeric (including 0) when known.
  const stockCount = stock.data?.length ?? null
  const discCount  = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null
  const allEmpty   = stockCount === 0 && discCount === 0

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Financial Activity</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No stock or financial-disclosure records on file for this legislator.
        </div>
      </section>
    )
  }

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Financial Activity</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {stockCount != null ? `${stockCount} stock trade${stockCount === 1 ? '' : 's'}` : '—'} ·{' '}
        {discCount  != null ? `${discCount} disclosure${discCount === 1 ? '' : 's'}${latestYear ? ` (${latestYear})` : ''}` : '—'}
      </div>

      <Subsection
        label={`Stock trades (${stockCount ?? '—'})`}
        open={openStock}
        onToggle={() => setOpenStock(v => !v)}
      >
        <StateStockTransactionsList rows={stock.data ?? []} />
      </Subsection>

      <Subsection
        label={`Financial disclosures (${discCount ?? '—'})`}
        open={openDisc}
        onToggle={() => setOpenDisc(v => !v)}
      >
        <StateFinancialDisclosuresList rows={disclosures.data ?? []} />
      </Subsection>
    </section>
  )
}

function Subsection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.neutral.border}`, paddingTop: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '6px 0',
          textAlign: 'left',
          cursor: 'pointer',
          color: COLORS.brand.text,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.neutral.background,
  border: `1px solid ${COLORS.neutral.border}`,
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
}
const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 12,
  marginTop: 0,
  color: COLORS.brand.text,
}
const mutedStyle: React.CSSProperties = {
  color: COLORS.neutral.textMuted,
  fontSize: 13,
}
