// Slice 77 (audit C24): CATEGORY_ACCENT / SUB_CASCADE_ACCENT /
// FINANCE_SUB_SECTION_SHADES parity blocks removed with the deleted surface.
import { describe, expect, it } from 'vitest'
import {
  PARTY_COLOR,
  PARTY_COLOR_DARK,
  ALIGNMENT_CHIP_COLORS,
  ALIGNMENT_CHIP_COLORS_DARK,
  SCORECARD_LEAN_COLOR,
  SCORECARD_LEAN_COLOR_DARK,
  MAP_COLORS,
  MAP_COLORS_DARK,
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
    expect(Object.keys(ALIGNMENT_CHIP_COLORS).sort()).toEqual(
      Object.keys(ALIGNMENT_CHIP_COLORS_DARK).sort(),
    )
  })

  it('SCORECARD_LEAN_COLOR key parity', () => {
    expect(Object.keys(SCORECARD_LEAN_COLOR).sort()).toEqual(
      Object.keys(SCORECARD_LEAN_COLOR_DARK).sort(),
    )
  })

  it('MAP_COLORS key parity', () => {
    expect(Object.keys(MAP_COLORS).sort()).toEqual(Object.keys(MAP_COLORS_DARK).sort())
  })

  it('MAP_COLORS_DARK inverts stroke + fill', () => {
    expect(MAP_COLORS_DARK.districtStroke).toBe('#fdf8f3')
    expect(MAP_COLORS_DARK.districtFill).toBe('#3a3e45')
  })
})
