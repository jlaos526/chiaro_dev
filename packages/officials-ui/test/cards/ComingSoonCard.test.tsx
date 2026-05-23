import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComingSoonCard } from '../../src/cards/ComingSoonCard.tsx'

describe('ComingSoonCard', () => {
  it('renders category title in header', () => {
    const { getByText } = render(<ComingSoonCard category="Finance" />)
    expect(getByText('Finance')).toBeTruthy()
  })

  it('renders per-category coming-soon copy in body', () => {
    const { getByText } = render(<ComingSoonCard category="Service Record" />)
    expect(getByText(/Bills \+ votes — coming soon/i)).toBeTruthy()
  })

  it('marks the category title with accessibilityRole="header"', () => {
    const { container } = render(<ComingSoonCard category="Issue Positions" />)
    expect(container.querySelector('[role="heading"]')).not.toBeNull()
  })

  it('accepts all 5 category values', () => {
    const categories = [
      'Service Record',
      'Issue Positions',
      'Community Presence',
      'Finance',
      'Ethics & Accountability',
    ] as const
    for (const c of categories) {
      const { getByText } = render(<ComingSoonCard category={c} />)
      expect(getByText(c)).toBeTruthy()
    }
  })
})
