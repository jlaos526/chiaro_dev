'use client'

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { IssueLens, IssueTopic } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandButton } from '../primitives/BrandButton.tsx'
import { useIssueFlow } from './IssueFlowProvider.tsx'

export interface LensPickerScreenProps {
  /** The full issue catalog (the route passes `useIssueCatalog()` data). */
  catalog: IssueTopic[]
  /** Advance to the quiz step (≥1 lens selected per selected topic). */
  onNext: () => void
}

/** Human-readable badge text per lens type. */
function badgeLabel(lensType: IssueLens['lens_type']): string {
  return lensType === 'watchlist' ? 'Watchlist' : 'Stance'
}

/**
 * Step 3 of the issue-priorities flow: for each selected topic, pick ≥1 lens.
 *
 * Presentational — wizard state lives in {@link useIssueFlow}. A topic groups
 * its lenses (looked up from `catalog`); each lens is a multi-select row showing
 * its `label` + a badge distinguishing `lens_type` ('Stance' vs 'Watchlist').
 * Only STANCE lenses get scored later (they carry quiz questions); watchlist
 * lenses are tracked for the rep's record but never quizzed. "Continue" enables
 * once every selected topic has ≥1 lens.
 */
export function LensPickerScreen({ catalog, onNext }: LensPickerScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { selectedTopics, selectedLenses, toggleLens } = useIssueFlow()

  // Resolve each selected topic against the catalog (preserve selection order;
  // drop any slug not present in the catalog defensively).
  const topics = selectedTopics
    .map((slug) => catalog.find((t) => t.slug === slug))
    .filter((t): t is IssueTopic => t != null)

  // Continue is enabled only when EVERY selected topic has ≥1 lens chosen.
  const canContinue =
    topics.length > 0 && topics.every((t) => (selectedLenses[t.slug] ?? []).length >= 1)

  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <BrandHeading level={1}>Pick your lenses</BrandHeading>
          <BrandBodyText muted>
            For each issue, choose the angles you care about. Stance lenses ask a few quick
            questions next; watchlists just track an official&apos;s record.
          </BrandBodyText>

          {topics.map((topic) => {
            const chosen = selectedLenses[topic.slug] ?? []
            return (
              <View key={topic.slug} style={styles.group}>
                <Text style={[styles.groupTitle, { color: semantic.text.primary }]}>
                  {topic.display_name}
                </Text>
                <View style={styles.lensList}>
                  {topic.lenses.map((lens) => {
                    const selected = chosen.includes(lens.slug)
                    const isWatchlist = lens.lens_type === 'watchlist'
                    return (
                      <Pressable
                        key={lens.slug}
                        onPress={() => toggleLens(topic.slug, lens.slug)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        aria-pressed={selected}
                        accessibilityLabel={`${lens.label} (${badgeLabel(lens.lens_type)})`}
                        dataSet={{ lensRow: '' }}
                        style={[
                          styles.lensRow,
                          {
                            backgroundColor: selected ? semantic.accent.bg : semantic.bg.card,
                            borderColor: selected
                              ? semantic.accent.primary
                              : semantic.border.default,
                            borderWidth: selected ? 2 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.lensLabel,
                            { color: selected ? semantic.accent.primary : semantic.text.body },
                          ]}
                        >
                          {lens.label}
                        </Text>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: isWatchlist
                                ? semantic.bg.subtle
                                : semantic.accent.bg,
                              borderColor: isWatchlist
                                ? semantic.border.default
                                : semantic.accent.primary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color: isWatchlist ? semantic.text.muted : semantic.accent.primary,
                              },
                            ]}
                          >
                            {badgeLabel(lens.lens_type)}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )
          })}

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
    gap: 14,
  },
  group: {
    gap: 8,
    marginTop: 6,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  lensList: {
    gap: 8,
  },
  lensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  lensLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  footer: {
    marginTop: 16,
    alignItems: 'stretch',
  },
})
