// Slice 77 (audit C24): CategoryId/CATEGORY_LABEL/CATEGORY_ACCENT(_DARK)/
// SUB_CASCADE_ACCENT(_DARK) were deleted with their only consumers (the
// orphaned MetricCardShell family) — this file now covers only the surviving
// CATEGORY_CARD_BG pair (consumed by BrandAlert via useCategoryCardBg).
import { describe, expect, it } from 'vitest'
import { CATEGORY_CARD_BG, CATEGORY_CARD_BG_DARK } from '../src/category.ts'

describe('CATEGORY_CARD_BG (slice 43 universal)', () => {
  it('exports the locked light card bg', () => {
    expect(CATEGORY_CARD_BG).toBe('#fffaf2')
  })
})

describe('CATEGORY_CARD_BG_DARK (slice 43 universal)', () => {
  it('exports the locked dark card bg', () => {
    expect(CATEGORY_CARD_BG_DARK).toBe('#2a2e34')
  })
})
