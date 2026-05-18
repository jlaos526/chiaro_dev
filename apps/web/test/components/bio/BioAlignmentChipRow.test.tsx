import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioAlignmentChipRow } from '@/components/bio/BioAlignmentChipRow'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

const OFFICIAL_ID = '84eeab39-349d-4ae9-acd2-2229a3d38569'

const CHIPS: AlignmentChipRow[] = [
  { issueArea: 'environment',   displayLabel: 'Environment',   tier: 'strongly-aligned', subCascadeSlug: 'environment' },
  { issueArea: 'civil-rights',  displayLabel: 'Civil Rights',  tier: 'mostly-aligned',   subCascadeSlug: 'civil-rights' },
  { issueArea: 'business-policy', displayLabel: 'Business Policy', tier: 'strongly-differs', subCascadeSlug: 'business-policy' },
]

describe('BioAlignmentChipRow', () => {
  it('renders 3 AlignmentChips with correct labels', () => {
    render(<BioAlignmentChipRow chips={CHIPS} officialId={OFFICIAL_ID} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
    expect(screen.getByText('Business Policy')).toBeTruthy()
  })

  it('each chip href is /officials/<id>#issue-positions:<slug>', () => {
    const { container } = render(<BioAlignmentChipRow chips={CHIPS} officialId={OFFICIAL_ID} />)
    const links = container.querySelectorAll('a')
    expect(links.length).toBe(3)
    expect(links[0]?.getAttribute('href')).toBe(`/officials/${OFFICIAL_ID}#issue-positions:environment`)
    expect(links[1]?.getAttribute('href')).toBe(`/officials/${OFFICIAL_ID}#issue-positions:civil-rights`)
    expect(links[2]?.getAttribute('href')).toBe(`/officials/${OFFICIAL_ID}#issue-positions:business-policy`)
  })

  it('returns null (no DOM) when chips is empty', () => {
    const { container } = render(<BioAlignmentChipRow chips={[]} officialId={OFFICIAL_ID} />)
    expect(container.firstChild).toBeNull()
  })

  it('handles partial coverage (1 chip)', () => {
    render(<BioAlignmentChipRow chips={CHIPS.slice(0, 1)} officialId={OFFICIAL_ID} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.queryByText('Civil Rights')).toBeNull()
  })

  it('handles partial coverage (2 chips)', () => {
    render(<BioAlignmentChipRow chips={CHIPS.slice(0, 2)} officialId={OFFICIAL_ID} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
    expect(screen.queryByText('Business Policy')).toBeNull()
  })

  it('row uses centered flex layout', () => {
    const { container } = render(<BioAlignmentChipRow chips={CHIPS} officialId={OFFICIAL_ID} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.display).toBe('flex')
    expect(wrapper.style.justifyContent).toBe('center')
  })
})
