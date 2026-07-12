'use client'

import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import {
  useOfficialCosponsoredBills,
  useOfficialCosponsoredBillsCount,
  useOfficialMissedVotes,
  useOfficialMissedVotesCount,
  useOfficialSponsoredBills,
  useOfficialSponsoredBillsCount,
} from '@chiaro/bills'
import { useOfficialMetrics } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
import { DetailCardShell } from '../cards/DetailCardShell.tsx'
import { useChiaroClient } from '../client-context.tsx'
import { FederalCosponsoredBillsList } from './FederalCosponsoredBillsList.tsx'
import { FederalMissedVotesList } from './FederalMissedVotesList.tsx'
import { FederalSponsoredBillsList } from './FederalSponsoredBillsList.tsx'

export interface FederalVotingBillsCardProps {
  officialId: string
  /** Congress number, e.g. '119'. */
  congress: string
}

export function FederalVotingBillsCard({
  officialId,
  congress,
}: FederalVotingBillsCardProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const client = useChiaroClient()
  const [openSponsored, setOpenSponsored] = useState(false)
  const [openCosponsored, setOpenCosponsored] = useState(false)
  const [openMissed, setOpenMissed] = useState(false)

  const metrics = useOfficialMetrics(client, officialId)
  // Slice 75 (audit C12): closed subsections need only COUNTS for their
  // labels — head-only count queries transfer zero rows. The full-row hooks
  // gate on first expand (TanStack keeps the data cached across re-collapse),
  // so a page open stopped downloading e.g. ~400 cosponsored bill rows just
  // to print "400 cosponsored".
  const sponsoredCountQ = useOfficialSponsoredBillsCount(client, officialId, congress)
  const cosponsoredCountQ = useOfficialCosponsoredBillsCount(client, officialId, congress)
  const missedCountQ = useOfficialMissedVotesCount(client, officialId, congress)
  const sponsored = useOfficialSponsoredBills(client, officialId, congress, {
    enabled: openSponsored,
  })
  const cosponsored = useOfficialCosponsoredBills(client, officialId, congress, {
    enabled: openCosponsored,
  })
  const missed = useOfficialMissedVotes(client, officialId, congress, { enabled: openMissed })

  const sponsoredCount = sponsoredCountQ.data ?? 0
  const cosponsoredCount = cosponsoredCountQ.data ?? 0
  const missedCount = missedCountQ.data ?? 0
  const attendance = metrics.data?.attendance_pct ?? null

  // Shell gating covers the UNCONDITIONAL queries only (metrics + the 3
  // counts); the enabled-gated full-row hooks keep their in-subsection
  // loading text below.
  return (
    <DetailCardShell
      title={`Voting & Bills (${congress}th Congress)`}
      isLoading={
        sponsoredCountQ.isLoading ||
        cosponsoredCountQ.isLoading ||
        missedCountQ.isLoading ||
        metrics.isLoading
      }
      isError={
        sponsoredCountQ.isError ||
        cosponsoredCountQ.isError ||
        missedCountQ.isError ||
        metrics.isError
      }
      onRetry={() => {
        void sponsoredCountQ.refetch()
        void cosponsoredCountQ.refetch()
        void missedCountQ.refetch()
        void metrics.refetch()
      }}
      isEmpty={sponsoredCount === 0 && cosponsoredCount === 0 && missedCount === 0}
      emptyText="No bill or voting-record data on file for this Congress."
    >
      <Text style={[styles.summary, { color: semantic.text.muted }]}>
        {`${sponsoredCount} sponsored`}
        {' · '}
        {`${cosponsoredCount} cosponsored`}
        {' · '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </Text>

      <CardSubsection
        label={`Sponsored bills (${sponsoredCount})`}
        open={openSponsored}
        onToggle={() => setOpenSponsored((v) => !v)}
      >
        {sponsored.isLoading ? (
          <Text style={[styles.muted, { color: semantic.text.muted }]}>Loading bills…</Text>
        ) : (
          <FederalSponsoredBillsList rows={sponsored.data ?? []} />
        )}
      </CardSubsection>

      <CardSubsection
        label={`Cosponsored bills (${cosponsoredCount})`}
        open={openCosponsored}
        onToggle={() => setOpenCosponsored((v) => !v)}
      >
        {cosponsored.isLoading ? (
          <Text style={[styles.muted, { color: semantic.text.muted }]}>Loading bills…</Text>
        ) : (
          <FederalCosponsoredBillsList rows={cosponsored.data ?? []} />
        )}
      </CardSubsection>

      <CardSubsection
        label={`Missed votes (${missedCount})`}
        open={openMissed}
        onToggle={() => setOpenMissed((v) => !v)}
      >
        {missed.isLoading ? (
          <Text style={[styles.muted, { color: semantic.text.muted }]}>Loading votes…</Text>
        ) : (
          <FederalMissedVotesList rows={missed.data ?? []} />
        )}
      </CardSubsection>
    </DetailCardShell>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13 },
  summary: { fontSize: 13, marginBottom: 12 },
})
