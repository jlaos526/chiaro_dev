import { describe, expect, it } from 'vitest'
import { BRAND, getSemantic, logoGeometry } from '../src/index.ts'

describe('BRAND root object', () => {
  it('exposes all 7 sub-namespaces', () => {
    expect(Object.keys(BRAND).sort()).toEqual([
      'logo',
      'palette',
      'radii',
      'semantic',
      'shadow',
      'space',
      'type',
    ])
  })

  it('BRAND.palette has light + dark', () => {
    expect(BRAND.palette).toHaveProperty('light')
    expect(BRAND.palette).toHaveProperty('dark')
  })

  it('BRAND.semantic has light + dark', () => {
    expect(BRAND.semantic).toHaveProperty('light')
    expect(BRAND.semantic).toHaveProperty('dark')
  })

  it('BRAND.type contains the documented keys', () => {
    expect(BRAND.type).toHaveProperty('display')
    expect(BRAND.type).toHaveProperty('body')
    expect(BRAND.type).toHaveProperty('micro')
  })

  it('BRAND.logo exposes RATIOS + FILLS', () => {
    expect(BRAND.logo).toHaveProperty('ratios')
    expect(BRAND.logo).toHaveProperty('fills')
    expect(BRAND.logo.ratios.offsetXRatio).toBeCloseTo(0.4375, 5)
    expect(BRAND.logo.fills.borderColor).toBe('#c46a2a')
  })
})

describe('helpers re-exported from package root', () => {
  it('getSemantic("light") returns the light semantic table', () => {
    const s = getSemantic('light')
    expect(s.text.primary).toBe('#1a1714')
  })

  it('logoGeometry(32) returns canonical medium-variant geometry', () => {
    const g = logoGeometry(32)
    expect(g.boundingWidth).toBe(46)
    expect(g.boundingHeight).toBe(40)
  })
})

describe('legacy COLORS surface still exported', () => {
  // Belt-and-suspenders — already covered by back-compat.test.ts in Task 1.
  it('COLORS import path still resolves', async () => {
    const mod = await import('../src/index.ts')
    expect(mod.COLORS).toBeDefined()
    expect(mod.MAP_COLORS).toBeDefined()
  })
})
