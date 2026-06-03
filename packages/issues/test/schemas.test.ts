import { describe, it, expect } from 'vitest'
import { measurementSourceSchema, saveSelectionsSchema } from '../src/schemas.ts'

describe('schemas', () => {
  it('accepts a valid scorecard source', () => {
    expect(measurementSourceSchema.safeParse({ type: 'scorecard', weight: 1, config: { orgs: ['lcv'] } }).success).toBe(true)
  })
  it('rejects an unknown source type', () => {
    expect(measurementSourceSchema.safeParse({ type: 'astrology', weight: 1, config: {} }).success).toBe(false)
  })
  it('validates a save payload', () => {
    const ok = saveSelectionsSchema.safeParse([{ topic_slug: 'gun-policy', lens_slug: 'gun-rights', display_order: 0, position: 67, importance: 2 }])
    expect(ok.success).toBe(true)
  })
})
