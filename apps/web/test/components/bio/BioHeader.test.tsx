import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BioHeader } from '@/components/bio/BioHeader'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

const OFFICIAL_ID = '84eeab39-349d-4ae9-acd2-2229a3d38569'

const PELOSI = {
  officialId: OFFICIAL_ID,
  fullName: 'Nancy Pelosi',
  portraitUrl: null,
  party: 'D',
  chamber: 'house' as const,
  state: 'CA',
  stateName: 'California',
  districtNumber: 11,
  senateClass: null,
  atLarge: false,
  role: 'Speaker',
  firstElectedYear: 2007,
  officialUrl: 'https://pelosi.house.gov',
  twitterHandle: 'SpeakerPelosi',
  chips: [] as AlignmentChipRow[],
}

const SAMPLE_CHIPS: AlignmentChipRow[] = [
  { issueArea: 'environment',   displayLabel: 'Environment',   tier: 'strongly-aligned', subCascadeSlug: 'environment' },
  { issueArea: 'civil-rights',  displayLabel: 'Civil Rights',  tier: 'mostly-aligned',   subCascadeSlug: 'civil-rights' },
  { issueArea: 'business-policy', displayLabel: 'Business Policy', tier: 'strongly-differs', subCascadeSlug: 'business-policy' },
]

describe('BioHeader', () => {
  it('renders name + identity row + service card + contact links for a house rep', () => {
    render(<BioHeader {...PELOSI} />)
    expect(screen.getByText('Nancy Pelosi')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    expect(screen.getByText("California's 11th District")).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
    expect(screen.getByText(/Since 2007/)).toBeTruthy()
    expect(screen.getByText('pelosi.house.gov')).toBeTruthy()
    expect(screen.getByText('@SpeakerPelosi')).toBeTruthy()
  })

  it('senate variant uses full state name (no district number)', () => {
    render(
      <BioHeader
        {...PELOSI}
        chamber="senate"
        districtNumber={null}
        senateClass={1}
        role="Senator"
      />
    )
    expect(screen.getByText('California')).toBeTruthy()
    expect(screen.queryByText(/11th District/)).toBeNull()
  })

  it('at-large variant renders "<StateName>\'s At-Large District"', () => {
    render(
      <BioHeader
        {...PELOSI}
        state="WY" stateName="Wyoming" districtNumber={null} atLarge={true}
        role="Representative" firstElectedYear={2023}
      />
    )
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })

  it('renders top-3 alignment chips with hash deep-link hrefs when chips provided', () => {
    const { container } = render(<BioHeader {...PELOSI} chips={SAMPLE_CHIPS} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
    expect(screen.getByText('Business Policy')).toBeTruthy()
    const hrefs = Array.from(container.querySelectorAll('a'))
      .map(a => a.getAttribute('href'))
      .filter((h): h is string => !!h && h.includes('#issue-positions:'))
    expect(hrefs).toContain(`/officials/${OFFICIAL_ID}#issue-positions:environment`)
    expect(hrefs).toContain(`/officials/${OFFICIAL_ID}#issue-positions:civil-rights`)
    expect(hrefs).toContain(`/officials/${OFFICIAL_ID}#issue-positions:business-policy`)
  })

  it('hides chip row when chips is empty', () => {
    render(<BioHeader {...PELOSI} chips={[]} />)
    expect(screen.queryByText('Environment')).toBeNull()
    expect(screen.queryByText('Civil Rights')).toBeNull()
  })

  it('gracefully hides contact links when both missing', () => {
    render(<BioHeader {...PELOSI} officialUrl={null} twitterHandle={null} />)
    expect(screen.queryByText('pelosi.house.gov')).toBeNull()
    expect(screen.queryByText('@SpeakerPelosi')).toBeNull()
  })
})
