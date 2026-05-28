import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsSection } from '../../src/settings/SettingsSection.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsSection', () => {
  it('renders without title (card only)', () => {
    const { container } = render(
      <SettingsSection><div>row-1</div></SettingsSection>,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('[role="heading"]')).toBeNull()
  })

  it('renders uppercase title as h2', () => {
    const { container } = render(
      <SettingsSection title="Account"><div>row-1</div></SettingsSection>,
      { wrapper: withMode('light') },
    )
    const h2 = container.querySelector('[role="heading"][aria-level="2"]')
    expect(h2?.textContent).toBe('ACCOUNT')
  })

  it('renders description below title when provided', () => {
    const { getByText } = render(
      <SettingsSection title="Notifications" description="Coming soon">
        <div>row-1</div>
      </SettingsSection>,
      { wrapper: withMode('light') },
    )
    expect(getByText('Coming soon')).toBeTruthy()
  })

  it('renders dividers between children but not after the last', () => {
    const { container } = render(
      <SettingsSection>
        <div data-testid="row-1">row-1</div>
        <div data-testid="row-2">row-2</div>
        <div data-testid="row-3">row-3</div>
      </SettingsSection>,
      { wrapper: withMode('light') },
    )
    // 3 children → expect 2 dividers
    const dividers = container.querySelectorAll('[data-divider="true"]')
    expect(dividers.length).toBe(2)
  })
})
