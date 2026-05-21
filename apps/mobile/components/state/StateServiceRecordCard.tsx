import { View, Text } from 'react-native'
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
import { supabase } from '@/lib/supabase'
import { StateBillsEvidence } from './StateBillsEvidence'
import { StateVotesEvidence } from './StateVotesEvidence'

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
  const sponsored = useOfficialSponsoredStateBills(supabase, official.id)
  const votes     = useOfficialStateVotes(supabase, official.id)
  const metrics   = useOfficialMetrics(supabase, official.id)

  if (!isStateLevel(official.chamber)) return null

  const m = metrics.data
  const partyUnity = m?.party_unity_state == null ? 'Not yet computed' : `${m.party_unity_state}%`
  const attendance = m?.attendance_pct == null ? '—' : `${m.attendance_pct}%`

  return (
    <View
      testID="state-service-record-card"
      style={{
        backgroundColor: COLORS.neutral.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.neutral.border,
      }}
    >
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.brand.text }}>
          Service Record
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'baseline',
            marginTop: 2,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {chamberLabel(official.chamber)}
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>·</Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
            {official.party}
          </Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <ScalarRow label="Bills sponsored"   value={m?.bills_sponsored_count   ?? 0} />
        <ScalarRow label="Bills cosponsored" value={m?.bills_cosponsored_count ?? 0} />
        <ScalarRow label="Votes voted"       value={m?.votes_voted_count       ?? 0} />
        <ScalarRow label="Votes missed"      value={m?.votes_missed_count      ?? 0} />
        <ScalarRow label="Attendance"        value={attendance} />
        <ScalarRow label="Party unity"       value={partyUnity} />
      </View>

      <Text style={{
        marginTop: 16,
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.brand.text,
      }}>
        Performance metrics
      </Text>
      <View style={{ marginTop: 8, gap: 8 }}>
        <ScalarRow label="Bills passed"        value={fmtCount(m?.bills_passed_count)} />
        <ScalarRow label="Hearings held"       value={fmtCount(m?.hearings_held_count)} />
        <ScalarRow label="Subject breadth"     value={fmtCount(m?.subject_breadth)} />
        <ScalarRow label="Bill passage rate"   value={fmtPct(m?.bill_passage_rate)} />
        <ScalarRow label="Fiscal impact / $"   value={fmtRatio(m?.fiscal_impact_per_dollar_raised)} />
        {m?.committee_chair_count != null && (
          <ScalarRow label="Committee chair seats" value={String(m.committee_chair_count)} />
        )}
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.brand.text }}>
          View sponsored bills ({sponsored.data?.length ?? 0})
        </Text>
        <StateBillsEvidence bills={sponsored.data ?? []} />
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.brand.text }}>
          View vote record ({votes.data?.length ?? 0})
        </Text>
        <StateVotesEvidence votes={votes.data ?? []} />
      </View>
    </View>
  )
}

function ScalarRow({ label, value }: { label: string; value: number | string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}
    >
      <Text style={{ fontSize: 13, color: COLORS.neutral.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.brand.text }}>
        {value}
      </Text>
    </View>
  )
}
