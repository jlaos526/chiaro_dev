'use client'

import { useMemo, useState } from 'react'
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { FederalStockTransactionsList } from './FederalStockTransactionsList'

interface Props { officialId: string }

function complianceColor(pct: number | null | undefined): string {
  if (pct == null) return COLORS.neutral.textMuted
  if (pct >= 90) return COLORS.signal.success
  if (pct >= 50) return COLORS.signal.warning
  return COLORS.signal.error
}

export function FederalEthicsAccountabilityCard({ officialId }: Props) {
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const metrics = useOfficialMetrics(client, officialId)
  const stock = useOfficialStockTransactions(client, officialId)

  const [openStock, setOpenStock] = useState(false)

  if (metrics.isLoading || stock.isLoading) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Ethics & Accountability</h2>
        <div style={mutedStyle}>Loading ethics & accountability…</div>
      </section>
    )
  }

  const m = metrics.data ?? null
  const compliancePct = m?.stock_act_compliance_pct ?? null
  const stockCount = stock.data?.length ?? 0
  const lateCount = stock.data?.filter(t => (t.days_late ?? 0) > 0).length ?? 0
  const allEmpty = stockCount === 0 && compliancePct == null

  if (allEmpty) {
    return (
      <section style={cardStyle}>
        <h2 style={titleStyle}>Ethics & Accountability</h2>
        <div style={{ ...mutedStyle, fontStyle: 'italic' }}>
          No stock-trade or STOCK-Act-compliance records on file.
        </div>
      </section>
    )
  }

  const compColor = complianceColor(compliancePct)

  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>Ethics & Accountability</h2>
      <div style={{ fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 }}>
        {`${stockCount} stock trade${stockCount === 1 ? '' : 's'}`} ·{' '}
        {`${lateCount} late filing${lateCount === 1 ? '' : 's'}`} ·{' '}
        {compliancePct != null ? `${compliancePct}% STOCK Act compliance` : '— STOCK Act compliance'}
      </div>

      {/* Compliance tile (always visible when pct present) */}
      {compliancePct != null && (
        <div style={{
          padding: '12px', backgroundColor: COLORS.neutral.surface,
          borderRadius: 6, marginBottom: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: compColor }}>
            {compliancePct}%
          </div>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 4 }}>
            STOCK Act on-time filing compliance (federal 45-day deadline)
          </div>
        </div>
      )}

      <Subsection label={`Stock trades (${stockCount})`}
                  open={openStock} onToggle={() => setOpenStock(v => !v)}>
        <FederalStockTransactionsList rows={stock.data ?? []} />
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
