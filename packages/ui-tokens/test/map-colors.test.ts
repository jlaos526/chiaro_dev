import { describe, expect, it } from 'vitest'
import { MAP_COLORS, MAP_COLORS_DARK } from '../src/map-colors.ts'

describe('MAP_COLORS (light, unchanged)', () => {
  it('exports districtStroke + districtFill', () => {
    expect(MAP_COLORS.districtStroke).toBe('#1a1714')
    expect(MAP_COLORS.districtFill).toBe('#f5f0e8')
  })
})

describe('MAP_COLORS_DARK (slice 41 cool slate cascade)', () => {
  it('districtStroke unchanged (bright cream stroke)', () => {
    expect(MAP_COLORS_DARK.districtStroke).toBe('#fdf8f3')
  })

  it('districtFill cascades from warm brown to cool slate border.strong', () => {
    expect(MAP_COLORS_DARK.districtFill).toBe('#3a3e45')
  })
})

describe('MAP_COLORS / MAP_COLORS_DARK parity', () => {
  it('light and dark have identical top-level keys', () => {
    expect(Object.keys(MAP_COLORS).sort()).toEqual(Object.keys(MAP_COLORS_DARK).sort())
  })
})
