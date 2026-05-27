'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useOfficialStateFinancialDisclosures } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
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
  const { semantic } = useBrandTokens()
  const disclosures = useOfficialStateFinancialDisclosures(client, officialId)

  const [openDisc, setOpenDisc] = useState(false)

  const cardStyle = [
    styles.card,
    { backgroundColor: semantic.bg.app, borderColor: semantic.border.default },
  ]
  const titleStyle = [styles.title, { color: semantic.text.primary }]
  const mutedStyle = [styles.muted, { color: semantic.text.muted }]
  const summaryStyle = [styles.summary, { color: semantic.text.muted }]

  if (disclosures.isLoading) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle}>Financial Disclosures</Text>
        <Text style={mutedStyle}>Loading financial disclosures…</Text>
      </View>
    )
  }

  const discCount = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null

  if (discCount === 0) {
    return (
      <View style={cardStyle}>
        <Text style={titleStyle}>Financial Disclosures</Text>
        <Text style={[mutedStyle, { fontStyle: 'italic' }]}>
          No financial-disclosure records on file for this legislator.
        </Text>
      </View>
    )
  }

  return (
    <View style={cardStyle}>
      <Text style={titleStyle}>Financial Disclosures</Text>
      <Text style={summaryStyle}>
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
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
})
