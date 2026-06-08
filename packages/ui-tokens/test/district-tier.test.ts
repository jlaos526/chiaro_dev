import { describe, expect, it } from 'vitest'
import { DISTRICT_TIER_COLOR, DISTRICT_TIER_COLOR_DARK } from '../src/district-tier.ts'

const KEYS = ['county', 'federal_house', 'federal_senate', 'place', 'state_house', 'state_senate']

describe('DISTRICT_TIER_COLOR', () => {
  it('light + dark have identical keys (all 6 tiers)', () => {
    expect(Object.keys(DISTRICT_TIER_COLOR).sort()).toEqual(KEYS)
    expect(Object.keys(DISTRICT_TIER_COLOR_DARK).sort()).toEqual(KEYS)
  })
  it('light values', () => {
    expect(DISTRICT_TIER_COLOR.federal_house).toBe('#5b6cff')
    expect(DISTRICT_TIER_COLOR.place).toBe('#c9a84c')
  })
  it('dark values lighten the hue', () => {
    expect(DISTRICT_TIER_COLOR_DARK.federal_house).toBe('#8a96ff')
    expect(DISTRICT_TIER_COLOR_DARK.place).toBe('#e0c06a')
  })
})
