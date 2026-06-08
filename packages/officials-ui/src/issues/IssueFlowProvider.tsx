'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { QuizAnswer, UserIssueSelectionRow } from '@chiaro/issues'

/** Max number of topics a user may pick in the flow (locked spec #2). */
export const MAX_TOPICS = 6

/**
 * Wizard state shared across all 5 onboarding steps (Welcome → Topics → Lenses
 * → Quiz → Radar). The per-platform route mounts ONE `<IssueFlowProvider>` and
 * renders each screen by step, so state survives step transitions without
 * cross-route plumbing.
 *
 * The field names here are a load-bearing contract: downstream screens
 * (LensPicker / Quiz / RadarResult, tasks T17/T18) and the routes (T19/T21)
 * import `useIssueFlow()` and read these exact members. Don't rename without
 * updating those consumers.
 */
export interface IssueFlowState {
  /** Topic slugs, in selection order, capped at MAX_TOPICS. */
  selectedTopics: string[]
  /** Toggle a topic on/off. Adding when already at MAX_TOPICS is a no-op. */
  toggleTopic: (slug: string) => void
  /** topicSlug → selected lensSlugs[] (selection order preserved). */
  selectedLenses: Record<string, string[]>
  /** Toggle a lens on/off under its topic. */
  toggleLens: (topicSlug: string, lensSlug: string) => void
  /** Quiz answers, upserted by (topicSlug, lensSlug, questionSlug). */
  answers: QuizAnswer[]
  /** Insert or replace the answer for a given (topic, lens, question) key. */
  setAnswer: (a: QuizAnswer) => void
  /** Clear all wizard state. */
  reset: () => void
}

const IssueFlowContext = createContext<IssueFlowState | null>(null)

function answerKey(a: Pick<QuizAnswer, 'topicSlug' | 'lensSlug' | 'questionSlug'>): string {
  return `${a.topicSlug}::${a.lensSlug}::${a.questionSlug}`
}

/** Derive ordered topic slugs + lens map from saved selection rows. */
function deriveFromSelections(rows: UserIssueSelectionRow[]): {
  topics: string[]
  lenses: Record<string, string[]>
} {
  // Lowest display_order observed per topic (rows of the same topic share it,
  // but be defensive and take the min).
  const orderByTopic = new Map<string, number>()
  const lenses: Record<string, string[]> = {}
  for (const row of rows) {
    const prev = orderByTopic.get(row.topic_slug)
    if (prev === undefined || row.display_order < prev) orderByTopic.set(row.topic_slug, row.display_order)
    const list = (lenses[row.topic_slug] ??= [])
    if (!list.includes(row.lens_slug)) list.push(row.lens_slug)
  }
  const topics = [...orderByTopic.keys()].sort(
    (a, b) => (orderByTopic.get(a) ?? 0) - (orderByTopic.get(b) ?? 0),
  )
  return { topics, lenses }
}

export interface IssueFlowProviderProps {
  children: ReactNode
  /** If given, hydrate topics + lenses from these rows on mount (edit mode). */
  initialSelections?: UserIssueSelectionRow[] | null
}

/**
 * React Context provider holding the issue-flow wizard state.
 *
 * @example
 * <IssueFlowProvider initialSelections={existing}>
 *   {step === 'topics' && <TopicPickerScreen topics={catalog} onNext={next} />}
 * </IssueFlowProvider>
 */
export function IssueFlowProvider({
  children,
  initialSelections,
}: IssueFlowProviderProps): React.JSX.Element {
  const initial = useRef(initialSelections ? deriveFromSelections(initialSelections) : null)
  const [selectedTopics, setSelectedTopics] = useState<string[]>(() => initial.current?.topics ?? [])
  const [selectedLenses, setSelectedLenses] = useState<Record<string, string[]>>(
    () => initial.current?.lenses ?? {},
  )
  const [answers, setAnswers] = useState<QuizAnswer[]>([])

  const toggleTopic = useCallback((slug: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug)
      // 6-cap: silently ignore the add when already full (don't add a 7th).
      if (prev.length >= MAX_TOPICS) return prev
      return [...prev, slug]
    })
  }, [])

  const toggleLens = useCallback((topicSlug: string, lensSlug: string) => {
    setSelectedLenses((prev) => {
      const current = prev[topicSlug] ?? []
      const next = current.includes(lensSlug)
        ? current.filter((s) => s !== lensSlug)
        : [...current, lensSlug]
      return { ...prev, [topicSlug]: next }
    })
  }, [])

  const setAnswer = useCallback((a: QuizAnswer) => {
    setAnswers((prev) => {
      const key = answerKey(a)
      const idx = prev.findIndex((x) => answerKey(x) === key)
      if (idx === -1) return [...prev, a]
      const next = prev.slice()
      next[idx] = a
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setSelectedTopics([])
    setSelectedLenses({})
    setAnswers([])
  }, [])

  const value = useMemo<IssueFlowState>(
    () => ({
      selectedTopics,
      toggleTopic,
      selectedLenses,
      toggleLens,
      answers,
      setAnswer,
      reset,
    }),
    [selectedTopics, toggleTopic, selectedLenses, toggleLens, answers, setAnswer, reset],
  )

  return <IssueFlowContext.Provider value={value}>{children}</IssueFlowContext.Provider>
}

/** Access the issue-flow wizard state. Throws if used outside the provider. */
export function useIssueFlow(): IssueFlowState {
  const ctx = useContext(IssueFlowContext)
  if (ctx == null) {
    throw new Error('useIssueFlow must be used within an <IssueFlowProvider>')
  }
  return ctx
}
