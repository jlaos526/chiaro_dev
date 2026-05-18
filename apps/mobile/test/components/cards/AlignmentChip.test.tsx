import { render, screen, fireEvent } from '@testing-library/react-native'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('AlignmentChip', () => {
  beforeEach(() => mockPush.mockClear())

  it('renders the label', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.getByText('Environment')).toBeTruthy()
  })

  it('press navigates when href provided', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" href="/officials/abc?cat=issue-positions&sub=environment" />)
    fireEvent.press(screen.getByText('Environment'))
    expect(mockPush).toHaveBeenCalledWith('/officials/abc?cat=issue-positions&sub=environment')
  })

  it('no press when href absent', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    fireEvent.press(screen.getByText('Environment'))
    expect(mockPush).not.toHaveBeenCalled()
  })
})
