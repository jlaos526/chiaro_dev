'use client'
import { useMemo } from 'react'
import { COLORS } from '@chiaro/ui-tokens'
import {
  isStateLevel,
  useOfficialMetrics,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import {
  useOfficialSponsoredStateBills,
  useOfficialStateVotes,
} from '@chiaro/state-bills'
import { StateBillsEvidence } from './StateBillsEvidence'
import { StateVotesEvidence } from './StateVotesEvidence'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function chamberLabel(chamber: OfficialWithDistrict['chamber']): string {
  if (chamber === 'state_house') return 'State Representative'
  // covers state_senate + state_legislature (Nebraska unicameral renders as Senate-shape)
  return 'State Senator'
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—'
  return String(n)
}

function fmtPct(n: number | string | null | undefined): string {
  if (n == null) return '—'
  const num = Number(n)
  return num % 1 === 0 ? `${num}%` : `${num.toFixed(1)}%`
}

function fmtRatio(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function StateServiceRecordCard({ official }: { official: OfficialWithDistrict }) {
  // Hooks must be called unconditionally (Rules of Hooks); chamber gate runs after.
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const sponsored = useOfficialSponsoredStateBills(client, official.id)
  const votes     = useOfficialStateVotes(client, official.id)
  const metrics   = useOfficialMetrics(client, official.id)

  if (!isStateLevel(official.chamber)) return null

  const m = metrics.data
  const partyUnity = m?.party_unity_state == null ? 'Not yet computed' : `${m.party_unity_state}%`
  const attendance = m?.attendance_pct == null ? '—' : `${m.attendance_pct}%`

  return (
    <section
      style={{
        background: COLORS.neutral.surface,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${COLORS.neutral.border}`,
      }}
    >
      <header style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.brand.text, margin: 0 }}>
          Service Record
        </h3>
        <div
          style={{
            fontSize: 12,
            color: COLORS.neutral.textMuted,
            marginTop: 2,
            display: 'flex',
            gap: 6,
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          <span>{chamberLabel(official.chamber)}</span>
          <span aria-hidden="true">·</span>
          <span>{official.party}</span>
        </div>
      </header>

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ScalarRow label="Bills sponsored"   value={m?.bills_sponsored_count   ?? 0} />
        <ScalarRow label="Bills cosponsored" value={m?.bills_cosponsored_count ?? 0} />
        <ScalarRow label="Votes voted"       value={m?.votes_voted_count       ?? 0} />
        <ScalarRow label="Votes missed"      value={m?.votes_missed_count      ?? 0} />
        <ScalarRow label="Attendance"        value={attendance} />
        <ScalarRow label="Party unity"       value={partyUnity} />
      </dl>

      <h4 style={{
        marginTop: 16,
        fontSize: 13,
        fontWeight: 700,
        color: COLORS.brand.text,
      }}>
        Performance metrics
      </h4>
      <dl style={{ margin: 0, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ScalarRow label="Bills passed"        value={fmtCount(m?.bills_passed_count)} />
        <ScalarRow label="Hearings held"       value={fmtCount(m?.hearings_held_count)} />
        <ScalarRow label="Subject breadth"     value={fmtCount(m?.subject_breadth)} />
        <ScalarRow label="Bill passage rate"   value={fmtPct(m?.bill_passage_rate)} />
        <ScalarRow label="Fiscal impact / $"   value={fmtRatio(m?.fiscal_impact_per_dollar_raised)} />
        {m?.committee_chair_count != null && (
          <ScalarRow label="Committee chair seats" value={String(m.committee_chair_count)} />
        )}
      </dl>

      <details style={{ marginTop: 12 }} open>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COLORS.brand.text }}>
          View sponsored bills ({sponsored.data?.length ?? 0})
        </summary>
        <StateBillsEvidence bills={sponsored.data ?? []} />
      </details>

      <details style={{ marginTop: 8 }} open>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COLORS.brand.text }}>
          View vote record ({votes.data?.length ?? 0})
        </summary>
        <StateVotesEvidence votes={votes.data ?? []} />
      </details>
    </section>
  )
}

function ScalarRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <dt style={{ fontSize: 13, color: COLORS.neutral.textMuted, margin: 0 }}>{label}</dt>
      <dd style={{ fontSize: 14, fontWeight: 600, color: COLORS.brand.text, margin: 0 }}>{value}</dd>
    </div>
  )
}
