import { render } from '@testing-library/react-native'

// The federal officials detail screen imports @chiaro/officials-ui (RNW source,
// outside jest's transform whitelist) so it must be mocked. We stub the heavy
// cards + BioHeader and capture the props handed to RepAlignmentSection, asserting
// the screen mounts the strip wired to the /issues flow. The strip's own UX is
// covered by RepAlignmentStrip.test.tsx in @chiaro/officials-ui (vitest + RNW).
// Top-level jest.mock (hoisted) — no resetModules (Gotcha #11).

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: 'fed-1' }),
  Redirect: () => null,
}))
jest.mock('expo-router/drawer', () => ({ Drawer: { Screen: () => null } }))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@chiaro/officials-ui/src/nav/BackButton.tsx', () => ({ BackButton: () => null }))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))
jest.mock('@/lib/derivations/alignment', () => ({ selectTopAlignmentChips: () => [] }))
jest.mock('@/lib/derivations/service-record', () => ({ firstElectedYear: () => null }))

jest.mock('@chiaro/officials', () => ({
  isStateLevel: () => false,
  STATE_NAMES: { CA: 'California' },
  useOfficial: () => ({
    isLoading: false,
    data: {
      id: 'fed-1',
      full_name: 'Test Rep',
      chamber: 'federal_house',
      party: 'D',
      state: 'CA',
      portrait_url: null,
      senate_class: null,
      official_url: null,
      twitter_handle: null,
      district: { code: 'CA-12' },
    },
  }),
  useOfficialScorecardRatings: () => ({ data: [] }),
  useOfficialLeadershipHistory: () => ({ data: [] }),
}))

let repSectionProps: { officialId?: string; repName?: string; onSetup?: () => void } | null = null
jest.mock('@chiaro/officials-ui', () => {
  const React = require('react')
  const { Text } = require('react-native')
  const stub = (label: string) => () => React.createElement(Text, null, label)
  return {
    BioHeader: stub('BioHeader'),
    FederalServiceRecordCard: stub('svc'),
    FederalCommunityPresenceCard: stub('comm'),
    FederalFinanceCard: stub('fin'),
    FederalIssuePositionsCard: stub('issue'),
    FederalEthicsAccountabilityCard: stub('ethics'),
    FederalVotingBillsCard: stub('voting'),
    RepAlignmentSection: (props: typeof repSectionProps) => {
      repSectionProps = props
      return React.createElement(Text, null, 'RepAlignmentSection')
    },
  }
})

import OfficialDetailScreen from '../app/(app)/officials/[id]'

describe('federal officials detail — rep alignment', () => {
  beforeEach(() => {
    repSectionProps = null
    mockPush.mockClear()
  })

  it('mounts RepAlignmentSection wired to /issues under the bio header', () => {
    const { getByText } = render(<OfficialDetailScreen />)
    expect(getByText('RepAlignmentSection')).toBeTruthy()
    expect(repSectionProps?.officialId).toBe('fed-1')
    expect(repSectionProps?.repName).toBe('Test Rep')
    repSectionProps?.onSetup?.()
    expect(mockPush).toHaveBeenCalledWith('/issues')
  })
})
