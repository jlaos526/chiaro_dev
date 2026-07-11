'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
  useOfficialHoldings,
  useOfficialDisclosureOther,
} from '@chiaro/officials'
import type { BrandSemantic } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { FederalStockTransactionsList } from './FederalStockTransactionsList.tsx'
import { FederalHoldingsList } from './FederalHoldingsList.tsx'
import { FederalDisclosureOtherList } from './FederalDisclosureOtherList.tsx'

export interface FederalEthicsAccountabilityCardProps {
  officialId: string
}

function complianceColor(pct: number | null | undefined, semantic: BrandSemantic): string {
  if (pct == null) return semantic.text.muted
  if (pct >= 90) return semantic.alert.success.fg
  if (pct >= 50) return semantic.alert.warning.fg
  return semantic.alert.danger.fg
}

export function FederalEthicsAccountabilityCard({
  officialId,
}: FederalEthicsAccountabilityCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const metrics = useOfficialMetrics(client, officialId)
  const stock = useOfficialStockTransactions(client, officialId)
  const holdings = useOfficialHoldings(client, officialId)
  const other = useOfficialDisclosureOther(client, officialId)

  const [openStock, setOpenStock] = useState(false)
  const [openHoldings, setOpenHoldings] = useState(false)
  const [openOther, setOpenOther] = useState(false)

  const cardStyle = [
    styles.card,
    { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
  ]
  const titleStyle = [styles.title, { color: semantic.text.primary }]
  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const summaryStyle = [styles.summary, { color: semantic.text.muted }]

  if (metrics.isLoading || stock.isLoading || holdings.isLoading || other.isLoading) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
          Ethics & Accountability
        </Text>
        <Text style={mutedStyle}>Loading ethics & accountability…</Text>
      </View>
    )
  }

  const m = metrics.data ?? null
  const compliancePct = m?.stock_act_compliance_pct ?? null
  const stockCount = stock.data?.length ?? 0
  const lateCount = stock.data?.filter((t) => (t.days_late ?? 0) > 0).length ?? 0
  const holdingsCount = holdings.data?.length ?? 0
  const otherCount = other.data?.length ?? 0
  const allEmpty =
    stockCount === 0 && compliancePct == null && holdingsCount === 0 && otherCount === 0

  if (allEmpty) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
          Ethics & Accountability
        </Text>
        <Text style={[styles.muted, { color: semantic.text.muted, fontStyle: 'italic' }]}>
          No stock-trade or STOCK-Act-compliance records on file.
        </Text>
      </View>
    )
  }

  const compColor = complianceColor(compliancePct, semantic)

  return (
    <View style={cardStyle}>
      <Text style={titleStyle} accessibilityRole="header" accessibilityLevel={2}>
        Ethics & Accountability
      </Text>
      <Text style={summaryStyle}>
        {`${stockCount} stock trade${stockCount === 1 ? '' : 's'}`}
        {' · '}
        {`${lateCount} late filing${lateCount === 1 ? '' : 's'}`}
        {' · '}
        {compliancePct != null
          ? `${compliancePct}% STOCK Act compliance`
          : '— STOCK Act compliance'}
      </Text>

      {/* Compliance tile (always visible when pct present) */}
      {compliancePct != null && (
        <View style={[styles.complianceTile, { backgroundColor: semantic.bg.app }]}>
          <Text style={[styles.compliancePct, { color: compColor }]}>{compliancePct}%</Text>
          <Text style={[styles.complianceLabel, { color: semantic.text.muted }]}>
            STOCK Act on-time filing compliance (federal 45-day deadline)
          </Text>
        </View>
      )}

      <CardSubsection
        label={`Stock trades (${stockCount})`}
        open={openStock}
        onToggle={() => setOpenStock((v) => !v)}
      >
        <FederalStockTransactionsList rows={stock.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`Holdings (${holdingsCount})`}
        open={openHoldings}
        onToggle={() => setOpenHoldings((v) => !v)}
      >
        <FederalHoldingsList rows={holdings.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`Other Disclosures (${otherCount})`}
        open={openOther}
        onToggle={() => setOpenOther((v) => !v)}
      >
        <FederalDisclosureOtherList rows={other.data ?? []} />
      </CardSubsection>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
  complianceTile: {
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  compliancePct: { fontSize: 24, fontWeight: '700' },
  complianceLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
})
