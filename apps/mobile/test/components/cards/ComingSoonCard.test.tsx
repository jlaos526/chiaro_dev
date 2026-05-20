import { render, screen } from '@testing-library/react-native'
import { ComingSoonCard } from '@/components/cards/ComingSoonCard'

describe('ComingSoonCard', () => {
  it('renders category title', () => {
    render(<ComingSoonCard category="Finance" />)
    expect(screen.getByText('Finance')).toBeTruthy()
  })

  it('renders per-category copy', () => {
    render(<ComingSoonCard category="Service Record" />)
    expect(screen.getByText(/Bills \+ votes — coming soon/i)).toBeTruthy()
  })

  it('accepts all 5 categories', () => {
    const categories = [
      'Service Record',
      'Issue Positions',
      'Community Presence',
      'Finance',
      'Ethics & Accountability',
    ] as const
    for (const c of categories) {
      const { unmount } = render(<ComingSoonCard category={c} />)
      expect(screen.getByText(c)).toBeTruthy()
      unmount()
    }
  })
})
