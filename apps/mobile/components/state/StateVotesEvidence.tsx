import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { COLORS } from '@chiaro/ui-tokens'
import type { StateVoteWithPosition } from '@chiaro/state-bills'

const INITIAL_ROW_COUNT = 5

function positionLabel(p: StateVoteWithPosition['position']): string {
  if (p === 'yes')        return 'yes'
  if (p === 'no')         return 'no'
  if (p === 'abstain')    return 'abstain'
  if (p === 'not_voting') return 'missed'
  if (p === 'present')    return 'present'
  return p
}

export function StateVotesEvidence({ votes }: { votes: StateVoteWithPosition[] }) {
  const [expanded, setExpanded] = useState(false)
  if (votes.length === 0) {
    return (
      <View style={{ padding: 8 }}>
        <Text
          style={{
            fontSize: 13,
            color: COLORS.neutral.textMuted,
            fontStyle: 'italic',
          }}
        >
          No votes this session.
        </Text>
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
          <View
            key={v.vote.id}
            style={{
              padding: 8,
              borderTopWidth: 1,
              borderTopColor: COLORS.neutral.border,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Pressable
                onPress={() => {
                  void Linking.openURL(v.vote.source_url)
                }}
                style={{ flexShrink: 1, paddingRight: 8 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: COLORS.brand.text,
                  }}
                >
                  {v.vote.question}
                </Text>
              </Pressable>
              <View
                style={{
                  paddingVertical: 2,
                  paddingHorizontal: 6,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: COLORS.neutral.border,
                  backgroundColor: COLORS.neutral.surface,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.brand.text }}>
                  {positionLabel(v.position)}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted, marginTop: 2 }}>
              {v.vote.vote_date} · {v.vote.result}
              {split && (
                <Text style={{ fontSize: 12, color: COLORS.neutral.textMuted }}>
                  {'  '}
                  {Object.entries(split).map(([k, n]) => `${k}: ${n}`).join(' · ')}
                </Text>
              )}
            </Text>
          </View>
        )
      })}
      {hasMore && (
        <Pressable
          onPress={() => setExpanded(e => !e)}
          style={{
            marginTop: 8,
            paddingVertical: 4,
            paddingHorizontal: 10,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: COLORS.neutral.border,
            borderRadius: 4,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.brand.text }}>
            {expanded ? 'show less' : `show more (${votes.length - INITIAL_ROW_COUNT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
