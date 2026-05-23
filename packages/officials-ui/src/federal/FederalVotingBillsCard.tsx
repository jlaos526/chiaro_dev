'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useOfficialCosponsoredBills,
  useOfficialMissedVotes,
  useOfficialSponsoredBills,
} from '@chiaro/bills'
import { useOfficialMetrics } from '@chiaro/officials'
import { COLORS } from '@chiaro/ui-tokens'
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
  const client = useChiaroClient()
  const metrics = useOfficialMetrics(client, officialId)
  const sponsored = useOfficialSponsoredBills(client, officialId, congress)
  const cosponsored = useOfficialCosponsoredBills(client, officialId, congress)
  const missed = useOfficialMissedVotes(client, officialId, congress)

  const [openSponsored, setOpenSponsored] = useState(false)
  const [openCosponsored, setOpenCosponsored] = useState(false)
  const [openMissed, setOpenMissed] = useState(false)

  if (
    sponsored.isLoading
    || cosponsored.isLoading
    || missed.isLoading
    || metrics.isLoading
  ) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Voting & Bills ({congress}th Congress)</Text>
        <Text style={styles.muted}>Loading voting & bills…</Text>
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
      <View style={styles.card}>
        <Text style={styles.title}>Voting & Bills ({congress}th Congress)</Text>
        <Text style={[styles.muted, { fontStyle: 'italic' }]}>
          No bill or voting-record data on file for this Congress.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Voting & Bills ({congress}th Congress)</Text>
      <Text style={styles.summary}>
        {`${sponsoredCount} sponsored`}
        {' · '}
        {`${cosponsoredCount} cosponsored`}
        {' · '}
        {attendance != null ? `${attendance}% attendance` : '—'}
      </Text>

      <Subsection
        label={`Sponsored bills (${sponsoredCount})`}
        open={openSponsored}
        onToggle={() => setOpenSponsored(v => !v)}
      >
        <FederalSponsoredBillsList rows={sponsored.data ?? []} />
      </Subsection>

      <Subsection
        label={`Cosponsored bills (${cosponsoredCount})`}
        open={openCosponsored}
        onToggle={() => setOpenCosponsored(v => !v)}
      >
        <FederalCosponsoredBillsList rows={cosponsored.data ?? []} />
      </Subsection>

      <Subsection
        label={`Missed votes (${missedCount})`}
        open={openMissed}
        onToggle={() => setOpenMissed(v => !v)}
      >
        <FederalMissedVotesList rows={missed.data ?? []} />
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
    marginTop: 8,
  },
  subsectionLabel: {
    color: COLORS.brand.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 6,
  },
})
