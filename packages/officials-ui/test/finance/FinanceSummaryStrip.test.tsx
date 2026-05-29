import { createElement, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FinanceSummaryStrip } from '../../src/finance/FinanceSummaryStrip.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('FinanceSummaryStrip', () => {
  it('renders 3 cells with formatted values', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={5_234_189} smallDonorPct={28.4} pacPct={0.6} />)
    expect(screen.getByText('$5.2M')).toBeTruthy()
    expect(screen.getByText('28%')).toBeTruthy()
    expect(screen.getByText('0.6%')).toBeTruthy()
  })

  it('formats labels with cycle year', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={1_000_000} smallDonorPct={null} pacPct={null} />)
    expect(screen.getByText(/Total Raised, 2024/i)).toBeTruthy()
  })

  it('displays — for null values', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={null} smallDonorPct={null} pacPct={null} />)
    expect(screen.getAllByText('—').length).toBe(3)
  })

  it('formats $K when totalRaised < 1M', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={425_000} smallDonorPct={null} pacPct={null} />)
    expect(screen.getByText('$425K')).toBeTruthy()
  })

  it('applies the finance category gradient on web', () => {
    const { container } = render(
      <FinanceSummaryStrip cycle="2024" totalRaised={1_000_000} smallDonorPct={28} pacPct={5} />,
    )
    // Outer wrapper is the raw <div> that carries the CSS gradient.
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(180deg, #d4e8d8 0%, #fff 100%\)/)
  })
})

describe('FinanceSummaryStrip — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(
        <FinanceSummaryStrip cycle="2024" totalRaised={1_000_000} smallDonorPct={28} pacPct={5} />,
        { wrapper: lightWrapper },
      ),
    ).not.toThrow()
    expect(() =>
      render(
        <FinanceSummaryStrip cycle="2024" totalRaised={1_000_000} smallDonorPct={28} pacPct={5} />,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
