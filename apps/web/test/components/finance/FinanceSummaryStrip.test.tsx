import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinanceSummaryStrip } from '@/components/finance/FinanceSummaryStrip'

describe('FinanceSummaryStrip', () => {
  it('renders 3 cells with values', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={5234189} smallDonorPct={28.4} pacPct={0.6} />)
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

  it('Total Raised cell is wider (1.3fr grid)', () => {
    const { container } = render(<FinanceSummaryStrip cycle="2024" totalRaised={5_234_189} smallDonorPct={28} pacPct={1} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe('1.3fr 1fr 1fr')
  })

  it('Total Raised value uses larger font (headline)', () => {
    render(<FinanceSummaryStrip cycle="2024" totalRaised={5_234_189} smallDonorPct={28} pacPct={1} />)
    const total = screen.getByText('$5.2M')
    expect(total.style.fontSize).toBe('1.45rem')
    expect(total.style.fontWeight).toBe('800')
  })
})
