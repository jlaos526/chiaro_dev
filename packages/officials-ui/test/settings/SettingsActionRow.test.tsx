import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BRAND_SEMANTIC } from '@chiaro/ui-tokens'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsActionRow } from '../../src/settings/SettingsActionRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

// RNW StyleSheet normalizes hex colors to rgb(R, G, B) form in inline styles
// (see Gotcha #19). Accept either form when asserting against a BRAND token.
function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function styleContainsColor(style: string, hex: string): boolean {
  return style.includes(hex) || style.includes(hexToRgb(hex))
}

describe('SettingsActionRow', () => {
  it('renders label and calls onPress when clicked', () => {
    const onPress = vi.fn()
    const { getByText } = render(
      <SettingsActionRow label="Sign out" onPress={onPress} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Sign out')).toBeTruthy()
    fireEvent.click(getByText('Sign out'))
    expect(onPress).toHaveBeenCalled()
  })

  it('non-danger uses text.primary color', () => {
    const { getByText } = render(
      <SettingsActionRow label="Sign out" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    const text = getByText('Sign out')
    const inlineStyle = text.getAttribute('style') ?? ''
    expect(styleContainsColor(inlineStyle, BRAND_SEMANTIC.light.text.primary)).toBe(true)
  })

  it('danger variant uses alert.danger.fg color', () => {
    const { getByText } = render(
      <SettingsActionRow label="Sign out" danger onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    const text = getByText('Sign out')
    const inlineStyle = text.getAttribute('style') ?? ''
    expect(styleContainsColor(inlineStyle, BRAND_SEMANTIC.light.alert.danger.fg)).toBe(true)
  })
})
