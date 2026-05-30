import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { BrandPageScreen } from '../../src/screens/BrandPageScreen.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BrandPageScreen', () => {
  it('renders title as h1 when provided', () => {
    const { container } = render(
      <BrandPageScreen title="Your officials"><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    // BrandHeading uses createElement('h1', ...) on web — plain <h1> without
    // explicit role/aria-level attributes (those are implicit for real h1).
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Your officials')
  })

  it('omits heading when title is undefined', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    expect(container.querySelector('h1')).toBeNull()
  })

  it('applies semantic.bg.app background on outer wrapper', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    // Light mode: BRAND_PALETTE.light.surface.base = #efece5 = rgb(239, 236, 229)
    // RNW may normalise hex to rgb in inline style.
    expect(outer?.getAttribute('style')).toMatch(/background-color:\s*(rgb\(239,\s*236,\s*229\)|#efece5)/i)
  })

  it('applies WEB_VIEWPORT_FILL minHeight 100vh on web', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/min-height:\s*100vh/i)
  })

  it('renders children inside the column wrapper', () => {
    const { getByText } = render(
      <BrandPageScreen><div>page-body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    expect(getByText('page-body')).toBeTruthy()
  })

  it('consumes the --chiaro-rail-width CSS var on web', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/padding-left:\s*calc\(/i)
    expect(outer?.getAttribute('style')).toContain('--chiaro-rail-width')
  })

  it('consumes the --chiaro-rail-topbar CSS var for padding-top on web', () => {
    const { container } = render(
      <BrandPageScreen><div>body</div></BrandPageScreen>,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/padding-top:\s*calc\([^)]*--chiaro-rail-topbar/i)
  })
})
