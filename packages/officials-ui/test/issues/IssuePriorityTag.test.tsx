import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { IssuePriorityTag } from '../../src/issues/IssuePriorityTag.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

// Mirror the officials-ui convention (see IssueRadarChart.test.tsx /
// RepAlignmentStrip.test.tsx): wrap the tree in BrandModeOverrideContext
// .Provider to pin the brand mode, rather than a (non-existent) TestBrandProvider.
const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('IssuePriorityTag', () => {
  it('renders the star label with an a11y label', () => {
    const { getByLabelText } = render(<IssuePriorityTag label="Your priority" />, {
      wrapper: lightWrapper,
    })
    expect(getByLabelText(/your priority/i)).toBeTruthy()
  })

  it('defaults the label to "Your priority"', () => {
    const { getByLabelText } = render(<IssuePriorityTag />, { wrapper: lightWrapper })
    expect(getByLabelText(/your priority/i)).toBeTruthy()
  })

  it('renders a star glyph alongside the label', () => {
    const { getByText } = render(<IssuePriorityTag label="Priority" />, {
      wrapper: lightWrapper,
    })
    expect(getByText(/★/)).toBeTruthy()
  })

  it('renders under both light and dark wrappers without throwing', () => {
    expect(() => render(<IssuePriorityTag />, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(<IssuePriorityTag />, { wrapper: darkWrapper })).not.toThrow()
  })
})
