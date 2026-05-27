import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MetricCardShell } from '../../src/cards/MetricCardShell.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('MetricCardShell', () => {
  it('renders the value and label text', () => {
    const { getByText } = render(
      <MetricCardShell
        value="$223,500"
        label="Base Salary"
        caption="Speaker"
        categoryId="service-record"
        externalSourceUrl="https://crsreports.congress.gov/example"
      />,
    )
    expect(getByText('$223,500')).toBeTruthy()
    expect(getByText('Base Salary')).toBeTruthy()
    expect(getByText('Speaker')).toBeTruthy()
  })

  it('renders "view evidence" CTA when onExpand provided', () => {
    const onExpand = vi.fn()
    const { getByText } = render(
      <MetricCardShell
        value="50%"
        label="Attendance"
        categoryId="voting-bills"
        onExpand={onExpand}
      />,
    )
    expect(getByText('view evidence →')).toBeTruthy()
  })

  it('renders "view source" CTA when externalSourceUrl provided', () => {
    const { getByText } = render(
      <MetricCardShell
        value="$5.2M"
        label="Total Raised"
        categoryId="finance"
        externalSourceUrl="https://www.opensecrets.org"
      />,
    )
    expect(getByText('view source →')).toBeTruthy()
  })

  it('unavailable variant forces "Unavailable" label + suppresses CTA', () => {
    const { getByText, queryByText } = render(
      <MetricCardShell
        value="No Data"
        label="Lives in District"
        categoryId="community-presence"
        unavailable={true}
        externalSourceUrl="https://example.org"
      />,
    )
    expect(getByText('Unavailable')).toBeTruthy()
    expect(queryByText('Lives in District')).toBeNull()
    expect(queryByText('view source →')).toBeNull()
  })

  it('applies per-category gradient background when not placeholder/unavailable', () => {
    const { container } = render(
      <MetricCardShell
        value="$5.2M"
        label="Total Raised"
        categoryId="finance"
        externalSourceUrl="https://www.opensecrets.org"
      />,
    )
    // Outer card is the first descendant element. RNW propagates the
    // `background` string straight through; inline style is read from DOM.
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(180deg, #f4faf6 0%, #fff 100%\)/)
  })

  it('placeholder variant suppresses CTA', () => {
    const onExpand = vi.fn()
    const { queryByText } = render(
      <MetricCardShell
        value="—"
        label="Individual Donors"
        categoryId="finance"
        placeholder={true}
        onExpand={onExpand}
      />,
    )
    expect(queryByText('view evidence →')).toBeNull()
  })
})

describe('MetricCardShell — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(
        <MetricCardShell
          value="$223,500"
          label="Base Salary"
          categoryId="service-record"
          externalSourceUrl="https://example.org"
        />,
        { wrapper: lightWrapper },
      ),
    ).not.toThrow()
    expect(() =>
      render(
        <MetricCardShell
          value="$223,500"
          label="Base Salary"
          categoryId="service-record"
          externalSourceUrl="https://example.org"
        />,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
