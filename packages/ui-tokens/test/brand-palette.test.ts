import { describe, expect, it } from 'vitest'
import { BRAND_PALETTE } from '../src/brand/palette.ts'

describe('BRAND_PALETTE.light', () => {
  it('exports the ink scale', () => {
    expect(BRAND_PALETTE.light.ink[1000]).toBe('#1a1714')
    expect(BRAND_PALETTE.light.ink[700]).toBe('#3a322c')
    expect(BRAND_PALETTE.light.ink[500]).toBe('#6b5e52')
    expect(BRAND_PALETTE.light.ink[300]).toBe('#8a7a6a')
    expect(BRAND_PALETTE.light.ink[100]).toBe('#c8b9a8')
  })

  it('exports the surface scale', () => {
    expect(BRAND_PALETTE.light.surface.base).toBe('#efece5')
    expect(BRAND_PALETTE.light.surface.card).toBe('#fdf8f3')
    expect(BRAND_PALETTE.light.surface.elevated).toBe('#ffffff')
    expect(BRAND_PALETTE.light.surface.subtle).toBe('#f7efe2')
  })

  it('exports border tokens', () => {
    expect(BRAND_PALETTE.light.border.default).toBe('#e8d8c2')
    expect(BRAND_PALETTE.light.border.strong).toBe('#d6c3a8')
  })

  it('exports the deep-orange accent scale with primary at 500', () => {
    expect(BRAND_PALETTE.light.accent[500]).toBe('#c46a2a')
    expect(BRAND_PALETTE.light.accent[400]).toBe('#e8a060')
    expect(BRAND_PALETTE.light.accent[100]).toBe('#fdf2e8')
  })

  it('exports the decisive-red alert scale with alert at 500', () => {
    expect(BRAND_PALETTE.light.alert[500]).toBe('#a83a3a')
    expect(BRAND_PALETTE.light.alert[100]).toBe('#fdf2f0')
  })
})

describe('BRAND_PALETTE.dark', () => {
  it('inverts ink (cream becomes primary text)', () => {
    expect(BRAND_PALETTE.dark.ink[1000]).toBe('#fdf8f3')
    expect(BRAND_PALETTE.dark.ink[100]).toBe('#3a322c')
  })

  it('uses deep-warm surface (no neutral grays)', () => {
    expect(BRAND_PALETTE.dark.surface.base).toBe('#1a1410')
    expect(BRAND_PALETTE.dark.surface.card).toBe('#2a221c')
    expect(BRAND_PALETTE.dark.surface.elevated).toBe('#3a2e26')
  })

  it('saturates accent up (light orange becomes primary on dark)', () => {
    expect(BRAND_PALETTE.dark.accent[500]).toBe('#e8a060')
    expect(BRAND_PALETTE.dark.accent[400]).toBe('#c46a2a')
  })
})

describe('palette mode parity', () => {
  it('light and dark have identical top-level key shapes', () => {
    expect(Object.keys(BRAND_PALETTE.light).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark).sort())
  })

  it('light and dark have identical ink scale keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.ink).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.ink).sort())
  })

  it('light and dark have identical accent scale keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.accent).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.accent).sort())
  })

  it('light and dark have identical alert scale keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.alert).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.alert).sort())
  })

  it('light and dark have identical surface keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.surface).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.surface).sort())
  })

  it('light and dark have identical border keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.border).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.border).sort())
  })
})

describe('no accidental duplicate hex within a single role group', () => {
  it('light ink stops are all distinct', () => {
    const values = Object.values(BRAND_PALETTE.light.ink)
    expect(new Set(values).size).toBe(values.length)
  })

  it('light accent stops are all distinct', () => {
    const values = Object.values(BRAND_PALETTE.light.accent)
    expect(new Set(values).size).toBe(values.length)
  })

  it('dark accent stops are all distinct', () => {
    const values = Object.values(BRAND_PALETTE.dark.accent)
    expect(new Set(values).size).toBe(values.length)
  })
})
