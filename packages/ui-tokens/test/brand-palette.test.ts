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

  it('exports the burgundy alert.danger triplet (slice 45 brand-family)', () => {
    expect(BRAND_PALETTE.light.alert.danger.fg).toBe('#8a3a4d')
    expect(BRAND_PALETTE.light.alert.danger.bg).toBe('#f8d8d0')
    expect(BRAND_PALETTE.light.alert.danger.border).toBe('#e0928a')
  })

  it('exports the gold alert.warning triplet (slice 45 brand-family)', () => {
    expect(BRAND_PALETTE.light.alert.warning.fg).toBe('#c89a4e')
    expect(BRAND_PALETTE.light.alert.warning.bg).toBe('#f9e3b8')
    expect(BRAND_PALETTE.light.alert.warning.border).toBe('#d6a85a')
  })

  it('exports the emerald alert.success triplet (slice 45 brand-family)', () => {
    expect(BRAND_PALETTE.light.alert.success.fg).toBe('#1a8f5a')
    expect(BRAND_PALETTE.light.alert.success.bg).toBe('#c5e0d6')
    expect(BRAND_PALETTE.light.alert.success.border).toBe('#5fa897')
  })

  it('exports the terracotta alert.info triplet (slice 45 new)', () => {
    expect(BRAND_PALETTE.light.alert.info.fg).toBe('#b86340')
    expect(BRAND_PALETTE.light.alert.info.bg).toBe('#f3d7b6')
    expect(BRAND_PALETTE.light.alert.info.border).toBe('#d6a474')
  })

  it('exports signal.success (finance green)', () => {
    expect(BRAND_PALETTE.light.signal.success).toBe('#3da75b')
  })

  it('exports link.fg (inline link blue)', () => {
    expect(BRAND_PALETTE.light.link.fg).toBe('#3b6ed1')
  })

  it('exports the portrait block (light)', () => {
    expect(BRAND_PALETTE.light.portrait.gradient.from).toBe('#c46a2a')
    expect(BRAND_PALETTE.light.portrait.gradient.to).toBe('#e8a060')
    expect(BRAND_PALETTE.light.portrait.initials).toBe('#ffffff')
  })

  it('exports the icon.location signal red (slice 46 new namespace)', () => {
    expect(BRAND_PALETTE.light.icon.location).toBe('#e74c3c')
  })
})

describe('BRAND_PALETTE.dark', () => {
  it('inverts ink (cream becomes primary text)', () => {
    expect(BRAND_PALETTE.dark.ink[1000]).toBe('#fdf8f3')
    expect(BRAND_PALETTE.dark.ink[100]).toBe('#3a322c')
  })

  it('uses cool slate surface (slice 40 reskin)', () => {
    expect(BRAND_PALETTE.dark.surface.base).toBe('#16181c')
    expect(BRAND_PALETTE.dark.surface.card).toBe('#1e2126')
    expect(BRAND_PALETTE.dark.surface.elevated).toBe('#262a30')
    expect(BRAND_PALETTE.dark.surface.subtle).toBe('#1c1e2270')
  })

  it('uses slate-blue accent ramp (slice 40 reskin)', () => {
    expect(BRAND_PALETTE.dark.accent[100]).toBe('#1a1f28')
    expect(BRAND_PALETTE.dark.accent[200]).toBe('#232a36')
    expect(BRAND_PALETTE.dark.accent[400]).toBe('#2e405a')
    expect(BRAND_PALETTE.dark.accent[500]).toBe('#374f68')
    expect(BRAND_PALETTE.dark.accent[600]).toBe('#485e76')
    expect(BRAND_PALETTE.dark.accent[700]).toBe('#6a7d96')
    expect(BRAND_PALETTE.dark.accent[900]).toBe('#ced8e4')
  })

  it('exports the burgundy alert.danger triplet (dark, slice 45)', () => {
    expect(BRAND_PALETTE.dark.alert.danger.fg).toBe('#c89aa8')
    expect(BRAND_PALETTE.dark.alert.danger.bg).toBe('#2a1820')
    expect(BRAND_PALETTE.dark.alert.danger.border).toBe('#5a2535')
  })

  it('exports the gold alert.warning triplet (dark, slice 45)', () => {
    expect(BRAND_PALETTE.dark.alert.warning.fg).toBe('#e1c896')
    expect(BRAND_PALETTE.dark.alert.warning.bg).toBe('#2e2516')
    expect(BRAND_PALETTE.dark.alert.warning.border).toBe('#7c5a1e')
  })

  it('exports the emerald alert.success triplet (dark, slice 45)', () => {
    expect(BRAND_PALETTE.dark.alert.success.fg).toBe('#7eb898')
    expect(BRAND_PALETTE.dark.alert.success.bg).toBe('#162a1f')
    expect(BRAND_PALETTE.dark.alert.success.border).toBe('#0f5a4f')
  })

  it('exports the terracotta alert.info triplet (dark, slice 45 new)', () => {
    expect(BRAND_PALETTE.dark.alert.info.fg).toBe('#e0b8a0')
    expect(BRAND_PALETTE.dark.alert.info.bg).toBe('#2a1f18')
    expect(BRAND_PALETTE.dark.alert.info.border).toBe('#7a3e23')
  })

  it('exports signal.success (finance green, dark)', () => {
    expect(BRAND_PALETTE.dark.signal.success).toBe('#5dc97f')
  })

  it('exports link.fg (inline link blue, dark)', () => {
    expect(BRAND_PALETTE.dark.link.fg).toBe('#7a98e1')
  })

  it('exports the portrait block (dark)', () => {
    expect(BRAND_PALETTE.dark.portrait.gradient.from).toBe('#6b7a5d')
    expect(BRAND_PALETTE.dark.portrait.gradient.to).toBe('#9caa8e')
    expect(BRAND_PALETTE.dark.portrait.initials).toBe('#fff0dc')
  })

  it('exports cool slate border tokens (slice 40 reskin)', () => {
    expect(BRAND_PALETTE.dark.border.default).toBe('#2a2d33')
    expect(BRAND_PALETTE.dark.border.strong).toBe('#3a3e45')
  })

  it('exports the icon.location coral (dark, slice 46 new namespace)', () => {
    expect(BRAND_PALETTE.dark.icon.location).toBe('#f08074')
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

  it('light and dark have identical alert variant keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.alert).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.alert).sort())
  })

  it('light and dark alert.danger triplets share fg/bg/border keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.alert.danger).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.alert.danger).sort())
  })

  it('light and dark alert.warning triplets share fg/bg/border keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.alert.warning).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.alert.warning).sort())
  })

  it('light and dark alert.success triplets share fg/bg/border keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.alert.success).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.alert.success).sort())
  })

  it('light and dark have identical signal keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.signal).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.signal).sort())
  })

  it('light and dark have identical link keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.link).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.link).sort())
  })

  it('light and dark have identical surface keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.surface).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.surface).sort())
  })

  it('light and dark have identical border keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.border).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.border).sort())
  })

  it('light and dark have identical portrait keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.portrait).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.portrait).sort())
  })

  it('light and dark portrait.gradient share from/to keys', () => {
    expect(Object.keys(BRAND_PALETTE.light.portrait.gradient).sort())
      .toEqual(Object.keys(BRAND_PALETTE.dark.portrait.gradient).sort())
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
