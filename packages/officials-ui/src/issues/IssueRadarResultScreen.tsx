'use client'

import { ScrollView, StyleSheet, View } from 'react-native'
import {
  derivePositions,
  type IssueTopic,
  type QuizAnswer,
  type SaveSelectionsPayload,
  type StancePosition,
} from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandButton } from '../primitives/BrandButton.tsx'
import { IssueRadarChart } from './IssueRadarChart.tsx'
import { useIssueFlow } from './IssueFlowProvider.tsx'

export interface IssueRadarResultScreenProps {
  /** The full issue catalog (the route passes `useIssueCatalog()` data). */
  catalog: IssueTopic[]
  /**
   * Persist the user's selections. The screen builds the full
   * {@link SaveSelectionsPayload} (one row per selected lens) and calls this;
   * the route wires it to `useSaveSelections().mutate`.
   */
  onSave: (payload: SaveSelectionsPayload) => void
}

/**
 * Resolve a quiz question's `agree_direction` from the catalog.
 *
 * derivePositions needs `(answer) => 1 | -1` so it can flip "agree" into a
 * 0/1 score: when `agree_direction === 1`, agreeing means the user holds the
 * topic's affirmative stance; when `-1`, disagreeing does. Unknown questions
 * default to +1 (treat "agree" as the affirmative position).
 */
function makeAgreeDirection(catalog: IssueTopic[]): (a: QuizAnswer) => 1 | -1 {
  // Index quiz questions by composite key for O(1) lookup per answer.
  const byKey = new Map<string, 1 | -1>()
  for (const topic of catalog) {
    for (const lens of topic.lenses) {
      for (const q of lens.quiz_questions) {
        byKey.set(`${topic.slug}::${lens.slug}::${q.slug}`, q.agree_direction)
      }
    }
  }
  return (a: QuizAnswer): 1 | -1 =>
    byKey.get(`${a.topicSlug}::${a.lensSlug}::${a.questionSlug}`) ?? 1
}

/** Mean of a topic's non-null stance positions, scaled to 0–1; 0 if none. */
function topicRadarValue(topicSlug: string, positions: StancePosition[]): number {
  const scores = positions
    .filter((p) => p.topicSlug === topicSlug && p.position != null)
    .map((p) => p.position as number)
  if (scores.length === 0) return 0
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length
  return mean / 100
}

/**
 * Step 5 of the issue-priorities flow: the user's OWN radar (derived from their
 * quiz answers) + a Save action.
 *
 * Consumes {@link useIssueFlow}. Each radar axis is a selected TOPIC, valued by
 * the mean of its stance positions (skipping nulls). Saving builds one
 * {@link SaveSelectionsPayload} row for EVERY selected (topic, lens): stance
 * lenses carry the derived `position` + `importance`; watchlist lenses carry
 * `position: null, importance: 1`. The radar shows the user's positions — NOT
 * alignment with any rep (that's the rep-page strip, Task 14).
 *
 * Presentational; wizard state lives in the provider. Mode-aware via
 * `useBrandTokens()`.
 */
export function IssueRadarResultScreen({
  catalog,
  onSave,
}: IssueRadarResultScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { selectedTopics, selectedLenses, answers } = useIssueFlow()

  const agreeDirection = makeAgreeDirection(catalog)
  // One StancePosition per scored (topic, lens) — only stance lenses get answers.
  const positions = derivePositions(answers, agreeDirection)
  const positionByKey = new Map<string, StancePosition>()
  for (const p of positions) positionByKey.set(`${p.topicSlug}::${p.lensSlug}`, p)

  // Radar axes = selected topics (labels from the catalog, falling back to the
  // slug). A topic with no non-null stance contributes a 0 spoke.
  const axisLabels = selectedTopics.map(
    (slug) => catalog.find((t) => t.slug === slug)?.display_name ?? slug,
  )
  const userValues = selectedTopics.map((slug) => topicRadarValue(slug, positions))

  // lens_type lookup so save can decide stance-vs-watchlist per (topic, lens).
  function lensType(topicSlug: string, lensSlug: string): IssueTopic['lenses'][number]['lens_type'] | undefined {
    return catalog
      .find((t) => t.slug === topicSlug)
      ?.lenses.find((l) => l.slug === lensSlug)?.lens_type
  }

  function handleSave(): void {
    const payload: SaveSelectionsPayload = []
    // display_order is the topic's selection index (rows of the same topic
    // share it — matches deriveFromSelections' min-per-topic read).
    selectedTopics.forEach((topicSlug, topicIdx) => {
      for (const lensSlug of selectedLenses[topicSlug] ?? []) {
        const derived = positionByKey.get(`${topicSlug}::${lensSlug}`)
        // Stance lenses carry the derived position+importance; everything else
        // (watchlists, or a stance lens with no answer yet) saves as null/1.
        const isStance = lensType(topicSlug, lensSlug) === 'stance' && derived != null
        payload.push({
          topic_slug: topicSlug,
          lens_slug: lensSlug,
          display_order: topicIdx,
          position: isStance ? derived.position : null,
          importance: isStance ? derived.importance : 1,
        })
      }
    })
    onSave(payload)
  }

  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <BrandHeading level={1}>Your issue priorities</BrandHeading>
          <BrandBodyText muted>
            Here&apos;s where you landed. Save to see how your elected officials line up with these
            views.
          </BrandBodyText>

          <View
            accessibilityLabel="Your issue priorities radar"
            style={[styles.chartWrap, { backgroundColor: semantic.bg.card, borderColor: semantic.border.default }]}
          >
            <IssueRadarChart axes={axisLabels} userValues={userValues} />
          </View>

          <View style={styles.footer}>
            <BrandButton onPress={handleSave} size="lg" accessibilityLabel="Save your issue priorities">
              Save my priorities
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  column: {
    width: '100%',
    maxWidth: 460,
    gap: 14,
  },
  chartWrap: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
  },
  footer: {
    marginTop: 8,
    alignItems: 'stretch',
  },
})
