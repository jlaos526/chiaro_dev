'use client'
import { useMemo } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import {
  isStateLevel,
  useOfficialStateFinanceSummary,
  useOfficialStateDonors,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { StateDonorsEvidence } from './StateDonorsEvidence'

const SOURCE_LABEL: Record<string, string> = {
  'ca-cal-access': 'Cal-Access',
  'ny-nysboe': 'NY BOE',
  'fl-doe': 'FL DOE',
  'tx-ethics': 'TX Ethics',
  'mi-boe': 'MI BOE',
}

function fmtDollars(n: number | null): string {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  const numeric = Number(n)
  return numeric % 1 === 0 ? `${numeric}%` : `${numeric.toFixed(1)}%`
}

export function StateFinanceCard({ official }: { official: OfficialWithDistrict }) {
  // Hooks must be called unconditionally (Rules of Hooks); chamber gate runs after.
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const summaryQ = useOfficialStateFinanceSummary(client as never, official.id)
  const donorsQ  = useOfficialStateDonors(client as never, official.id)

  if (!isStateLevel(official.chamber)) return null

  const summary = summaryQ.data
  if (!summary) {
    return (
      <section style={{
        background: COLORS.neutral.surface,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${COLORS.neutral.border}`,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.brand.text, margin: 0 }}>Finance</h3>
        <div style={{ marginTop: 8, fontSize: 13, color: COLORS.neutral.textMuted, fontStyle: 'italic' }}>
          No state finance data yet for this legislator.
        </div>
      </section>
    )
  }

  const sourceLabel = SOURCE_LABEL[summary.source] ?? summary.source

  return (
    <section style={{
      background: COLORS.neutral.surface,
      borderRadius: 12,
      padding: 16,
      border: `1px solid ${COLORS.neutral.border}`,
    }}>
      <header style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.brand.text, margin: 0 }}>Finance</h3>
          <div style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
            {summary.cycle} cycle
          </div>
        </div>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4,
          background: COLORS.neutral.surface,
          border: `1px solid ${COLORS.neutral.border}`,
          color: COLORS.brand.text,
        }}>
          {sourceLabel}
        </span>
      </header>

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ScalarRow label="Total raised"    value={fmtDollars(summary.total_raised as never)} />
        <ScalarRow label="Total disbursed" value={fmtDollars(summary.total_disbursed as never)} />
        <ScalarRow label="Small-donor %"   value={fmtPct(summary.small_donor_pct as never)} />
        <ScalarRow label="In-state %"      value={fmtPct(summary.in_state_pct as never)} />
      </dl>

      <details style={{ marginTop: 12 }} open>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COLORS.brand.text }}>
          Top donors ({donorsQ.data?.length ?? 0})
        </summary>
        <StateDonorsEvidence donors={donorsQ.data ?? []} />
      </details>
    </section>
  )
}

function ScalarRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <dt style={{ fontSize: 13, color: COLORS.neutral.textMuted, margin: 0 }}>{label}</dt>
      <dd style={{ fontSize: 14, fontWeight: 600, color: COLORS.brand.text, margin: 0 }}>{value}</dd>
    </div>
  )
}
