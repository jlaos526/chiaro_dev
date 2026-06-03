'use client'

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { IssueTopic, QuizAnswer, QuizQuestion } from '@chiaro/issues'
import { useBrandTokens } from '../brand-hooks.ts'
import { WEB_VIEWPORT_FILL } from '../screens/_viewport-fill.ts'
import { BrandHeading } from '../primitives/BrandHeading.tsx'
import { BrandBodyText } from '../primitives/BrandBodyText.tsx'
import { BrandButton } from '../primitives/BrandButton.tsx'
import { useIssueFlow } from './IssueFlowProvider.tsx'

export interface IssueQuizScreenProps {
  /** The full issue catalog (the route passes `useIssueCatalog()` data). */
  catalog: IssueTopic[]
  /** Advance to the radar-result step (every question answered). */
  onFinish: () => void
}

/** One quiz item with its owning (topic, lens) keys for `setAnswer`. */
interface QuizItem {
  topicSlug: string
  lensSlug: string
  question: QuizQuestion
}

type AnswerValue = QuizAnswer['answer']

const ANSWER_CHOICES: ReadonlyArray<{ value: AnswerValue; label: string }> = [
  { value: 'disagree', label: 'Disagree' },
  { value: 'agree', label: 'Agree' },
  { value: 'skip', label: 'Skip' },
]

/**
 * Build the ordered quiz item list from the wizard's selected lenses.
 *
 * Only STANCE lenses are scored, so only their `quiz_questions` become items —
 * watchlist lenses and unselected lenses contribute nothing. Items are ordered
 * by topic (selection order in `selectedTopics`), then lens (selection order in
 * `selectedLenses`), then `question.display_order`.
 */
function buildQuizItems(
  catalog: IssueTopic[],
  selectedTopics: string[],
  selectedLenses: Record<string, string[]>,
): QuizItem[] {
  const items: QuizItem[] = []
  for (const topicSlug of selectedTopics) {
    const topic = catalog.find((t) => t.slug === topicSlug)
    if (topic == null) continue
    for (const lensSlug of selectedLenses[topicSlug] ?? []) {
      const lens = topic.lenses.find((l) => l.slug === lensSlug)
      // Watchlists aren't scored → no questions.
      if (lens == null || lens.lens_type !== 'stance') continue
      const questions = [...lens.quiz_questions].sort((a, b) => a.display_order - b.display_order)
      for (const question of questions) {
        items.push({ topicSlug, lensSlug, question })
      }
    }
  }
  return items
}

/**
 * Step 4 of the issue-priorities flow: a yes/no quiz drawn ONLY from the
 * selected stance lenses.
 *
 * Presentational — wizard state lives in {@link useIssueFlow}. Each question is
 * a card with Disagree / Agree / Skip choices + a "★ extra weight" toggle.
 * Every interaction upserts a {@link QuizAnswer} via `setAnswer` (the provider
 * dedupes by composite key). A progress counter shows answered / total, and
 * "See my radar" enables once every question has an answer (skip counts).
 */
export function IssueQuizScreen({ catalog, onFinish }: IssueQuizScreenProps): React.JSX.Element {
  const { semantic } = useBrandTokens()
  const { selectedTopics, selectedLenses, answers, setAnswer } = useIssueFlow()

  const items = buildQuizItems(catalog, selectedTopics, selectedLenses)

  // Index answers by composite key for O(1) lookup per card.
  const answerByKey = new Map<string, QuizAnswer>()
  for (const a of answers) answerByKey.set(`${a.topicSlug}::${a.lensSlug}::${a.questionSlug}`, a)
  const keyOf = (item: QuizItem): string =>
    `${item.topicSlug}::${item.lensSlug}::${item.question.slug}`

  const total = items.length
  const answered = items.filter((it) => answerByKey.has(keyOf(it))).length
  const canFinish = total > 0 && answered === total

  function choose(item: QuizItem, value: AnswerValue): void {
    const prev = answerByKey.get(keyOf(item))
    setAnswer({
      topicSlug: item.topicSlug,
      lensSlug: item.lensSlug,
      questionSlug: item.question.slug,
      answer: value,
      starred: prev?.starred ?? false,
    })
  }

  function toggleStar(item: QuizItem): void {
    const prev = answerByKey.get(keyOf(item))
    setAnswer({
      topicSlug: item.topicSlug,
      lensSlug: item.lensSlug,
      questionSlug: item.question.slug,
      // Starring before answering leaves the answer pending as a 'skip' default
      // would mark it answered prematurely; keep the prior answer if present.
      answer: prev?.answer ?? 'skip',
      starred: !(prev?.starred ?? false),
    })
  }

  return (
    <View style={[styles.outer, { backgroundColor: semantic.bg.app }, WEB_VIEWPORT_FILL]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <BrandHeading level={1}>A few quick questions</BrandHeading>
          <BrandBodyText muted>
            Tell us where you stand. Star the ones that matter most for extra weight, or skip any you
            are unsure about.
          </BrandBodyText>

          <View style={styles.progressRow}>
            <Text
              accessibilityLabel={`${answered} of ${total} questions answered`}
              style={[
                styles.progress,
                { color: canFinish ? semantic.accent.primary : semantic.text.muted },
              ]}
            >
              {answered} / {total}
            </Text>
          </View>

          {items.map((item) => {
            const current = answerByKey.get(keyOf(item))
            const starred = current?.starred ?? false
            return (
              <View
                key={keyOf(item)}
                style={[styles.card, { backgroundColor: semantic.bg.card, borderColor: semantic.border.default }]}
              >
                <Text style={[styles.prompt, { color: semantic.text.primary }]}>
                  {item.question.prompt}
                </Text>

                <View style={styles.choices}>
                  {ANSWER_CHOICES.map((choice) => {
                    const selected = current?.answer === choice.value
                    return (
                      <Pressable
                        key={choice.value}
                        onPress={() => choose(item, choice.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        aria-pressed={selected}
                        accessibilityLabel={`${choice.label}: ${item.question.prompt}`}
                        dataSet={{ answerChoice: choice.value }}
                        style={[
                          styles.choice,
                          {
                            backgroundColor: selected ? semantic.accent.bg : semantic.bg.subtle,
                            borderColor: selected ? semantic.accent.primary : semantic.border.default,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            { color: selected ? semantic.accent.primary : semantic.text.body },
                          ]}
                        >
                          {choice.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>

                <Pressable
                  onPress={() => toggleStar(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: starred }}
                  aria-pressed={starred}
                  accessibilityLabel={starred ? 'Remove extra weight' : 'Give extra weight'}
                  dataSet={{ starToggle: '' }}
                  style={styles.star}
                >
                  <Text
                    style={[
                      styles.starText,
                      { color: starred ? semantic.accent.primary : semantic.text.muted },
                    ]}
                  >
                    {starred ? '★ extra weight' : '☆ extra weight'}
                  </Text>
                </Pressable>
              </View>
            )
          })}

          <View style={styles.footer}>
            <BrandButton onPress={onFinish} disabled={!canFinish} size="lg">
              See my radar
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
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  progress: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  choices: {
    flexDirection: 'row',
    gap: 8,
  },
  choice: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  choiceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  star: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  starText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 16,
    alignItems: 'stretch',
  },
})
