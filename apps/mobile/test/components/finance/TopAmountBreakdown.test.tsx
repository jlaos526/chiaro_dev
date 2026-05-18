import { render, screen, fireEvent } from '@testing-library/react-native'
import { TopAmountBreakdown } from '@/components/finance/TopAmountBreakdown'

const TEN = Array.from({ length: 10 }, (_, i) => ({
  label: `Item ${i + 1}`,
  amount: (10 - i) * 50_000,
}))
const NOUN = { singular: 'industry', plural: 'industries' }

describe('TopAmountBreakdown', () => {
  it('renders 5 rows by default', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN} />)
    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByText('Item 5')).toBeTruthy()
    expect(screen.queryByText('Item 6')).toBeNull()
  })
  it('toggle reveals rows 6-10', () => {
    render(<TopAmountBreakdown rows={TEN} noun={NOUN} />)
    fireEvent.press(screen.getByText('Show 5 more industries'))
    expect(screen.getByText('Item 10')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
  })
  it('toggle copy reflects different noun', () => {
    render(<TopAmountBreakdown rows={TEN} noun={{ singular: 'donor', plural: 'donors' }} />)
    expect(screen.getByText('Show 5 more donors')).toBeTruthy()
  })
  it('toggle hidden when ≤5 rows', () => {
    render(<TopAmountBreakdown rows={TEN.slice(0, 3)} noun={NOUN} />)
    expect(screen.queryByText(/Show 5 more/)).toBeNull()
  })
})
