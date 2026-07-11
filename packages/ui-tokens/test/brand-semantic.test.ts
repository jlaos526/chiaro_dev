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

  it('resolves alert.danger.{fg,bg,border} to slice 45 burgundy triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.danger.fg).toBe('#8a3a4d')
    expect(BRAND_SEMANTIC.light.alert.danger.bg).toBe('#f8d8d0')
    expect(BRAND_SEMANTIC.light.alert.danger.border).toBe('#e0928a')
  })

  it('resolves alert.warning.{fg,bg,border} to slice 45 gold triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.warning.fg).toBe('#c89a4e')
    expect(BRAND_SEMANTIC.light.alert.warning.bg).toBe('#f9e3b8')
    expect(BRAND_SEMANTIC.light.alert.warning.border).toBe('#d6a85a')
  })

  it('resolves alert.success.{fg,bg,border} to slice 45 emerald triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.success.fg).toBe('#1a8f5a')
    expect(BRAND_SEMANTIC.light.alert.success.bg).toBe('#c5e0d6')
    expect(BRAND_SEMANTIC.light.alert.success.border).toBe('#5fa897')
  })

  it('resolves alert.info.{fg,bg,border} to slice 45 terracotta triplet (new)', () => {
    expect(BRAND_SEMANTIC.light.alert.info.fg).toBe('#b86340')
    expect(BRAND_SEMANTIC.light.alert.info.bg).toBe('#f3d7b6')
    expect(BRAND_SEMANTIC.light.alert.info.border).toBe('#d6a474')
  })

  it('resolves signal.success to finance green', () => {
    expect(BRAND_SEMANTIC.light.signal.success).toBe('#3da75b')
    expect(BRAND_SEMANTIC.light.signal.success).toBe(BRAND_PALETTE.light.signal.success)
  })

  it('resolves link.fg to inline link blue', () => {
    expect(BRAND_SEMANTIC.light.link.fg).toBe('#3b6ed1')
    expect(BRAND_SEMANTIC.light.link.fg).toBe(BRAND_PALETTE.light.link.fg)
  })

  it('resolves portrait.gradient.from/to + initials (light)', () => {
    expect(BRAND_SEMANTIC.light.portrait.gradient.from).toBe('#c46a2a')
    expect(BRAND_SEMANTIC.light.portrait.gradient.to).toBe('#e8a060')
    expect(BRAND_SEMANTIC.light.portrait.initials).toBe('#ffffff')
  })

  it('resolves icon.location to the slice 46 palette value (light)', () => {
    expect(BRAND_SEMANTIC.light.icon.location).toBe('#e74c3c')
    expect(BRAND_SEMANTIC.light.icon.location).toBe(BRAND_PALETTE.light.icon.location)
  })
})

describe('BRAND_SEMANTIC.dark → palette references', () => {
  it('resolves text.primary to dark ink.1000 (cream)', () => {
    expect(BRAND_SEMANTIC.dark.text.primary).toBe('#fdf8f3')
  })

  it('resolves accent.primary to dark accent.500 (slate-blue)', () => {
    expect(BRAND_SEMANTIC.dark.accent.primary).toBe('#374f68')
  })

  it('resolves bg.app to dark surface.base (cool slate)', () => {
    expect(BRAND_SEMANTIC.dark.bg.app).toBe('#16181c')
  })

  it('resolves alert.danger.{fg,bg,border} (dark, slice 45)', () => {
    expect(BRAND_SEMANTIC.dark.alert.danger.fg).toBe('#c89aa8')
    expect(BRAND_SEMANTIC.dark.alert.danger.bg).toBe('#2a1820')
    expect(BRAND_SEMANTIC.dark.alert.danger.border).toBe('#5a2535')
  })

  it('resolves alert.warning.{fg,bg,border} (dark, slice 45)', () => {
    expect(BRAND_SEMANTIC.dark.alert.warning.fg).toBe('#e1c896')
    expect(BRAND_SEMANTIC.dark.alert.warning.bg).toBe('#2e2516')
    expect(BRAND_SEMANTIC.dark.alert.warning.border).toBe('#7c5a1e')
  })

  it('resolves alert.success.{fg,bg,border} (dark, slice 45)', () => {
    expect(BRAND_SEMANTIC.dark.alert.success.fg).toBe('#7eb898')
    expect(BRAND_SEMANTIC.dark.alert.success.bg).toBe('#162a1f')
    expect(BRAND_SEMANTIC.dark.alert.success.border).toBe('#0f5a4f')
  })

  it('resolves alert.info.{fg,bg,border} (dark, slice 45 new)', () => {
    expect(BRAND_SEMANTIC.dark.alert.info.fg).toBe('#e0b8a0')
    expect(BRAND_SEMANTIC.dark.alert.info.bg).toBe('#2a1f18')
    expect(BRAND_SEMANTIC.dark.alert.info.border).toBe('#7a3e23')
  })

  it('resolves signal.success (finance green, dark)', () => {
    expect(BRAND_SEMANTIC.dark.signal.success).toBe('#5dc97f')
  })

  it('resolves link.fg (inline link blue, dark)', () => {
    expect(BRAND_SEMANTIC.dark.link.fg).toBe('#7a98e1')
  })

  it('resolves portrait.gradient.from/to + initials (dark)', () => {
    expect(BRAND_SEMANTIC.dark.portrait.gradient.from).toBe('#6b7a5d')
    expect(BRAND_SEMANTIC.dark.portrait.gradient.to).toBe('#9caa8e')
    expect(BRAND_SEMANTIC.dark.portrait.initials).toBe('#fff0dc')
  })

  it('resolves icon.location to the slice 46 palette value (dark)', () => {
    expect(BRAND_SEMANTIC.dark.icon.location).toBe('#f08074')
    expect(BRAND_SEMANTIC.dark.icon.location).toBe(BRAND_PALETTE.dark.icon.location)
  })
})

describe('semantic parity between modes', () => {
  it('light and dark expose identical top-level keys', () => {
    expect(Object.keys(BRAND_SEMANTIC.light).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark).sort(),
    )
  })

  it('text.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.text).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.text).sort(),
    )
  })

  it('bg.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.bg).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.bg).sort(),
    )
  })

  it('accent.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.accent).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.accent).sort(),
    )
  })

  it('alert.* variant keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.alert).sort(),
    )
  })

  it('alert.danger fg/bg/border keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert.danger).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.alert.danger).sort(),
    )
  })

  it('alert.warning fg/bg/border keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert.warning).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.alert.warning).sort(),
    )
  })

  it('alert.success fg/bg/border keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert.success).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.alert.success).sort(),
    )
  })

  it('signal.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.signal).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.signal).sort(),
    )
  })

  it('link.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.link).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.link).sort(),
    )
  })

  it('portrait keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.portrait).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.portrait).sort(),
    )
  })

  it('portrait.gradient keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.portrait.gradient).sort()).toEqual(
      Object.keys(BRAND_SEMANTIC.dark.portrait.gradient).sort(),
    )
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
