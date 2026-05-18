import { render, screen } from '@testing-library/react-native'
import { BioAlignmentChipRow } from '@/components/bio/BioAlignmentChipRow'
import type { AlignmentChipRow } from '@/lib/derivations/alignment'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const CHIPS: AlignmentChipRow[] = [
  { issueArea: 'environment', displayLabel: 'Environment', tier: 'strongly-aligned', subCascadeSlug: 'environment' },
  { issueArea: 'civil-rights', displayLabel: 'Civil Rights', tier: 'mostly-aligned', subCascadeSlug: 'civil-rights' },
]

describe('BioAlignmentChipRow', () => {
  it('renders chips', () => {
    render(<BioAlignmentChipRow chips={CHIPS} officialId="abc" />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('Civil Rights')).toBeTruthy()
  })
  it('renders null when chips empty', () => {
    const { toJSON } = render(<BioAlignmentChipRow chips={[]} officialId="abc" />)
    expect(toJSON()).toBeNull()
  })
})
