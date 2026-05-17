import { describe, expect, it } from 'vitest'
import { FINANCE_SUB_SECTION_SHADES } from '../src/finance-shades.ts'

describe('FINANCE_SUB_SECTION_SHADES', () => {
  it('Contributors uses sage (#a8d2b1) with deep-sage heading', () => {
    expect(FINANCE_SUB_SECTION_SHADES.contributors.accent).toBe('#a8d2b1')
    expect(FINANCE_SUB_SECTION_SHADES.contributors.heading).toBe('#2d5d3a')
  })

  it('Top Donor uses mint (#a8d4c0) with deep-mint heading', () => {
    expect(FINANCE_SUB_SECTION_SHADES.topDonor.accent).toBe('#a8d4c0')
    expect(FINANCE_SUB_SECTION_SHADES.topDonor.heading).toBe('#2a5d4a')
  })

  it('is frozen const (TypeScript readonly)', () => {
    // @ts-expect-error const assertion makes mutation a type error
    FINANCE_SUB_SECTION_SHADES.contributors.accent = '#000000'
  })
})
