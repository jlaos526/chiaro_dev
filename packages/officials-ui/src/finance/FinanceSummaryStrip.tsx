import { Text, View } from 'react-native'
import { useBrandTokens, useCategoryAccent, useCategoryCardBg } from '../brand-hooks.ts'

export interface FinanceSummaryStripProps {
  cycle: string
  totalRaised: number | null
  smallDonorPct: number | null
  pacPct: number | null
}

function formatMoney(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function formatPct(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

function Cell({
  label,
  value,
  headline,
}: { label: string; value: string; headline?: boolean }): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const dotColor = semantic.signal.success
  return (
    <View style={{ flex: headline ? 1.3 : 1, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor, marginRight: 5 }} />
        <Text
          style={{
            fontSize: 11,
            color: semantic.text.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: headline ? 22 : 18,
          fontWeight: headline ? '800' : '700',
          color: semantic.text.primary,
          marginTop: 6,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

export function FinanceSummaryStrip({
  cycle,
  totalRaised,
  smallDonorPct,
  pacPct,
}: FinanceSummaryStripProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const cardBg = useCategoryCardBg()
  const financeAccent = useCategoryAccent('finance')
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: semantic.border.default,
        borderTopWidth: 3,
        borderTopColor: financeAccent,
        borderRadius: 6,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <Cell label={`Total Raised, ${cycle}`} value={formatMoney(totalRaised)} headline />
      <View style={{ width: 1, backgroundColor: semantic.border.default }} />
      <Cell label="Small-donor %" value={formatPct(smallDonorPct)} />
      <View style={{ width: 1, backgroundColor: semantic.border.default }} />
      <Cell label="PAC %" value={pacPct == null ? '—' : `${pacPct.toFixed(1)}%`} />
    </View>
  )
}
