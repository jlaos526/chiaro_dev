import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BioAlignmentChipRow } from '../../src/bio/BioAlignmentChipRow.tsx'
import type { AlignmentChipRow } from '@chiaro/officials'

const CHIPS: AlignmentChipRow[] = [
  {
    issueArea: 'environment',
    displayLabel: 'Environment',
    tier: 'strongly-aligned',
    subCascadeSlug: 'environment',
  },
  {
    issueArea: 'civil-rights',
    displayLabel: 'Civil Rights',
    tier: 'mostly-aligned',
    subCascadeSlug: 'civil-rights',
  },
  {
    issueArea: 'business-policy',
    displayLabel: 'Business Policy',
    tier: 'strongly-differs',
    subCascadeSlug: 'business-policy',
  },
]

describe('BioAlignmentChipRow', () => {
  it('renders 3 chips with correct labels', () => {
    render(<BioAlignmentChipRow chips={CHIPS} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
    expect(screen.getByText('Business Policy')).toBeTruthy()
  })

  it('returns null when chips is empty', () => {
    const { container } = render(<BioAlignmentChipRow chips={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders chips as inert (no link role) when onChipPress is omitted', () => {
    render(<BioAlignmentChipRow chips={CHIPS} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('invokes onChipPress(chip) when a chip is pressed', () => {
    const onChipPress = vi.fn()
    render(<BioAlignmentChipRow chips={CHIPS} onChipPress={onChipPress} />)
    const link = screen.getByRole('link', { name: /View Civil Rights positions/i })
    fireEvent.click(link)
    expect(onChipPress).toHaveBeenCalledTimes(1)
    expect(onChipPress).toHaveBeenCalledWith(CHIPS[1])
  })

  it('handles partial coverage (1 chip)', () => {
    render(<BioAlignmentChipRow chips={CHIPS.slice(0, 1)} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.queryByText('Civil Rights')).toBeNull()
  })
})
