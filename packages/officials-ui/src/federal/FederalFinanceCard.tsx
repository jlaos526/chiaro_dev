'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useOfficialFinance } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { FederalDonorsList } from './FederalDonorsList.tsx'
import { FederalPACsList } from './FederalPACsList.tsx'

export interface FederalFinanceCardProps {
  officialId: string
  /** FEC cycle, e.g. '2024'. */
  cycle: string
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

export function FederalFinanceCard({
  officialId,
  cycle,
}: FederalFinanceCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const finance = useOfficialFinance(client, officialId, cycle)

  const [openDonors, setOpenDonors] = useState(false)
  const [openPACs, setOpenPACs] = useState(false)

  if (finance.isLoading) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
        ]}
      >
        <Text
          style={[styles.title, { color: semantic.text.primary }]}
          accessibilityRole="header"
          accessibilityLevel={2}
        >
          Finance ({cycle})
        </Text>
        <Text style={[styles.muted, { color: semantic.text.muted }]}>Loading finance…</Text>
      </View>
    )
  }

  const f = finance.data ?? null
  if (!f) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
        ]}
      >
        <Text
          style={[styles.title, { color: semantic.text.primary }]}
          accessibilityRole="header"
          accessibilityLevel={2}
        >
          Finance ({cycle})
        </Text>
        <Text style={[styles.muted, { color: semantic.text.muted, fontStyle: 'italic' }]}>
          No finance data available for this legislator and cycle.
        </Text>
      </View>
    )
  }

  const totalRaised = f.summary?.total_raised == null ? null : Number(f.summary.total_raised)
  const donorCount = f.individualDonors.length
  const pacCount = f.pacs.length

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: semantic.bg.elevated, borderColor: semantic.border.default },
      ]}
    >
      <Text
        style={[styles.title, { color: semantic.text.primary }]}
        accessibilityRole="header"
        accessibilityLevel={2}
      >
        Finance ({cycle})
      </Text>
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
        {fmtAmount(totalRaised)} raised
        {' · '}
        {`${donorCount} donor${donorCount === 1 ? '' : 's'}`}
        {' · '}
        {`${pacCount} PAC${pacCount === 1 ? '' : 's'}`}
      </Text>

      <CardSubsection
        label={`Top individual donors (${donorCount})`}
        open={openDonors}
        onToggle={() => setOpenDonors((v) => !v)}
      >
        <FederalDonorsList finance={f} />
      </CardSubsection>

      <CardSubsection
        label={`Top PACs (${pacCount})`}
        open={openPACs}
        onToggle={() => setOpenPACs((v) => !v)}
      >
        <FederalPACsList finance={f} />
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
})
