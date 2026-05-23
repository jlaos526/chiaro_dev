'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  useOfficialMetrics,
  useOfficialStockTransactions,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { FederalStockTransactionsList } from './FederalStockTransactionsList.tsx'

export interface FederalEthicsAccountabilityCardProps {
  officialId: string
}

function complianceColor(pct: number | null | undefined): string {
  if (pct == null) return COLORS.neutral.textMuted
  if (pct >= 90) return COLORS.signal.success
  if (pct >= 50) return COLORS.signal.warning
  return COLORS.signal.error
}

export function FederalEthicsAccountabilityCard({
  officialId,
}: FederalEthicsAccountabilityCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const metrics = useOfficialMetrics(client, officialId)
  const stock = useOfficialStockTransactions(client, officialId)

  const [openStock, setOpenStock] = useState(false)

  if (metrics.isLoading || stock.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Ethics & Accountability</Text>
        <Text style={styles.muted}>Loading ethics & accountability…</Text>
      </View>
    )
  }

  const m = metrics.data ?? null
  const compliancePct = m?.stock_act_compliance_pct ?? null
  const stockCount = stock.data?.length ?? 0
  const lateCount = stock.data?.filter(t => (t.days_late ?? 0) > 0).length ?? 0
  const allEmpty = stockCount === 0 && compliancePct == null

  if (allEmpty) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Ethics & Accountability</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No stock-trade or STOCK-Act-compliance records on file.
        </Text>
      </View>
    )
  }

  const compColor = complianceColor(compliancePct)

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ethics & Accountability</Text>
      <Text style={styles.summary}>
        {`${stockCount} stock trade${stockCount === 1 ? '' : 's'}`}
        {' · '}
        {`${lateCount} late filing${lateCount === 1 ? '' : 's'}`}
        {' · '}
        {compliancePct != null ? `${compliancePct}% STOCK Act compliance` : '— STOCK Act compliance'}
      </Text>

      {/* Compliance tile (always visible when pct present) */}
      {compliancePct != null && (
        <View style={styles.complianceTile}>
          <Text style={[styles.compliancePct, { color: compColor }]}>
            {compliancePct}%
          </Text>
          <Text style={styles.complianceLabel}>
            STOCK Act on-time filing compliance (federal 45-day deadline)
          </Text>
        </View>
      )}

      <CardSubsection
        label={`Stock trades (${stockCount})`}
        open={openStock}
        onToggle={() => setOpenStock(v => !v)}
      >
        <FederalStockTransactionsList rows={stock.data ?? []} />
      </CardSubsection>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.neutral.background,
    borderColor: COLORS.neutral.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: COLORS.brand.text },
  muted: { color: COLORS.neutral.textMuted, fontSize: 13 },
  summary: { fontSize: 13, color: COLORS.neutral.textMuted, marginBottom: 12 },
  complianceTile: {
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  compliancePct: { fontSize: 24, fontWeight: '700' },
  complianceLabel: {
    fontSize: 12,
    color: COLORS.neutral.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
})
