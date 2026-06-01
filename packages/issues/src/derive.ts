import type { QuizAnswer, StancePosition } from './types.ts'

/** Group answers by (topic,lens) and compute a 0-100 position + importance per stance. */
export function derivePositions(
  answers: QuizAnswer[],
  agreeDirection: (a: QuizAnswer) => 1 | -1,
): StancePosition[] {
  const groups = new Map<string, { topicSlug: string; lensSlug: string; answers: QuizAnswer[] }>()
  for (const a of answers) {
    const key = `${a.topicSlug}::${a.lensSlug}`
    const existing = groups.get(key)
    if (existing) existing.answers.push(a)
    else groups.set(key, { topicSlug: a.topicSlug, lensSlug: a.lensSlug, answers: [a] })
  }
  const out: StancePosition[] = []
  for (const { topicSlug, lensSlug, answers: group } of groups.values()) {
    const scored = group
      .filter((a) => a.answer !== 'skip')
      .map((a): number => {
        const agree = a.answer === 'agree'
        const dir = agreeDirection(a)
        return (agree && dir === 1) || (!agree && dir === -1) ? 1 : 0
      })
    const position =
      scored.length === 0 ? null : Math.round((scored.reduce((s, v) => s + v, 0) / scored.length) * 100)
    const importance: 1 | 2 = group.some((a) => a.starred) ? 2 : 1
    out.push({ topicSlug, lensSlug, position, importance })
  }
  return out
}
