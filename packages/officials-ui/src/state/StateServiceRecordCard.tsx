'use client'

import { StyleSheet, Text, View } from 'react-native'
import {
  isStateLevel,
  useOfficialMetrics,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import {
  useOfficialSponsoredStateBills,
  useOfficialStateVotes,
} from '@chiaro/state-bills'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'
import { StateBillsEvidence } from './StateBillsEvidence.tsx'
import { StateVotesEvidence } from './StateVotesEvidence.tsx'

export interface StateServiceRecordCardProps {
  official: OfficialWithDistrict
}

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

export function StateServiceRecordCard({
  official,
}: StateServiceRecordCardProps): React.JSX.Element | null {
  // Hooks must be called unconditionally (Rules of Hooks); chamber gate runs after.
  const client = useChiaroClient()
  const sponsored = useOfficialSponsoredStateBills(client, official.id)
  const votes = useOfficialStateVotes(client, official.id)
  const metrics = useOfficialMetrics(client, official.id)

  if (!isStateLevel(official.chamber)) return null

  const m = metrics.data
  const partyUnity = m?.party_unity_state == null ? 'Not yet computed' : `${m.party_unity_state}%`
  const attendance = m?.attendance_pct == null ? '—' : `${m.attendance_pct}%`

  return (
    <View testID="state-service-record-card" style={styles.card}>
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.title}>Service Record</Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'baseline',
            marginTop: 2,
          }}
        >
          <Text style={styles.subtitle}>{chamberLabel(official.chamber)}</Text>
          <Text style={styles.subtitle}>·</Text>
          <Text style={styles.subtitle}>{official.party}</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <ScalarRow label="Bills sponsored" value={m?.bills_sponsored_count ?? 0} />
        <ScalarRow label="Bills cosponsored" value={m?.bills_cosponsored_count ?? 0} />
        <ScalarRow label="Votes voted" value={m?.votes_voted_count ?? 0} />
        <ScalarRow label="Votes missed" value={m?.votes_missed_count ?? 0} />
        <ScalarRow label="Attendance" value={attendance} />
        <ScalarRow label="Party unity" value={partyUnity} />
      </View>

      <Text style={styles.subheading}>Performance metrics</Text>
      <View style={{ marginTop: 8, gap: 8 }}>
        <ScalarRow label="Bills passed" value={fmtCount(m?.bills_passed_count)} />
        <ScalarRow label="Hearings held" value={fmtCount(m?.hearings_held_count)} />
        <ScalarRow label="Subject breadth" value={fmtCount(m?.subject_breadth)} />
        <ScalarRow label="Bill passage rate" value={fmtPct(m?.bill_passage_rate)} />
        <ScalarRow
          label="Fiscal impact / $"
          value={fmtRatio(m?.fiscal_impact_per_dollar_raised)}
        />
        {m?.committee_chair_count != null && (
          <ScalarRow label="Committee chair seats" value={String(m.committee_chair_count)} />
        )}
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={styles.evidenceHeading}>
          View sponsored bills ({sponsored.data?.length ?? 0})
        </Text>
        <StateBillsEvidence bills={sponsored.data ?? []} />
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={styles.evidenceHeading}>
          View vote record ({votes.data?.length ?? 0})
        </Text>
        <StateVotesEvidence votes={votes.data ?? []} />
      </View>
    </View>
  )
}

function ScalarRow({
  label,
  value,
}: {
  label: string
  value: number | string
}): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral.border,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brand.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.neutral.textMuted,
  },
  subheading: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brand.text,
  },
  evidenceHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.brand.text,
  },
  rowLabel: {
    fontSize: 13,
    color: COLORS.neutral.textMuted,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.brand.text,
  },
})
