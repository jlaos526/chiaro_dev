import { describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useBrandTokens } from '../src/brand-hooks.ts'
import { BrandModeProvider, useBrandModeSetter } from '../src/brand-mode-provider.tsx'

function withProvider(defaultMode: 'light' | 'dark' | null, onChange?: (m: 'light' | 'dark' | null) => void) {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeProvider, { defaultMode, onChange }, children)
}

describe('BrandModeProvider', () => {
  it('defaults useBrandTokens.mode to light when defaultMode is null and useColorScheme is null', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: withProvider(null) })
    expect(result.current.mode).toBe('light')
  })

  it('forces dark when defaultMode is "dark"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: withProvider('dark') })
    expect(result.current.mode).toBe('dark')
  })

  it('forces light when defaultMode is "light"', () => {
    const { result } = renderHook(() => useBrandTokens(), { wrapper: withProvider('light') })
    expect(result.current.mode).toBe('light')
  })

  it('setMode updates the active mode for consumers', () => {
    const { result } = renderHook(
      () => ({ tokens: useBrandTokens(), setter: useBrandModeSetter() }),
      { wrapper: withProvider(null) },
    )
    expect(result.current.tokens.mode).toBe('light')
    act(() => result.current.setter.setMode('dark'))
    expect(result.current.tokens.mode).toBe('dark')
  })

  it('setMode(null) clears the override and falls back to system', () => {
    const { result } = renderHook(
      () => ({ tokens: useBrandTokens(), setter: useBrandModeSetter() }),
      { wrapper: withProvider('dark') },
    )
    expect(result.current.tokens.mode).toBe('dark')
    act(() => result.current.setter.setMode(null))
    // No useColorScheme mock → null override falls through to light default.
    expect(result.current.tokens.mode).toBe('light')
  })

  it('invokes onChange with the new value on each setMode call', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useBrandModeSetter(), {
      wrapper: withProvider(null, onChange),
    })
    act(() => result.current.setMode('dark'))
    act(() => result.current.setMode('light'))
    act(() => result.current.setMode(null))
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenNthCalledWith(1, 'dark')
    expect(onChange).toHaveBeenNthCalledWith(2, 'light')
    expect(onChange).toHaveBeenNthCalledWith(3, null)
  })

  it('exposes the current override on the setter context', () => {
    const { result } = renderHook(() => useBrandModeSetter(), {
      wrapper: withProvider('dark'),
    })
    expect(result.current.override).toBe('dark')
  })
})
