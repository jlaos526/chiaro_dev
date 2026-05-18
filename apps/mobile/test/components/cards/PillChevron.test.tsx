import { render, screen } from '@testing-library/react-native'
import { PillChevron } from '@/components/cards/PillChevron'

describe('PillChevron', () => {
  it('shows ▸ when closed', () => {
    render(<PillChevron open={false} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('shows ▾ when open', () => {
    render(<PillChevron open={true} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })
})
