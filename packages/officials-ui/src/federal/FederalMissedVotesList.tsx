'use client'

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { VoteRow, VotePositionEnum } from '@chiaro/bills'
import { COLORS } from '@chiaro/ui-tokens'
import { useBrandTokens } from '../brand-hooks.ts'

/**
 * Matches the return shape of `fetchOfficialMissedVotes` in @chiaro/bills:
 * `Array<{ vote_id; position; vote: VoteRow }>`. Declared inline as a
 * structural type because there is no named `MissedVoteRow` export.
 */
export interface MissedVoteEntry {
  vote_id: string
  position: VotePositionEnum
  vote: VoteRow
}

export interface FederalMissedVotesListProps {
  rows: MissedVoteEntry[]
}

export function FederalMissedVotesList({ rows }: FederalMissedVotesListProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  if (rows.length === 0) {
    return (
      <Text style={[styles.muted, { color: semantic.text.muted }]}>
        No missed votes in current Congress.
      </Text>
    )
  }
  return (
    <View style={styles.list}>
      {rows.slice(0, 25).map(r => {
        const url = r.vote.source_url ?? null
        const Row = url ? Pressable : View
        return (
          <Row
            key={r.vote_id}
            {...(url ? { onPress: () => Linking.openURL(url).catch(() => {}) } : {})}
            style={[styles.row, { backgroundColor: semantic.bg.app }]}
          >
            <View style={styles.rowHeader}>
              <Text style={[styles.title, { color: semantic.text.primary }]}>
                {r.vote.vote_date} · Roll Call #{r.vote.roll_call}
              </Text>
              <Text
                style={[
                  styles.chip,
                  { color: COLORS.signal.warning, backgroundColor: `${COLORS.signal.warning}22` },
                ]}
              >
                MISSED
              </Text>
            </View>
            {r.vote.question && (
              <Text style={[styles.question, { color: semantic.text.primary }]}>{r.vote.question}</Text>
            )}
          </Row>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontStyle: 'italic', padding: 8 },
  list: { gap: 6, padding: 8 },
  row: {
    borderRadius: 6,
    padding: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  title: { fontSize: 13, fontWeight: '500' },
  chip: {
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  question: { fontSize: 12 },
})
