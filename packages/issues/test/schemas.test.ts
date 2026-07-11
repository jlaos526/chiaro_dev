import { describe, it, expect } from 'vitest'
import { saveSelectionsSchema } from '../src/schemas.ts'

describe('schemas', () => {
  it('validates a save payload', () => {
    const ok = saveSelectionsSchema.safeParse([
      {
        topic_slug: 'gun-policy',
        lens_slug: 'gun-rights',
        display_order: 0,
        position: 67,
        importance: 2,
      },
    ])
    expect(ok.success).toBe(true)
  })
})
