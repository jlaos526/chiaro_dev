import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { IndustryBreakdown } from '@/components/finance/IndustryBreakdown'

const TEN = Array.from({ length: 10 }, (_, i) => ({
  industry: `Industry ${i + 1}`,
  amount: (10 - i) * 50_000,
}))

describe('IndustryBreakdown', () => {
  it('renders 5 rows by default', () => {
    render(<IndustryBreakdown rows={TEN} />)
    expect(screen.getByText('Industry 1')).toBeTruthy()
    expect(screen.getByText('Industry 5')).toBeTruthy()
    expect(screen.queryByText('Industry 6')).toBeNull()
  })

  it('toggle button shows "Show 5 more industries · 5 of 10 shown"', () => {
    render(<IndustryBreakdown rows={TEN} />)
    expect(screen.getByText('Show 5 more industries')).toBeTruthy()
    expect(screen.getByText('5 of 10 shown')).toBeTruthy()
  })

  it('clicking toggle reveals rows 6-10 + flips to "Show less"', () => {
    render(<IndustryBreakdown rows={TEN} />)
    fireEvent.click(screen.getByText('Show 5 more industries').closest('button')!)
    expect(screen.getByText('Industry 6')).toBeTruthy()
    expect(screen.getByText('Industry 10')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
    expect(screen.getByText('10 of 10 shown')).toBeTruthy()
  })

  it('row 1 industry name uses bolder + slightly larger font', () => {
    render(<IndustryBreakdown rows={TEN} />)
    const row1 = screen.getByText('Industry 1')
    expect(row1.style.fontWeight).toBe('700')
    expect(row1.style.fontSize).toBe('0.92rem')
  })

  it('row 2+ uses 600 / 0.82rem', () => {
    render(<IndustryBreakdown rows={TEN} />)
    const row2 = screen.getByText('Industry 2')
    expect(row2.style.fontWeight).toBe('600')
    expect(row2.style.fontSize).toBe('0.82rem')
  })

  it('percent is shown next to dollar', () => {
    render(<IndustryBreakdown rows={[{ industry: 'A', amount: 500 }, { industry: 'B', amount: 500 }]} />)
    const pcts = screen.getAllByText(/50%/)
    expect(pcts.length).toBe(2)
  })

  it('toggle hidden when <=5 rows', () => {
    render(<IndustryBreakdown rows={TEN.slice(0, 3)} />)
    expect(screen.queryByText(/Show 5 more/)).toBeNull()
  })

  it('renders "full breakdown on OpenSecrets" link', () => {
    render(<IndustryBreakdown rows={TEN} sourceUrl="https://www.opensecrets.org/example" />)
    const link = screen.getByText(/full breakdown on OpenSecrets/)
    expect(link.closest('a')?.getAttribute('href')).toBe('https://www.opensecrets.org/example')
  })
})
