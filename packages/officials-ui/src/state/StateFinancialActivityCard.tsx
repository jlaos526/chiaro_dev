'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useOfficialStateFinancialDisclosures,
  useOfficialStateStockTransactions,
} from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'
import { StateFinancialDisclosuresList } from './StateFinancialDisclosuresList.tsx'
import { StateStockTransactionsList } from './StateStockTransactionsList.tsx'

export interface StateFinancialActivityCardProps {
  officialId: string
}

export function StateFinancialActivityCard({
  officialId,
}: StateFinancialActivityCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const stock = useOfficialStateStockTransactions(client, officialId)
  const disclosures = useOfficialStateFinancialDisclosures(client, officialId)

  const [openStock, setOpenStock] = useState(false)
  const [openDisc, setOpenDisc] = useState(false)

  if (stock.isLoading || disclosures.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Financial Activity</Text>
        <Text style={styles.muted}>Loading financial activity…</Text>
      </View>
    )
  }

  // Header counts: per NULL-vs-0 convention — em-dash when unknown,
  // numeric (including 0) when known.
  const stockCount = stock.data?.length ?? null
  const discCount = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null
  const allEmpty = stockCount === 0 && discCount === 0

  if (allEmpty) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Financial Activity</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No stock or financial-disclosure records on file for this legislator.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Financial Activity</Text>
      <Text style={styles.summary}>
        {stockCount != null
          ? `${stockCount} stock trade${stockCount === 1 ? '' : 's'}`
          : '—'}
        {' · '}
        {discCount != null
          ? `${discCount} disclosure${discCount === 1 ? '' : 's'}${latestYear ? ` (${latestYear})` : ''}`
          : '—'}
      </Text>

      <Subsection
        label={`Stock trades (${stockCount ?? '—'})`}
        open={openStock}
        onToggle={() => setOpenStock(v => !v)}
      >
        <StateStockTransactionsList rows={stock.data ?? []} />
      </Subsection>

      <Subsection
        label={`Financial disclosures (${discCount ?? '—'})`}
        open={openDisc}
        onToggle={() => setOpenDisc(v => !v)}
      >
        <StateFinancialDisclosuresList rows={disclosures.data ?? []} />
      </Subsection>
    </View>
  )
}

function Subsection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <View style={styles.subsection}>
      <Pressable onPress={onToggle}>
        <Text style={styles.subsectionLabel}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open ? <View>{children}</View> : null}
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
  subsection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral.border,
    paddingTop: 8,
  },
  subsectionLabel: {
    color: COLORS.brand.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 6,
  },
})
