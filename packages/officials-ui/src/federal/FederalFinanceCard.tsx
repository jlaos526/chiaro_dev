'use client'

import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useOfficialFinance } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
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

  const f = finance.data ?? null
  const rawTotal = f?.summary?.total_raised
  const totalRaised = rawTotal == null ? null : Number(rawTotal)
  const donorCount = f?.individualDonors.length ?? 0
  const pacCount = f?.pacs.length ?? 0

  return (
    <DetailCardShell
      title={`Finance (${cycle})`}
      isLoading={finance.isLoading}
      isError={finance.isError}
      onRetry={() => {
        void finance.refetch()
      }}
      isEmpty={!f}
      emptyText="No finance data available for this legislator and cycle."
    >
      {/* Children are constructed even when the shell renders another branch,
          so the data body is guarded on `f` (null while loading/empty). */}
      {f ? (
        <>
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
        </>
      ) : null}
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, marginBottom: 12 },
})
