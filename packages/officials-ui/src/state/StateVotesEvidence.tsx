'use client'

import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import type { StateVoteWithPosition } from '@chiaro/state-bills'
import { useBrandTokens } from '../brand-hooks.ts'

const INITIAL_ROW_COUNT = 5

function positionLabel(p: StateVoteWithPosition['position']): string {
  if (p === 'yes')        return 'yes'
  if (p === 'no')         return 'no'
  if (p === 'abstain')    return 'abstain'
  if (p === 'not_voting') return 'missed'
  if (p === 'present')    return 'present'
  return p
}

export interface StateVotesEvidenceProps {
  votes: StateVoteWithPosition[]
}

export function StateVotesEvidence({ votes }: StateVotesEvidenceProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { semantic } = useBrandTokens()

  const emptyStyle = [styles.empty, { color: semantic.text.muted }]
  const rowStyle = [styles.row, { borderTopColor: semantic.border.default }]
  const questionStyle = [styles.question, { color: semantic.text.primary }]
  const chipStyle = [
    styles.chip,
    { borderColor: semantic.border.default, backgroundColor: semantic.bg.app },
  ]
  const chipTextStyle = [styles.chipText, { color: semantic.text.primary }]
  const metaStyle = [styles.meta, { color: semantic.text.muted }]
  const moreButtonStyle = [styles.moreButton, { borderColor: semantic.border.default }]
  const moreTextStyle = [styles.moreText, { color: semantic.text.primary }]

  if (votes.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text style={emptyStyle}>No votes this session.</Text>
      </View>
    )
  }
  const visible = expanded ? votes : votes.slice(0, INITIAL_ROW_COUNT)
  const hasMore = votes.length > INITIAL_ROW_COUNT
  return (
    <View testID="state-votes-evidence">
      {visible.map(v => {
        const split = v.vote.party_vote_split as Record<string, number> | null
        return (
          <View key={v.vote.id} style={rowStyle}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => Linking.openURL(v.vote.source_url).catch(() => {})}
                style={{ flexShrink: 1, paddingRight: 8 }}
              >
                <Text style={questionStyle}>{v.vote.question}</Text>
              </Pressable>
              <View style={chipStyle}>
                <Text style={chipTextStyle}>{positionLabel(v.position)}</Text>
              </View>
            </View>
            <Text style={metaStyle}>
              {v.vote.vote_date} · {v.vote.result}
              {split && (
                <Text style={metaStyle}>
                  {'  '}
                  {Object.entries(split).map(([k, n]) => `${k}: ${n}`).join(' · ')}
                </Text>
              )}
            </Text>
          </View>
        )
      })}
      {hasMore && (
        <Pressable onPress={() => setExpanded(e => !e)} style={moreButtonStyle}>
          <Text style={moreTextStyle}>
            {expanded ? 'show less' : `show more (${votes.length - INITIAL_ROW_COUNT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, fontStyle: 'italic' },
  row: {
    padding: 8,
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  question: { fontSize: 14, fontWeight: '600' },
  chip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipText: { fontSize: 12 },
  meta: { fontSize: 12, marginTop: 2 },
  moreButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
  },
  moreText: { fontSize: 12 },
})
