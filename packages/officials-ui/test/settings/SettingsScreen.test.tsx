import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { SettingsScreen } from '../../src/settings/SettingsScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('SettingsScreen', () => {
  it('renders default "Settings" title as h1', () => {
    const { container } = render(<SettingsScreen>{null}</SettingsScreen>, {
      wrapper: withMode('light'),
    })
    const h1 = container.querySelector('h1[role="heading"][aria-level="1"]')
    expect(h1?.textContent).toBe('Settings')
  })

  it('renders custom title when prop provided', () => {
    const { container } = render(<SettingsScreen title="Preferences">{null}</SettingsScreen>, {
      wrapper: withMode('light'),
    })
    expect(container.querySelector('h1')?.textContent).toBe('Preferences')
  })

  it('renders children below title', () => {
    const { getByText } = render(
      <SettingsScreen>
        <div>child-content</div>
      </SettingsScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('child-content')).toBeTruthy()
  })

  it('applies viewport-fill (minHeight: 100vh) on web', () => {
    const { container } = render(<SettingsScreen>{null}</SettingsScreen>, {
      wrapper: withMode('light'),
    })
    // jsdom is Platform.OS === 'web'; outer View should receive the WEB_VIEWPORT_FILL style.
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/min-height:\s*100vh/i)
  })
})
