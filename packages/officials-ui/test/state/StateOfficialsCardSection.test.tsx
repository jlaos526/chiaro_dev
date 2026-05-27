import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import type { OfficialWithDistrict } from '@chiaro/officials'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'
import { StateOfficialsCardSection } from '../../src/state/StateOfficialsCardSection.tsx'

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
    const { getByText } = render(
      <StateOfficialsCardSection officials={officials} onSelect={vi.fn()} />,
    )
    expect(getByText('State')).toBeTruthy()
    expect(getByText('Asm Test')).toBeTruthy()
    expect(getByText('Sen Test')).toBeTruthy()
  })

  it('renders nothing when officials empty (DC user)', () => {
    const { container } = render(
      <StateOfficialsCardSection officials={[]} onSelect={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('NE legislator labeled as State Senator (chamber=state_legislature)', () => {
    const ne = mkState('state_legislature', 'NE Test')
    ne.state = 'NE'
    ne.title = 'Senator'
    const { getByText } = render(
      <StateOfficialsCardSection officials={[ne]} onSelect={vi.fn()} />,
    )
    expect(getByText('State Senator')).toBeTruthy()
  })

  it('fires onSelect with officialId when row tapped', () => {
    const onSelect = vi.fn()
    const { getByText } = render(
      <StateOfficialsCardSection
        officials={[mkState('state_house', 'Asm Test', 'state-id-1')]}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(getByText('Asm Test'))
    expect(onSelect).toHaveBeenCalledWith({ officialId: 'state-id-1' })
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('StateOfficialsCardSection — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    const officials = [mkState('state_house', 'Asm Test')]
    const renderWith = (wrapper: typeof lightWrapper) =>
      render(
        <StateOfficialsCardSection officials={officials} onSelect={vi.fn()} />,
        { wrapper },
      )
    expect(() => renderWith(lightWrapper)).not.toThrow()
    expect(() => renderWith(darkWrapper)).not.toThrow()
  })
})
