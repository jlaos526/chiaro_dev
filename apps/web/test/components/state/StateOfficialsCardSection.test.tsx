import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OfficialWithDistrict } from '@chiaro/officials'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { StateOfficialsCardSection } from '@/components/state/StateOfficialsCardSection'

function mkState(
  chamber: OfficialWithDistrict['chamber'],
  fullName: string,
  id = 'oid-' + fullName,
): OfficialWithDistrict {
  return {
    id, full_name: fullName, first_name: '', last_name: '',
    bioguide_id: null, openstates_person_id: 'ocd-person/' + id,
    chamber, party: 'D', state: 'CA',
    district_id: 'did', district_code: '15', title: 'Assemblymember',
    senate_class: null, in_office: true, source_version: 'openstates',
    opensecrets_id: null, fec_candidate_id: null,
    district: { id: 'did', tier: 'state_house', state: 'CA', code: 'CA-15', name: 'CA-15' },
  } as unknown as OfficialWithDistrict
}

describe('StateOfficialsCardSection', () => {
  it('renders State heading + cards for each state official', () => {
    const officials = [
      mkState('state_house', 'Asm Test'),
      mkState('state_senate', 'Sen Test'),
    ]
    const { getByText } = render(<StateOfficialsCardSection officials={officials} />)
    expect(getByText('State')).toBeTruthy()
    expect(getByText('Asm Test')).toBeTruthy()
    expect(getByText('Sen Test')).toBeTruthy()
  })

  it('renders nothing when officials empty (DC user)', () => {
    const { container } = render(<StateOfficialsCardSection officials={[]} />)
    expect(container.querySelector('[data-testid="state-section"]')).toBeNull()
  })

  it('NE legislator labeled as State Senator (chamber=state_legislature)', () => {
    const ne = mkState('state_legislature', 'NE Test')
    ne.state = 'NE'
    ne.title = 'Senator'
    const { getByText } = render(<StateOfficialsCardSection officials={[ne]} />)
    expect(getByText('State Senator')).toBeTruthy()
  })

  it('tap routes to /state-officials/[id]', () => {
    mockPush.mockReset()
    const { getByText } = render(
      <StateOfficialsCardSection officials={[mkState('state_house', 'Asm Test', 'state-id-1')]} />,
    )
    fireEvent.click(getByText('Asm Test'))
    expect(mockPush).toHaveBeenCalledWith('/state-officials/state-id-1')
  })
})
