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

  it('resolves alert.danger.{fg,bg,border} to palette alert.danger triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.danger.fg).toBe(BRAND_PALETTE.light.alert.danger.fg)
    expect(BRAND_SEMANTIC.light.alert.danger.bg).toBe(BRAND_PALETTE.light.alert.danger.bg)
    expect(BRAND_SEMANTIC.light.alert.danger.border).toBe(BRAND_PALETTE.light.alert.danger.border)
  })

  it('resolves alert.warning.{fg,bg,border} to palette alert.warning triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.warning.fg).toBe('#d68a1f')
    expect(BRAND_SEMANTIC.light.alert.warning.bg).toBe('#fef7e8')
    expect(BRAND_SEMANTIC.light.alert.warning.border).toBe('#f5c878')
  })

  it('resolves alert.success.{fg,bg,border} to palette alert.success triplet', () => {
    expect(BRAND_SEMANTIC.light.alert.success.fg).toBe('#1f9b88')
    expect(BRAND_SEMANTIC.light.alert.success.bg).toBe('#e8f5f2')
    expect(BRAND_SEMANTIC.light.alert.success.border).toBe('#7fc5b5')
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

  it('resolves alert.danger.{fg,bg,border} (dark)', () => {
    expect(BRAND_SEMANTIC.dark.alert.danger.fg).toBe('#d05050')
    expect(BRAND_SEMANTIC.dark.alert.danger.bg).toBe('#2a1414')
    expect(BRAND_SEMANTIC.dark.alert.danger.border).toBe('#6e2222')
  })

  it('resolves alert.warning.{fg,bg,border} (dark)', () => {
    expect(BRAND_SEMANTIC.dark.alert.warning.fg).toBe('#f0b558')
    expect(BRAND_SEMANTIC.dark.alert.warning.bg).toBe('#3a2a14')
    expect(BRAND_SEMANTIC.dark.alert.warning.border).toBe('#6e4a20')
  })

  it('resolves alert.success.{fg,bg,border} (dark)', () => {
    expect(BRAND_SEMANTIC.dark.alert.success.fg).toBe('#4dbfb0')
    expect(BRAND_SEMANTIC.dark.alert.success.bg).toBe('#1a302c')
    expect(BRAND_SEMANTIC.dark.alert.success.border).toBe('#3a6e62')
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

  it('alert.* variant keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.alert).sort())
  })

  it('alert.danger fg/bg/border keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert.danger).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.alert.danger).sort())
  })

  it('alert.warning fg/bg/border keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert.warning).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.alert.warning).sort())
  })

  it('alert.success fg/bg/border keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.alert.success).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.alert.success).sort())
  })

  it('signal.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.signal).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.signal).sort())
  })

  it('link.* keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.link).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.link).sort())
  })

  it('portrait keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.portrait).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.portrait).sort())
  })

  it('portrait.gradient keys are identical between modes', () => {
    expect(Object.keys(BRAND_SEMANTIC.light.portrait.gradient).sort())
      .toEqual(Object.keys(BRAND_SEMANTIC.dark.portrait.gradient).sort())
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
