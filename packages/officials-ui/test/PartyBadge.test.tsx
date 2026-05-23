import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartyBadge } from '../src/PartyBadge.tsx'

describe('PartyBadge', () => {
  it('renders short party code for Democratic', () => {
    const { getByText } = render(<PartyBadge party="D" />)
    expect(getByText('D')).toBeTruthy()
  })

  it('renders short party code for Republican', () => {
    const { getByText } = render(<PartyBadge party="R" />)
    expect(getByText('R')).toBeTruthy()
  })

  it('renders accessibility label with full party name', () => {
    const { container } = render(<PartyBadge party="D" />)
    expect(container.querySelector('[aria-label="Democratic"]')).not.toBeNull()
  })
})
