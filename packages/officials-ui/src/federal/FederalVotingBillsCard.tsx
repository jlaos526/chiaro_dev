'use client'

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  useOfficialCosponsoredBills,
  useOfficialMissedVotes,
  useOfficialSponsoredBills,
} from '@chiaro/bills'
import { useOfficialMetrics } from '@chiaro/officials'
import { useBrandTokens } from '../brand-hooks.ts'
import { CardSubsection } from '../cards/CardSubsection.tsx'
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
  const metrics = useOfficialMetrics(client, officialId)
  const sponsored = useOfficialSponsoredBills(client, officialId, congress)
  const cosponsored = useOfficialCosponsoredBills(client, officialId, congress)
  const missed = useOfficialMissedVotes(client, officialId, congress)

  const [openSponsored, setOpenSponsored] = useState(false)
  const [openCosponsored, setOpenCosponsored] = useState(false)
  const [openMissed, setOpenMissed] = useState(false)

  if (sponsored.isLoading || cosponsored.isLoading || missed.isLoading || metrics.isLoading) {
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
          Voting & Bills ({congress}th Congress)
        </Text>
        <Text style={[styles.muted, { color: semantic.text.muted }]}>Loading voting & bills…</Text>
      </View>
    )
  }

  const sponsoredCount = sponsored.data?.length ?? 0
  const cosponsoredCount = cosponsored.data?.length ?? 0
  const missedCount = missed.data?.length ?? 0
  const attendance = metrics.data?.attendance_pct ?? null

  const allEmpty = sponsoredCount === 0 && cosponsoredCount === 0 && missedCount === 0
  if (allEmpty) {
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
          Voting & Bills ({congress}th Congress)
        </Text>
        <Text style={[styles.muted, { color: semantic.text.muted, fontStyle: 'italic' }]}>
          No bill or voting-record data on file for this Congress.
        </Text>
      </View>
    )
  }

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
        Voting & Bills ({congress}th Congress)
      </Text>
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
        <FederalSponsoredBillsList rows={sponsored.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`Cosponsored bills (${cosponsoredCount})`}
        open={openCosponsored}
        onToggle={() => setOpenCosponsored((v) => !v)}
      >
        <FederalCosponsoredBillsList rows={cosponsored.data ?? []} />
      </CardSubsection>

      <CardSubsection
        label={`Missed votes (${missedCount})`}
        open={openMissed}
        onToggle={() => setOpenMissed((v) => !v)}
      >
        <FederalMissedVotesList rows={missed.data ?? []} />
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
