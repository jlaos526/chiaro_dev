import { describe, expect, it } from 'vitest'
import { BRAND_PALETTE } from '../src/brand/palette.ts'
import { BRAND_SEMANTIC, getSemantic } from '../src/brand/semantic.ts'

describe('BRAND_SEMANTIC.light → palette references', () => {
  it('resolves text.primary to ink.1000', () => {
    expect(BRAND_SEMANTIC.light.text.primary).toBe(BRAND_PALETTE.light.ink[1000])
  })

  it('resolves text.body to ink.700', () => {
    expect(BRAND_SEMANTIC.light.text.body).toBe(BRAND_PALETTE.light.ink[700])
  })

  it('resolves text.muted to ink.500', () => {
    expect(BRAND_SEMANTIC.light.text.muted).toBe(BRAND_PALETTE.light.ink[500])
  })

  it('resolves bg.card to surface.card', () => {
    expect(BRAND_SEMANTIC.light.bg.card).toBe(BRAND_PALETTE.light.surface.card)
  })

  it('resolves accent.primary to accent.500', () => {
    expect(BRAND_SEMANTIC.light.accent.primary).toBe(BRAND_PALETTE.light.accent[500])
  })

  it('resolves border.focus to accent.500', () => {
    expect(BRAND_SEMANTIC.light.border.focus).toBe(BRAND_PALETTE.light.accent[500])
  })

  it('resolves alert.danger.fg to alert.500', () => {
    expect(BRAND_SEMANTIC.light.alert.danger.fg).toBe(BRAND_PALETTE.light.alert[500])
  })
})

describe('BRAND_SEMANTIC.dark → palette references', () => {
  it('resolves text.primary to dark ink.1000 (cream)', () => {
    expect(BRAND_SEMANTIC.dark.text.primary).toBe('#fdf8f3')
  })

  it('resolves accent.primary to dark accent.500 (saturated up)', () => {
    expect(BRAND_SEMANTIC.dark.accent.primary).toBe('#e8a060')
  })

  it('resolves bg.app to dark surface.base', () => {
    expect(BRAND_SEMANTIC.dark.bg.app).toBe('#1a1410')
  })
})

describe('semantic parity between modes', () => {
  it('light and dark expose identical top-level keys', () => {
    expect(Object.keys(BRAND_SEMANTIC.light).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark).sort())
  })

  it('text.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.text).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.text).sort())
  })

  it('bg.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.bg).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.bg).sort())
  })

  it('accent.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.accent).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.accent).sort())
  })
})

describe('getSemantic helper', () => {
  it('returns the light table when called with "light"', () => {
    expect(getSemantic('light')).toBe(BRAND_SEMANTIC.light)
  })

  it('returns the dark table when called with "dark"', () => {
    expect(getSemantic('dark')).toBe(BRAND_SEMANTIC.dark)
  })
})
