import { describe, expect, it } from 'vitest'
import { COLORS, MAP_COLORS, type BrandColor, type MapColor } from '../src/index.ts'

describe('legacy COLORS surface (back-compat)', () => {
  it('exports COLORS.brand with unchanged hex values', () => {
    expect(COLORS.brand.primary).toBe('#5b6cff')
    expect(COLORS.brand.accent).toBe('#1f9b88')
    expect(COLORS.brand.text).toBe('#1a1714')
  })

  it('exports COLORS.neutral with unchanged hex values', () => {
    expect(COLORS.neutral.background).toBe('#ffffff')
    expect(COLORS.neutral.surface).toBe('#f7f6f4')
    expect(COLORS.neutral.surfaceAlt).toBe('#f3f4f6')
    expect(COLORS.neutral.border).toBe('#e6e3df')
    expect(COLORS.neutral.mute).toBe('#807a72')
    expect(COLORS.neutral.textMuted).toBe('#666')
    expect(COLORS.neutral.outline).toBe('#888')
  })

  it('exports COLORS.signal with unchanged hex values', () => {
    expect(COLORS.signal.error).toBe('#c5364a')
    expect(COLORS.signal.warning).toBe('#d68a1f')
    expect(COLORS.signal.success).toBe('#1f9b88')
  })
})

describe('MAP_COLORS surface (back-compat)', () => {
  it('exports MAP_COLORS from the package root', () => {
    expect(MAP_COLORS.districtStroke).toBe('#1a1714')
    expect(MAP_COLORS.districtFill).toBe('#f5f0e8')
  })
})

describe('legacy types still resolve', () => {
  it('BrandColor + MapColor type aliases compile', () => {
    const _b: BrandColor = COLORS
    const _m: MapColor = MAP_COLORS
    expect(_b).toBe(COLORS)
    expect(_m).toBe(MAP_COLORS)
  })
})
