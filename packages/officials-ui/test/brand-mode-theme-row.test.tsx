import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeProvider } from '../src/brand-mode-provider.tsx'
import { BrandModeThemeRow } from '../src/settings/brand-mode-theme-row.tsx'

function withProvider(
  defaultMode: 'light' | 'dark' | null,
  onChange?: (m: 'light' | 'dark' | null) => void,
) {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeProvider, { defaultMode, onChange }, children)
}

describe('BrandModeThemeRow', () => {
  it('renders three buttons labelled System, Light, Dark', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null) })
    expect(getByText('System')).toBeTruthy()
    expect(getByText('Light')).toBeTruthy()
    expect(getByText('Dark')).toBeTruthy()
  })

  it('marks System as selected when override is null', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null) })
    const systemBtn = getByText('System').closest('[role="button"]')
    expect(systemBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks Light as selected when override is "light"', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider('light') })
    expect(getByText('Light').closest('[role="button"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(getByText('System').closest('[role="button"]')?.getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('marks Dark as selected when override is "dark"', () => {
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider('dark') })
    expect(getByText('Dark').closest('[role="button"]')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('tapping Dark calls onChange with "dark"', () => {
    const onChange = vi.fn()
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null, onChange) })
    fireEvent.click(getByText('Dark'))
    expect(onChange).toHaveBeenCalledWith('dark')
  })

  it('tapping System calls onChange with null', () => {
    const onChange = vi.fn()
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider('dark', onChange) })
    fireEvent.click(getByText('System'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('tapping Light calls onChange with "light"', () => {
    const onChange = vi.fn()
    const { getByText } = render(<BrandModeThemeRow />, { wrapper: withProvider(null, onChange) })
    fireEvent.click(getByText('Light'))
    expect(onChange).toHaveBeenCalledWith('light')
  })
})
