import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandFormScreen } from '../../src/screens/BrandFormScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BrandFormScreen', () => {
  it('renders required title as h1', () => {
    const { container } = render(
      <BrandFormScreen title="Home address">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Home address')
  })

  it('renders optional subtitle as muted body text', () => {
    const { getByText } = render(
      <BrandFormScreen title="Home address" subtitle="Last updated yesterday">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('Last updated yesterday')).toBeTruthy()
  })

  it('omits subtitle when not provided', () => {
    const { queryByText } = render(
      <BrandFormScreen title="Home address">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(queryByText(/last updated/i)).toBeNull()
  })

  it('renders optional back link with href + label', () => {
    const { container } = render(
      <BrandFormScreen title="Home address" backHref="/settings" backLabel="← Settings">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    const link = container.querySelector('a[href="/settings"]')
    expect(link?.textContent).toBe('← Settings')
  })

  it('omits back link when backHref is absent', () => {
    const { container } = render(
      <BrandFormScreen title="Home address">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('a')).toBeNull()
  })

  it('applies card bg.elevated', () => {
    const { container } = render(
      <BrandFormScreen title="X">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    // Outer is the bg.app wrapper; card is the first inner View.
    const card = container.firstChild?.firstChild as HTMLElement
    // Light bg.elevated is #ffffff → rgb(255, 255, 255)
    expect(card?.getAttribute('style')).toMatch(
      /background-color:\s*(rgb\(255,\s*255,\s*255\)|#fff|#ffffff)/i,
    )
  })

  it('renders form children', () => {
    const { getByText } = render(
      <BrandFormScreen title="X">
        <div>form-body</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('form-body')).toBeTruthy()
  })

  it('consumes the --chiaro-rail-topbar CSS var for padding-top on web', () => {
    const { container } = render(
      <BrandFormScreen title="X">
        <div>form</div>
      </BrandFormScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/padding-top:\s*calc\([^)]*--chiaro-rail-topbar/i)
  })
})
