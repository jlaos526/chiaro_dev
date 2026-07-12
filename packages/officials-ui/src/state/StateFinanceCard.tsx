'use client'

import { StyleSheet, Text, View } from 'react-native'
import {
  isStateLevel,
  useOfficialStateDonors,
  useOfficialStateFinanceSummary,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
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

export function StateFinanceCard({ official }: StateFinanceCardProps): React.JSX.Element | null {
  // Hooks called unconditionally (Rules of Hooks); chamber gate runs after.
  const client = useChiaroClient()
  const summaryQ = useOfficialStateFinanceSummary(client, official.id)
  const donorsQ = useOfficialStateDonors(client, official.id)
  const { semantic } = useBrandTokens()

  if (!isStateLevel(official.chamber)) return null

  const titleColor = { color: semantic.text.primary }
  const mutedColor = { color: semantic.text.muted }
  const sourcePillColors = {
    borderColor: semantic.border.default,
    color: semantic.text.primary,
  }
  const rowLabelColor = { color: semantic.text.muted }
  const rowValueColor = { color: semantic.text.primary }

  const summary = summaryQ.data ?? null

  return (
    <DetailCardShell
      title="Finance"
      // Slice-57 B5 semantics preserved: only the summary query gates the
      // loading branch (donors render "(0)" while they trickle in).
      isLoading={summaryQ.isLoading}
      isError={summaryQ.isError || donorsQ.isError}
      onRetry={() => {
        void summaryQ.refetch()
        void donorsQ.refetch()
      }}
      isEmpty={!summary}
      emptyText="No state finance data yet for this legislator."
    >
      {/* Children are constructed even when the shell renders another branch,
          so the data body is guarded on `summary` (null while loading/empty). */}
      {summary ? (
        <>
          <View style={styles.header}>
            <Text style={[styles.subtitle, mutedColor]}>{summary.cycle} cycle</Text>
            <Text style={[styles.sourcePill, sourcePillColors]}>
              {SOURCE_LABEL[summary.source] ?? summary.source}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <ScalarRow
              label="Total raised"
              value={fmtDollars(summary.total_raised)}
              labelColor={rowLabelColor}
              valueColor={rowValueColor}
            />
            <ScalarRow
              label="Total disbursed"
              value={fmtDollars(summary.total_disbursed)}
              labelColor={rowLabelColor}
              valueColor={rowValueColor}
            />
            <ScalarRow
              label="Small-donor %"
              value={fmtPct(summary.small_donor_pct)}
              labelColor={rowLabelColor}
              valueColor={rowValueColor}
            />
            <ScalarRow
              label="In-state %"
              value={fmtPct(summary.in_state_pct)}
              labelColor={rowLabelColor}
              valueColor={rowValueColor}
            />
          </View>

          <Text
            style={[styles.donorsHeading, titleColor]}
            accessibilityRole="header"
            accessibilityLevel={3}
          >
            Top donors ({donorsQ.data?.length ?? 0})
          </Text>
          <StateDonorsEvidence donors={donorsQ.data ?? []} />
        </>
      ) : null}
    </DetailCardShell>
  )
}

function ScalarRow({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string
  value: string
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 12,
  },
  sourcePill: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  donorsHeading: {
    marginTop: 12,
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
