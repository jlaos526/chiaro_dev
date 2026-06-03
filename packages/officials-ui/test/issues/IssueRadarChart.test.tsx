import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { IssueRadarChart } from '../../src/issues/IssueRadarChart.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Mirror the officials-ui convention (see BioPortrait.test.tsx): wrap the tree
// in BrandModeOverrideContext.Provider to pin the brand mode, rather than a
// (non-existent) TestBrandProvider helper.
const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

const SIX = ['a', 'b', 'c', 'd', 'e', 'f']

describe('IssueRadarChart', () => {
  it('renders a user polygon over 6 axes (grid + user)', () => {
    const { container } = render(
      <IssueRadarChart axes={SIX} userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]} />,
      { wrapper: lightWrapper },
    )
    // grid polygon + user polygon (no rep → 2 polygons)
    expect(container.querySelectorAll('polygon').length).toBe(2)
  })

  it('draws one radial spoke per axis', () => {
    const { container } = render(
      <IssueRadarChart axes={SIX} userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]} />,
      { wrapper: lightWrapper },
    )
    expect(container.querySelectorAll('line').length).toBe(6)
  })

  it('adds a third (rep) polygon when repValues is provided', () => {
    const { container } = render(
      <IssueRadarChart
        axes={SIX}
        userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]}
        repValues={[0.5, 0.5, 1, 0.5, 0.5, 0.5]}
      />,
      { wrapper: lightWrapper },
    )
    // grid + rep + user = 3 polygons
    expect(container.querySelectorAll('polygon').length).toBe(3)
  })

  it('rep polygon is dashed (distinguishable from the user fill)', () => {
    const { container } = render(
      <IssueRadarChart
        axes={SIX}
        userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]}
        repValues={[0.5, 0.5, 1, 0.5, 0.5, 0.5]}
      />,
      { wrapper: lightWrapper },
    )
    // React in jsdom normalizes the SVG prop `strokeDasharray` to the DOM
    // attribute `stroke-dasharray`, so query the hyphenated name.
    const dashed = Array.from(container.querySelectorAll('polygon')).filter((p) =>
      p.getAttribute('stroke-dasharray'),
    )
    expect(dashed.length).toBe(1)
  })

  it('a null rep entry collapses to center (drawn as 0) without throwing', () => {
    expect(() =>
      render(
        <IssueRadarChart
          axes={SIX}
          userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]}
          repValues={[0.5, null, 1, 0.5, 0.5, 0.5]}
        />,
        { wrapper: lightWrapper },
      ),
    ).not.toThrow()
  })

  it('exposes an accessibility label on the wrapping view', () => {
    const { container } = render(
      <IssueRadarChart axes={SIX} userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]} />,
      { wrapper: lightWrapper },
    )
    expect(container.querySelector('[aria-label="Issue priorities radar chart"]')).not.toBeNull()
  })

  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<IssueRadarChart axes={SIX} userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]} />, {
        wrapper: lightWrapper,
      }),
    ).not.toThrow()
    expect(() =>
      render(<IssueRadarChart axes={SIX} userValues={[1, 0.5, 0.5, 0.5, 0.5, 0.5]} />, {
        wrapper: darkWrapper,
      }),
    ).not.toThrow()
  })

  it('uses mode-aware grid color (light vs dark differ)', () => {
    const light = render(<IssueRadarChart axes={SIX} userValues={[1, 1, 1, 1, 1, 1]} />, {
      wrapper: lightWrapper,
    })
    const dark = render(<IssueRadarChart axes={SIX} userValues={[1, 1, 1, 1, 1, 1]} />, {
      wrapper: darkWrapper,
    })
    const lightGrid = light.container.querySelector('polygon')?.getAttribute('stroke')
    const darkGrid = dark.container.querySelector('polygon')?.getAttribute('stroke')
    expect(lightGrid).toBeTruthy()
    expect(darkGrid).toBeTruthy()
    expect(lightGrid).not.toBe(darkGrid)
  })
})
