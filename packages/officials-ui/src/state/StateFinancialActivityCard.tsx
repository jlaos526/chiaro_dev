'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useOfficialStateFinancialDisclosures } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { StateFinancialDisclosuresList } from './StateFinancialDisclosuresList.tsx'

export interface StateFinancialActivityCardProps {
  officialId: string
}

export function StateFinancialActivityCard({
  officialId,
}: StateFinancialActivityCardProps): React.JSX.Element {
  const client = useChiaroClient()
  const disclosures = useOfficialStateFinancialDisclosures(client, officialId)

  const [openDisc, setOpenDisc] = useState(false)

  if (disclosures.isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Financial Disclosures</Text>
        <Text style={styles.muted}>Loading financial disclosures…</Text>
      </View>
    )
  }

  const discCount = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null

  if (discCount === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Financial Disclosures</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No financial-disclosure records on file for this legislator.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Financial Disclosures</Text>
      <Text style={styles.summary}>
        {discCount != null
          ? `${discCount} disclosure${discCount === 1 ? '' : 's'}${latestYear ? ` (latest ${latestYear})` : ''}`
          : '—'}
      </Text>

      <CardSubsection
        label={`Financial disclosures (${discCount ?? '—'})`}
        open={openDisc}
        onToggle={() => setOpenDisc(v => !v)}
      >
        <StateFinancialDisclosuresList rows={disclosures.data ?? []} />
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
})
