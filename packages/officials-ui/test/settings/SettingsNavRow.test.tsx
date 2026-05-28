import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsNavRow } from '../../src/settings/SettingsNavRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsNavRow', () => {
  it('renders label + chevron', () => {
    const { getByText } = render(
      <SettingsNavRow label="Home address" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Home address')).toBeTruthy()
    expect(getByText('›')).toBeTruthy()
  })

  it('renders value when provided', () => {
    const { getByText } = render(
      <SettingsNavRow label="Home address" value="123 Main St" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    expect(getByText('123 Main St')).toBeTruthy()
  })

  it('calls onPress when the row is clicked (no href, Pressable path)', () => {
    const onPress = vi.fn()
    const { getByText } = render(
      <SettingsNavRow label="Home address" onPress={onPress} />,
      { wrapper: withMode('light') },
    )
    fireEvent.click(getByText('Home address'))
    expect(onPress).toHaveBeenCalled()
  })

  it('renders an <a href> on web when href is provided (smart-anchor)', () => {
    const { container } = render(
      <SettingsNavRow label="Home address" href="/settings/address" onPress={() => {}} />,
      { wrapper: withMode('light') },
    )
    const anchor = container.querySelector('a[href="/settings/address"]')
    expect(anchor).not.toBeNull()
  })

  it('calls onPress on plain left-click of the anchor (smart-anchor intercepts)', () => {
    const onPress = vi.fn()
    const { container } = render(
      <SettingsNavRow label="Home address" href="/settings/address" onPress={onPress} />,
      { wrapper: withMode('light') },
    )
    const anchor = container.querySelector('a') as HTMLAnchorElement
    fireEvent.click(anchor, { metaKey: false, ctrlKey: false, shiftKey: false, button: 0 })
    expect(onPress).toHaveBeenCalled()
  })
})
