import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AlignmentChip } from '../../src/cards/AlignmentChip.tsx'

describe('AlignmentChip', () => {
  it('renders the label', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.getByText('Environment')).toBeTruthy()
  })

  it('renders inert (no link role) when onPress is omitted', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('exposes link role + accessibility label when onPress is provided', () => {
    const onPress = vi.fn()
    render(<AlignmentChip label="Environment" tier="strongly-aligned" onPress={onPress} />)
    const link = screen.getByRole('link', { name: /View Environment positions/i })
    expect(link).toBeTruthy()
  })

  it('invokes onPress when pressed', () => {
    const onPress = vi.fn()
    render(<AlignmentChip label="Environment" tier="strongly-aligned" onPress={onPress} />)
    const link = screen.getByRole('link', { name: /View Environment positions/i })
    fireEvent.click(link)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
