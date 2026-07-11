import { describe, expect, it } from 'vitest'
import { BRAND_TYPE } from '../src/brand/typography.ts'
import { BRAND_SPACE } from '../src/brand/spacing.ts'
import { BRAND_RADII } from '../src/brand/radii.ts'
import { BRAND_SHADOW } from '../src/brand/shadow.ts'

describe('BRAND_TYPE scale', () => {
  it('contains all 9 type tokens', () => {
    expect(Object.keys(BRAND_TYPE).sort()).toEqual([
      'body',
      'bodySm',
      'display',
      'h1',
      'h2',
      'h3',
      'h4',
      'label',
      'micro',
    ])
  })

  it('display is 40px / 1.15 / -0.02em / 700', () => {
    expect(BRAND_TYPE.display).toEqual({
      sizePx: 40,
      sizeRem: 2.5,
      lineHeight: 1.15,
      tracking: '-0.02em',
      weight: 700,
    })
  })

  it('body is 15px / 1.55 / 0 / 400', () => {
    expect(BRAND_TYPE.body).toEqual({
      sizePx: 15,
      sizeRem: 0.9375,
      lineHeight: 1.55,
      tracking: '0',
      weight: 400,
    })
  })

  it('scale is strictly descending by sizePx from display to micro', () => {
    const order = ['display', 'h1', 'h2', 'h3', 'h4', 'body', 'bodySm', 'label', 'micro'] as const
    const sizes = order.map((k) => BRAND_TYPE[k].sizePx)
    const sorted = [...sizes].sort((a, b) => b - a)
    expect(sizes).toEqual(sorted)
  })
})

describe('BRAND_SPACE scale', () => {
  it('uses 4px base unit', () => {
    expect(BRAND_SPACE[1]).toBe(4)
    expect(BRAND_SPACE[2]).toBe(8)
    expect(BRAND_SPACE[3]).toBe(12)
    expect(BRAND_SPACE[4]).toBe(16)
  })

  it('exposes the documented stops', () => {
    expect(
      Object.keys(BRAND_SPACE)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16])
  })

  it('reset is 0', () => {
    expect(BRAND_SPACE[0]).toBe(0)
  })
})

describe('BRAND_RADII scale', () => {
  it('exposes the sharp-editorial stops', () => {
    expect(BRAND_RADII.none).toBe(0)
    expect(BRAND_RADII.xs).toBe(2)
    expect(BRAND_RADII.sm).toBe(4)
    expect(BRAND_RADII.md).toBe(6)
    expect(BRAND_RADII.lg).toBe(8)
    expect(BRAND_RADII.xl).toBe(12)
    expect(BRAND_RADII.full).toBe(9999)
  })
})

describe('BRAND_SHADOW scale', () => {
  it('sm shadow uses warm-brown rgba in light mode', () => {
    expect(BRAND_SHADOW.sm.light).toBe('0 1px 2px rgba(58,40,24,0.06)')
  })

  it('md shadow uses 2-layer warm-brown in light mode', () => {
    expect(BRAND_SHADOW.md.light).toBe(
      '0 2px 4px rgba(58,40,24,0.08), 0 1px 2px rgba(58,40,24,0.06)',
    )
  })

  it('lg shadow uses 2-layer warm-brown with larger first layer in light mode', () => {
    expect(BRAND_SHADOW.lg.light).toBe(
      '0 8px 16px rgba(58,40,24,0.10), 0 2px 4px rgba(58,40,24,0.08)',
    )
  })

  it('dark mode shadows use pure black rgba', () => {
    expect(BRAND_SHADOW.sm.dark).toBe('0 1px 2px rgba(0,0,0,0.4)')
    expect(BRAND_SHADOW.md.dark).toBe('0 2px 4px rgba(0,0,0,0.5)')
    expect(BRAND_SHADOW.lg.dark).toBe('0 8px 16px rgba(0,0,0,0.6)')
  })
})
