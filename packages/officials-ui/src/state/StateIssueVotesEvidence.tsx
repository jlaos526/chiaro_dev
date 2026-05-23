'use client'

import { StyleSheet, Text, View } from 'react-native'
import { useOfficialStateVotesOnSubject } from '@chiaro/state-bills'
import { COLORS } from '@chiaro/ui-tokens'
import { useChiaroClient } from '../client-context.tsx'

// Maps a scorecard org's issue_area to candidate subject strings that may
// appear on state_bill_subjects.subject (varies per state). Conservative
// listing — better to under-match than over-match for the v1 evidence panel.
const SUBJECT_BY_AREA_STATE: Record<string, string[]> = {
  'environment':         ['Environment', 'Energy', 'Climate'],
  'civil-liberties':     ['Civil rights', 'Privacy', 'Civil liberties'],
  'reproductive-rights': ['Health', 'Reproductive rights'],
  'second-amendment':    ['Firearms', 'Guns'],
  'business-policy':     ['Commerce', 'Business', 'Taxation'],
  'liberal-policy':      ['Government operations'],
  'conservative-policy': ['Government operations'],
  'labor':               ['Labor', 'Employment'],
}

export interface StateIssueVotesEvidenceProps {
  officialId: string
  issueArea: string
}

export function StateIssueVotesEvidence({
  officialId,
  issueArea,
}: StateIssueVotesEvidenceProps): React.JSX.Element {
  const client = useChiaroClient()
  const subjects = SUBJECT_BY_AREA_STATE[issueArea] ?? []
  const { data, isLoading } = useOfficialStateVotesOnSubject(client, officialId, subjects)

  if (isLoading) {
    return <Text style={styles.muted}>Loading evidence votes…</Text>
  }
  if (!data || data.length === 0) {
    return (
      <Text style={styles.muted}>
        No matching votes for this subject area in current session.
      </Text>
    )
  }
  return (
    <View style={styles.list}>
      {data.slice(0, 5).map(vp => (
        <View key={vp.vote.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.billTitle}>
              {vp.vote.bill?.bill_type} {vp.vote.bill?.number} — {vp.vote.bill?.title}
            </Text>
            <Text style={styles.meta}>
              {vp.vote.question} · {vp.vote.vote_date}
            </Text>
          </View>
          <Text
            style={[
              styles.position,
              {
                color:
                  vp.position === 'yes'
                    ? COLORS.signal.success
                    : vp.position === 'no'
                    ? COLORS.signal.error
                    : COLORS.neutral.textMuted,
              },
            ]}
          >
            {vp.position.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: {
    color: COLORS.neutral.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    padding: 8,
  },
  list: { gap: 6, padding: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.neutral.surface,
    borderRadius: 6,
    padding: 8,
  },
  billTitle: { fontSize: 13, fontWeight: '500', color: COLORS.brand.text },
  meta: { fontSize: 12, color: COLORS.neutral.textMuted },
  position: { fontWeight: '600' },
})
