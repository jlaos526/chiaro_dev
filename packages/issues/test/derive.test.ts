import { describe, it, expect } from 'vitest'
import { derivePositions } from '../src/derive.ts'
import type { QuizAnswer } from '../src/types.ts'

const q = (questionSlug: string, answer: QuizAnswer['answer'], starred = false): QuizAnswer =>
  ({ topicSlug: 'environment', lensSlug: 'conservation', questionSlug, answer, starred })

// catalog directions: q1 agree_direction +1, q2 -1, q3 +1
const directions = { q1: 1, q2: -1, q3: 1 } as const
const lookup = (a: QuizAnswer) => directions[a.questionSlug as keyof typeof directions]

describe('derivePositions', () => {
  it('orients by agree_direction and averages to 0-100', () => {
    // agree q1(+1)=1, agree q2(-1)=0, agree q3(+1)=1  -> mean 0.667 -> 67
    const out = derivePositions([q('q1','agree'), q('q2','agree'), q('q3','agree')], lookup)
    expect(out[0]!.position).toBe(67)
    expect(out[0]!.importance).toBe(1)
  })
  it('excludes skips from the mean', () => {
    const out = derivePositions([q('q1','agree'), q('q2','skip'), q('q3','disagree')], lookup)
    // q1(+1,agree)=1, q3(+1,disagree)=0 -> mean 0.5 -> 50
    expect(out[0]!.position).toBe(50)
  })
  it('all-skipped -> null position', () => {
    expect(derivePositions([q('q1','skip')], lookup)[0]!.position).toBeNull()
  })
  it('any starred -> importance 2', () => {
    expect(derivePositions([q('q1','agree', true)], lookup)[0]!.importance).toBe(2)
  })
})
