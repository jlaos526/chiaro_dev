'use client'

import { StyleSheet, Text, View } from 'react-native'
import {
  isStateLevel,
  useOfficialStateDonors,
  useOfficialStateFinanceSummary,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'
import { StateDonorsEvidence } from './StateDonorsEvidence.tsx'

export interface StateFinanceCardProps {
  official: OfficialWithDistrict
}

const SOURCE_LABEL: Record<string, string> = {
  'ca-cal-access': 'Cal-Access',
  'ny-nysboe': 'NY BOE',
  'fl-doe': 'FL DOE',
  'tx-ethics': 'TX Ethics',
  'mi-boe': 'MI BOE',
}

function fmtDollars(n: number | string | null | undefined): string {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(n: number | string | null | undefined): string {
  if (n == null) return '—'
  const numeric = Number(n)
  return numeric % 1 === 0 ? `${numeric}%` : `${numeric.toFixed(1)}%`
}

export function StateFinanceCard({
  official,
}: StateFinanceCardProps): React.JSX.Element | null {
  // Hooks called unconditionally (Rules of Hooks); chamber gate runs after.
  const client = useChiaroClient()
  const summaryQ = useOfficialStateFinanceSummary(client, official.id)
  const donorsQ = useOfficialStateDonors(client, official.id)

  if (!isStateLevel(official.chamber)) return null

  const summary = summaryQ.data
  if (!summary) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Finance</Text>
        <Text style={styles.emptyMuted}>
          No state finance data yet for this legislator.
        </Text>
      </View>
    )
  }

  const sourceLabel = SOURCE_LABEL[summary.source] ?? summary.source

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Finance</Text>
          <Text style={styles.subtitle}>{summary.cycle} cycle</Text>
        </View>
        <Text style={styles.sourcePill}>{sourceLabel}</Text>
      </View>

      <View style={{ gap: 8 }}>
        <ScalarRow label="Total raised" value={fmtDollars(summary.total_raised)} />
        <ScalarRow label="Total disbursed" value={fmtDollars(summary.total_disbursed)} />
        <ScalarRow label="Small-donor %" value={fmtPct(summary.small_donor_pct)} />
        <ScalarRow label="In-state %" value={fmtPct(summary.in_state_pct)} />
      </View>

      <Text style={styles.donorsHeading}>
        Top donors ({donorsQ.data?.length ?? 0})
      </Text>
      <StateDonorsEvidence donors={donorsQ.data ?? []} />
    </View>
  )
}

function ScalarRow({
  label,
  value,
}: {
  label: string
  value: string
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brand.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.neutral.textMuted,
    marginTop: 2,
  },
  sourcePill: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.neutral.border,
    color: COLORS.brand.text,
  },
  emptyMuted: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.neutral.textMuted,
    fontStyle: 'italic',
  },
  donorsHeading: {
    marginTop: 12,
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
