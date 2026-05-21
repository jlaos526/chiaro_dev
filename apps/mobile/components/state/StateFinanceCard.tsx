import { View, Text } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import {
  isStateLevel,
  useOfficialStateFinanceSummary,
  useOfficialStateDonors,
  type OfficialWithDistrict,
} from '@chiaro/officials'
import { supabase } from '@/lib/supabase'
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
  // Hooks called unconditionally (Rules of Hooks); chamber gate runs after.
  const summaryQ = useOfficialStateFinanceSummary(supabase as never, official.id)
  const donorsQ = useOfficialStateDonors(supabase as never, official.id)

  if (!isStateLevel(official.chamber)) return null

  const cardStyle = {
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral.border,
  }

  const summary = summaryQ.data
  if (!summary) {
    return (
      <View style={cardStyle}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.brand.text }}>Finance</Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 13,
            color: COLORS.neutral.textMuted,
            fontStyle: 'italic',
          }}
        >
          No state finance data yet for this legislator.
        </Text>
      </View>
    )
  }

  const sourceLabel = SOURCE_LABEL[summary.source] ?? summary.source

  return (
    <View style={cardStyle}>
      <View
        style={{
          marginBottom: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.brand.text }}>Finance</Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
            {summary.cycle} cycle
          </Text>
        </View>
        <Text
          style={{
            fontSize: 11,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: COLORS.neutral.border,
            color: COLORS.brand.text,
          }}
        >
          {sourceLabel}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <ScalarRow label="Total raised" value={fmtDollars(summary.total_raised as never)} />
        <ScalarRow label="Total disbursed" value={fmtDollars(summary.total_disbursed as never)} />
        <ScalarRow label="Small-donor %" value={fmtPct(summary.small_donor_pct as never)} />
        <ScalarRow label="In-state %" value={fmtPct(summary.in_state_pct as never)} />
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 13,
          fontWeight: '600',
          color: COLORS.brand.text,
        }}
      >
        Top donors ({donorsQ.data?.length ?? 0})
      </Text>
      <StateDonorsEvidence donors={donorsQ.data ?? []} />
    </View>
  )
}

function ScalarRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={{ fontSize: 13, color: COLORS.neutral.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.brand.text }}>{value}</Text>
    </View>
  )
}
