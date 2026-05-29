import { describe, expect, it } from 'vitest'
import {
  PARTY_COLOR, PARTY_COLOR_DARK,
  ALIGNMENT_CHIP_COLORS, ALIGNMENT_CHIP_COLORS_DARK,
  SCORECARD_LEAN_COLOR, SCORECARD_LEAN_COLOR_DARK,
  CATEGORY_ACCENT, CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_GRADIENT, CATEGORY_CARD_GRADIENT_DARK,
  CATEGORY_CARD_BG_SOLID, CATEGORY_CARD_BG_SOLID_DARK,
  SUB_CASCADE_ACCENT, SUB_CASCADE_ACCENT_DARK,
  INDUSTRY_COLOR, INDUSTRY_COLOR_DARK,
  INDUSTRY_DEFAULT_COLOR, INDUSTRY_DEFAULT_COLOR_DARK,
  FINANCE_SUB_SECTION_SHADES, FINANCE_SUB_SECTION_SHADES_DARK,
  FINANCE_CARD_BG, FINANCE_CARD_BG_DARK,
  MAP_COLORS, MAP_COLORS_DARK,
} from '../src/index.ts'

describe('domain palette dark variants — key parity', () => {
  it('PARTY_COLOR + PARTY_COLOR_DARK share identical keys', () => {
    expect(Object.keys(PARTY_COLOR).sort()).toEqual(Object.keys(PARTY_COLOR_DARK).sort())
  })

  it('PARTY_COLOR has unknown stop', () => {
    expect(PARTY_COLOR.unknown).toBe('#807a72')
    expect(PARTY_COLOR_DARK.unknown).toBe('#7a7268')
  })

  it('ALIGNMENT_CHIP_COLORS key parity', () => {
    expect(Object.keys(ALIGNMENT_CHIP_COLORS).sort())
      .toEqual(Object.keys(ALIGNMENT_CHIP_COLORS_DARK).sort())
  })

  it('SCORECARD_LEAN_COLOR key parity', () => {
    expect(Object.keys(SCORECARD_LEAN_COLOR).sort())
      .toEqual(Object.keys(SCORECARD_LEAN_COLOR_DARK).sort())
  })

  it('CATEGORY_ACCENT key parity', () => {
    expect(Object.keys(CATEGORY_ACCENT).sort()).toEqual(Object.keys(CATEGORY_ACCENT_DARK).sort())
  })

  it('CATEGORY_CARD_GRADIENT key parity', () => {
    expect(Object.keys(CATEGORY_CARD_GRADIENT).sort())
      .toEqual(Object.keys(CATEGORY_CARD_GRADIENT_DARK).sort())
  })

  it('CATEGORY_CARD_BG_SOLID has 6 categories in both modes', () => {
    const expectedKeys = ['service-record', 'issue-positions', 'community-presence', 'finance', 'ethics-accountability', 'voting-bills']
    expect(Object.keys(CATEGORY_CARD_BG_SOLID).sort()).toEqual(expectedKeys.sort())
    expect(Object.keys(CATEGORY_CARD_BG_SOLID_DARK).sort()).toEqual(expectedKeys.sort())
  })

  it('SUB_CASCADE_ACCENT key parity', () => {
    expect(Object.keys(SUB_CASCADE_ACCENT).sort())
      .toEqual(Object.keys(SUB_CASCADE_ACCENT_DARK).sort())
  })

  it('INDUSTRY_COLOR key parity', () => {
    expect(Object.keys(INDUSTRY_COLOR).sort()).toEqual(Object.keys(INDUSTRY_COLOR_DARK).sort())
  })

  it('FINANCE_SUB_SECTION_SHADES key parity', () => {
    expect(Object.keys(FINANCE_SUB_SECTION_SHADES).sort())
      .toEqual(Object.keys(FINANCE_SUB_SECTION_SHADES_DARK).sort())
  })

  it('MAP_COLORS key parity', () => {
    expect(Object.keys(MAP_COLORS).sort()).toEqual(Object.keys(MAP_COLORS_DARK).sort())
  })

  it('FINANCE_CARD_BG known values', () => {
    expect(FINANCE_CARD_BG).toBe('#f4faf6')
    expect(FINANCE_CARD_BG_DARK).toBe('#1a2820')
  })

  it('INDUSTRY_DEFAULT_COLOR has dark variant', () => {
    expect(INDUSTRY_DEFAULT_COLOR).toBeDefined()
    expect(INDUSTRY_DEFAULT_COLOR_DARK).toBeDefined()
  })

  it('MAP_COLORS_DARK inverts stroke + fill', () => {
    expect(MAP_COLORS_DARK.districtStroke).toBe('#fdf8f3')
    expect(MAP_COLORS_DARK.districtFill).toBe('#3a3e45')
  })

  it('CATEGORY_CARD_BG_SOLID light values match expected', () => {
    expect(CATEGORY_CARD_BG_SOLID['service-record']).toBe('#f5e6cc')
    expect(CATEGORY_CARD_BG_SOLID.finance).toBe('#d4e8d8')
  })
})
