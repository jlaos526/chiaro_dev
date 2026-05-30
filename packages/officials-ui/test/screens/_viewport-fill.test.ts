import { describe, expect, it } from 'vitest'
import { WEB_VIEWPORT_FILL } from '../../src/screens/_viewport-fill.ts'

describe('WEB_VIEWPORT_FILL', () => {
  it('exports the 100vh minHeight object on web (jsdom)', () => {
    expect(WEB_VIEWPORT_FILL).toEqual({ minHeight: '100vh' })
  })
})
