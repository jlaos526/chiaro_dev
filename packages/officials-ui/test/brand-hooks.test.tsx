import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import {
  ALIGNMENT_CHIP_COLORS,
  ALIGNMENT_CHIP_COLORS_DARK,
  BRAND_PALETTE,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BG_DARK,
  FINANCE_SUB_SECTION_SHADES,
  FINANCE_SUB_SECTION_SHADES_DARK,
  INDUSTRY_COLOR,
  INDUSTRY_COLOR_DARK,
  INDUSTRY_DEFAULT_COLOR,
  INDUSTRY_DEFAULT_COLOR_DARK,
  MAP_COLORS,
  MAP_COLORS_DARK,
  PARTY_COLOR,
  PARTY_COLOR_DARK,
  SCORECARD_LEAN_COLOR,
  SCORECARD_LEAN_COLOR_DARK,
  getSemantic,
} from '@chiaro/ui-tokens'
import {
  BrandModeOverrideContext,
  useAlignmentChipColors,
  useBrandTokens,
  useCategoryAccent,
  useCategoryCardBg,
  useFinanceSubSectionShade,
  useIndustryColor,
  useMapColors,
  usePartyColor,
  useScorecardLeanColor,
} from '../src/brand-hooks.ts'

function wrapper(override: 'light' | 'dark' | null) {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: override }, children)
}

describe('useBrandTokens', () => {
  it('returns light mode by default when no override and useColorScheme returns null', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper(null) })
    expect(result.current.mode).toBe('light')
    expect(result.current.semantic).toBe(getSemantic('light'))
    expect(result.current.palette).toBe(BRAND_PALETTE.light)
  })

  it('returns dark mode when override is "dark"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper('dark') })
    expect(result.current.mode).toBe('dark')
    expect(result.current.semantic).toBe(getSemantic('dark'))
    expect(result.current.palette).toBe(BRAND_PALETTE.dark)
  })

  it('returns light mode when override is "light"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper('light') })
    expect(result.current.mode).toBe('light')
  })

  it('semantic.text.primary equals palette ink[1000] for both modes', () => {
    const { result: light } = renderHook(() => useBrandTokens(), { wrapper: wrapper('light') })
    const { result: dark } = renderHook(() => useBrandTokens(), { wrapper: wrapper('dark') })
    expect(light.current.semantic.text.primary).toBe(light.current.palette.ink[1000])
    expect(dark.current.semantic.text.primary).toBe(dark.current.palette.ink[1000])
    expect(light.current.semantic.text.primary).not.toBe(dark.current.semantic.text.primary)
  })

  it('return object has exactly 3 keys', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: wrapper(null) })
    expect(Object.keys(result.current).sort()).toEqual(['mode', 'palette', 'semantic'])
  })
})

// ---------------------------------------------------------------------------
// Slice 37: per-domain mode-aware accessor hook tests.
// ---------------------------------------------------------------------------

describe('usePartyColor', () => {
  it('returns light value when mode is light', () => {
    const { result } = renderHook(() => usePartyColor('D'), { wrapper: wrapper('light') })
    expect(result.current).toBe(PARTY_COLOR.D)
  })
  it('returns dark value when mode is dark', () => {
    const { result } = renderHook(() => usePartyColor('D'), { wrapper: wrapper('dark') })
    expect(result.current).toBe(PARTY_COLOR_DARK.D)
  })
  it('falls back to unknown for unrecognized party in light mode', () => {
    const { result } = renderHook(() => usePartyColor('XYZ'), { wrapper: wrapper('light') })
    expect(result.current).toBe(PARTY_COLOR.unknown)
  })
  it('falls back to unknown for undefined party in dark mode', () => {
    const { result } = renderHook(() => usePartyColor(undefined), { wrapper: wrapper('dark') })
    expect(result.current).toBe(PARTY_COLOR_DARK.unknown)
  })
})

describe('useAlignmentChipColors', () => {
  it('returns light { bg, fg } when mode is light', () => {
    const { result } = renderHook(() => useAlignmentChipColors('strongly-aligned'), {
      wrapper: wrapper('light'),
    })
    expect(result.current).toEqual(ALIGNMENT_CHIP_COLORS['strongly-aligned'])
  })
  it('returns dark { bg, fg } when mode is dark', () => {
    const { result } = renderHook(() => useAlignmentChipColors('strongly-aligned'), {
      wrapper: wrapper('dark'),
    })
    expect(result.current).toEqual(ALIGNMENT_CHIP_COLORS_DARK['strongly-aligned'])
  })
  it('returns the mixed tier object shape', () => {
    const { result } = renderHook(() => useAlignmentChipColors('mixed'), { wrapper: wrapper('light') })
    expect(result.current).toEqual(ALIGNMENT_CHIP_COLORS.mixed)
    expect(Object.keys(result.current).sort()).toEqual(['bg', 'fg'])
  })
})

describe('useScorecardLeanColor', () => {
  it('returns light value when mode is light', () => {
    const { result } = renderHook(() => useScorecardLeanColor('progressive'), {
      wrapper: wrapper('light'),
    })
    expect(result.current).toBe(SCORECARD_LEAN_COLOR.progressive)
  })
  it('returns dark value when mode is dark', () => {
    const { result } = renderHook(() => useScorecardLeanColor('conservative'), {
      wrapper: wrapper('dark'),
    })
    expect(result.current).toBe(SCORECARD_LEAN_COLOR_DARK.conservative)
  })
})

describe('useCategoryAccent', () => {
  it('returns light accent when mode is light', () => {
    const { result } = renderHook(() => useCategoryAccent('voting-bills'), {
      wrapper: wrapper('light'),
    })
    expect(result.current).toBe(CATEGORY_ACCENT['voting-bills'])
  })
  it('returns dark accent when mode is dark', () => {
    const { result } = renderHook(() => useCategoryAccent('voting-bills'), {
      wrapper: wrapper('dark'),
    })
    expect(result.current).toBe(CATEGORY_ACCENT_DARK['voting-bills'])
  })
})

describe('useIndustryColor', () => {
  it('returns light value for a known industry in light mode', () => {
    const { result } = renderHook(() => useIndustryColor('Real Estate'), {
      wrapper: wrapper('light'),
    })
    expect(result.current).toBe(INDUSTRY_COLOR['Real Estate'])
  })
  it('returns dark value for a known industry in dark mode', () => {
    const { result } = renderHook(() => useIndustryColor('Real Estate'), {
      wrapper: wrapper('dark'),
    })
    expect(result.current).toBe(INDUSTRY_COLOR_DARK['Real Estate'])
  })
  it('falls back to default color for unknown industry in light mode', () => {
    const { result } = renderHook(() => useIndustryColor('Quasar Mining'), {
      wrapper: wrapper('light'),
    })
    expect(result.current).toBe(INDUSTRY_DEFAULT_COLOR)
  })
  it('falls back to default color for undefined industry in dark mode', () => {
    const { result } = renderHook(() => useIndustryColor(undefined), { wrapper: wrapper('dark') })
    expect(result.current).toBe(INDUSTRY_DEFAULT_COLOR_DARK)
  })
})

describe('useFinanceSubSectionShade', () => {
  it('returns light shade for contributors in light mode', () => {
    const { result } = renderHook(() => useFinanceSubSectionShade('contributors'), {
      wrapper: wrapper('light'),
    })
    expect(result.current).toEqual(FINANCE_SUB_SECTION_SHADES.contributors)
  })
  it('returns dark shade for topDonor in dark mode', () => {
    const { result } = renderHook(() => useFinanceSubSectionShade('topDonor'), {
      wrapper: wrapper('dark'),
    })
    expect(result.current).toEqual(FINANCE_SUB_SECTION_SHADES_DARK.topDonor)
  })
  it('returns undefined for unknown category', () => {
    const { result } = renderHook(() => useFinanceSubSectionShade('nope'), {
      wrapper: wrapper('light'),
    })
    expect(result.current).toBeUndefined()
  })
})

describe('useMapColors', () => {
  it('returns light map palette when mode is light', () => {
    const { result } = renderHook(() => useMapColors(), { wrapper: wrapper('light') })
    expect(result.current).toEqual(MAP_COLORS)
  })
  it('returns dark map palette when mode is dark', () => {
    const { result } = renderHook(() => useMapColors(), { wrapper: wrapper('dark') })
    expect(result.current).toEqual(MAP_COLORS_DARK)
  })
  it('inverts stroke/fill between modes', () => {
    const { result: light } = renderHook(() => useMapColors(), { wrapper: wrapper('light') })
    const { result: dark } = renderHook(() => useMapColors(), { wrapper: wrapper('dark') })
    expect(light.current.districtStroke).not.toBe(dark.current.districtStroke)
    expect(light.current.districtFill).not.toBe(dark.current.districtFill)
  })
})

describe('useCategoryCardBg (slice 43)', () => {
  it('returns light card bg when mode is light', () => {
    const { result } = renderHook(() => useCategoryCardBg(), { wrapper: wrapper('light') })
    expect(result.current).toBe(CATEGORY_CARD_BG)
  })
  it('returns dark card bg when mode is dark', () => {
    const { result } = renderHook(() => useCategoryCardBg(), { wrapper: wrapper('dark') })
    expect(result.current).toBe(CATEGORY_CARD_BG_DARK)
  })
})
