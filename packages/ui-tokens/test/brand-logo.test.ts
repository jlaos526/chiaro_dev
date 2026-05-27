import { describe, expect, it } from 'vitest'
import { LOGO_RATIOS, LOGO_FILLS, logoGeometry } from '../src/brand/logo.ts'

describe('LOGO_RATIOS constants', () => {
  it('matches the spec ratios', () => {
    expect(LOGO_RATIOS.offsetXRatio).toBeCloseTo(0.4375, 5)
    expect(LOGO_RATIOS.offsetYRatio).toBeCloseTo(0.25, 5)
    expect(LOGO_RATIOS.overlapWidthRatio).toBeCloseTo(0.5625, 5)
    expect(LOGO_RATIOS.overlapHeightRatio).toBeCloseTo(0.75, 5)
    expect(LOGO_RATIOS.bracketArmRatio).toBeCloseTo(0.20, 5)
    expect(LOGO_RATIOS.boundingWidthRatio).toBeCloseTo(1.4375, 5)
    expect(LOGO_RATIOS.boundingHeightRatio).toBeCloseTo(1.25, 5)
  })
})

describe('LOGO_FILLS gradient strings', () => {
  it('back square uses deep-orange (rgba 196,106,42) 135deg gradient', () => {
    expect(LOGO_FILLS.backSquare).toBe(
      'linear-gradient(135deg, rgba(196,106,42,0.6) 0%, rgba(196,106,42,0.08) 100%)'
    )
  })

  it('front square uses light-orange (rgba 232,160,96) 135deg gradient', () => {
    expect(LOGO_FILLS.frontSquare).toBe(
      'linear-gradient(135deg, rgba(232,160,96,0.6) 0%, rgba(232,160,96,0.08) 100%)'
    )
  })

  it('border + bracket color is the deep-orange accent.500', () => {
    expect(LOGO_FILLS.borderColor).toBe('#c46a2a')
    expect(LOGO_FILLS.bracketColor).toBe('#c46a2a')
  })
})

describe('logoGeometry(S=32) canonical values', () => {
  it('produces the documented medium-variant geometry', () => {
    const g = logoGeometry(32)
    expect(g.squareSize).toBe(32)
    expect(g.offsetX).toBe(14)
    expect(g.offsetY).toBe(8)
    expect(g.overlapWidth).toBe(18)
    expect(g.overlapHeight).toBe(24)
    expect(g.boundingWidth).toBe(46)
    expect(g.boundingHeight).toBe(40)
  })

  it('square radius clamps to 3 at S=32', () => {
    expect(logoGeometry(32).squareRadius).toBe(3)
  })

  it('border stroke is 1 at S=32', () => {
    expect(logoGeometry(32).borderStroke).toBe(1)
  })

  it('bracket arm is 6.4 at S=32, stroke clamps to 1.5', () => {
    const g = logoGeometry(32)
    expect(g.bracketArm).toBeCloseTo(6.4, 5)
    expect(g.bracketStroke).toBeCloseTo(1.5, 5)
  })
})

describe('logoGeometry — scales linearly with S', () => {
  it('S=64 doubles all linear dimensions', () => {
    const g = logoGeometry(64)
    expect(g.offsetX).toBe(28)
    expect(g.offsetY).toBe(16)
    expect(g.overlapWidth).toBe(36)
    expect(g.overlapHeight).toBe(48)
    expect(g.boundingWidth).toBe(92)
    expect(g.boundingHeight).toBe(80)
  })

  it('S=16 halves linear dimensions', () => {
    const g = logoGeometry(16)
    expect(g.offsetX).toBe(7)
    expect(g.offsetY).toBe(4)
    expect(g.overlapWidth).toBe(9)
    expect(g.overlapHeight).toBe(12)
  })
})

describe('logoGeometry — clamp behavior at extremes', () => {
  it('border stroke clamps to a minimum of 0.75 at S=12 (favicon)', () => {
    expect(logoGeometry(12).borderStroke).toBe(0.75)
  })

  it('border stroke clamps to a maximum of 2 at S=96', () => {
    expect(logoGeometry(96).borderStroke).toBe(2)
  })

  it('square radius clamps to a minimum of 2 at S=12', () => {
    expect(logoGeometry(12).squareRadius).toBe(2)
  })

  it('square radius clamps to a maximum of 6 at very large S', () => {
    expect(logoGeometry(128).squareRadius).toBe(6)
  })
})
