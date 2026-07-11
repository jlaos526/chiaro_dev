import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsValueRow } from '../../src/settings/SettingsValueRow.tsx'
import { SettingsComingSoonRow } from '../../src/settings/SettingsComingSoonRow.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsValueRow', () => {
  it('renders label and right-aligned value', () => {
    const { getByText } = render(<SettingsValueRow label="Version" value="1.2.3" />, {
      wrapper: withMode('light'),
    })
    expect(getByText('Version')).toBeTruthy()
    expect(getByText('1.2.3')).toBeTruthy()
  })
})

describe('SettingsComingSoonRow', () => {
  it('renders label and "Coming soon" badge', () => {
    const { getByText } = render(<SettingsComingSoonRow label="Display name" />, {
      wrapper: withMode('light'),
    })
    expect(getByText('Display name')).toBeTruthy()
    expect(getByText('Coming soon')).toBeTruthy()
  })

  it('renders description below label when provided', () => {
    const { getByText } = render(
      <SettingsComingSoonRow label="Avatar" description="Upload a profile picture" />,
      { wrapper: withMode('light') },
    )
    expect(getByText('Upload a profile picture')).toBeTruthy()
  })
})
