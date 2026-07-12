'use client'

import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useOfficialStateFinancialDisclosures } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
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

  // NULL-vs-0 convention: count is null when data isn't ingested (renders
  // "—" in the data branch), and only a KNOWN zero routes to the empty state.
  const discCount = disclosures.data?.length ?? null
  const latestYear = disclosures.data?.[0]?.filing_year ?? null

  return (
    <DetailCardShell
      title="Financial Disclosures"
      isLoading={disclosures.isLoading}
      isError={disclosures.isError}
      onRetry={() => {
        void disclosures.refetch()
      }}
      isEmpty={discCount === 0}
      emptyText="No financial-disclosure records on file for this legislator."
    >
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
        {discCount != null
          ? `${discCount} disclosure${discCount === 1 ? '' : 's'}${latestYear ? ` (latest ${latestYear})` : ''}`
          : '—'}
      </Text>

      <CardSubsection
        label={`Financial disclosures (${discCount ?? '—'})`}
        open={openDisc}
        onToggle={() => setOpenDisc((v) => !v)}
      >
        <StateFinancialDisclosuresList rows={disclosures.data ?? []} />
      </CardSubsection>
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, marginBottom: 12 },
})
