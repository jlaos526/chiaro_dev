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
import { useBrandTokens } from '../brand-hooks.ts'
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
  const { semantic } = useBrandTokens()

  if (!isStateLevel(official.chamber)) return null

  if (metrics.isLoading || sponsored.isLoading || votes.isLoading) {
    return (
      <View
        testID="state-service-record-card"
        style={[styles.card, { backgroundColor: semantic.bg.app, borderColor: semantic.border.default }]}
      >
        <Text style={[styles.title, { color: semantic.text.primary }]} accessibilityRole="header" accessibilityLevel={2}>Service Record</Text>
        <Text style={[styles.subtitle, { color: semantic.text.muted, marginTop: 8 }]}>Loading service record…</Text>
      </View>
    )
  }

  const m = metrics.data
  const partyUnity = m?.party_unity_state == null ? 'Not yet computed' : `${m.party_unity_state}%`
  const attendance = m?.attendance_pct == null ? '—' : `${m.attendance_pct}%`

  const subtitleStyle = [styles.subtitle, { color: semantic.text.muted }]
  const headingStyle = { color: semantic.text.primary }
  const rowLabelColor = { color: semantic.text.muted }
  const rowValueColor = { color: semantic.text.primary }

  return (
    <View
      testID="state-service-record-card"
      style={[
        styles.card,
        { backgroundColor: semantic.bg.app, borderColor: semantic.border.default },
      ]}
    >
      <View style={{ marginBottom: 12 }}>
        <Text style={[styles.title, headingStyle]} accessibilityRole="header" accessibilityLevel={2}>Service Record</Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'baseline',
            marginTop: 2,
          }}
        >
          <Text style={subtitleStyle}>{chamberLabel(official.chamber)}</Text>
          <Text style={subtitleStyle}>·</Text>
          <Text style={subtitleStyle}>{official.party}</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <ScalarRow label="Bills sponsored" value={fmtCount(m?.bills_sponsored_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Bills cosponsored" value={fmtCount(m?.bills_cosponsored_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Votes voted" value={fmtCount(m?.votes_voted_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Votes missed" value={fmtCount(m?.votes_missed_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Attendance" value={attendance} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Party unity" value={partyUnity} labelColor={rowLabelColor} valueColor={rowValueColor} />
      </View>

      <Text style={[styles.subheading, headingStyle]}>Performance metrics</Text>
      <View style={{ marginTop: 8, gap: 8 }}>
        <ScalarRow label="Bills passed" value={fmtCount(m?.bills_passed_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Hearings held" value={fmtCount(m?.hearings_held_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Subject breadth" value={fmtCount(m?.subject_breadth)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow label="Bill passage rate" value={fmtPct(m?.bill_passage_rate)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        <ScalarRow
          label="Fiscal impact / $"
          value={fmtRatio(m?.fiscal_impact_per_dollar_raised)}
          labelColor={rowLabelColor}
          valueColor={rowValueColor}
        />
        {m?.committee_chair_count != null && (
          <ScalarRow label="Committee chair seats" value={String(m.committee_chair_count)} labelColor={rowLabelColor} valueColor={rowValueColor} />
        )}
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={[styles.evidenceHeading, headingStyle]}>
          View sponsored bills ({sponsored.data?.length ?? 0})
        </Text>
        <StateBillsEvidence bills={sponsored.data ?? []} />
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={[styles.evidenceHeading, headingStyle]}>
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
  labelColor,
  valueColor,
}: {
  label: string
  value: number | string
  labelColor: { color: string }
  valueColor: { color: string }
}): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}
    >
      <Text style={[styles.rowLabel, labelColor]}>{label}</Text>
      <Text style={[styles.rowValue, valueColor]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  subheading: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
  },
  evidenceHeading: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowLabel: {
    fontSize: 13,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
})
