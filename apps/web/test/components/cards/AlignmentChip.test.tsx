import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AlignmentChip } from '@/components/cards/AlignmentChip'

afterEach(() => {
  cleanup()
})

describe('AlignmentChip', () => {
  it('renders the display label, no symbol/glyph', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    const chip = screen.getByText('Environment')
    expect(chip.textContent).toBe('Environment')
  })

  it('applies the strongly-aligned palette', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    const chip = screen.getByText('Environment')
    expect(chip.style.background).toContain('rgb(197, 227, 199)')
    expect(chip.style.color).toContain('rgb(31, 77, 36)')
  })

  it('applies the strongly-differs palette', () => {
    render(<AlignmentChip label="Second Amendment" tier="strongly-differs" />)
    const chip = screen.getByText('Second Amendment')
    expect(chip.style.background).toContain('rgb(240, 184, 160)')
    expect(chip.style.color).toContain('rgb(90, 40, 18)')
  })

  it('wraps in an <a> when href is provided', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" href="/officials/abc#issue-positions:environment" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/officials/abc#issue-positions:environment')
    expect(link.textContent).toContain('Environment')
  })

  it('renders bare span (no link) when href is omitted', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
