import { render, screen } from '@testing-library/react-native'
import { BioHeader } from '@/components/bio/BioHeader'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const PELOSI = {
  officialId: 'abc',
  fullName: 'Nancy Pelosi',
  portraitUrl: null,
  party: 'D',
  chamber: 'federal_house' as const,
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

describe('BioHeader', () => {
  it('renders house variant with district badge', () => {
    render(<BioHeader {...PELOSI} />)
    expect(screen.getByText('Nancy Pelosi')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    expect(screen.getByText("California's 11th District")).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
    expect(screen.getByText(/Since 2007/)).toBeTruthy()
  })
  it('senate variant uses full state name', () => {
    render(<BioHeader {...PELOSI} chamber="federal_senate" districtNumber={null} senateClass={1} role="Senator" />)
    expect(screen.getByText('California')).toBeTruthy()
    expect(screen.queryByText(/District/)).toBeNull()
  })
  it('at-large variant', () => {
    render(<BioHeader {...PELOSI} state="WY" stateName="Wyoming" districtNumber={null} atLarge={true} role="Representative" />)
    expect(screen.getByText("Wyoming's At-Large District")).toBeTruthy()
  })
  it('renders alignment chips when present', () => {
    const chips: AlignmentChipRow[] = [
      { issueArea: 'environment', displayLabel: 'Environment', tier: 'strongly-aligned', subCascadeSlug: 'environment' },
    ]
    render(<BioHeader {...PELOSI} chips={chips} />)
    expect(screen.getByText('Environment')).toBeTruthy()
  })
  it('hides contact links when both missing', () => {
    render(<BioHeader {...PELOSI} officialUrl={null} twitterHandle={null} />)
    expect(screen.queryByText('pelosi.house.gov')).toBeNull()
    expect(screen.queryByText('@SpeakerPelosi')).toBeNull()
  })
})
