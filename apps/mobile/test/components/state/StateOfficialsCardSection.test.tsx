import { render, screen, fireEvent } from '@testing-library/react-native'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { StateOfficialsCardSection } from '@/components/state/StateOfficialsCardSection'
import type { OfficialWithDistrict } from '@chiaro/officials'

function mkState(chamber: OfficialWithDistrict['chamber'], fullName: string, id = 'oid-' + fullName) {
  return {
    id,
    full_name: fullName,
    chamber,
    party: 'D',
    state: 'CA',
    district_code: '15',
    title: 'Assemblymember',
    district: { id: 'did', tier: 'state_house', state: 'CA', code: 'CA-15', name: 'CA-15' },
  } as unknown as OfficialWithDistrict
}

describe('StateOfficialsCardSection', () => {
  beforeEach(() => mockPush.mockClear())

  it('renders heading + cards', () => {
    render(<StateOfficialsCardSection officials={[mkState('state_house', 'Asm Test')]} />)
    expect(screen.getByText('State')).toBeTruthy()
    expect(screen.getByText('Asm Test')).toBeTruthy()
  })

  it('renders nothing when empty', () => {
    render(<StateOfficialsCardSection officials={[]} />)
    expect(screen.queryByTestId('state-section')).toBeNull()
  })

  it('NE labeled State Senator', () => {
    const ne = mkState('state_legislature', 'NE Test')
    render(<StateOfficialsCardSection officials={[ne]} />)
    expect(screen.getByText('State Senator')).toBeTruthy()
  })

  it('tap routes to /state-officials/[id]', () => {
    render(<StateOfficialsCardSection officials={[mkState('state_house', 'Asm Test', 'state-id-1')]} />)
    fireEvent.press(screen.getByText('Asm Test'))
    expect(mockPush).toHaveBeenCalledWith('/state-officials/state-id-1')
  })
})
