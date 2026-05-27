import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BRAND_PALETTE, getSemantic } from '@chiaro/ui-tokens'
import {
  BrandModeOverrideContext,
  useBrandTokens,
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
