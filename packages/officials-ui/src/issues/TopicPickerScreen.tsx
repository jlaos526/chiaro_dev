'use client'

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { IssueTopic } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandButton } from '../primitives/BrandButton.tsx'
import { useIssueFlow, MAX_TOPICS } from './IssueFlowProvider.tsx'

export interface TopicPickerScreenProps {
  /** The full issue catalog (the route passes `useIssueCatalog()` data). */
  topics: IssueTopic[]
  /** Advance to the lens-picker step (≥1 topic selected). */
  onNext: () => void
}

/**
 * Step 2 of the issue-priorities flow: pick up to {@link MAX_TOPICS} topics.
 *
 * Presentational — wizard state lives in {@link useIssueFlow}. Multi-select
 * grid of topic cards; once at the cap, unselected cards are disabled/no-op
 * (the provider's `toggleTopic` already ignores the 7th add, but we also dim
 * the card for affordance). A `N / 6` counter and a "Continue" CTA that
 * enables at ≥1 selection.
 */
export function TopicPickerScreen({ topics, onNext }: TopicPickerScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { selectedTopics, toggleTopic } = useIssueFlow()
  const atCap = selectedTopics.length >= MAX_TOPICS
  const canContinue = selectedTopics.length >= 1

  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <BrandHeading level={1}>What matters to you?</BrandHeading>
          <BrandBodyText muted>
            Pick up to {MAX_TOPICS} issues you care about most. You can change these any time.
          </BrandBodyText>

          <View style={styles.counterRow}>
            <Text
              accessibilityLabel={`${selectedTopics.length} of ${MAX_TOPICS} topics selected`}
              style={[styles.counter, { color: atCap ? semantic.accent.primary : semantic.text.muted }]}
            >
              {selectedTopics.length} / {MAX_TOPICS}
            </Text>
          </View>

          <View style={styles.grid}>
            {topics.map((topic) => {
              const selected = selectedTopics.includes(topic.slug)
              const disabled = atCap && !selected
              return (
                <Pressable
                  key={topic.slug}
                  onPress={() => toggleTopic(topic.slug)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  aria-pressed={selected}
                  accessibilityLabel={topic.display_name}
                  dataSet={{ topicCard: '' }}
                  style={[
                    styles.card,
                    {
                      backgroundColor: selected ? semantic.accent.bg : semantic.bg.card,
                      borderColor: selected ? semantic.accent.primary : semantic.border.default,
                      borderWidth: selected ? 2 : 1,
                      opacity: disabled ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.cardTitle,
                      { color: selected ? semantic.accent.primary : semantic.text.primary },
                    ]}
                  >
                    {topic.display_name}
                  </Text>
                  {topic.description ? (
                    <Text numberOfLines={2} style={[styles.cardDesc, { color: semantic.text.muted }]}>
                      {topic.description}
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
          </View>

          <View style={styles.footer}>
            <BrandButton onPress={onNext} disabled={!canContinue} size="lg">
              Continue
            </BrandButton>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  column: {
    width: '100%',
    maxWidth: 560,
    gap: 12,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  counter: {
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 150,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    marginTop: 16,
    alignItems: 'stretch',
  },
})
